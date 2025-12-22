import type { SrsDifficulty } from './types.js';

/**
 * Base intervals in minutes for each difficulty level
 */
const BASE_INTERVALS: Record<SrsDifficulty, number> = {
  hard: 10,
  normal: 1 * 24 * 60, // 1 day
  good: 3 * 24 * 60,   // 3 days
  easy: 7 * 24 * 60,   // 7 days
};

/**
 * Parameters for scheduling next review
 */
export interface ScheduleNextReviewParams {
  now: Date;
  previousIntervalMinutes: number;
  previousReviewCount: number;
  difficulty: SrsDifficulty;
}

/**
 * Result of scheduling next review
 */
export interface ScheduleNextReviewResult {
  nextIntervalMinutes: number;
  nextReviewAt: Date;
}

/**
 * Calculate next review schedule based on user's difficulty rating
 * 
 * Algorithm:
 * - Base interval depends on difficulty (10 min, 1 day, 3 days, 7 days)
 * - Interval grows with review count: base * max(1, review_count)
 * 
 * @param params - Scheduling parameters
 * @returns Next interval and review date
 */
export function scheduleNextReview(
  params: ScheduleNextReviewParams
): ScheduleNextReviewResult {
  const { now, previousIntervalMinutes, previousReviewCount, difficulty } = params;

  const base = BASE_INTERVALS[difficulty];

  // Simple rule: multiply base by a factor that grows with review_count
  const factor = Math.max(1, previousReviewCount);
  const nextIntervalMinutes = base * factor;

  const nextReviewAt = addMinutes(now, nextIntervalMinutes);

  return {
    nextIntervalMinutes,
    nextReviewAt,
  };
}

/**
 * Create initial SRS item parameters
 * Used when a word becomes 'unknown' in the quiz
 */
export function createInitialSrsItem(now: Date): {
  intervalMinutes: number;
  nextReviewAt: Date;
} {
  // Start with 10 minutes (hard difficulty base)
  const intervalMinutes = BASE_INTERVALS.hard;
  const nextReviewAt = addMinutes(now, intervalMinutes);

  return {
    intervalMinutes,
    nextReviewAt,
  };
}

/**
 * Add minutes to a date
 */
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

