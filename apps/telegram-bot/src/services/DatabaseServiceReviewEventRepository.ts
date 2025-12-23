/**
 * Database Service implementation of ReviewEventRepository
 * Uses Database Service API for review event tracking and statistics
 */

import type { DatabaseClient } from '@english-learning/data-layer-client';
import type { ReviewEventRepository } from '../domain/interfaces';
import type { ReviewEvent, UserStats, UserId } from '../domain/types';

export class DatabaseServiceReviewEventRepository implements ReviewEventRepository {
  constructor(private dbClient: DatabaseClient) {}

  async recordEvent(event: Omit<ReviewEvent, 'id'>): Promise<void> {
    try {
      // Map domain difficulty to API difficulty
      const apiDifficulty = this.mapDifficultyToApi(event.difficulty);
      
      // Record the review using Database Service
      await this.dbClient.recordReview(event.userId, event.wordId, apiDifficulty);
    } catch (error) {
      console.error('Failed to record review event:', error);
      throw new Error(`Failed to record review event: ${error}`);
    }
  }

  async getEvents(_userId: UserId, _since: Date, _until?: Date): Promise<ReviewEvent[]> {
    try {
      // Database Service doesn't have a direct getEvents method yet
      // For now, return empty array as this is mainly used for detailed analytics
      console.warn('getEvents: Not yet supported by Database Service');
      return [];
    } catch (error) {
      console.error('Failed to get review events:', error);
      return [];
    }
  }

  async calculateStats(userId: UserId): Promise<UserStats> {
    try {
      // Use Database Service stats endpoint
      const stats = await this.dbClient.getSrsStats(userId);
      
      return {
        totalItems: stats.total,
        dueToday: stats.due,
        successRate: 0, // Not available in SrsStatsResponse
        learningStreak: 0, // Not available in SrsStatsResponse
      };
    } catch (error) {
      console.error('Failed to calculate stats:', error);
      // Return default stats on error
      return {
        totalItems: 0,
        dueToday: 0,
        successRate: 0,
        learningStreak: 0,
      };
    }
  }

  /**
   * Map domain difficulty to API difficulty
   */
  private mapDifficultyToApi(difficulty: string): 'easy' | 'medium' | 'hard' | 'very_hard' {
    const mapping: Record<string, 'easy' | 'medium' | 'hard' | 'very_hard'> = {
      easy: 'easy',
      good: 'medium',
      normal: 'hard',
      hard: 'very_hard',
    };
    
    return mapping[difficulty] || 'hard';
  }
}