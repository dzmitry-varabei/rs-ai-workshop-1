/**
 * Core domain types for the Telegram Bot
 * These types define the data structures and contracts used throughout the application
 */

// Core domain types - temporarily defined locally until module resolution is fixed
export type UserId = string & { __brand: 'UserId' };
export type WordId = string & { __brand: 'WordId' };

export interface Pronunciation {
  locale: string;
  ipa?: string;
  audioUrl?: string;
  source?: string;
}

export interface Word {
  id: WordId;
  text: string;
  level?: string;
  exampleEn?: string;
  exampleRu?: string;
  tags: string[];
  pronunciations: Pronunciation[];
}

/**
 * Difficulty levels for spaced repetition system
 * Maps to the srs_difficulty enum in the database
 */
export type Difficulty = 'hard' | 'normal' | 'good' | 'easy';

/**
 * Delivery state for SRS items - implements state machine from design
 * - due: Ready for delivery (next_review_at <= now)
 * - sending: Claimed by scheduler but not yet sent
 * - awaiting_response: Message sent, waiting for user rating
 * - scheduled: Waiting for next review time (next_review_at > now)
 */
export type DeliveryState = 'due' | 'sending' | 'awaiting_response' | 'scheduled';

/**
 * Scheduled review item with delivery state management
 */
export interface ScheduledReview {
  userId: UserId;
  wordId: WordId;
  nextReviewAt: Date;
  intervalMinutes: number;
  reviewCount: number;
  deliveryState: DeliveryState;
  lastMessageId?: string;
  lastClaimedAt?: Date;
  lastSentAt?: Date;
}

/**
 * Result of link code validation
 */
export interface LinkCodeValidation {
  isValid: boolean;
  userId?: UserId;
  error?: 'expired' | 'used' | 'not_found' | 'rate_limited';
}

/**
 * User statistics for /stats command
 */
export interface UserStats {
  totalItems: number;
  dueToday: number;
  successRate: number; // Percentage of "good" or "easy" responses in last 30 days
  learningStreak: number; // Consecutive days with at least one review
}

/**
 * Time window configuration for message delivery
 */
export interface DeliveryWindow {
  start: string; // HH:MM format (e.g., "09:00")
  end: string;   // HH:MM format (e.g., "21:00")
  timezone: string; // IANA timezone (e.g., "Europe/London")
}

/**
 * User profile with bot-specific settings
 */
export interface UserProfile {
  id: UserId;
  telegramChatId?: string;
  timezone: string;
  dailyWordLimit: number;
  preferredWindow: DeliveryWindow;
  paused: boolean;
  createdAt: Date;
}

/**
 * Link code for account linking
 */
export interface LinkCode {
  code: string; // 8-character alphanumeric
  userId: UserId;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

/**
 * Link attempt for rate limiting
 */
export interface LinkAttempt {
  id: string;
  chatId: string;
  attemptedAt: Date;
  success: boolean;
  codeAttempted?: string;
}

/**
 * Review event for statistics tracking
 */
export interface ReviewEvent {
  id: string;
  userId: UserId;
  wordId: WordId;
  reviewedAt: Date;
  difficulty: Difficulty;
  source: 'telegram' | 'timeout' | 'manual';
  messageId?: string;
}

/**
 * Error types for different failure scenarios
 */
export class TelegramBotError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'TelegramBotError';
  }
}

export class AccountLinkingError extends TelegramBotError {
  constructor(message: string, cause?: Error) {
    super(message, 'ACCOUNT_LINKING_ERROR', cause);
    this.name = 'AccountLinkingError';
  }
}

export class RateLimitError extends TelegramBotError {
  constructor(message: string, public readonly retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends TelegramBotError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}