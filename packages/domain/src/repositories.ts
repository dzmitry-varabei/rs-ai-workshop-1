import type { UserId, WordId } from './types.js';
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

