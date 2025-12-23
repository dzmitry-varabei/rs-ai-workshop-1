/**
 * Statistics Service
 * 
 * Handles user learning statistics and review event tracking
 */

import type { UserProfileRepository, SrsRepository } from '@english-learning/data-layer-domain';
import type { UserId } from '@english-learning/data-layer-domain';

export interface UserStats {
  totalItems: number;
  dueToday: number;
  successRate: number;
  learningStreak: number;
}

export class StatsService {
  constructor(
    private readonly userProfileRepository: UserProfileRepository,
    private readonly srsRepository: SrsRepository
  ) {}

  /**
   * Calculate user learning statistics
   */
  async getUserStats(userId: UserId): Promise<UserStats> {
    try {
      // Get SRS stats for the user
      const srsStats = await this.srsRepository.getStats(userId);
      
      // Get due items for today
      const now = new Date();
      const dueItems = await this.srsRepository.getDueItems(userId, now, 100);
      
      // Calculate basic stats
      const totalItems = srsStats.total;
      const dueToday = dueItems.length;
      
      // For now, return basic stats
      // TODO: Implement proper success rate and streak calculation
      // This would require review event tracking which is not yet in Database Service
      const successRate = 0; // Placeholder
      const learningStreak = 0; // Placeholder
      
      return {
        totalItems,
        dueToday,
        successRate,
        learningStreak,
      };
    } catch (error) {
      console.error('Error calculating user stats:', error);
      return {
        totalItems: 0,
        dueToday: 0,
        successRate: 0,
        learningStreak: 0,
      };
    }
  }

  /**
   * Check if user has reached daily review limit
   */
  async hasReachedDailyLimit(userId: UserId, date: Date = new Date()): Promise<{
    hasReachedLimit: boolean;
    reviewsToday: number;
    dailyLimit: number;
  }> {
    try {
      const profile = await this.userProfileRepository.getProfile(userId);
      const dailyLimit = profile?.dailyWordLimit || 10;
      
      // TODO: Implement proper daily review counting
      // For now, assume no limit reached
      const reviewsToday = 0;
      
      return {
        hasReachedLimit: reviewsToday >= dailyLimit,
        reviewsToday,
        dailyLimit,
      };
    } catch (error) {
      console.error('Error checking daily limit:', error);
      return {
        hasReachedLimit: false,
        reviewsToday: 0,
        dailyLimit: 10,
      };
    }
  }

  /**
   * Check if user is within delivery window
   */
  async isWithinDeliveryWindow(userId: UserId, currentTime: Date = new Date()): Promise<{
    withinWindow: boolean;
    windowStart: string;
    windowEnd: string;
    userTimezone: string;
  }> {
    try {
      const result = await this.userProfileRepository.isWithinDeliveryWindow(userId, currentTime);
      return result;
    } catch (error) {
      console.error('Error checking delivery window:', error);
      // Default to within window to avoid blocking reviews
      return {
        withinWindow: true,
        windowStart: '09:00',
        windowEnd: '21:00',
        userTimezone: 'UTC',
      };
    }
  }
}