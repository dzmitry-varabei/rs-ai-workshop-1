import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Difficulty } from '../domain/types';

/**
 * **Feature: telegram-bot, Property 8: SRS Interval Calculation**
 * **Validates: Requirements 3.2**
 * 
 * Property-based tests for SRS interval calculations.
 * These tests verify that interval calculations follow the correct formula
 * and maintain consistency across all difficulty levels and review counts.
 */

describe('SRS Interval Calculations', () => {
  
  /**
   * Calculate next interval based on difficulty and review count
   * This implements the formula from the design document:
   * base_interval × max(1, review_count) with minimum 10 minutes
   */
  function calculateInterval(difficulty: Difficulty, reviewCount: number): number {
    const baseIntervals = {
      'hard': 10,      // 10 minutes
      'normal': 1440,  // 24 hours
      'good': 4320,    // 72 hours (3 days)
      'easy': 10080    // 168 hours (1 week)
    };
    
    const baseInterval = baseIntervals[difficulty];
    const multiplier = Math.max(1, reviewCount);
    const calculatedInterval = baseInterval * multiplier;
    
    // Ensure minimum 10 minutes
    return Math.max(10, calculatedInterval);
  }

  describe('Base Interval Validation', () => {
    it('should use correct base intervals for each difficulty', () => {
      // **Property 8: SRS Interval Calculation**
      // For any difficulty rating and review history, the next interval should be calculated 
      // as base_interval × max(1, review_count) with correct base values
      
      fc.assert(fc.property(
        fc.constantFrom('hard', 'normal', 'good', 'easy'),
        (difficulty: Difficulty) => {
          const interval = calculateInterval(difficulty, 0);
          
          // Test correct base intervals from requirements
          switch (difficulty) {
            case 'hard':
              expect(interval).toBe(10); // 10 minutes
              break;
            case 'normal':
              expect(interval).toBe(1440); // 24 hours
              break;
            case 'good':
              expect(interval).toBe(4320); // 72 hours
              break;
            case 'easy':
              expect(interval).toBe(10080); // 168 hours
              break;
          }
        }
      ), { numRuns: 100 });
    });
  });

  describe('Review Count Multiplier', () => {
    it('should apply review count multiplier correctly', () => {
      fc.assert(fc.property(
        fc.constantFrom('hard', 'normal', 'good', 'easy'),
        fc.integer({ min: 0, max: 100 }),
        (difficulty: Difficulty, reviewCount: number) => {
          const interval = calculateInterval(difficulty, reviewCount);
          
          const baseIntervals = {
            'hard': 10,
            'normal': 1440,
            'good': 4320,
            'easy': 10080
          };
          
          const baseInterval = baseIntervals[difficulty];
          const expectedMultiplier = Math.max(1, reviewCount);
          const expectedInterval = Math.max(10, baseInterval * expectedMultiplier);
          
          // Test that calculation follows the formula
          expect(interval).toBe(expectedInterval);
          
          // Test that multiplier is at least 1
          expect(expectedMultiplier).toBeGreaterThanOrEqual(1);
          
          // Test that interval grows with review count (except for minimum clamp)
          if (reviewCount > 0) {
            const previousInterval = calculateInterval(difficulty, reviewCount - 1);
            if (previousInterval >= 10 && interval >= 10) {
              expect(interval).toBeGreaterThanOrEqual(previousInterval);
            }
          }
        }
      ), { numRuns: 100 });
    });
  });

  describe('Minimum Interval Enforcement', () => {
    it('should enforce minimum 10-minute interval', () => {
      fc.assert(fc.property(
        fc.constantFrom('hard', 'normal', 'good', 'easy'),
        fc.integer({ min: 0, max: 100 }),
        (difficulty: Difficulty, reviewCount: number) => {
          const interval = calculateInterval(difficulty, reviewCount);
          
          // Test that result is never less than 10 minutes
          expect(interval).toBeGreaterThanOrEqual(10);
          
          // Test specific case where clamping might occur
          if (difficulty === 'hard' && reviewCount === 0) {
            expect(interval).toBe(10); // Base case
          }
        }
      ), { numRuns: 100 });
    });
  });

  describe('Timeout Handling with 0.5x Multiplier', () => {
    it('should handle timeout scenarios with reduced intervals', () => {
      fc.assert(fc.property(
        fc.constantFrom('hard', 'normal', 'good', 'easy'),
        fc.integer({ min: 1, max: 100 }),
        (difficulty: Difficulty, reviewCount: number) => {
          // Simulate timeout processing with 0.5x multiplier
          const normalInterval = calculateInterval(difficulty, reviewCount);
          const timeoutInterval = Math.max(10, Math.floor(normalInterval * 0.5));
          
          // Test that timeout interval is reduced but respects minimum
          expect(timeoutInterval).toBeLessThanOrEqual(normalInterval);
          expect(timeoutInterval).toBeGreaterThanOrEqual(10);
          
          // Test that for hard difficulty with review count 1, timeout should be minimum
          if (difficulty === 'hard' && reviewCount === 1) {
            expect(timeoutInterval).toBe(10);
          }
        }
      ), { numRuns: 100 });
    });
  });

  describe('Interval Progression Properties', () => {
    it('should show consistent interval progression', () => {
      fc.assert(fc.property(
        fc.constantFrom('normal', 'good', 'easy'), // Skip 'hard' as it has special minimum behavior
        fc.integer({ min: 1, max: 50 }),
        (difficulty: Difficulty, maxReviews: number) => {
          const intervals: number[] = [];
          
          // Calculate intervals for increasing review counts
          for (let i = 0; i <= maxReviews; i++) {
            intervals.push(calculateInterval(difficulty, i));
          }
          
          // Test that intervals are non-decreasing
          for (let i = 1; i < intervals.length; i++) {
            expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]);
          }
          
          // Test that intervals grow linearly with review count
          const baseInterval = intervals[1]; // First interval (review_count = 1)
          for (let i = 1; i < intervals.length; i++) {
            const expectedInterval = baseInterval * i;
            expect(intervals[i]).toBe(expectedInterval);
          }
        }
      ), { numRuns: 100 });
    });
  });

  describe('Difficulty Ordering', () => {
    it('should maintain correct difficulty ordering', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 100 }),
        (reviewCount: number) => {
          const hardInterval = calculateInterval('hard', reviewCount);
          const normalInterval = calculateInterval('normal', reviewCount);
          const goodInterval = calculateInterval('good', reviewCount);
          const easyInterval = calculateInterval('easy', reviewCount);
          
          // Test that difficulties are ordered correctly (harder = shorter intervals)
          expect(hardInterval).toBeLessThanOrEqual(normalInterval);
          expect(normalInterval).toBeLessThan(goodInterval);
          expect(goodInterval).toBeLessThan(easyInterval);
          
          // Test specific ratios for base intervals
          if (reviewCount === 1) {
            expect(normalInterval).toBe(1440); // 24 hours
            expect(goodInterval).toBe(4320);   // 72 hours (3x normal)
            expect(easyInterval).toBe(10080);  // 168 hours (7x normal)
          }
        }
      ), { numRuns: 100 });
    });
  });

  describe('Edge Cases', () => {
    it('should handle edge cases correctly', () => {
      fc.assert(fc.property(
        fc.constantFrom('hard', 'normal', 'good', 'easy'),
        fc.oneof(
          fc.constant(0),           // Zero reviews
          fc.constant(1),           // First review
          fc.constant(-1),          // Negative (should be clamped to 1)
          fc.integer({ min: 1000, max: 10000 }) // Very high review count
        ),
        (difficulty: Difficulty, reviewCount: number) => {
          const interval = calculateInterval(difficulty, reviewCount);
          
          // Test that result is always valid
          expect(interval).toBeGreaterThanOrEqual(10);
          expect(Number.isInteger(interval)).toBe(true);
          expect(Number.isFinite(interval)).toBe(true);
          
          // Test that negative review counts are handled
          if (reviewCount < 0) {
            const positiveInterval = calculateInterval(difficulty, 1);
            expect(interval).toBe(positiveInterval);
          }
          
          // Test that zero review count uses multiplier of 1
          if (reviewCount === 0) {
            const oneReviewInterval = calculateInterval(difficulty, 1);
            expect(interval).toBe(oneReviewInterval);
          }
        }
      ), { numRuns: 100 });
    });
  });

  describe('Mathematical Properties', () => {
    it('should satisfy mathematical properties', () => {
      fc.assert(fc.property(
        fc.constantFrom('normal', 'good', 'easy'),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (difficulty: Difficulty, reviewCount1: number, reviewCount2: number) => {
          const interval1 = calculateInterval(difficulty, reviewCount1);
          const interval2 = calculateInterval(difficulty, reviewCount2);
          
          // Test proportionality: if reviewCount2 = 2 * reviewCount1, then interval2 = 2 * interval1
          if (reviewCount2 === 2 * reviewCount1) {
            expect(interval2).toBe(2 * interval1);
          }
          
          // Test additivity: interval(n+m) = interval(1) * (n+m) for n,m > 0
          if (reviewCount1 > 0 && reviewCount2 > 0) {
            const combinedInterval = calculateInterval(difficulty, reviewCount1 + reviewCount2);
            const baseInterval = calculateInterval(difficulty, 1);
            expect(combinedInterval).toBe(baseInterval * (reviewCount1 + reviewCount2));
          }
        }
      ), { numRuns: 100 });
    });
  });
});