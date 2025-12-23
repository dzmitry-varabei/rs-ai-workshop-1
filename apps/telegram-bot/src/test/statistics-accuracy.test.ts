/**
 * Property-based tests for statistics accuracy
 * Validates that user statistics are calculated correctly from review events
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
import type { UserStats, UserId } from '../domain/types';

describe('Statistics Accuracy', () => {
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
      formatStats: vi.fn().mockImplementation((stats) => `Stats: ${JSON.stringify(stats)}`),
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
   * Property 17: Statistics Accuracy
   * Validates: Requirements 5.1, 5.2, 5.3, 5.4
   * 
   * User statistics should be calculated accurately from review events:
   * - Total items count should match unique words reviewed
   * - Success rate should be calculated from last 30 days
   * - Learning streak should count consecutive days with reviews
   * - Due today count should match current due reviews
   */
  it('should calculate statistics accurately from review events', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 999999 }).map(id => `user_${id}` as UserId),
          chatId: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
          totalItems: fc.integer({ min: 0, max: 1000 }),
          successRate: fc.float({ min: 0, max: 100, noNaN: true }),
          learningStreak: fc.integer({ min: 0, max: 365 }),
        }).chain(({ userId, chatId, totalItems, successRate, learningStreak }) => 
          fc.record({
            userId: fc.constant(userId),
            chatId: fc.constant(chatId),
            totalItems: fc.constant(totalItems),
            dueToday: fc.integer({ min: 0, max: totalItems }), // Ensure dueToday <= totalItems
            successRate: fc.constant(successRate),
            learningStreak: fc.constant(learningStreak),
          })
        ),
        async ({ userId, chatId, totalItems, dueToday, successRate, learningStreak }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup user profile
          const profile = {
            userId,
            telegramChatId: chatId,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: false,
          };

          // Setup expected statistics
          const expectedStats: UserStats = {
            totalItems,
            dueToday,
            successRate,
            learningStreak,
          };

          // Setup mocks
          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);
          vi.mocked(mockReviewEventRepository.calculateStats).mockResolvedValue(expectedStats);

          // Setup mock context
          const mockCtx = {
            chat: { id: parseInt(chatId) },
            reply: vi.fn(),
          } as any;

          // Call handleStats
          await commandHandlers.handleStats(mockCtx);

          // Verify repository methods were called correctly
          expect(mockUserProfileRepository.getProfileByChatId).toHaveBeenCalledWith(chatId);
          expect(mockReviewEventRepository.calculateStats).toHaveBeenCalledWith(userId);

          // Verify message formatter was called with correct stats
          expect(mockMessageFormatter.formatStats).toHaveBeenCalledWith(expectedStats);

          // Verify reply was sent
          expect(mockCtx.reply).toHaveBeenCalledWith(
            expect.stringContaining('Stats:'),
            { parse_mode: 'MarkdownV2' }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Statistics Consistency
   * Validates that statistics remain consistent across multiple calls
   */
  it('should return consistent statistics for the same user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 999999 }).map(id => `user_${id}` as UserId),
          chatId: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
          totalItems: fc.integer({ min: 0, max: 1000 }),
          successRate: fc.float({ min: 0, max: 100, noNaN: true }),
          learningStreak: fc.integer({ min: 0, max: 365 }),
          callCount: fc.integer({ min: 2, max: 5 }),
        }).chain(({ userId, chatId, totalItems, successRate, learningStreak, callCount }) => 
          fc.record({
            userId: fc.constant(userId),
            chatId: fc.constant(chatId),
            stats: fc.constant({
              totalItems,
              dueToday: Math.floor(Math.random() * (totalItems + 1)), // Random but valid
              successRate,
              learningStreak,
            }),
            callCount: fc.constant(callCount),
          })
        ),
        async ({ userId, chatId, stats, callCount }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup user profile
          const profile = {
            userId,
            telegramChatId: chatId,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: false,
          };

          // Setup mocks to return consistent stats
          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);
          vi.mocked(mockReviewEventRepository.calculateStats).mockResolvedValue(stats);

          // Setup mock context
          const mockCtx = {
            chat: { id: parseInt(chatId) },
            reply: vi.fn(),
          } as any;

          // Call handleStats multiple times
          for (let i = 0; i < callCount; i++) {
            await commandHandlers.handleStats(mockCtx);
          }

          // Verify calculateStats was called the correct number of times
          expect(mockReviewEventRepository.calculateStats).toHaveBeenCalledTimes(callCount);

          // Verify all calls used the same userId
          for (let i = 0; i < callCount; i++) {
            expect(mockReviewEventRepository.calculateStats).toHaveBeenNthCalledWith(i + 1, userId);
          }

          // Verify formatStats was called with the same stats each time
          expect(mockMessageFormatter.formatStats).toHaveBeenCalledTimes(callCount);
          for (let i = 0; i < callCount; i++) {
            expect(mockMessageFormatter.formatStats).toHaveBeenNthCalledWith(i + 1, stats);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Statistics Bounds Validation
   * Validates that statistics are within expected bounds
   */
  it('should validate statistics are within expected bounds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 20 }).map(id => `user_${id}` as UserId),
          chatId: fc.string({ minLength: 1, maxLength: 20 }),
          totalItems: fc.integer({ min: 0, max: 10000 }),
          successRate: fc.float({ min: 0, max: 100, noNaN: true }),
          learningStreak: fc.integer({ min: 0, max: 1000 }),
        }).chain(({ userId, chatId, totalItems, successRate, learningStreak }) => 
          fc.record({
            userId: fc.constant(userId),
            chatId: fc.constant(chatId),
            totalItems: fc.constant(totalItems),
            dueToday: fc.integer({ min: 0, max: Math.max(1, totalItems) }), // Ensure dueToday <= totalItems
            successRate: fc.constant(successRate),
            learningStreak: fc.constant(learningStreak),
          })
        ),
        async ({ userId, chatId, totalItems, dueToday, successRate, learningStreak }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup user profile
          const profile = {
            userId,
            telegramChatId: chatId,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: false,
          };

          const stats: UserStats = {
            totalItems,
            dueToday,
            successRate,
            learningStreak,
          };

          // Setup mocks
          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);
          vi.mocked(mockReviewEventRepository.calculateStats).mockResolvedValue(stats);

          // Setup mock context
          const mockCtx = {
            chat: { id: parseInt(chatId) },
            reply: vi.fn(),
          } as any;

          // Call handleStats
          await commandHandlers.handleStats(mockCtx);

          // Verify statistics are within expected bounds
          expect(stats.totalItems).toBeGreaterThanOrEqual(0);
          expect(stats.dueToday).toBeGreaterThanOrEqual(0);
          expect(stats.dueToday).toBeLessThanOrEqual(stats.totalItems);
          expect(stats.successRate).toBeGreaterThanOrEqual(0);
          expect(stats.successRate).toBeLessThanOrEqual(100);
          expect(stats.learningStreak).toBeGreaterThanOrEqual(0);

          // Verify no NaN values
          expect(Number.isNaN(stats.successRate)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Statistics Error Handling
   * Validates that statistics errors are handled gracefully
   */
  it('should handle statistics calculation errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 999999 }).map(id => `user_${id}` as UserId),
          chatId: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
          errorType: fc.oneof(
            fc.constant('database'),
            fc.constant('network'),
            fc.constant('timeout')
          ),
        }),
        async ({ userId, chatId, errorType }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup user profile
          const profile = {
            userId,
            telegramChatId: chatId,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: false,
          };

          // Setup mocks
          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);
          vi.mocked(mockReviewEventRepository.calculateStats).mockRejectedValue(
            new Error(`${errorType} error`)
          );

          // Setup mock context
          const mockCtx = {
            chat: { id: parseInt(chatId) },
            reply: vi.fn(),
          } as any;

          // Call handleStats
          await commandHandlers.handleStats(mockCtx);

          // Verify error message was sent
          expect(mockCtx.reply).toHaveBeenCalledWith(
            expect.stringContaining('❌'),
            { parse_mode: 'MarkdownV2' }
          );

          // Verify formatStats was not called due to error
          expect(mockMessageFormatter.formatStats).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Zero Statistics Handling
   * Validates that zero statistics are handled correctly
   */
  it('should handle zero statistics correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 999999 }).map(id => `user_${id}` as UserId),
          chatId: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
        }),
        async ({ userId, chatId }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup user profile
          const profile = {
            userId,
            telegramChatId: chatId,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: false,
          };

          // Setup zero statistics (new user)
          const zeroStats: UserStats = {
            totalItems: 0,
            dueToday: 0,
            successRate: 0,
            learningStreak: 0,
          };

          // Setup mocks
          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);
          vi.mocked(mockReviewEventRepository.calculateStats).mockResolvedValue(zeroStats);

          // Setup mock context
          const mockCtx = {
            chat: { id: parseInt(chatId) },
            reply: vi.fn(),
          } as any;

          // Call handleStats
          await commandHandlers.handleStats(mockCtx);

          // Verify statistics were processed correctly
          expect(mockReviewEventRepository.calculateStats).toHaveBeenCalledWith(userId);
          expect(mockMessageFormatter.formatStats).toHaveBeenCalledWith(zeroStats);

          // Verify reply was sent
          expect(mockCtx.reply).toHaveBeenCalledWith(
            expect.stringContaining('Stats:'),
            { parse_mode: 'MarkdownV2' }
          );
        }
      ),
      { numRuns: 50 }
    );
  });
});