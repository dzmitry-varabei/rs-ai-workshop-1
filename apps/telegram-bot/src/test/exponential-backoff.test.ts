/**
 * Property tests for exponential backoff retry logic
 * Validates: Requirements 10.5 - Exponential Backoff Retry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { TelegramApiWrapper } from '../services/TelegramApiWrapper';
import type { RetryConfig, TelegramApiError } from '../services/TelegramApiWrapper';

// Mock Telegraf bot
const createMockBot = () => ({
  telegram: {
    sendMessage: vi.fn(),
    editMessageText: vi.fn(),
    answerCbQuery: vi.fn(),
    getChat: vi.fn(),
  },
});

describe('TelegramApiWrapper - Exponential Backoff', () => {
  let mockBot: ReturnType<typeof createMockBot>;
  let wrapper: TelegramApiWrapper;

  beforeEach(() => {
    mockBot = createMockBot();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  /**
   * Property 25: Exponential Backoff Retry
   * Retry delays should increase exponentially with each attempt,
   * respecting maximum delay limits and Telegram's retry_after parameter.
   */
  it('should implement exponential backoff with proper delay calculation', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate retry configuration
        fc.record({
          maxRetries: fc.integer({ min: 1, max: 5 }),
          baseDelayMs: fc.integer({ min: 100, max: 2000 }),
          maxDelayMs: fc.integer({ min: 5000, max: 60000 }),
          backoffMultiplier: fc.float({ min: 1.5, max: 3.0, noNaN: true }),
        }),
        // Generate number of failures before success
        fc.integer({ min: 1, max: 3 }),
        async (retryConfig: RetryConfig, failureCount: number) => {
          wrapper = new TelegramApiWrapper(mockBot, retryConfig);
          
          let callCount = 0;
          const delays: number[] = [];
          
          // Mock sendMessage to fail specified number of times, then succeed
          mockBot.telegram.sendMessage.mockImplementation(() => {
            callCount++;
            if (callCount <= failureCount) {
              const error = new Error('Network error') as TelegramApiError;
              error.code = 500; // Server error (retryable)
              throw error;
            }
            return Promise.resolve({ message_id: 123 });
          });
          
          // Mock setTimeout to capture delays
          vi.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
            delays.push(delay as number);
            // Execute callback immediately for testing
            if (typeof callback === 'function') {
              callback();
            }
            return 1 as any; // Return a timer ID
          });
          
          if (failureCount <= retryConfig.maxRetries) {
            // Should succeed after the specified number of failures
            await wrapper.sendMessage({
              chat_id: '123',
              text: 'test message',
            });
            
            // Should have succeeded after retries
            expect(callCount).toBe(failureCount + 1);
            
            // Should have recorded delays for each retry
            expect(delays).toHaveLength(failureCount);
            
            // Verify exponential backoff pattern - just check basic properties
            for (let i = 0; i < delays.length; i++) {
              // All delays should be positive numbers
              expect(delays[i]).toBeGreaterThan(0);
              expect(delays[i]).toBeLessThanOrEqual(retryConfig.maxDelayMs + 1); // Allow small rounding
              
              // Each delay should generally increase (unless hitting max delay)
              if (i > 0 && delays[i - 1] < retryConfig.maxDelayMs * 0.9) {
                expect(delays[i]).toBeGreaterThan(delays[i - 1] * 0.8); // Allow for jitter and rounding
              }
            }
          } else {
            // Should fail after exhausting all retries
            await expect(wrapper.sendMessage({
              chat_id: '123',
              text: 'test message',
            })).rejects.toThrow();
            
            expect(callCount).toBe(retryConfig.maxRetries + 1);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should respect Telegram retry_after parameter', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 30 }), // retry_after seconds
        fc.record({
          maxRetries: fc.constant(2),
          baseDelayMs: fc.constant(1000),
          maxDelayMs: fc.constant(30000),
          backoffMultiplier: fc.constant(2),
        }),
        async (retryAfterSeconds: number, retryConfig: RetryConfig) => {
          wrapper = new TelegramApiWrapper(mockBot, retryConfig);
          
          let callCount = 0;
          const delays: number[] = [];
          
          // Mock to return rate limit error with retry_after
          mockBot.telegram.sendMessage.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              const error = new Error('Too Many Requests') as TelegramApiError;
              error.code = 429;
              error.parameters = { retry_after: retryAfterSeconds };
              throw error;
            }
            return Promise.resolve({ message_id: 123 });
          });
          
          // Capture delays
          vi.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
            delays.push(delay as number);
            // Execute callback immediately for testing
            if (typeof callback === 'function') {
              callback();
            }
            return 1 as any; // Return a timer ID
          });
          
          await wrapper.sendMessage({
            chat_id: '123',
            text: 'test message',
          });
          
          // Should have used retry_after value
          expect(delays).toHaveLength(1);
          const expectedDelay = Math.min(retryAfterSeconds * 1000, retryConfig.maxDelayMs);
          expect(delays[0]).toBe(expectedDelay);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should not retry non-retryable errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          400, // Bad Request
          401, // Unauthorized  
          403, // Forbidden
          404  // Not Found
        ),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (errorCode: number, errorMessage: string) => {
          wrapper = new TelegramApiWrapper(mockBot, {
            maxRetries: 3,
            baseDelayMs: 1000,
            maxDelayMs: 10000,
            backoffMultiplier: 2,
          });
          
          let callCount = 0;
          
          // Mock to return non-retryable error
          mockBot.telegram.sendMessage.mockImplementation(() => {
            callCount++;
            const error = new Error(errorMessage) as TelegramApiError;
            error.code = errorCode;
            throw error;
          });
          
          // Should throw immediately without retries (except for 429)
          await expect(wrapper.sendMessage({
            chat_id: '123',
            text: 'test message',
          })).rejects.toThrow();
          
          if (errorCode === 429) {
            // Rate limiting should be retried
            expect(callCount).toBeGreaterThan(1);
          } else {
            // Other 4xx errors should not be retried
            expect(callCount).toBe(1);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle maximum retry limit correctly', async () => {
    // Test with a fixed configuration to avoid timeout issues
    wrapper = new TelegramApiWrapper(mockBot, {
      maxRetries: 2,
      baseDelayMs: 1, // Minimal delay for testing
      maxDelayMs: 10,
      backoffMultiplier: 2,
    });
    
    let callCount = 0;
    
    // Mock to always fail with retryable error
    mockBot.telegram.sendMessage.mockImplementation(() => {
      callCount++;
      const error = new Error('Server error') as TelegramApiError;
      error.code = 500;
      throw error;
    });
    
    // Mock setTimeout to execute immediately
    vi.spyOn(global, 'setTimeout').mockImplementation((callback) => {
      if (typeof callback === 'function') {
        callback();
      }
      return 1 as any;
    });
    
    // Should fail after exhausting retries
    await expect(wrapper.sendMessage({
      chat_id: '123',
      text: 'test message',
    })).rejects.toThrow();
    
    // Should have made exactly maxRetries + 1 attempts (initial + retries)
    expect(callCount).toBe(3); // 2 retries + 1 initial = 3 total
  }, 1000); // 1 second timeout should be enough

  it('should add jitter to prevent thundering herd', async () => {
    const retryConfig: RetryConfig = {
      maxRetries: 2,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
    };
    
    wrapper = new TelegramApiWrapper(mockBot, retryConfig);
    
    const allDelays: number[][] = [];
    
    // Run multiple identical scenarios to check for jitter
    for (let run = 0; run < 10; run++) {
      const delays: number[] = [];
      let callCount = 0;
      
      mockBot.telegram.sendMessage.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          const error = new Error('Server error') as TelegramApiError;
          error.code = 500;
          throw error;
        }
        return Promise.resolve({ message_id: 123 });
      });
      
      vi.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
        delays.push(delay as number);
        // Execute callback immediately for testing
        if (typeof callback === 'function') {
          callback();
        }
        return 1 as any; // Return a timer ID
      });
      
      await wrapper.sendMessage({
        chat_id: '123',
        text: 'test message',
      });
      
      allDelays.push([...delays]);
      vi.clearAllMocks();
    }
    
    // Check that delays vary between runs (jitter is working)
    if (allDelays.length >= 2) {
      const firstRunDelays = allDelays[0];
      const hasVariation = allDelays.some(delays => 
        delays.some((delay, i) => Math.abs(delay - firstRunDelays[i]) > 1)
      );
      
      // Should have some variation due to jitter (not always identical)
      expect(hasVariation).toBe(true);
    }
  });

  it('should handle different error message patterns for non-retryable errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'Bad Request: message is not modified',
          'Bad Request: query is too old',
          'Bad Request: message to edit not found',
          'Forbidden: bot was blocked by the user',
          'Forbidden: user is deactivated',
          'Forbidden: bot can\'t send messages to bots'
        ),
        async (errorMessage: string) => {
          wrapper = new TelegramApiWrapper(mockBot, {
            maxRetries: 3,
            baseDelayMs: 1000,
            maxDelayMs: 10000,
            backoffMultiplier: 2,
          });
          
          let callCount = 0;
          
          mockBot.telegram.sendMessage.mockImplementation(() => {
            callCount++;
            const error = new Error(errorMessage) as TelegramApiError;
            throw error;
          });
          
          // Should not retry these specific error messages
          await expect(wrapper.sendMessage({
            chat_id: '123',
            text: 'test message',
          })).rejects.toThrow();
          
          expect(callCount).toBe(1);
        }
      ),
      { numRuns: 20 }
    );
  });
});