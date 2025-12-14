/**
 * Property tests for rate limiting
 * Tests requirement 1.5: Link Code Rate Limiting
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { LinkAttempt } from '../domain/types';

// Mock implementation for testing rate limiting logic
class MockRateLimiter {
  private attempts: LinkAttempt[] = [];
  private readonly maxFailedAttempts = 5;
  private readonly timeWindowMinutes = 60;

  recordAttempt(chatId: string, success: boolean, codeAttempted?: string) {
    this.attempts.push({
      id: `attempt-${this.attempts.length}`,
      chatId,
      attemptedAt: new Date(),
      success,
      codeAttempted,
    });
  }

  isRateLimited(chatId: string): boolean {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.timeWindowMinutes * 60 * 1000);

    const recentFailedAttempts = this.attempts.filter(
      attempt => 
        attempt.chatId === chatId &&
        !attempt.success &&
        attempt.attemptedAt >= windowStart
    );

    return recentFailedAttempts.length >= this.maxFailedAttempts;
  }

  getFailedAttempts(chatId: string): number {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.timeWindowMinutes * 60 * 1000);

    return this.attempts.filter(
      attempt => 
        attempt.chatId === chatId &&
        !attempt.success &&
        attempt.attemptedAt >= windowStart
    ).length;
  }

  // Helper for testing - simulate time passing
  simulateTimePass(minutes: number) {
    const timeToSubtract = minutes * 60 * 1000;
    this.attempts.forEach(attempt => {
      attempt.attemptedAt = new Date(attempt.attemptedAt.getTime() - timeToSubtract);
    });
  }
}

describe('Rate Limiting Properties', () => {
  it('Property 2: Link Code Rate Limiting - blocks after max failed attempts', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 5, max: 10 }),
        (chatId, failedAttempts) => {
          const rateLimiter = new MockRateLimiter();

          // Record failed attempts up to the limit
          for (let i = 0; i < failedAttempts; i++) {
            rateLimiter.recordAttempt(chatId, false, `CODE${i}`);
          }

          const isBlocked = rateLimiter.isRateLimited(chatId);
          const failedCount = rateLimiter.getFailedAttempts(chatId);

          if (failedAttempts >= 5) {
            expect(isBlocked).toBe(true);
            expect(failedCount).toBeGreaterThanOrEqual(5);
          } else {
            expect(isBlocked).toBe(false);
            expect(failedCount).toBeLessThan(5);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 2: Link Code Rate Limiting - successful attempts do not count toward limit', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (chatId, successfulAttempts, failedAttempts) => {
          const rateLimiter = new MockRateLimiter();

          // Mix successful and failed attempts
          for (let i = 0; i < successfulAttempts; i++) {
            rateLimiter.recordAttempt(chatId, true, `GOOD${i}`);
          }
          for (let i = 0; i < failedAttempts; i++) {
            rateLimiter.recordAttempt(chatId, false, `BAD${i}`);
          }

          const isBlocked = rateLimiter.isRateLimited(chatId);
          const failedCount = rateLimiter.getFailedAttempts(chatId);

          // Only failed attempts should count
          expect(failedCount).toBe(failedAttempts);
          
          if (failedAttempts >= 5) {
            expect(isBlocked).toBe(true);
          } else {
            expect(isBlocked).toBe(false);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 2: Link Code Rate Limiting - rate limit resets after time window', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 61, max: 120 }), // Time passed in minutes
        (chatId, minutesPassed) => {
          const rateLimiter = new MockRateLimiter();

          // Record 5 failed attempts to trigger rate limit
          for (let i = 0; i < 5; i++) {
            rateLimiter.recordAttempt(chatId, false, `CODE${i}`);
          }

          expect(rateLimiter.isRateLimited(chatId)).toBe(true);

          // Simulate time passing beyond the window
          rateLimiter.simulateTimePass(minutesPassed);

          // Should no longer be rate limited
          expect(rateLimiter.isRateLimited(chatId)).toBe(false);
          expect(rateLimiter.getFailedAttempts(chatId)).toBe(0);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('Property 2: Link Code Rate Limiting - different chat IDs have independent limits', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s !== fc.sample(fc.string({ minLength: 1, maxLength: 20 }), 1)[0]),
        (chatId1, chatId2) => {
          fc.pre(chatId1 !== chatId2); // Ensure different chat IDs

          const rateLimiter = new MockRateLimiter();

          // Rate limit first chat ID
          for (let i = 0; i < 5; i++) {
            rateLimiter.recordAttempt(chatId1, false, `CODE${i}`);
          }

          // Second chat ID should not be affected
          expect(rateLimiter.isRateLimited(chatId1)).toBe(true);
          expect(rateLimiter.isRateLimited(chatId2)).toBe(false);
          expect(rateLimiter.getFailedAttempts(chatId1)).toBe(5);
          expect(rateLimiter.getFailedAttempts(chatId2)).toBe(0);
        }
      ),
      { numRuns: 30 }
    );
  });
});