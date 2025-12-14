/**
 * Property tests for daily limit enforcement
 * Tests requirement 4.3: Daily Limit Enforcement
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Mock implementation for testing daily limit enforcement logic
class MockDailyLimitEnforcer {
  private reviewCounts: Map<string, { date: string; count: number }> = new Map();

  /**
   * Check if user has reached their daily review limit
   * Property 14: Daily Limit Enforcement
   */
  hasReachedDailyLimit(userId: string, dailyLimit: number, date: Date = new Date()): boolean {
    const dateKey = this.getDateKey(date);
    const userKey = `${userId}-${dateKey}`;
    
    const userCount = this.reviewCounts.get(userKey)?.count ?? 0;
    return userCount >= dailyLimit;
  }

  /**
   * Record a review for a user
   */
  recordReview(userId: string, date: Date = new Date()): void {
    const dateKey = this.getDateKey(date);
    const userKey = `${userId}-${dateKey}`;
    
    const current = this.reviewCounts.get(userKey) ?? { date: dateKey, count: 0 };
    this.reviewCounts.set(userKey, { ...current, count: current.count + 1 });
  }

  /**
   * Get current review count for user on specific date
   */
  getReviewCount(userId: string, date: Date = new Date()): number {
    const dateKey = this.getDateKey(date);
    const userKey = `${userId}-${dateKey}`;
    
    return this.reviewCounts.get(userKey)?.count ?? 0;
  }

  /**
   * Get remaining reviews for user
   */
  getRemainingReviews(userId: string, dailyLimit: number, date: Date = new Date()): number {
    const currentCount = this.getReviewCount(userId, date);
    return Math.max(0, dailyLimit - currentCount);
  }

  /**
   * Reset all counts (for testing)
   */
  reset(): void {
    this.reviewCounts.clear();
  }

  /**
   * Get eligible users who haven't reached their daily limit
   */
  getEligibleUsers(
    users: Array<{ id: string; dailyLimit: number }>,
    date: Date = new Date()
  ): string[] {
    return users
      .filter(user => !this.hasReachedDailyLimit(user.id, user.dailyLimit, date))
      .map(user => user.id);
  }

  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }
}

