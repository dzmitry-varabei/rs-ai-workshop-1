/**
 * Branded types for type safety
 */

export type UserId = string & { __brand: 'UserId' };
export type WordId = string & { __brand: 'WordId' };

/**
 * Word status enum for quiz
 */
export type WordStatus = 'unknown' | 'learning' | 'known';

/**
 * SRS difficulty levels
 */
export type SrsDifficulty = 'hard' | 'normal' | 'good' | 'easy';

