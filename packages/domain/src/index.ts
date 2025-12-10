/**
 * Domain package exports
 * 
 * This package contains pure TypeScript types and business logic
 * with no dependencies on infrastructure (Supabase, etc.)
 */

export type { UserId, WordId, WordStatus, SrsDifficulty } from './types.js';
export type { Word, Pronunciation } from './word.js';
export {
  scheduleNextReview,
  createInitialSrsItem,
  type ScheduleNextReviewParams,
  type ScheduleNextReviewResult,
} from './srs.js';
export type { WordRepository } from './repositories.js';

