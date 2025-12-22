/**
 * Spaced Repetition Service
 * 
 * Business logic for SRS (Spaced Repetition System) operations.
 */

import type { SrsRepository, WordRepository, SrsDifficulty } from '@english-learning/data-layer-domain';
import { scheduleNextReview } from '@english-learning/data-layer-domain';
import type { SrsItemResponse, SrsStatsResponse, RecordReviewRequest } from '../types/api.js';

// NOTE: Map API difficulty levels to domain SrsDifficulty
const mapDifficultyToDomain = (difficulty: string): SrsDifficulty => {
  const mapping: Record<string, SrsDifficulty> = {
    'very_hard': 'hard',
    'hard': 'hard',
    'medium': 'normal',
    'easy': 'easy',
  };
  return mapping[difficulty] || 'normal';
};

export class SrsService {
  constructor(
    private srsRepository: SrsRepository,
    private wordRepository: WordRepository
  ) {}

  async getDueWords(userId: string, limit: number): Promise<SrsItemResponse[]> {
    const now = new Date();
    const srsItems = await this.srsRepository.getDueItems(userId as any, now, limit);
    
    // Get word details for each SRS item
    const wordIds = srsItems.map(item => item.wordId);
    const words = await this.wordRepository.getByIds(wordIds);
    const wordsMap = new Map(words.map(word => [word.id, word]));

    return srsItems.map(item => {
      const word = wordsMap.get(item.wordId);
      if (!word) {
        throw new Error(`Word not found: ${item.wordId}`);
      }

      return {
        userId: item.userId,
        wordId: item.wordId,
        nextReviewAt: item.nextReviewAt.toISOString(),
        lastReviewAt: item.lastReviewAt?.toISOString() || null,
        intervalMinutes: item.intervalMinutes,
        difficultyLast: item.difficultyLast,
        reviewCount: item.reviewCount,
        active: item.active,
        word: {
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
        },
      };
    });
  }

  async recordReview(request: RecordReviewRequest): Promise<void> {
    const { userId, wordId, difficulty } = request;
    const now = new Date();

    // Get or create SRS item
    const srsItem = await this.srsRepository.createOrGet(userId as any, wordId as any, now);
    
    // Map API difficulty to domain difficulty
    const domainDifficulty = mapDifficultyToDomain(difficulty);
    
    // Calculate next review schedule
    const scheduleResult = scheduleNextReview({
      now,
      previousIntervalMinutes: srsItem.intervalMinutes,
      previousReviewCount: srsItem.reviewCount,
      difficulty: domainDifficulty,
    });

    // Update SRS item
    await this.srsRepository.updateAfterReview(
      userId as any,
      wordId as any,
      scheduleResult,
      domainDifficulty,
      now
    );
  }

  async getSrsStats(userId: string): Promise<SrsStatsResponse> {
    const stats = await this.srsRepository.getStats(userId as any);
    
    return {
      total: stats.total,
      active: stats.active,
      due: stats.due,
      reviewCount: stats.reviewCount,
    };
  }

  async createSrsItem(userId: string, wordId: string): Promise<void> {
    const now = new Date();
    await this.srsRepository.createOrGet(userId as any, wordId as any, now);
  }

  async deactivateSrsItem(userId: string, wordId: string): Promise<void> {
    await this.srsRepository.deactivate(userId as any, wordId as any);
  }

  async getGlobalDueReviews(limit: number = 10, offset: number = 0) {
    const now = new Date();
    const reviews = await this.srsRepository.getGlobalDueReviews(now, limit, offset);
    
    // Get word details for each review
    const wordIds = reviews.map(review => review.wordId);
    const words = await this.wordRepository.getByIds(wordIds);
    const wordsMap = new Map(words.map(word => [word.id, word]));

    return {
      reviews: reviews.map(review => {
        const word = wordsMap.get(review.wordId);
        return {
          userId: review.userId,
          wordId: review.wordId,
          nextReviewAt: review.nextReviewAt.toISOString(),
          intervalMinutes: review.intervalMinutes,
          reviewCount: review.reviewCount,
          user: review.user,
          word: word ? {
            id: word.id,
            textEn: word.text,
            level: word.level,
            exampleEn: word.exampleEn,
            exampleRu: word.exampleRu,
            tags: word.tags,
            pronunciations: word.pronunciations.map(p => ({
              locale: p.locale,
              ipa: p.ipa,
              audioUrl: p.audioUrl,
            })),
          } : null,
        };
      }).filter(review => review.word !== null),
      total: reviews.length,
      hasMore: reviews.length === limit,
    };
  }

  async claimReviews(limit: number = 10) {
    const claimed = await this.srsRepository.claimReviews(limit);
    
    // Get word details for claimed reviews
    const wordIds = claimed.map(item => item.wordId);
    const words = await this.wordRepository.getByIds(wordIds);
    const wordsMap = new Map(words.map(word => [word.id, word]));

    return {
      claimedReviews: claimed.map(item => {
        const word = wordsMap.get(item.wordId);
        return {
          userId: item.userId,
          wordId: item.wordId,
          word: word ? {
            id: word.id,
            textEn: word.text,
            level: word.level,
            exampleEn: word.exampleEn,
            exampleRu: word.exampleRu,
            tags: word.tags,
            pronunciations: word.pronunciations.map(p => ({
              locale: p.locale,
              ipa: p.ipa,
              audioUrl: p.audioUrl,
            })),
          } : null,
        };
      }).filter(item => item.word !== null),
    };
  }

  async markSent(userId: string, wordId: string, messageId: string, sentAt: string): Promise<void> {
    await this.srsRepository.markSent(
      userId as any, 
      wordId as any, 
      messageId, 
      new Date(sentAt)
    );
  }

  async resetToDue(userId: string, wordId: string): Promise<void> {
    await this.srsRepository.resetToDue(userId as any, wordId as any);
  }

  async processTimeouts(timeoutMinutes: number = 1440): Promise<{ processedCount: number }> {
    const processedCount = await this.srsRepository.processTimeouts(timeoutMinutes);
    return { processedCount };
  }

  async getProcessingStats() {
    return this.srsRepository.getProcessingStats();
  }
}