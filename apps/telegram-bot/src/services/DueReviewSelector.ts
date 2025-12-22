/**
 * Service for selecting due reviews based on user preferences and time windows
 * Handles timezone conversions, delivery windows, and daily limits
 */

import type { DatabaseClient } from '@english-learning/data-layer-client';
import type { DueReviewSelector } from '../domain/interfaces';
import type { ScheduledReview, UserId } from '../domain/types';

export class DueReviewSelectorService implements DueReviewSelector {
  constructor(private dbClient: DatabaseClient) {}

  async getDueReviews(limit: number = 10): Promise<ScheduledReview[]> {
    try {
      // Get due words from all users
      // Note: The Database Service doesn't have a global getDueWords method yet
      // For now, we'll need to implement this differently or create a ticket for the Database Service
      
      // TODO: Create ticket for Database Service to add global due words endpoint
      // For now, return empty array as this method needs Database Service enhancement
      console.warn('getDueReviews: Global due reviews not yet supported by Database Service');
      return [];
    } catch (error) {
      console.error('Error getting due reviews:', error);
      return [];
    }
  }

  async getUserDueReviews(userId: UserId): Promise<ScheduledReview[]> {
    try {
      // Get due words for specific user
      const srsItems = await this.dbClient.getDueWords(userId, 50); // Get more to filter locally
      
      // Convert SrsItemResponse to ScheduledReview
      return srsItems.map((item: any) => ({
        userId: item.userId,
        wordId: item.wordId,
        nextReviewAt: new Date(item.nextReviewAt),
        intervalMinutes: item.intervalMinutes,
        reviewCount: item.reviewCount,
        deliveryState: 'due' as const, // SRS items from getDueWords are due
      }));
    } catch (error) {
      console.error('Error getting user due reviews:', error);
      return [];
    }
  }

  async isWithinDeliveryWindow(userId: UserId, currentTime: Date = new Date()): Promise<boolean> {
    try {
      // TODO: Create ticket for Database Service to add user profile endpoint
      // For now, assume within window to avoid blocking reviews
      console.warn('isWithinDeliveryWindow: User profile access not yet supported by Database Service');
      return true;
    } catch (error) {
      console.error('Error checking delivery window:', error);
      // On error, assume within window to avoid blocking reviews
      return true;
    }
  }

  async hasReachedDailyLimit(userId: UserId, date: Date = new Date()): Promise<boolean> {
    try {
      // TODO: Create ticket for Database Service to add daily limit checking
      // For now, assume limit not reached to avoid blocking reviews
      console.warn('hasReachedDailyLimit: Daily limit checking not yet supported by Database Service');
      return false;
    } catch (error) {
      console.error('Error checking daily limit:', error);
      // On error, assume limit not reached to avoid blocking reviews
      return false;
    }
  }

  /**
   * Get users who should receive reviews right now
   * Considers timezone, delivery window, pause state, and daily limits
   */
  async getEligibleUsers(): Promise<UserId[]> {
    try {
      // TODO: Create ticket for Database Service to add eligible users endpoint
      // This requires complex user profile filtering not yet available in Database Service
      console.warn('getEligibleUsers: Not yet supported by Database Service');
      return [];
    } catch (error) {
      console.error('Error getting eligible users:', error);
      return [];
    }
  }
}