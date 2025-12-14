/**
 * Property-based tests for callback validation and response
 * Validates that callback queries are properly validated and processed
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

describe('Callback Validation and Response', () => {
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
   * Property 10: Callback Validation and Response
   * Validates: Requirements 3.1, 3.4
   * 
   * Callback queries should be properly validated and processed:
   * - Only valid callback data formats should be accepted
   * - User authorization should be verified
   * - Difficulty ratings should be processed correctly
   * - Messages should be updated to remove keyboards
   * - Appropriate acknowledgments should be sent
   */
  it('should validate and process callback queries correctly', async () => {
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
          isLinked: fc.boolean(),
          isAuthorized: fc.boolean(),
          processSuccess: fc.boolean(),
        }),
        async ({ userId, wordId, chatId, messageId, difficulty, isLinked, isAuthorized, processSuccess }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup user profile
          const profile: UserProfile | null = isLinked ? {
            userId: isAuthorized ? userId : `other_${userId}` as UserId,
            telegramChatId: chatId,
            timezone: 'UTC',
            dailyWordLimit: 10,
            preferredWindow: { start: '09:00', end: '21:00' },
            paused: false,
          } : null;

          // Setup callback data
          const callbackData = `difficulty:${userId}:${wordId}:${difficulty}`;

          // Setup mocks
          vi.mocked(mockUserProfileRepository.getProfileByChatId).mockResolvedValue(profile);
          vi.mocked(mockReviewProcessor.processCallback).mockResolvedValue(processSuccess);

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

          // Verify behavior based on conditions
          if (!isLinked) {
            // Should reject unlinked users
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Account not linked');
            expect(mockReviewProcessor.processCallback).not.toHaveBeenCalled();
          } else if (!isAuthorized) {
            // Should reject unauthorized users
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Unauthorized callback');
            expect(mockReviewProcessor.processCallback).not.toHaveBeenCalled();
          } else {
            // Should process valid callbacks
            expect(mockReviewProcessor.processCallback).toHaveBeenCalledWith(
              userId,
              wordId,
              messageId,
              difficulty
            );

            if (processSuccess) {
              // Should update message and send acknowledgment
              expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledWith({ inline_keyboard: [] });
              expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(`Rated as: ${difficulty}`);
              expect(mockMessageFormatter.formatCallbackAck).toHaveBeenCalledWith(difficulty);
            } else {
              // Should handle duplicate/invalid callbacks
              expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('This review has already been processed');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Callback Data Parsing Validation
   * Validates that callback data is parsed correctly and invalid formats are rejected
   */
  it('should parse callback data correctly and reject invalid formats', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Valid callback data
          fc.record({
            type: fc.constant('difficulty'),
            userId: fc.integer({ min: 1, max: 999999 }).map(id => `user_${id}`),
            wordId: fc.integer({ min: 1, max: 999999 }).map(id => `word_${id}`),
            difficulty: fc.oneof(
              fc.constant('hard'),
              fc.constant('normal'),
              fc.constant('good'),
              fc.constant('easy')
            ),
            isValid: fc.constant(true),
          }).map(({ type, userId, wordId, difficulty, isValid }) => ({
            callbackData: `${type}:${userId}:${wordId}:${difficulty}`,
            isValid,
          })),
          // Invalid callback data
          fc.oneof(
            // Wrong number of parts
            fc.string().map(data => ({ callbackData: data, isValid: false })),
            // Invalid difficulty
            fc.record({
              type: fc.constant('difficulty'),
              userId: fc.string({ minLength: 1, maxLength: 10 }),
              wordId: fc.string({ minLength: 1, maxLength: 10 }),
              difficulty: fc.string({ minLength: 1, maxLength: 10 }).filter(d => 
                !['hard', 'normal', 'good', 'easy'].includes(d)
              ),
            }).map(({ type, userId, wordId, difficulty }) => ({
              callbackData: `${type}:${userId}:${wordId}:${difficulty}`,
              isValid: false,
            })),
            // Invalid type
            fc.record({
              type: fc.string({ minLength: 1, maxLength: 10 }).filter(t => t !== 'difficulty'),
              userId: fc.string({ minLength: 1, maxLength: 10 }),
              wordId: fc.string({ minLength: 1, maxLength: 10 }),
              difficulty: fc.constant('hard'),
            }).map(({ type, userId, wordId, difficulty }) => ({
              callbackData: `${type}:${userId}:${wordId}:${difficulty}`,
              isValid: false,
            }))
          )
        ),
        async ({ callbackData, isValid }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          const chatId = '123456789';
          
          // Extract userId from callback data to ensure consistency
          const parts = callbackData.split(':');
          const userId = parts.length >= 2 ? parts[1] as UserId : 'user_123' as UserId;
          
          // Setup linked user with matching userId
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
              data: callbackData,
              message: { message_id: 123 }
            },
            chat: { id: parseInt(chatId) },
            answerCbQuery: vi.fn(),
            editMessageReplyMarkup: vi.fn(),
            reply: vi.fn(),
          } as any;

          // Execute callback handling
          await callbackHandlers.handleCallbackQuery(mockCtx);

          if (isValid) {
            // Should process valid callback data
            expect(mockReviewProcessor.processCallback).toHaveBeenCalled();
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
   * Property: Message Editing Error Handling
   * Validates that message editing errors are handled gracefully
   */
  it('should handle message editing errors gracefully', async () => {
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
          editError: fc.boolean(),
        }),
        async ({ userId, wordId, chatId, messageId, difficulty, editError }) => {
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
          vi.mocked(mockReviewProcessor.processCallback).mockResolvedValue(true);

          // Setup mock context with potential edit error
          const mockCtx = {
            callbackQuery: {
              data: callbackData,
              message: { message_id: parseInt(messageId) }
            },
            chat: { id: parseInt(chatId) },
            answerCbQuery: vi.fn(),
            editMessageReplyMarkup: editError 
              ? vi.fn().mockRejectedValue(new Error('Message too old to edit'))
              : vi.fn().mockResolvedValue({}),
            reply: vi.fn(),
          } as any;

          // Execute callback handling
          await callbackHandlers.handleCallbackQuery(mockCtx);

          // Should always process the callback
          expect(mockReviewProcessor.processCallback).toHaveBeenCalledWith(
            userId,
            wordId,
            messageId,
            difficulty
          );

          // Should always send acknowledgment, regardless of edit success
          expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(`Rated as: ${difficulty}`);

          // Should attempt to edit message
          expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledWith({ inline_keyboard: [] });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Context Validation
   * Validates that missing context information is handled properly
   */
  it('should handle missing context information properly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          hasCallbackQuery: fc.boolean(),
          hasCallbackData: fc.boolean(),
          hasChat: fc.boolean(),
          hasMessage: fc.boolean(),
          callbackData: fc.string({ minLength: 1, maxLength: 50 }),
          chatId: fc.integer({ min: 1, max: 999999999 }).map(id => id.toString()),
        }),
        async ({ hasCallbackQuery, hasCallbackData, hasChat, hasMessage, callbackData, chatId }) => {
          // Reset mocks for this iteration
          vi.clearAllMocks();
          
          // Setup mock context with potentially missing information
          const mockCtx = {
            callbackQuery: hasCallbackQuery ? {
              data: hasCallbackData ? callbackData : undefined,
              message: hasMessage ? { message_id: 123 } : undefined
            } : undefined,
            chat: hasChat ? { id: parseInt(chatId) } : undefined,
            answerCbQuery: vi.fn(),
            editMessageReplyMarkup: vi.fn(),
            reply: vi.fn(),
          } as any;

          // Execute callback handling
          await callbackHandlers.handleCallbackQuery(mockCtx);

          // Should handle missing information gracefully
          expect(mockCtx.answerCbQuery).toHaveBeenCalled();

          if (!hasCallbackQuery) {
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Invalid callback query');
          } else if (!hasChat) {
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Unable to identify chat');
          } else if (!hasCallbackData) {
            // When callback query exists but data is undefined, it will fail parsing
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Invalid callback data');
          }

          // Should not process callback if context is invalid
          if (!hasCallbackQuery || !hasCallbackData || !hasChat) {
            expect(mockReviewProcessor.processCallback).not.toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});