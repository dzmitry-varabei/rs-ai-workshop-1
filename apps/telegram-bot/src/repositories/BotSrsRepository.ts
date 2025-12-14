/**
 * Extended SRS repository for Telegram bot with delivery state management
 * Extends the base SRS functionality with bot-specific atomic operations
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId, WordId, DeliveryState } from '../domain/types';
import type { ScheduledReview, Difficulty } from '../domain/types';

export class BotSrsRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Atomically claim due reviews using the database RPC function
   * This prevents race conditions when multiple bot instances are running
   */
  async claimDueReviews(limit: number = 10): Promise<ScheduledReview[]> {
    const { data, error } = await this.supabase
      .rpc('rpc_claim_due_reviews', {
        p_limit: limit,
        p_now: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to claim due reviews: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // NOTE: We don't need word data here since ScheduledReview doesn't include it
    // Word data will be fetched separately when needed for message formatting

    // Get the full SRS item data for claimed reviews
    const userWordPairs = data.map((item: any) => ({ user_id: item.user_id, word_id: item.word_id }));
    
    const { data: srsData, error: srsError } = await this.supabase
      .from('srs_items')
      .select('*')
      .in('user_id', userWordPairs.map((p: { user_id: string; word_id: string }) => p.user_id))
      .in('word_id', userWordPairs.map((p: { user_id: string; word_id: string }) => p.word_id));

    if (srsError) {
      throw new Error(`Failed to get SRS data for claimed reviews: ${srsError.message}`);
    }

    // Map to ScheduledReview objects
    return data.map((item: any) => {
      const srsItem = srsData?.find(s => s.user_id === item.user_id && s.word_id === item.word_id);
      return {
        userId: item.user_id,
        wordId: item.word_id,
        nextReviewAt: new Date(), // Already due since we claimed it
        intervalMinutes: srsItem?.interval_minutes || 1440,
        reviewCount: srsItem?.review_count || 0,
        deliveryState: 'sending' as DeliveryState,
        lastClaimedAt: new Date(),
      };
    });
  }

  /**
   * Mark a review as sent with message ID
   */
  async markSent(userId: UserId, wordId: WordId, messageId: string): Promise<void> {
    const { error } = await this.supabase
      .from('srs_items')
      .update({
        delivery_state: 'awaiting_response',
        last_message_id: parseInt(messageId),
        last_sent_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('word_id', wordId);

    if (error) {
      throw new Error(`Failed to mark review as sent: ${error.message}`);
    }
  }

  /**
   * Reset a review to 'due' state if sending failed
   */
  async resetToDue(userId: UserId, wordId: WordId): Promise<void> {
    const { error } = await this.supabase
      .from('srs_items')
      .update({
        delivery_state: 'due',
        last_claimed_at: null,
      })
      .eq('user_id', userId)
      .eq('word_id', wordId);

    if (error) {
      throw new Error(`Failed to reset review to due: ${error.message}`);
    }
  }
  /**
   * Process difficulty rating using atomic RPC function
   * This ensures consistency between SRS updates and event recording
   */
  async processDifficultyRating(
    userId: UserId,
    wordId: WordId,
    messageId: string,
    difficulty: Difficulty
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .rpc('rpc_process_difficulty_rating', {
        p_user_id: userId,
        p_word_id: wordId,
        p_message_id: parseInt(messageId),
        p_difficulty: difficulty,
      });

    if (error) {
      throw new Error(`Failed to process difficulty rating: ${error.message}`);
    }

    return data === true;
  }

  /**
   * Process timed out reviews (no response after specified time)
   */
  async processTimeouts(timeoutMinutes: number = 1440): Promise<number> {
    const { data, error } = await this.supabase
      .rpc('rpc_process_timeout_reviews', {
        p_timeout_minutes: timeoutMinutes,
        p_now: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to process timeout reviews: ${error.message}`);
    }

    return data ?? 0;
  }

  /**
   * Get reviews that are due for a specific user (respecting delivery window and pause state)
   */
  async getUserDueReviews(userId: UserId): Promise<ScheduledReview[]> {
    const { data, error } = await this.supabase
      .from('srs_items')
      .select(`
        *,
        words (*)
      `)
      .eq('user_id', userId)
      .eq('delivery_state', 'due')
      .lte('next_review_at', new Date().toISOString())
      .order('next_review_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get user due reviews: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map(item => ({
      userId: item.user_id,
      wordId: item.word_id,
      nextReviewAt: new Date(item.next_review_at),
      intervalMinutes: item.interval_minutes,
      reviewCount: item.review_count,
      deliveryState: item.delivery_state,
      lastMessageId: item.last_message_id?.toString(),
      lastClaimedAt: item.last_claimed_at ? new Date(item.last_claimed_at) : undefined,
      lastSentAt: item.last_sent_at ? new Date(item.last_sent_at) : undefined,
    }));
  }

  /**
   * Check if a user has reached their daily review limit
   */
  async hasReachedDailyLimit(userId: UserId, date: Date = new Date()): Promise<boolean> {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Get user's daily limit
    const { data: profile, error: profileError } = await this.supabase
      .from('profiles')
      .select('daily_limit')
      .eq('id', userId)
      .single();

    if (profileError) {
      throw new Error(`Failed to get user profile: ${profileError.message}`);
    }

    const dailyLimit = profile?.daily_limit ?? 20;

    // Count today's reviews
    const { count, error } = await this.supabase
      .from('review_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('reviewed_at', startOfDay.toISOString())
      .lt('reviewed_at', endOfDay.toISOString());

    if (error) {
      throw new Error(`Failed to count daily reviews: ${error.message}`);
    }

    return (count ?? 0) >= dailyLimit;
  }

  /**
   * Check if user is within their preferred delivery window
   */
  async isWithinDeliveryWindow(userId: UserId, currentTime: Date = new Date()): Promise<boolean> {
    const { data: profile, error } = await this.supabase
      .from('profiles')
      .select('preferred_window_start, preferred_window_end, timezone, paused')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(`Failed to get user profile: ${error.message}`);
    }

    if (!profile || profile.paused) {
      return false;
    }

    // Convert current time to user's timezone
    const userTimezone = profile.timezone || 'UTC';
    const userTime = new Date(currentTime.toLocaleString('en-US', { timeZone: userTimezone }));
    const currentHour = userTime.getHours();
    const currentMinute = userTime.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    // Parse time windows (format: "HH:MM")
    const parseTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const windowStart = parseTime(profile.preferred_window_start || '09:00');
    const windowEnd = parseTime(profile.preferred_window_end || '21:00');

    // Handle window that crosses midnight
    if (windowStart > windowEnd) {
      return currentTimeMinutes >= windowStart || currentTimeMinutes <= windowEnd;
    }

    return currentTimeMinutes >= windowStart && currentTimeMinutes <= windowEnd;
  }
}