describe('Daily Limit Enforcement Properties', () => {
  it('Property 14: Daily Limit Enforcement - users cannot exceed their daily limit', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 200 }),
        (userId, dailyLimit, attemptedReviews) => {
          const enforcer = new MockDailyLimitEnforcer();
          const testDate = new Date('2024-01-15');
          
          // Record reviews up to the attempted amount
          for (let i = 0; i < attemptedReviews; i++) {
            if (!enforcer.hasReachedDailyLimit(userId, dailyLimit, testDate)) {
              enforcer.recordReview(userId, testDate);
            }
          }
          
          const finalCount = enforcer.getReviewCount(userId, testDate);
          const hasReachedLimit = enforcer.hasReachedDailyLimit(userId, dailyLimit, testDate);
          
          // Final count should never exceed daily limit
          expect(finalCount).toBeLessThanOrEqual(dailyLimit);
          
          // If we've reached the limit, the flag should be true
          if (finalCount >= dailyLimit) {
            expect(hasReachedLimit).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 14: Daily Limit Enforcement - different dates have independent limits', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 10 }),
        (userId, dailyLimit, dayOffset) => {
          const enforcer = new MockDailyLimitEnforcer();
          
          const date1 = new Date('2024-01-15');
          const date2 = new Date('2024-01-15');
          date2.setDate(date2.getDate() + dayOffset);
          
          // Fill up limit for date1
          for (let i = 0; i < dailyLimit; i++) {
            enforcer.recordReview(userId, date1);
          }
          
          const count1 = enforcer.getReviewCount(userId, date1);
          const count2 = enforcer.getReviewCount(userId, date2);
          const hasReachedLimit1 = enforcer.hasReachedDailyLimit(userId, dailyLimit, date1);
          const hasReachedLimit2 = enforcer.hasReachedDailyLimit(userId, dailyLimit, date2);
          
          expect(count1).toBe(dailyLimit);
          expect(hasReachedLimit1).toBe(true);
          
          if (dayOffset > 0) {
            // Different date should have independent count
            expect(count2).toBe(0);
            expect(hasReachedLimit2).toBe(false);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('Property 14: Daily Limit Enforcement - remaining reviews calculation is accurate', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 5, max: 50 }),
        fc.integer({ min: 0, max: 10 }),
        (userId, dailyLimit, reviewsRecorded) => {
          const enforcer = new MockDailyLimitEnforcer();
          const testDate = new Date('2024-01-15');
          
          // Record some reviews (but not more than the limit)
          const actualRecorded = Math.min(reviewsRecorded, dailyLimit);
          for (let i = 0; i < actualRecorded; i++) {
            enforcer.recordReview(userId, testDate);
          }
          
          const remaining = enforcer.getRemainingReviews(userId, dailyLimit, testDate);
          const currentCount = enforcer.getReviewCount(userId, testDate);
          
          // Remaining + current should equal daily limit (or remaining should be 0)
          expect(remaining + currentCount).toBe(dailyLimit);
          expect(remaining).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 14: Daily Limit Enforcement - eligible users filtering works correctly', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          dailyLimit: fc.integer({ min: 1, max: 20 }),
        }), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 0, max: 25 }),
        (users, reviewsToRecord) => {
          const enforcer = new MockDailyLimitEnforcer();
          const testDate = new Date('2024-01-15');
          
          // Record reviews for each user
          for (const user of users) {
            const reviewsForUser = Math.min(reviewsToRecord, user.dailyLimit + 5); // Sometimes exceed limit
            for (let i = 0; i < reviewsForUser; i++) {
              if (!enforcer.hasReachedDailyLimit(user.id, user.dailyLimit, testDate)) {
                enforcer.recordReview(user.id, testDate);
              }
            }
          }
          
          const eligibleUsers = enforcer.getEligibleUsers(users, testDate);
          
          // All eligible users should not have reached their limit
          for (const eligibleUserId of eligibleUsers) {
            const user = users.find(u => u.id === eligibleUserId);
            expect(user).toBeDefined();
            if (user) {
              expect(enforcer.hasReachedDailyLimit(user.id, user.dailyLimit, testDate)).toBe(false);
            }
          }
          
          // All users who reached their limit should not be in eligible list
          for (const user of users) {
            if (enforcer.hasReachedDailyLimit(user.id, user.dailyLimit, testDate)) {
              expect(eligibleUsers).not.toContain(user.id);
            }
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it('Property 14: Daily Limit Enforcement - zero limit blocks all reviews', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 10 }),
        (userId, attemptedReviews) => {
          const enforcer = new MockDailyLimitEnforcer();
          const testDate = new Date('2024-01-15');
          const zeroLimit = 0;
          
          // Try to record reviews with zero limit
          for (let i = 0; i < attemptedReviews; i++) {
            if (!enforcer.hasReachedDailyLimit(userId, zeroLimit, testDate)) {
              enforcer.recordReview(userId, testDate);
            }
          }
          
          const finalCount = enforcer.getReviewCount(userId, testDate);
          const hasReachedLimit = enforcer.hasReachedDailyLimit(userId, zeroLimit, testDate);
          
          // With zero limit, should always be at limit and have zero reviews
          expect(finalCount).toBe(0);
          expect(hasReachedLimit).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 14: Daily Limit Enforcement - limit enforcement is consistent', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 50 }),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        (userId, dailyLimit, testDate) => {
          const enforcer = new MockDailyLimitEnforcer();
          
          // Check limit multiple times before recording any reviews
          const initialCheck1 = enforcer.hasReachedDailyLimit(userId, dailyLimit, testDate);
          const initialCheck2 = enforcer.hasReachedDailyLimit(userId, dailyLimit, testDate);
          
          expect(initialCheck1).toBe(initialCheck2);
          expect(initialCheck1).toBe(false); // Should not be at limit initially
          
          // Record exactly the daily limit
          for (let i = 0; i < dailyLimit; i++) {
            enforcer.recordReview(userId, testDate);
          }
          
          // Check limit multiple times after reaching it
          const finalCheck1 = enforcer.hasReachedDailyLimit(userId, dailyLimit, testDate);
          const finalCheck2 = enforcer.hasReachedDailyLimit(userId, dailyLimit, testDate);
          
          expect(finalCheck1).toBe(finalCheck2);
          expect(finalCheck1).toBe(true); // Should be at limit now
        }
      ),
      { numRuns: 30 }
    );
  });
});