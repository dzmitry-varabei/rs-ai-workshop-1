/**
 * Word Service
 * 
 * Business logic layer for word operations.
 * Encapsulates domain logic and repository interactions.
 */

import type { WordRepository } from '@english-learning/domain';
import type { WordResponse } from '../types/api.js';

export class WordService {
  constructor(private wordRepository: WordRepository) {}

  async getRandomWords(userId: string, limit: number): Promise<WordResponse[]> {
    const words = await this.wordRepository.getRandomBatch(userId as any, limit);
    
    return words.map(word => ({
      id: word.id,
      textEn: word.text, // NOTE: API uses textEn, domain uses text
      level: word.level,
      exampleEn: word.exampleEn,
      exampleRu: word.exampleRu,
      tags: word.tags,
      pronunciations: word.pronunciations.map(p => ({
        locale: p.locale,
        ipa: p.ipa,
        audioUrl: p.audioUrl,
      })),
    }));
  }

  async getWordById(wordId: string): Promise<WordResponse | null> {
    const words = await this.wordRepository.getByIds([wordId as any]);
    const word = words[0];
    
    if (!word) {
      return null;
    }

    return {
      id: word.id,
      textEn: word.text, // NOTE: API uses textEn, domain uses text
      level: word.level,
      exampleEn: word.exampleEn,
      exampleRu: word.exampleRu,
      tags: word.tags,
      pronunciations: word.pronunciations.map(p => ({
        locale: p.locale,
        ipa: p.ipa,
        audioUrl: p.audioUrl,
      })),
    };
  }

  async getTotalCount(): Promise<number> {
    return this.wordRepository.getTotalCount();
  }
}