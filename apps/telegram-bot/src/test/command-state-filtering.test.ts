/**
 * Property-based tests for command state filtering
 * Validates that commands are properly filtered based on user state (linked/unlinked, paused/active)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { CommandHandlers } from '../handlers/CommandHandlers';
import type {
  AccountLinker,
  MessageFormatter,
  UserProfileRepository,
  ReviewEventRepository,
  DueReviewSelector,
} from '../domain/interfaces';
import type { UserProfile, UserId } from '../domain/types';

describe('Command State Filtering', () => {
  let commandHandlers: CommandHandlers;
  let mockAccountLinker: AccountLinker;
  let mockMessageFormatter: MessageFormatter;
  let mockUserProfileRepository: UserProfileRepository;
  let mockReviewEventRepository: ReviewEventRepository;
  let mockDueReviewSelector: DueReviewSelector;

  beforeEach(() => {
    mockAccountLinker = {
      validateLinkCode: vi.fn(),
      linkAccount: vi.fn(),
      recordLinkAttempt: vi.fn(),
      isRateLimited: vi.fn(),
      getFailedAttempts: vi.fn(),
    };

    mockMessageFormatter = {
      formatReview: vi.fn(),
      formatStats: vi.fn(),
      formatWelcome: vi.fn(),
      formatHelp: vi.fn(),
      formatSettings: vi.fn(),
      escapeMarkdownV2: vi.fn(),
      createDifficultyKeyboard: vi.fn(),
      formatError: vi.fn().mockImplementation((msg) => `❌ ${msg}`),
      formatSuccess: vi.fn().mockImplementation((msg) => `✅ ${msg}`),
      formatLinkInstructions: vi.fn(),
      formatPauseConfirmation: vi.fn(),
      formatResumeConfirmation: vi.fn(),
      formatCallbackAck: vi.fn(),
    } as any;

    mockUserProfileRepository = {
      getProfile: vi.fn(),
      getProfileByChatId: vi.fn(),
      updateProfile: vi.fn(),
      setPaused: vi.fn(),
    };

    mockReviewEventRepository = {
      recordEvent: vi.fn(),
      getEvents: vi.fn(),
      calculateStats: vi.fn(),
    };

    mockDueReviewSelector = {
      getDueReviews: vi.fn(),
      getUserDueReviews: vi.fn(),
      isWithinDeliveryWindow: vi.fn(),
      hasReachedDailyLimit: vi.fn(),
    };

    commandHandlers = new CommandHandlers(
      mockAccountLinker,
      mockMessageFormatter,
      mockUserProfileRepository,
      mockReviewEventRepository,
      mockDueReviewSelector
    );
  });

  /**
   * Property 22: Command State Filtering
   * Validates: Requirements 8.6
   * 
   * Commands should be properly filtered based on user state:
   * - Unlinked users can only use: start, help, link
   * - Linked users can use all commands
   * - Paused state doesn't restrict command access (only affects automatic delivery)
   */
  it('should filter commands based on user link state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          chatId: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
          command: fc.oneof(
            fc.constant('start'),
            fc.constant('help'), 
            fc.constant('link'),
            fc.constant('stats'),
            fc.constant('pause'),
            fc.constant('resume'),
            fc.constant('settings')
          ),
          isLinked: fc.boolean(),
          isPaused: fc.boolean(),
        }),
        async ({ chatId, command, isLinked, isPaused }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup mock context
          const mockCtx = {
            chat: { id: parseInt(chatId) },
          } as any;

          // Setup user profile mock
          const profile: UserProfile | null = isLinked ? {
            userId: `user_${chatId}` as UserId,
            telegramChatId: chatId,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: isPaused,
          } : null;

          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);

          // Test command filtering
          const allowed = await commandHandlers.filterCommand(command, mockCtx);

          // Define expected behavior
          const unlinkedCommands = ['start', 'help', 'link'];
          const expectedAllowed = isLinked || unlinkedCommands.includes(command);

          expect(allowed).toBe(expectedAllowed);

          // Verify repository was called correctly
          expect(mockUserProfileRepository.getProfileByChatId).toHaveBeenCalledWith(chatId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Paused State Command Access
   * Validates that paused users can still access all commands
   * (pause only affects automatic review delivery, not manual commands)
   */
  it('should allow all commands for paused but linked users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          chatId: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
          command: fc.oneof(
            fc.constant('start'),
            fc.constant('help'),
            fc.constant('link'),
            fc.constant('stats'),
            fc.constant('pause'),
            fc.constant('resume'),
            fc.constant('settings')
          ),
        }),
        async ({ chatId, command }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup mock context
          const mockCtx = {
            chat: { id: parseInt(chatId) },
          } as any;

          // Setup paused but linked user
          const profile: UserProfile = {
            userId: `user_${chatId}` as UserId,
            telegramChatId: chatId,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: true, // User is paused
          };

          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);

          // Test command filtering
          const allowed = await commandHandlers.filterCommand(command, mockCtx);

          // All commands should be allowed for linked users, even when paused
          expect(allowed).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Invalid Chat ID Handling
   * Validates that commands are rejected for invalid chat IDs
   */
  it('should reject commands for invalid chat IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          command: fc.oneof(
            fc.constant('start'),
            fc.constant('help'),
            fc.constant('link'),
            fc.constant('stats'),
            fc.constant('pause'),
            fc.constant('resume'),
            fc.constant('settings')
          ),
          hasChat: fc.boolean(),
          chatId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
        }),
        async ({ command, hasChat, chatId }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup mock context with potentially invalid chat
          const mockCtx = {
            chat: hasChat && chatId ? { id: parseInt(chatId) } : undefined,
          } as any;

          // Test command filtering
          const allowed = await commandHandlers.filterCommand(command, mockCtx);

          const isValidChatId = hasChat && chatId && chatId.trim() !== '' && !isNaN(parseInt(chatId));
          
          if (!isValidChatId) {
            // Should reject commands for invalid chat IDs
            expect(allowed).toBe(false);
            // Repository should not be called for invalid chat IDs
            expect(mockUserProfileRepository.getProfileByChatId).not.toHaveBeenCalled();
          } else {
            // Should process normally for valid chat IDs
            expect(mockUserProfileRepository.getProfileByChatId).toHaveBeenCalledWith(chatId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Command Case Sensitivity
   * Validates that command filtering is case-sensitive
   */
  it('should handle command case sensitivity correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          chatId: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
          baseCommand: fc.oneof(
            fc.constant('start'),
            fc.constant('help'),
            fc.constant('link')
          ),
          caseVariation: fc.oneof(
            fc.constant('upper'),
            fc.constant('lower'),
            fc.constant('mixed')
          ),
        }),
        async ({ chatId, baseCommand, caseVariation }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Apply case variation
          let command = baseCommand;
          if (caseVariation === 'upper') {
            command = baseCommand.toUpperCase();
          } else if (caseVariation === 'mixed') {
            command = baseCommand.charAt(0).toUpperCase() + baseCommand.slice(1);
          }

          // Setup mock context
          const mockCtx = {
            chat: { id: parseInt(chatId) },
          } as any;

          // Setup unlinked user (so only start, help, link should work)
          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(null);

          // Test command filtering
          const allowed = await commandHandlers.filterCommand(command, mockCtx);

          // Only lowercase versions should be allowed for unlinked users
          const expectedAllowed = caseVariation === 'lower';
          expect(allowed).toBe(expectedAllowed);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Repository Error Handling
   * Validates that repository errors are handled gracefully in command filtering
   */
  it('should handle repository errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          chatId: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
          command: fc.oneof(
            fc.constant('start'),
            fc.constant('help'),
            fc.constant('link'),
            fc.constant('stats')
          ),
          errorType: fc.oneof(
            fc.constant('network'),
            fc.constant('database'),
            fc.constant('timeout')
          ),
        }),
        async ({ chatId, command, errorType }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup mock context
          const mockCtx = {
            chat: { id: parseInt(chatId) },
          } as any;

          // Setup repository to throw error
          const error = new Error(`${errorType} error`);
          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockRejectedValue(error);

          // Test command filtering with error
          const allowed = await commandHandlers.filterCommand(command, mockCtx);

          // Should default to false (deny access) when repository fails
          expect(allowed).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });
});