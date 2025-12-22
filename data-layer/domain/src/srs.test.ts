import { describe, it, expect } from 'vitest';
import {
  scheduleNextReview,
  createInitialSrsItem,
  type ScheduleNextReviewParams,
} from './srs.js';

describe('SRS Algorithm', () => {
  const baseDate = new Date('2025-01-01T12:00:00Z');

  describe('scheduleNextReview', () => {
    it('should schedule hard difficulty for 10 minutes', () => {
      const params: ScheduleNextReviewParams = {
        now: baseDate,
        previousIntervalMinutes: 10,
        previousReviewCount: 1,
        difficulty: 'hard',
      };

      const result = scheduleNextReview(params);

      expect(result.nextIntervalMinutes).toBe(10);
      expect(result.nextReviewAt).toEqual(new Date('2025-01-01T12:10:00Z'));
    });

    it('should schedule normal difficulty for 1 day', () => {
      const params: ScheduleNextReviewParams = {
        now: baseDate,
        previousIntervalMinutes: 10,
        previousReviewCount: 1,
        difficulty: 'normal',
      };

      const result = scheduleNextReview(params);

      expect(result.nextIntervalMinutes).toBe(1 * 24 * 60); // 1440 minutes
      expect(result.nextReviewAt).toEqual(new Date('2025-01-02T12:00:00Z'));
    });

    it('should schedule good difficulty for 3 days', () => {
      const params: ScheduleNextReviewParams = {
        now: baseDate,
        previousIntervalMinutes: 10,
        previousReviewCount: 1,
        difficulty: 'good',
      };

      const result = scheduleNextReview(params);

      expect(result.nextIntervalMinutes).toBe(3 * 24 * 60); // 4320 minutes
      expect(result.nextReviewAt).toEqual(new Date('2025-01-04T12:00:00Z'));
    });

    it('should schedule easy difficulty for 7 days', () => {
      const params: ScheduleNextReviewParams = {
        now: baseDate,
        previousIntervalMinutes: 10,
        previousReviewCount: 1,
        difficulty: 'easy',
      };

      const result = scheduleNextReview(params);

      expect(result.nextIntervalMinutes).toBe(7 * 24 * 60); // 10080 minutes
      expect(result.nextReviewAt).toEqual(new Date('2025-01-08T12:00:00Z'));
    });

    it('should increase interval with review count', () => {
      const params: ScheduleNextReviewParams = {
        now: baseDate,
        previousIntervalMinutes: 10,
        previousReviewCount: 3,
        difficulty: 'normal',
      };

      const result = scheduleNextReview(params);

      // base (1440) * factor (3) = 4320 minutes = 3 days
      expect(result.nextIntervalMinutes).toBe(4320);
      expect(result.nextReviewAt).toEqual(new Date('2025-01-04T12:00:00Z'));
    });

    it('should use minimum factor of 1 even for review_count 0', () => {
      const params: ScheduleNextReviewParams = {
        now: baseDate,
        previousIntervalMinutes: 10,
        previousReviewCount: 0,
        difficulty: 'normal',
      };

      const result = scheduleNextReview(params);

      // Should use factor = 1 (not 0)
      expect(result.nextIntervalMinutes).toBe(1 * 24 * 60);
    });
  });

  describe('createInitialSrsItem', () => {
    it('should create initial item with 10 minutes interval', () => {
      const result = createInitialSrsItem(baseDate);

      expect(result.intervalMinutes).toBe(10);
      expect(result.nextReviewAt).toEqual(new Date('2025-01-01T12:10:00Z'));
    });
  });
});

