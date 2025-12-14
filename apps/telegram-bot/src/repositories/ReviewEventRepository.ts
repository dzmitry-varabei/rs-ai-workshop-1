/**
 * Supabase implementation of ReviewEventRepository
 * Handles review event tracking and statistics calculation
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReviewEventRepository } from '../domain/interfaces';
import type { ReviewEvent, UserStats, UserId } from '../domain/types';

export class SupabaseReviewEventRepository implements ReviewEventRepository {
  constructor(private supabase: SupabaseClient) {}

  async recordEvent(event: Omit<ReviewEvent, 'id'>): Promise<void> {
    const { error } = await this.supabase
      .from('review_events')
      .insert({
        user_id: event.userId,
        word_id: event.wordId,
        reviewed_at: event.reviewedAt.toISOString(),
        difficulty: event.difficulty,
        source: event.source ?? 'telegram',
        message_id: event.messageId,
      });

    if (error) {
      throw new Error(`Failed to record review event: ${error.message}`);
    }
  }

  async getEvents(userId: UserId, since: Date, until?: Date): Promise<ReviewEvent[]> {
    let query = this.supabase
      .from('review_events')
      .select('*')
      .eq('user_id', userId)
      .gte('reviewed_at', since.toISOString())
      .order('reviewed_at', { ascending: false });

    if (until) {
      query = query.lte('reviewed_at', until.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get review events: ${error.message}`);
    }

    return (data ?? []).map(row => ({
      id: row.id,
      userId: row.user_id,
      wordId: row.word_id,
      reviewedAt: new Date(row.reviewed_at),
      difficulty: row.difficulty,
      source: row.source,
      messageId: row.message_id,
    }));
  }
  async calculateStats(userId: UserId): Promise<UserStats> {
    // Get stats for different time periods
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Query for today's reviews
    const { data: todayData, error: todayError } = await this.supabase
      .from('review_events')
      .select('difficulty')
      .eq('user_id', userId)
      .gte('reviewed_at', today.toISOString());

    if (todayError) {
      throw new Error(`Failed to get today's stats: ${todayError.message}`);
    }

    // NOTE: Week data not needed for current UserStats interface
    // Can be added later if weekly statistics are required

    // Query for this month's reviews
    const { data: monthData, error: monthError } = await this.supabase
      .from('review_events')
      .select('difficulty')
      .eq('user_id', userId)
      .gte('reviewed_at', thisMonth.toISOString());

    if (monthError) {
      throw new Error(`Failed to get month's stats: ${monthError.message}`);
    }

    // Calculate statistics
    const todayReviews = todayData?.length ?? 0;
    const monthReviews = monthData?.length ?? 0;

    // Calculate accuracy (good + easy / total)
    const calculateAccuracy = (data: any[]) => {
      if (!data || data.length === 0) return 0;
      const accurate = data.filter(r => r.difficulty === 'good' || r.difficulty === 'easy').length;
      return Math.round((accurate / data.length) * 100);
    };

    return {
      totalItems: monthReviews,
      dueToday: todayReviews,
      successRate: calculateAccuracy(monthData ?? []),
      learningStreak: await this.calculateStreak(userId),
    };
  }

  private async calculateStreak(userId: UserId): Promise<number> {
    // Get reviews grouped by date for streak calculation
    const { data, error } = await this.supabase
      .from('review_events')
      .select('reviewed_at')
      .eq('user_id', userId)
      .order('reviewed_at', { ascending: false });

    if (error || !data) {
      return 0;
    }

    // Group by date and calculate consecutive days
    const reviewDates = new Set(
      data.map(r => new Date(r.reviewed_at).toDateString())
    );

    let streak = 0;
    const today = new Date();
    
    for (let i = 0; i < 365; i++) { // Max 1 year streak
      const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      if (reviewDates.has(checkDate.toDateString())) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  private async getTotalReviews(userId: UserId): Promise<number> {
    const { count, error } = await this.supabase
      .from('review_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to get total reviews: ${error.message}`);
    }

    return count ?? 0;
  }
}