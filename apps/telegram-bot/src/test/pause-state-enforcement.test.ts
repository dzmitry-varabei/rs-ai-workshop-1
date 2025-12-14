/**
 * Property-based tests for pause state enforcement
 * Validates that pause/resume functionality works correctly and enforces proper state transitions
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
import type { UserProfile, UserId, ScheduledReview } from '../domain/types';

describe('Pause State Enforcement', () => {
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
      formatPauseConfirmation: vi.fn().mockReturnValue('⏸️ Learning paused'),
      formatResumeConfirmation: vi.fn().mockImplementation((count) => `▶️ Learning resumed (${count} overdue)`),
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
   * Property 18: Pause State Enforcement
   * Validates: Requirements 6.2
   * 
   * Pause/resume functionality should enforce proper state transitions:
   * - Can only pause when not already paused
   * - Can only resume when currently paused
   * - State changes should be persisted to database
   * - Appropriate confirmation messages should be sent
   */
  it('should enforce proper pause state transitions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 999999 }).map(id => `user_${id}` as UserId),
          chatId: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
          initialPausedState: fc.boolean(),
          action: fc.oneof(fc.constant('pause'), fc.constant('resume')),
        }),
        async ({ userId, chatId, initialPausedState, action }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup user profile with initial pause state
          const profile: UserProfile = {
            userId,
            telegramChatId: chatId,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: initialPausedState,
          };

          // Setup mock context
          const mockCtx = {
            chat: { id: parseInt(chatId) },
            reply: vi.fn(),
          } as any;

          // Setup mocks
          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);
          vi.mocked(mockUserProfileRepository.setPaused).mockResolvedValue();

          // For resume action, setup overdue reviews
          const overdueReviews: ScheduledReview[] = [];
          if (action === 'resume') {
            // Generate some overdue reviews
            for (let i = 0; i < 3; i++) {
              overdueReviews.push({
                userId,
                wordId: `word_${i}` as any,
                scheduledFor: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
                reviewCount: i + 1,
                state: 'due',
              });
            }
            vi.mocked(mockDueReviewSelector.getUserDueReviews).mockResolvedValue(overdueReviews);
          }

          // Execute the action
          if (action === 'pause') {
            await commandHandlers.handlePause(mockCtx);
          } else {
            await commandHandlers.handleResume(mockCtx);
          }

          // Determine expected behavior
          const shouldSucceed = (action === 'pause' && !initialPausedState) || 
                               (action === 'resume' && initialPausedState);
          


          if (shouldSucceed) {
            // Should update the pause state
            const newPausedState = action === 'pause';
            expect(mockUserProfileRepository.setPaused).toHaveBeenCalledWith(userId, newPausedState);

            // Should send confirmation message
            if (action === 'pause') {
              expect(mockMessageFormatter.formatPauseConfirmation).toHaveBeenCalled();
            } else {
              expect(mockMessageFormatter.formatResumeConfirmation).toHaveBeenCalledWith(overdueReviews.length);
            }

            // Should reply with success message
            expect(mockCtx.reply).toHaveBeenCalledWith(
              expect.stringContaining(action === 'pause' ? '⏸️' : '▶️'),
              { parse_mode: 'MarkdownV2' }
            );
          } else {
            // Should not update the pause state
            expect(mockUserProfileRepository.setPaused).not.toHaveBeenCalled();

            // Should send error message
            expect(mockCtx.reply).toHaveBeenCalledWith(
              expect.stringContaining('❌'),
              { parse_mode: 'MarkdownV2' }
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Pause State Idempotency
   * Validates that pause/resume operations are idempotent
   */
  it('should handle idempotent pause/resume operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 999999 }).map(id => `user_${id}` as UserId),
          chatId: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
          action: fc.oneof(fc.constant('pause'), fc.constant('resume')),
          repeatCount: fc.integer({ min: 2, max: 5 }),
        }),
        async ({ userId, chatId, action, repeatCount }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup user profile with opposite state to the action
          const initialPausedState = action === 'resume'; // If resuming, start paused
          const profile: UserProfile = {
            userId,
            telegramChatId: chatId,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: initialPausedState,
          };

          // Setup mock context
          const mockCtx = {
            chat: { id: parseInt(chatId) },
            reply: vi.fn(),
          } as any;

          // Setup mocks
          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);
          vi.mocked(mockUserProfileRepository.setPaused).mockResolvedValue();
          vi.mocked(mockDueReviewSelector.getUserDueReviews).mockResolvedValue([]);

          // Execute the action multiple times
          for (let i = 0; i < repeatCount; i++) {
            if (action === 'pause') {
              await commandHandlers.handlePause(mockCtx);
            } else {
              await commandHandlers.handleResume(mockCtx);
            }

            // After first successful call, update the profile state for subsequent calls
            if (i === 0) {
              profile.paused = action === 'pause';
              // Update the mock to return the updated profile
              vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);
            }
          }

          // Should only update state once (first call)
          expect(mockUserProfileRepository.setPaused).toHaveBeenCalledTimes(1);
          expect(mockUserProfileRepository.setPaused).toHaveBeenCalledWith(userId, action === 'pause');

          // Should reply to all calls, but only first should be success
          expect(mockCtx.reply).toHaveBeenCalledTimes(repeatCount);

          // First call should be success, rest should be errors
          expect(mockCtx.reply).toHaveBeenNthCalledWith(1, 
            expect.stringContaining(action === 'pause' ? '⏸️' : '▶️'),
            { parse_mode: 'MarkdownV2' }
          );

          for (let i = 2; i <= repeatCount; i++) {
            expect(mockCtx.reply).toHaveBeenNthCalledWith(i,
              expect.stringContaining('❌'),
              { parse_mode: 'MarkdownV2' }
            );
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Resume Overdue Count Accuracy
   * Validates that resume shows accurate count of overdue reviews
   */
  it('should show accurate overdue count when resuming', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 999999 }).map(id => `user_${id}` as UserId),
          chatId: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
          overdueCount: fc.integer({ min: 0, max: 50 }),
        }),
        async ({ userId, chatId, overdueCount }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup paused user profile
          const profile: UserProfile = {
            userId,
            telegramChatId: chatId,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: true, // User is paused
          };

          // Generate overdue reviews
          const overdueReviews: ScheduledReview[] = [];
          for (let i = 0; i < overdueCount; i++) {
            overdueReviews.push({
              userId,
              wordId: `word_${i}` as any,
              scheduledFor: new Date(Date.now() - (i + 1) * 60 * 60 * 1000), // Hours ago
              reviewCount: i + 1,
              state: 'due',
            });
          }

          // Setup mock context
          const mockCtx = {
            chat: { id: parseInt(chatId) },
            reply: vi.fn(),
          } as any;

          // Setup mocks
          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);
          vi.mocked(mockUserProfileRepository.setPaused).mockResolvedValue();
          vi.mocked(mockDueReviewSelector.getUserDueReviews).mockResolvedValue(overdueReviews);

          // Execute resume
          await commandHandlers.handleResume(mockCtx);

          // Should update pause state
          expect(mockUserProfileRepository.setPaused).toHaveBeenCalledWith(userId, false);

          // Should get user due reviews
          expect(mockDueReviewSelector.getUserDueReviews).toHaveBeenCalledWith(userId);

          // Should format resume confirmation with correct overdue count
          expect(mockMessageFormatter.formatResumeConfirmation).toHaveBeenCalledWith(overdueCount);

          // Should reply with resume message
          expect(mockCtx.reply).toHaveBeenCalledWith(
            expect.stringContaining('▶️'),
            { parse_mode: 'MarkdownV2' }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Database Error Handling
   * Validates that database errors during pause/resume are handled gracefully
   */
  it('should handle database errors during pause/resume gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 999999 }).map(id => `user_${id}` as UserId),
          chatId: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
          action: fc.oneof(fc.constant('pause'), fc.constant('resume')),
          errorType: fc.oneof(
            fc.constant('database'),
            fc.constant('network'),
            fc.constant('timeout')
          ),
        }),
        async ({ userId, chatId, action, errorType }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup user profile with appropriate initial state
          const profile: UserProfile = {
            userId,
            telegramChatId: chatId,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: action === 'resume', // Opposite of action for valid state transition
          };

          // Setup mock context
          const mockCtx = {
            chat: { id: parseInt(chatId) },
            reply: vi.fn(),
          } as any;

          // Setup mocks
          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);
          vi.mocked(mockUserProfileRepository.setPaused).mockRejectedValue(
            new Error(`${errorType} error`)
          );
          vi.mocked(mockDueReviewSelector.getUserDueReviews).mockResolvedValue([]);

          // Execute the action
          if (action === 'pause') {
            await commandHandlers.handlePause(mockCtx);
          } else {
            await commandHandlers.handleResume(mockCtx);
          }

          // Should attempt to update pause state
          expect(mockUserProfileRepository.setPaused).toHaveBeenCalledWith(userId, action === 'pause');

          // Should send error message due to database failure
          expect(mockCtx.reply).toHaveBeenCalledWith(
            expect.stringContaining('❌'),
            { parse_mode: 'MarkdownV2' }
          );

          // Should not send confirmation message due to error
          if (action === 'pause') {
            expect(mockMessageFormatter.formatPauseConfirmation).not.toHaveBeenCalled();
          } else {
            expect(mockMessageFormatter.formatResumeConfirmation).not.toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});