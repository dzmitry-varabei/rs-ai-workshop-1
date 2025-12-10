import type { UserId, WordId, WordStatus } from './types.js';
import type { Word } from './word.js';

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
}

