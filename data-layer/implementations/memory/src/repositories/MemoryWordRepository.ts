/**
 * In-memory implementation of WordRepository
 * 
 * Useful for testing and development without external dependencies.
 */

import type { WordRepository, UserId, WordId } from '@english-learning/data-layer-domain';
import type { Word } from '@english-learning/data-layer-domain';

export class MemoryWordRepository implements WordRepository {
  private words: Map<WordId, Word> = new Map();

  constructor(initialWords: Word[] = []) {
    initialWords.forEach(word => {
      this.words.set(word.id, word);
    });
  }

  async getRandomBatch(userId: UserId, limit: number): Promise<Word[]> {
    const allWords = Array.from(this.words.values());
    
    // Simple random selection (not cryptographically secure, but fine for dev/test)
    const shuffled = allWords.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  }

  async getByIds(ids: WordId[]): Promise<Word[]> {
    const result: Word[] = [];
    
    for (const id of ids) {
      const word = this.words.get(id);
      if (word) {
        result.push(word);
      }
    }
    
    return result;
  }

  async getTotalCount(): Promise<number> {
    return this.words.size;
  }

  // Additional methods for testing
  addWord(word: Word): void {
    this.words.set(word.id, word);
  }

  clear(): void {
    this.words.clear();
  }

  getAllWords(): Word[] {
    return Array.from(this.words.values());
  }
}