/**
 * Property-based tests for duplicate callback handling
 * Validates that duplicate callback queries are handled with proper idempotency
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { CallbackHandlers } from '../handlers/CallbackHandlers';
import type {
  ReviewProcessor,
  MessageFormatter,
  UserProfileRepository,
} from '../domain/interfaces';
import type { Difficulty, UserId, WordId, UserProfile } from '../domain/types';

describe('Duplicate Callback Handling', () => {
  let callbackHandlers: CallbackHandlers;
  let mockReviewProcessor: ReviewProcessor;
  let mockMessageFormatter: MessageFormatter;
  let mockUserProfileRepository: UserProfileRepository;

  beforeEach(() => {
    mockReviewProcessor = {
      processCallback: vi.fn(),
      processTimeouts: vi.fn(),
      scheduleNextReview: vi.fn(),
      calculateInterval: vi.fn(),
    };

    mockMessageFormatter = {
      formatReview: vi.fn(),
      formatStats: vi.fn(),
      formatWelcome: vi.fn(),
      formatHelp: vi.fn(),
      formatSettings: vi.fn(),
      escapeMarkdownV2: vi.fn(),
      createDifficultyKeyboard: vi.fn(),
      formatCallbackAck: vi.fn().mockImplementation((difficulty) => `Rated as: ${difficulty}`),
    } as any;

    mockUserProfileRepository = {
      getProfile: vi.fn(),
      getProfileByChatId: vi.fn(),
      updateProfile: vi.fn(),
      setPaused: vi.fn(),
    };

    callbackHandlers = new CallbackHandlers(
      mockReviewProcessor,
      mockMessageFormatter,
      mockUserProfileRepository
    );
  });

  /**
   * Property 12: Duplicate Callback Handling
   * Validates: Requirements 3.6
   * 
   * Duplicate callback queries should be handled with idempotency:
   * - First callback should be processed normally
   * - Subsequent identical callbacks should be rejected
   * - No side effects should occur from duplicate processing
   * - Appropriate "already processed" message should be sent
   */
  it('should handle duplicate callbacks with idempotency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 999999 }).map(id => `user_${id}` as UserId),
          wordId: fc.integer({ min: 1, max: 999999 }).map(id => `word_${id}` as WordId),
          chatId: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
          messageId: fc.integer({ min: 1, max: 999999 }).map(id => id.toString()),
          difficulty: fc.oneof(
            fc.constant('hard' as Difficulty),
            fc.constant('normal' as Difficulty),
            fc.constant('good' as Difficulty),
            fc.constant('easy' as Difficulty)
          ),
          duplicateCount: fc.integer({ min: 2, max: 5 }),
        }),
        async ({ userId, wordId, chatId, messageId, difficulty, duplicateCount }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup linked and authorized user
          const profile: UserProfile = {
            userId,
            telegramChatId: chatId,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: false,
          };

          const callbackData = `difficulty:${userId}:${wordId}:${difficulty}`;

          // Setup mocks - first call succeeds, subsequent calls fail (already processed)
          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);
          vi.mocked(mockReviewProcessor.processCallback)
            .mockResolvedValueOnce(true)  // First call succeeds
            .mockResolvedValue(false);    // Subsequent calls fail (already processed)

          // Create multiple identical callback contexts
          const mockContexts = Array.from({ length: duplicateCount }, () => ({
            callbackQuery: {
              data: callbackData,
              message: { message_id: parseInt(messageId) }
            },
            chat: { id: parseInt(chatId) },
            answerCbQuery: vi.fn(),
            editMessageReplyMarkup: vi.fn(),
            reply: vi.fn(),
          })) as any[];

          // Execute callback handling multiple times
          for (const mockCtx of mockContexts) {
            await callbackHandlers.handleCallbackQuery(mockCtx);
          }

          // Should call processCallback for each attempt
          expect(mockReviewProcessor.processCallback).toHaveBeenCalledTimes(duplicateCount);

          // All calls should use the same parameters
          for (let i = 0; i < duplicateCount; i++) {
            expect(mockReviewProcessor.processCallback).toHaveBeenNthCalledWith(
              i + 1,
              userId,
              wordId,
              messageId,
              difficulty
            );
          }

          // First context should get success acknowledgment
          expect(mockContexts[0].answerCbQuery).toHaveBeenCalledWith(`Rated as: ${difficulty}`);
          expect(mockContexts[0].editMessageReplyMarkup).toHaveBeenCalledWith({ inline_keyboard: [] });

          // Subsequent contexts should get "already processed" message
          for (let i = 1; i < duplicateCount; i++) {
            expect(mockContexts[i].answerCbQuery).toHaveBeenCalledWith('This review has already been processed');
            expect(mockContexts[i].editMessageReplyMarkup).not.toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Concurrent Callback Handling
   * Validates that concurrent callbacks for the same review are handled correctly
   */
  it('should handle concurrent callbacks correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 999999 }).map(id => `user_${id}` as UserId),
          wordId: fc.integer({ min: 1, max: 999999 }).map(id => `word_${id}` as WordId),
          chatId: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
          messageId: fc.integer({ min: 1, max: 999999 }).map(id => id.toString()),
          difficulty: fc.oneof(
            fc.constant('hard' as Difficulty),
            fc.constant('normal' as Difficulty),
            fc.constant('good' as Difficulty),
            fc.constant('easy' as Difficulty)
          ),
          concurrentCount: fc.integer({ min: 2, max: 4 }),
        }),
        async ({ userId, wordId, chatId, messageId, difficulty, concurrentCount }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup linked and authorized user
          const profile: UserProfile = {
            userId,
            telegramChatId: chatId,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: false,
          };

          const callbackData = `difficulty:${userId}:${wordId}:${difficulty}`;

          // Setup mocks - only one call should succeed due to atomic processing
          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);
          vi.mocked(mockReviewProcessor.processCallback)
            .mockResolvedValueOnce(true)  // First call succeeds
            .mockResolvedValue(false);    // Subsequent calls fail

          // Create multiple concurrent callback contexts
          const mockContexts = Array.from({ length: concurrentCount }, () => ({
            callbackQuery: {
              data: callbackData,
              message: { message_id: parseInt(messageId) }
            },
            chat: { id: parseInt(chatId) },
            answerCbQuery: vi.fn(),
            editMessageReplyMarkup: vi.fn(),
            reply: vi.fn(),
          })) as any[];

          // Execute callbacks concurrently
          await Promise.all(
            mockContexts.map(ctx => callbackHandlers.handleCallbackQuery(ctx))
          );

          // Should call processCallback for each attempt
          expect(mockReviewProcessor.processCallback).toHaveBeenCalledTimes(concurrentCount);

          // Should have exactly one success and rest failures
          let successCount = 0;
          let failureCount = 0;

          for (const mockCtx of mockContexts) {
            const calls = vi.mocked(mockCtx.answerCbQuery).mock.calls;
            if (calls.some(call => call[0].includes('Rated as:'))) {
              successCount++;
            } else if (calls.some(call => call[0].includes('already been processed'))) {
              failureCount++;
            }
          }

          // Should have exactly one success (due to atomic processing)
          expect(successCount).toBe(1);
          expect(failureCount).toBe(concurrentCount - 1);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Invalid Message ID Handling
   * Validates that callbacks with invalid message IDs are handled correctly
   */
  it('should handle invalid message IDs correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 999999 }).map(id => `user_${id}` as UserId),
          wordId: fc.integer({ min: 1, max: 999999 }).map(id => `word_${id}` as WordId),
          chatId: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
          difficulty: fc.oneof(
            fc.constant('hard' as Difficulty),
            fc.constant('normal' as Difficulty),
            fc.constant('good' as Difficulty),
            fc.constant('easy' as Difficulty)
          ),
          hasMessageId: fc.boolean(),
        }),
        async ({ userId, wordId, chatId, difficulty, hasMessageId }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup linked and authorized user
          const profile: UserProfile = {
            userId,
            telegramChatId: chatId,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: false,
          };

          const callbackData = `difficulty:${userId}:${wordId}:${difficulty}`;

          // Setup mocks
          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);

          // Setup mock context with potentially missing message ID
          const mockCtx = {
            callbackQuery: {
              data: callbackData,
              message: hasMessageId ? { message_id: 123 } : {}
            },
            chat: { id: parseInt(chatId) },
            answerCbQuery: vi.fn(),
            editMessageReplyMarkup: vi.fn(),
            reply: vi.fn(),
          } as any;

          // Execute callback handling
          await callbackHandlers.handleCallbackQuery(mockCtx);

          if (!hasMessageId) {
            // Should reject callbacks without message ID
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Unable to identify message');
            expect(mockReviewProcessor.processCallback).not.toHaveBeenCalled();
          } else {
            // Should process callbacks with valid message ID
            expect(mockReviewProcessor.processCallback).toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Callback Data Format Validation
   * Validates that various callback data formats are handled correctly
   */
  it('should validate callback data formats correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Valid format
          fc.record({
            format: fc.constant('valid'),
            data: fc.record({
              userId: fc.integer({ min: 1, max: 999999 }).map(id => `user_${id}`),
              wordId: fc.integer({ min: 1, max: 999999 }).map(id => `word_${id}`),
              difficulty: fc.oneof(fc.constant('hard'), fc.constant('normal'), fc.constant('good'), fc.constant('easy')),
            }).map(({ userId, wordId, difficulty }) => `difficulty:${userId}:${wordId}:${difficulty}`)
          }),
          // Invalid formats
          fc.record({
            format: fc.constant('invalid'),
            data: fc.oneof(
              fc.constant(''),                           // Empty string
              fc.constant('difficulty'),                 // Too few parts
              fc.constant('difficulty:user:word'),       // Missing difficulty
              fc.constant('difficulty:user:word:invalid:extra'), // Too many parts
              fc.constant('invalid:user:word:hard'),     // Wrong type
              fc.constant('difficulty:user:word:invalid'), // Invalid difficulty
              fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes(':')), // No colons
            )
          })
        ),
        async ({ format, data }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          const chatId = '123456789';
          
          // Extract userId from callback data to ensure consistency
          const parts = data.split(':');
          const userId = (format === 'valid' && parts.length >= 2) ? parts[1] as UserId : 'user_123' as UserId;

          // Setup linked and authorized user
          const profile: UserProfile = {
            userId,
            telegramChatId: chatId,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: false,
          };

          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);
          vi.mocked(mockReviewProcessor.processCallback).mockResolvedValue(true);

          // Setup mock context
          const mockCtx = {
            callbackQuery: {
              data,
              message: { message_id: 123 }
            },
            chat: { id: parseInt(chatId) },
            answerCbQuery: vi.fn(),
            editMessageReplyMarkup: vi.fn(),
            reply: vi.fn(),
          } as any;

          // Execute callback handling
          await callbackHandlers.handleCallbackQuery(mockCtx);

          if (format === 'valid') {
            // Should process valid callback data
            expect(mockReviewProcessor.processCallback).toHaveBeenCalled();
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(expect.stringContaining('Rated as:'));
          } else {
            // Should reject invalid callback data
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(
              expect.stringMatching(/Invalid callback data|Unknown callback type|Unauthorized callback/)
            );
            expect(mockReviewProcessor.processCallback).not.toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Idempotent Processing
   * Validates that processing the same callback multiple times is idempotent
   */
  it('should ensure idempotent processing of identical callbacks', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 999999 }).map(id => `user_${id}` as UserId),
          wordId: fc.integer({ min: 1, max: 999999 }).map(id => `word_${id}` as WordId),
          chatId: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
          messageId: fc.integer({ min: 1, max: 999999 }).map(id => id.toString()),
          difficulty: fc.oneof(
            fc.constant('hard' as Difficulty),
            fc.constant('normal' as Difficulty),
            fc.constant('good' as Difficulty),
            fc.constant('easy' as Difficulty)
          ),
          repeatCount: fc.integer({ min: 2, max: 6 }),
        }),
        async ({ userId, wordId, chatId, messageId, difficulty, repeatCount }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup linked and authorized user
          const profile: UserProfile = {
            userId,
            telegramChatId: chatId,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: false,
          };

          const callbackData = `difficulty:${userId}:${wordId}:${difficulty}`;

          // Setup mocks - simulate idempotent behavior
          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);
          
          // First call succeeds, subsequent calls return false (already processed)
          const processCallbackMock = vi.mocked(mockReviewProcessor.processCallback);
          processCallbackMock.mockResolvedValueOnce(true);
          for (let i = 1; i < repeatCount; i++) {
            processCallbackMock.mockResolvedValueOnce(false);
          }

          // Execute the same callback multiple times
          const results = [];
          for (let i = 0; i < repeatCount; i++) {
            const mockCtx = {
              callbackQuery: {
                data: callbackData,
                message: { message_id: parseInt(messageId) }
              },
              chat: { id: parseInt(chatId) },
              answerCbQuery: vi.fn(),
              editMessageReplyMarkup: vi.fn(),
              reply: vi.fn(),
            } as any;

            await callbackHandlers.handleCallbackQuery(mockCtx);
            results.push(mockCtx);
          }

          // Should call processCallback for each attempt
          expect(mockReviewProcessor.processCallback).toHaveBeenCalledTimes(repeatCount);

          // First call should succeed
          expect(results[0].answerCbQuery).toHaveBeenCalledWith(`Rated as: ${difficulty}`);
          expect(results[0].editMessageReplyMarkup).toHaveBeenCalledWith({ inline_keyboard: [] });

          // Subsequent calls should be rejected as duplicates
          for (let i = 1; i < repeatCount; i++) {
            expect(results[i].answerCbQuery).toHaveBeenCalledWith('This review has already been processed');
            expect(results[i].editMessageReplyMarkup).not.toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Cross-User Callback Isolation
   * Validates that callbacks from different users don't interfere with each other
   */
  it('should isolate callbacks between different users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user1Id: fc.integer({ min: 1, max: 999999 }).map(id => `user_${id}` as UserId),
          user2Id: fc.integer({ min: 1, max: 999999 }).map(id => `user_${id + 1000000}` as UserId),
          wordId: fc.integer({ min: 1, max: 999999 }).map(id => `word_${id}` as WordId),
          chatId1: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
          chatId2: fc.integer({ min: 1, max: 999999999 }).map(id => (id + 1000000000).toString()),
          messageId: fc.integer({ min: 1, max: 999999 }).map(id => id.toString()),
          difficulty: fc.oneof(
            fc.constant('hard' as Difficulty),
            fc.constant('normal' as Difficulty),
            fc.constant('good' as Difficulty),
            fc.constant('easy' as Difficulty)
          ),
        }),
        async ({ user1Id, user2Id, wordId, chatId1, chatId2, messageId, difficulty }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup two different user profiles
          const profile1: UserProfile = {
            userId: user1Id,
            telegramChatId: chatId1,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: false,
          };

          const profile2: UserProfile = {
            userId: user2Id,
            telegramChatId: chatId2,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: false,
          };

          // Setup callback data for each user
          const callbackData1 = `difficulty:${user1Id}:${wordId}:${difficulty}`;
          const callbackData2 = `difficulty:${user2Id}:${wordId}:${difficulty}`;

          // Setup mocks
          vi.mocked(mockUserProfileRepository.getProfileByChatId)
            .mockImplementation(async (chatId) => {
              if (chatId === chatId1) return profile1;
              if (chatId === chatId2) return profile2;
              return null;
            });
          vi.mocked(mockReviewProcessor.processCallback).mockResolvedValue(true);

          // Create contexts for both users
          const mockCtx1 = {
            callbackQuery: {
              data: callbackData1,
              message: { message_id: parseInt(messageId) }
            },
            chat: { id: parseInt(chatId1) },
            answerCbQuery: vi.fn(),
            editMessageReplyMarkup: vi.fn(),
            reply: vi.fn(),
          } as any;

          const mockCtx2 = {
            callbackQuery: {
              data: callbackData2,
              message: { message_id: parseInt(messageId) }
            },
            chat: { id: parseInt(chatId2) },
            answerCbQuery: vi.fn(),
            editMessageReplyMarkup: vi.fn(),
            reply: vi.fn(),
          } as any;

          // Execute callbacks for both users
          await callbackHandlers.handleCallbackQuery(mockCtx1);
          await callbackHandlers.handleCallbackQuery(mockCtx2);

          // Should process both callbacks independently
          expect(mockReviewProcessor.processCallback).toHaveBeenCalledTimes(2);
          expect(mockReviewProcessor.processCallback).toHaveBeenCalledWith(
            user1Id, wordId, messageId, difficulty
          );
          expect(mockReviewProcessor.processCallback).toHaveBeenCalledWith(
            user2Id, wordId, messageId, difficulty
          );

          // Both should succeed independently
          expect(mockCtx1.answerCbQuery).toHaveBeenCalledWith(`Rated as: ${difficulty}`);
          expect(mockCtx2.answerCbQuery).toHaveBeenCalledWith(`Rated as: ${difficulty}`);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Error Recovery
   * Validates that errors during callback processing are handled gracefully
   */
  it('should handle processing errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 999999 }).map(id => `user_${id}` as UserId),
          wordId: fc.integer({ min: 1, max: 999999 }).map(id => `word_${id}` as WordId),
          chatId: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
          messageId: fc.integer({ min: 1, max: 999999 }).map(id => id.toString()),
          difficulty: fc.oneof(
            fc.constant('hard' as Difficulty),
            fc.constant('normal' as Difficulty),
            fc.constant('good' as Difficulty),
            fc.constant('easy' as Difficulty)
          ),
          errorType: fc.oneof(
            fc.constant('database'),
            fc.constant('network'),
            fc.constant('processing')
          ),
        }),
        async ({ userId, wordId, chatId, messageId, difficulty, errorType }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup linked and authorized user
          const profile: UserProfile = {
            userId,
            telegramChatId: chatId,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: false,
          };

          const callbackData = `difficulty:${userId}:${wordId}:${difficulty}`;

          // Setup mocks with error
          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);
          vi.mocked(mockReviewProcessor.processCallback).mockRejectedValue(
            new Error(`${errorType} error`)
          );

          // Setup mock context
          const mockCtx = {
            callbackQuery: {
              data: callbackData,
              message: { message_id: parseInt(messageId) }
            },
            chat: { id: parseInt(chatId) },
            answerCbQuery: vi.fn(),
            editMessageReplyMarkup: vi.fn(),
            reply: vi.fn(),
          } as any;

          // Execute callback handling
          await callbackHandlers.handleCallbackQuery(mockCtx);

          // Should handle error gracefully
          expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Failed to process rating');
          expect(mockReviewProcessor.processCallback).toHaveBeenCalledWith(
            userId, wordId, messageId, difficulty
          );
        }
      ),
      { numRuns: 50 }
    );
  });
});