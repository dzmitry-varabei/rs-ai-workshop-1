/**
 * Domain interfaces for the Telegram Bot
 * These interfaces define the contracts between different layers of the application
 */

import type {
  Word,
  Pronunciation,
  UserId,
  WordId,
  ScheduledReview,
  LinkCodeValidation,
  UserStats,
  UserProfile,
  LinkCode,
  LinkAttempt,
  ReviewEvent,
  Difficulty,
} from './types';

/**
 * Service for selecting due reviews based on user preferences and time windows
 */
export interface DueReviewSelector {
  /**
   * Get reviews that are due for delivery across all users
   * @param limit Maximum number of reviews to return
   * @returns Array of due reviews
   */
  getDueReviews(limit?: number): Promise<ScheduledReview[]>;

  /**
   * Get reviews that are due for a specific user
   * @param userId User to get reviews for
   * @returns Array of due reviews for the user
   */
  getUserDueReviews(userId: UserId): Promise<ScheduledReview[]>;

  /**
   * Check if a user is within their preferred delivery window
   * @param userId User to check
   * @param currentTime Current time to check against
   * @returns True if within delivery window
   */
  isWithinDeliveryWindow(userId: UserId, currentTime?: Date): Promise<boolean>;

  /**
   * Check if a user has reached their daily review limit
   * @param userId User to check
   * @param date Date to check limit for (defaults to today)
   * @returns True if daily limit reached
   */
  hasReachedDailyLimit(userId: UserId, date?: Date): Promise<boolean>;
}

/**
 * Service for delivering reviews to users via Telegram
 */
export interface ReviewDeliveryService {
  /**
   * Atomically claim a review for delivery (prevents duplicate sends)
   * @param userId User ID
   * @param wordId Word ID
   * @returns True if successfully claimed
   */
  claimReview(userId: UserId, wordId: WordId): Promise<boolean>;

  /**
   * Send a review message to the user
   * @param userId User ID
   * @param wordId Word ID
   * @param word Word data to send
   * @returns Telegram message ID
   */
  sendReview(userId: UserId, wordId: WordId, word: Word): Promise<string>;

  /**
   * Mark a review as sent and update state
   * @param userId User ID
   * @param wordId Word ID
   * @param messageId Telegram message ID
   */
  markSent(userId: UserId, wordId: WordId, messageId: string): Promise<void>;

  /**
   * Reset a review to 'due' state if sending failed
   * @param userId User ID
   * @param wordId Word ID
   */
  resetToDue(userId: UserId, wordId: WordId): Promise<void>;
}

/**
 * Service for processing user responses and scheduling next reviews
 */
export interface ReviewProcessor {
  /**
   * Process a difficulty rating from user callback
   * @param userId User ID
   * @param wordId Word ID
   * @param messageId Telegram message ID
   * @param difficulty User's difficulty rating
   * @returns True if successfully processed
   */
  processCallback(
    userId: UserId,
    wordId: WordId,
    messageId: string,
    difficulty: Difficulty
  ): Promise<boolean>;

  /**
   * Process reviews that have timed out (no response after 24h)
   * @param timeoutMinutes Timeout threshold in minutes (default: 1440 = 24h)
   * @returns Number of reviews processed
   */
  processTimeouts(timeoutMinutes?: number): Promise<number>;

  /**
   * Schedule the next review for a word based on difficulty
   * @param userId User ID
   * @param wordId Word ID
   * @param difficulty Difficulty rating
   * @param reviewCount Current review count
   */
  scheduleNextReview(
    userId: UserId,
    wordId: WordId,
    difficulty: Difficulty,
    reviewCount: number
  ): Promise<void>;

  /**
   * Calculate the next interval based on difficulty and review history
   * @param difficulty Difficulty rating
   * @param reviewCount Number of previous reviews
   * @returns Interval in minutes
   */
  calculateInterval(difficulty: Difficulty, reviewCount: number): number;
}

/**
 * Service for handling account linking between web and Telegram
 */
export interface AccountLinker {
  /**
   * Validate a link code provided by user
   * @param code 8-character link code
   * @returns Validation result with user ID if valid
   */
  validateLinkCode(code: string): Promise<LinkCodeValidation>;

  /**
   * Link a Telegram chat to a user account
   * @param code Link code
   * @param telegramChatId Telegram chat ID
   * @returns True if successfully linked
   */
  linkAccount(code: string, telegramChatId: string): Promise<boolean>;

  /**
   * Record a link attempt for rate limiting
   * @param chatId Telegram chat ID
   * @param code Code that was attempted
   * @param success Whether the attempt was successful
   */
  recordLinkAttempt(chatId: string, code: string, success: boolean): Promise<void>;

