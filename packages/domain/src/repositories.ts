import type { UserId, WordId, WordStatus, SrsDifficulty } from './types.js';
import type { Word } from './word.js';
import type { ScheduleNextReviewResult } from './srs.js';

/**
 * Repository interface for words
 * 
 * Implementations should provide methods to fetch words from the data source.
 */
export interface WordRepository {
  /**
   * Get a random batch of words for quiz
   * 
   * @param userId - User ID (for filtering already seen words if needed)
   * @param limit - Maximum number of words to return
   * @returns Array of words
   */
  getRandomBatch(userId: UserId, limit: number): Promise<Word[]>;

  /**
   * Get words by their IDs
   * 
   * @param ids - Array of word IDs
   * @returns Array of words (may be shorter than ids if some words don't exist)
   */
  getByIds(ids: WordId[]): Promise<Word[]>;

  /**
   * Get total count of words in dictionary
   * 
   * @returns Total number of words
   */
  getTotalCount(): Promise<number>;
}

/**
 * Statistics about user's word knowledge
 */
export interface UserWordStats {
  /** Total number of words the user has seen */
  totalSeen: number;
  /** Number of words marked as known */
  known: number;
  /** Number of words marked as unknown */
  unknown: number;
  /** Number of words marked as learning */
  learning: number;
  /** Knowledge percentage (known / totalSeen * 100) */
  knowledgePercentage: number;
}

/**
 * Repository interface for user word state
 * 
 * Manages the quiz results: which words the user knows/doesn't know.
 */
export interface UserWordStateRepository {
  /**
   * Mark a word as known by the user
   * 
   * @param userId - User ID
   * @param wordId - Word ID
   */
  markKnown(userId: UserId, wordId: WordId): Promise<void>;

  /**
   * Mark a word as unknown by the user
   * 
   * @param userId - User ID
   * @param wordId - Word ID
   */
  markUnknown(userId: UserId, wordId: WordId): Promise<void>;

  /**
   * Get statistics about user's word knowledge
   * 
   * @param userId - User ID
   * @returns Statistics object
   */
  getStats(userId: UserId): Promise<UserWordStats>;

  /**
   * Get word status for a specific word
   * 
   * @param userId - User ID
   * @param wordId - Word ID
   * @returns Word status or null if word hasn't been seen yet
   */
  getStatus(userId: UserId, wordId: WordId): Promise<WordStatus | null>;

  /**
   * Reset all progress for a user (delete all word states)
   * 
   * @param userId - User ID
   */
  resetProgress(userId: UserId): Promise<void>;

  /**
   * Get all word IDs for a user filtered by status
   * 
   * @param userId - User ID
   * @param status - Word status to filter by
   * @returns Array of word IDs
   */
  getWordIdsByStatus(userId: UserId, status: WordStatus): Promise<WordId[]>;
}

/**
 * SRS item data structure
 */
export interface SrsItem {
  userId: UserId;
  wordId: WordId;
  nextReviewAt: Date;
  lastReviewAt: Date | null;
  intervalMinutes: number;
  difficultyLast: SrsDifficulty | null;
  reviewCount: number;
  active: boolean;
}

/**
 * Repository interface for spaced repetition items
 * 
 * Manages SRS items for the Telegram bot.
 */
export interface SrsRepository {
  /**
   * Create or get existing SRS item for a word
   * 
   * @param userId - User ID
   * @param wordId - Word ID
   * @param now - Current time
   * @returns SRS item
   */
  createOrGet(userId: UserId, wordId: WordId, now: Date): Promise<SrsItem>;

  /**
   * Get SRS items that are due for review
   * 
   * @param userId - User ID
   * @param now - Current time
   * @param limit - Maximum number of items to return
   * @returns Array of SRS items ready for review
   */
  getDueItems(userId: UserId, now: Date, limit: number): Promise<SrsItem[]>;

  /**
   * Update SRS item after review
   * 
   * @param userId - User ID
   * @param wordId - Word ID
   * @param scheduleResult - Result from scheduleNextReview function
   * @param difficulty - Difficulty chosen by user
   * @param now - Current time
   */
  updateAfterReview(
    userId: UserId,
    wordId: WordId,
    scheduleResult: ScheduleNextReviewResult,
    difficulty: SrsDifficulty,
    now: Date
  ): Promise<void>;

  /**
   * Get SRS item by user and word
   * 
   * @param userId - User ID
   * @param wordId - Word ID
   * @returns SRS item or null if not found
   */
  getItem(userId: UserId, wordId: WordId): Promise<SrsItem | null>;

  /**
   * Deactivate SRS item (mark as inactive)
   * 
   * @param userId - User ID
   * @param wordId - Word ID
   */
  deactivate(userId: UserId, wordId: WordId): Promise<void>;

  /**
   * Get statistics about user's SRS items
   * 
   * @param userId - User ID
   * @returns Statistics object
   */
  getStats(userId: UserId): Promise<{
    total: number;
    active: number;
    due: number;
    reviewCount: number;
  }>;
}

