/**
 * Service for selecting due reviews based on user preferences and time windows
 * Handles timezone conversions, delivery windows, and daily limits
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DueReviewSelector } from '../domain/interfaces';
import type { ScheduledReview, UserId } from '../domain/types';
import { BotSrsRepository, SupabaseUserProfileRepository } from '../repositories';

export class DueReviewSelectorService implements DueReviewSelector {
  private botSrsRepo: BotSrsRepository;
  private userProfileRepo: SupabaseUserProfileRepository;

  constructor(private supabase: SupabaseClient) {
    this.botSrsRepo = new BotSrsRepository(supabase);
    this.userProfileRepo = new SupabaseUserProfileRepository(supabase);
  }

  async getDueReviews(limit: number = 10): Promise<ScheduledReview[]> {
    try {
      // Use the atomic RPC function to claim due reviews
      // This prevents race conditions when multiple bot instances are running
      return await this.botSrsRepo.claimDueReviews(limit);
    } catch (error) {
      console.error('Error getting due reviews:', error);
      return [];
    }
  }

  async getUserDueReviews(userId: UserId): Promise<ScheduledReview[]> {
    try {
      // Check if user is paused or outside delivery window
      const isWithinWindow = await this.isWithinDeliveryWindow(userId);
      if (!isWithinWindow) {
        return [];
      }

      // Check daily limit
      const hasReachedLimit = await this.hasReachedDailyLimit(userId);
      if (hasReachedLimit) {
        return [];
      }

      return await this.botSrsRepo.getUserDueReviews(userId);
    } catch (error) {
      console.error('Error getting user due reviews:', error);
      return [];
    }
  }

  async isWithinDeliveryWindow(userId: UserId, currentTime: Date = new Date()): Promise<boolean> {
    try {
      return await this.botSrsRepo.isWithinDeliveryWindow(userId, currentTime);
    } catch (error) {
      console.error('Error checking delivery window:', error);
      // On error, assume within window to avoid blocking reviews
      return true;
    }
  }

  async hasReachedDailyLimit(userId: UserId, date: Date = new Date()): Promise<boolean> {
    try {
      return await this.botSrsRepo.hasReachedDailyLimit(userId, date);
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
      const { data: profiles, error } = await this.supabase
        .from('profiles')
        .select('id, timezone, preferred_window_start, preferred_window_end, paused')
        .eq('paused', false)
        .not('telegram_chat_id', 'is', null);

      if (error || !profiles) {
        console.error('Error getting eligible users:', error);
        return [];
      }

      const now = new Date();
      const eligibleUsers: UserId[] = [];

      for (const profile of profiles) {
        // Check if within delivery window
        const isWithinWindow = await this.isWithinDeliveryWindow(profile.id as UserId, now);
        if (!isWithinWindow) {
          continue;
        }

        // Check daily limit
        const hasReachedLimit = await this.hasReachedDailyLimit(profile.id as UserId, now);
        if (hasReachedLimit) {
          continue;
        }

        eligibleUsers.push(profile.id as UserId);
      }

      return eligibleUsers;
    } catch (error) {
      console.error('Error getting eligible users:', error);
      return [];
    }
  }
}