  /**
   * Check if a chat ID is rate limited for link attempts
   * @param chatId Telegram chat ID
   * @returns True if rate limited
   */
  isRateLimited(chatId: string): Promise<boolean>;

  /**
   * Get the number of failed attempts in the last hour
   * @param chatId Telegram chat ID
   * @returns Number of failed attempts
   */
  getFailedAttempts(chatId: string): Promise<number>;
}

/**
 * Service for formatting Telegram messages
 */
export interface MessageFormatter {
  /**
   * Format a word review message with MarkdownV2 escaping
   * @param word Word data
   * @param pronunciation Optional pronunciation data
   * @returns Formatted message text
   */
  formatReview(word: Word, pronunciation?: Pronunciation): string;

  /**
   * Format user statistics for /stats command
   * @param stats User statistics
   * @returns Formatted stats message
   */
  formatStats(stats: UserStats): string;

  /**
   * Format welcome message based on user link status
   * @param isLinked Whether user account is linked
   * @returns Formatted welcome message
   */
  formatWelcome(isLinked: boolean): string;

  /**
   * Format help message with available commands
   * @returns Formatted help message
   */
  formatHelp(): string;

  /**
   * Format settings display message
   * @param profile User profile with settings
   * @returns Formatted settings message
   */
  formatSettings(profile: UserProfile): string;

  /**
   * Escape text for MarkdownV2 format
   * @param text Text to escape
   * @returns Escaped text safe for Telegram MarkdownV2
   */
  escapeMarkdownV2(text: string): string;

  /**
   * Create inline keyboard for difficulty selection
   * @param userId User ID for callback data
   * @param wordId Word ID for callback data
   * @returns Inline keyboard markup
   */
  createDifficultyKeyboard(userId: UserId, wordId: WordId): unknown; // Telegram-specific type
}

/**
 * Repository interface for managing user profiles
 */
export interface UserProfileRepository {
  /**
   * Get user profile by ID
   * @param userId User ID
   * @returns User profile or null if not found
   */
  getProfile(userId: UserId): Promise<UserProfile | null>;

  /**
   * Get user profile by Telegram chat ID
   * @param chatId Telegram chat ID
   * @returns User profile or null if not found
   */
  getProfileByChatId(chatId: string): Promise<UserProfile | null>;

  /**
   * Update user profile
   * @param userId User ID
   * @param updates Partial profile updates
   */
  updateProfile(userId: UserId, updates: Partial<UserProfile>): Promise<void>;

  /**
   * Set user pause state
   * @param userId User ID
   * @param paused Whether user is paused
   */
  setPaused(userId: UserId, paused: boolean): Promise<void>;
}

/**
 * Repository interface for managing link codes
 */
export interface LinkCodeRepository {
  /**
   * Get link code by code string
   * @param code Link code
   * @returns Link code data or null if not found
   */
  getLinkCode(code: string): Promise<LinkCode | null>;

  /**
   * Mark link code as used
   * @param code Link code
   * @param usedAt When it was used
   */
  markUsed(code: string, usedAt?: Date): Promise<void>;

  /**
   * Clean up expired link codes
   * @param before Clean up codes that expired before this date
   * @returns Number of codes cleaned up
   */
  cleanupExpired(before?: Date): Promise<number>;
}

/**
 * Repository interface for managing link attempts
 */
export interface LinkAttemptRepository {
  /**
   * Record a link attempt
   * @param attempt Link attempt data
   */
  recordAttempt(attempt: Omit<LinkAttempt, 'id'>): Promise<void>;

  /**
   * Get failed attempts for a chat ID within time window
   * @param chatId Telegram chat ID
   * @param since Get attempts since this time
   * @returns Array of failed attempts
   */
  getFailedAttempts(chatId: string, since: Date): Promise<LinkAttempt[]>;

  /**
   * Clean up old link attempts
   * @param before Clean up attempts older than this date
   * @returns Number of attempts cleaned up
   */
  cleanupOld(before?: Date): Promise<number>;
}

/**
 * Repository interface for managing review events
 */
export interface ReviewEventRepository {
  /**
   * Record a review event
   * @param event Review event data
   */
  recordEvent(event: Omit<ReviewEvent, 'id'>): Promise<void>;

  /**
   * Get review events for a user within time range
   * @param userId User ID
   * @param since Get events since this time
   * @param until Get events until this time (optional)
   * @returns Array of review events
   */
  getEvents(userId: UserId, since: Date, until?: Date): Promise<ReviewEvent[]>;

  /**
   * Calculate user statistics from review events
   * @param userId User ID
   * @returns User statistics
   */
  calculateStats(userId: UserId): Promise<UserStats>;
}