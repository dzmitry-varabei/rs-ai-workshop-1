/**
 * Service for processing user responses and scheduling next reviews
 * Handles difficulty ratings, timeout processing, and SRS calculations
 */

import type { DatabaseClient } from '@english-learning/data-layer-client';
import type { ReviewProcessor } from '../domain/interfaces';
import type { UserId, WordId, Difficulty } from '../domain/types';

export class ReviewProcessorService implements ReviewProcessor {
  constructor(private dbClient: DatabaseClient) {}

  async processCallback(
    userId: UserId,
    wordId: WordId,
    messageId: string,
    difficulty: Difficulty
  ): Promise<boolean> {
    try {
      // Map domain difficulty to API difficulty
      const apiDifficulty = this.mapDifficultyToApi(difficulty);
      
      // Record the review using Database Service
      await this.dbClient.recordReview(userId, wordId, apiDifficulty);
      
      return true;
    } catch (error) {
      console.error('Error processing callback:', error);
      return false;
    }
  }

  async processTimeouts(timeoutMinutes: number = 1440): Promise<number> {
    try {
      // TODO: Create ticket for Database Service to add timeout processing endpoint
      // For now, return 0 as this functionality needs to be added to Database Service
      console.warn('processTimeouts: Not yet supported by Database Service');
      return 0;
    } catch (error) {
      console.error('Error processing timeouts:', error);
      return 0;
    }
  }

  async scheduleNextReview(
    userId: UserId,
    wordId: WordId,
    difficulty: Difficulty,
    reviewCount: number
  ): Promise<void> {
    try {
      // The Database Service recordReview method handles scheduling automatically
      // So this method is essentially a no-op when using the Database Service
      const apiDifficulty = this.mapDifficultyToApi(difficulty);
      await this.dbClient.recordReview(userId, wordId, apiDifficulty);
    } catch (error) {
      console.error('Error scheduling next review:', error);
      throw error;
    }
  }

  calculateInterval(difficulty: Difficulty, reviewCount: number): number {
    // Base intervals in minutes based on difficulty
    const baseIntervals = {
      hard: 10,      // 10 minutes
      normal: 1440,  // 24 hours
      good: 4320,    // 72 hours (3 days)
      easy: 10080,   // 168 hours (1 week)
    };

    const baseInterval = baseIntervals[difficulty];
    
    // Apply review count multiplier
    // Each successful review increases the interval
    const multiplier = Math.max(1, reviewCount + 1);
    
    // Calculate final interval with minimum of 10 minutes
    const finalInterval = Math.max(10, baseInterval * multiplier);
    
    return finalInterval;
  }

  /**
   * Map domain difficulty to API difficulty
   */
  private mapDifficultyToApi(difficulty: Difficulty): 'easy' | 'medium' | 'hard' | 'very_hard' {
    const mapping = {
      easy: 'easy' as const,
      good: 'medium' as const,
      normal: 'hard' as const,
      hard: 'very_hard' as const,
    };
    
    return mapping[difficulty];
  }

  /**
   * Process a batch of callbacks efficiently
   * Useful for handling multiple user responses at once
   */
  async processBatchCallbacks(
    callbacks: Array<{
      userId: UserId;
      wordId: WordId;
      messageId: string;
      difficulty: Difficulty;
    }>
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    // Process callbacks in parallel with limited concurrency
    const batchSize = 5;
    for (let i = 0; i < callbacks.length; i += batchSize) {
      const batch = callbacks.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(callback =>
          this.processCallback(
            callback.userId,
            callback.wordId,
            callback.messageId,
            callback.difficulty
          )
        )
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          processed++;
        } else {
          failed++;
        }
      }
    }

    return { processed, failed };
  }

  /**
   * Get statistics about review processing
   */
  async getProcessingStats(): Promise<{
    awaitingResponse: number;
    overdue: number;
    processedToday: number;
  }> {
    try {
      // TODO: Create ticket for Database Service to add processing stats endpoint
      // For now, return zeros as this functionality needs to be added to Database Service
      console.warn('getProcessingStats: Not yet supported by Database Service');
      return {
        awaitingResponse: 0,
        overdue: 0,
        processedToday: 0,
      };
    } catch (error) {
      console.error('Error getting processing stats:', error);
      return {
        awaitingResponse: 0,
        overdue: 0,
        processedToday: 0,
      };
    }
  }
}