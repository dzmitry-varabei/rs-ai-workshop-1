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

/**
 * User profile for Telegram bot settings
 */
export interface UserProfile {
  id: UserId;
  telegramChatId?: string;
  timezone: string;
  dailyWordLimit: number;
  preferredWindowStart: string; // HH:MM format
  preferredWindowEnd: string;   // HH:MM format
  paused: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Link code for account linking between web app and Telegram bot
 */
export interface LinkCode {
  code: string; // 8-character alphanumeric
  userId: UserId;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

