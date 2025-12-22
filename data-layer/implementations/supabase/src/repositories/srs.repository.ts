import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  UserId,
  WordId,
  SrsDifficulty,
  SrsRepository,
  SrsItem,
  ScheduleNextReviewResult,
} from '@english-learning/data-layer-domain';
import { createInitialSrsItem } from '@english-learning/data-layer-domain';

/**
 * Database row type for srs_items table
 */
interface SrsItemRow {
  user_id: string;
  word_id: string;
  next_review_at: string;
  last_review_at: string | null;
  interval_minutes: number;
  difficulty_last: SrsDifficulty | null;
  review_count: number;
  active: boolean;
}

/**
 * Supabase implementation of SrsRepository
 */
export class SupabaseSrsRepository implements SrsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async createOrGet(userId: UserId, wordId: WordId, now: Date): Promise<SrsItem> {
    // Try to get existing item
    const { data: existing, error: fetchError } = await this.client
      .from('srs_items')
      .select('*')
      .eq('user_id', userId)
      .eq('word_id', wordId)
      .single();

    if (existing) {
      return this.mapRowToItem(existing);
    }

    // If not found and it's not a "not found" error, throw
    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch SRS item: ${fetchError.message}`);
    }

    // Create new item
    const initial = createInitialSrsItem(now);
    const { data, error } = await this.client
      .from('srs_items')
      .insert({
        user_id: userId,
        word_id: wordId,
        next_review_at: initial.nextReviewAt.toISOString(),
        last_review_at: null,
        interval_minutes: initial.intervalMinutes,
        difficulty_last: null,
        review_count: 0,
        active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create SRS item: ${error.message}`);
    }

    return this.mapRowToItem(data);
  }

  async getDueItems(userId: UserId, now: Date, limit: number): Promise<SrsItem[]> {
    const { data, error } = await this.client
      .from('srs_items')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .lte('next_review_at', now.toISOString())
      .order('next_review_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get due SRS items: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map((row) => this.mapRowToItem(row));
  }

  async updateAfterReview(
    userId: UserId,
    wordId: WordId,
    scheduleResult: ScheduleNextReviewResult,
    difficulty: SrsDifficulty,
    now: Date
  ): Promise<void> {
    // First, get current item to increment review_count
    const { data: current, error: fetchError } = await this.client
      .from('srs_items')
      .select('review_count')
      .eq('user_id', userId)
      .eq('word_id', wordId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch SRS item for update: ${fetchError.message}`);
    }

    const newReviewCount = (current?.review_count ?? 0) + 1;

    const { error } = await this.client
      .from('srs_items')
      .update({
        next_review_at: scheduleResult.nextReviewAt.toISOString(),
        last_review_at: now.toISOString(),
        interval_minutes: scheduleResult.nextIntervalMinutes,
        difficulty_last: difficulty,
        review_count: newReviewCount,
        active: true,
      })
      .eq('user_id', userId)
      .eq('word_id', wordId);

    if (error) {
      throw new Error(`Failed to update SRS item after review: ${error.message}`);
    }
  }

  async getItem(userId: UserId, wordId: WordId): Promise<SrsItem | null> {
    const { data, error } = await this.client
      .from('srs_items')
      .select('*')
      .eq('user_id', userId)
      .eq('word_id', wordId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw new Error(`Failed to get SRS item: ${error.message}`);
    }

    return data ? this.mapRowToItem(data) : null;
  }

  async deactivate(userId: UserId, wordId: WordId): Promise<void> {
    const { error } = await this.client
      .from('srs_items')
      .update({ active: false })
      .eq('user_id', userId)
      .eq('word_id', wordId);

    if (error) {
      throw new Error(`Failed to deactivate SRS item: ${error.message}`);
    }
  }

  async getStats(userId: UserId): Promise<{
    total: number;
    active: number;
    due: number;
    reviewCount: number;
  }> {
    const now = new Date();

    // Get all items
    const { data: allItems, error: allError } = await this.client
      .from('srs_items')
      .select('active, next_review_at, review_count')
      .eq('user_id', userId);

    if (allError) {
      throw new Error(`Failed to get SRS stats: ${allError.message}`);
    }

    if (!allItems || allItems.length === 0) {
      return {
        total: 0,
        active: 0,
        due: 0,
        reviewCount: 0,
      };
    }

    const total = allItems.length;
    const active = allItems.filter((item) => item.active).length;
    const due = allItems.filter(
      (item) => item.active && new Date(item.next_review_at) <= now
    ).length;
    const reviewCount = allItems.reduce((sum, item) => sum + (item.review_count ?? 0), 0);

    return {
      total,
      active,
      due,
      reviewCount,
    };
  }

  // TODO: Implement these methods for Supabase
  async getGlobalDueReviews(now: Date, limit: number, offset: number): Promise<Array<{
    userId: UserId;
    wordId: WordId;
    nextReviewAt: Date;
    intervalMinutes: number;
    reviewCount: number;
    user: {
      telegramChatId?: string;
      timezone: string;
      preferredWindowStart: string;
      preferredWindowEnd: string;
    };
  }>> {
    // TODO: Implement with proper join to user profiles
    return [];
  }

  async claimReviews(limit: number): Promise<Array<{
    userId: UserId;
    wordId: WordId;
  }>> {
    // TODO: Implement atomic claiming
    return [];
  }

  async markSent(userId: UserId, wordId: WordId, messageId: string, sentAt: Date): Promise<void> {
    // TODO: Implement message tracking
  }

  async resetToDue(userId: UserId, wordId: WordId): Promise<void> {
    // TODO: Implement reset to due state
  }

  async processTimeouts(timeoutMinutes: number = 1440): Promise<number> {
    // TODO: Implement timeout processing
    return 0;
  }

  async getProcessingStats(): Promise<{
    awaitingResponse: number;
    overdue: number;
    processedToday: number;
  }> {
    // TODO: Implement processing stats
    return {
      awaitingResponse: 0,
      overdue: 0,
      processedToday: 0,
    };
  }

  /**
   * Map database row to domain SrsItem
   */
  private mapRowToItem(row: SrsItemRow): SrsItem {
    return {
      userId: row.user_id as UserId,
      wordId: row.word_id as WordId,
      nextReviewAt: new Date(row.next_review_at),
      lastReviewAt: row.last_review_at ? new Date(row.last_review_at) : null,
      intervalMinutes: row.interval_minutes,
      difficultyLast: row.difficulty_last,
      reviewCount: row.review_count,
      active: row.active,
    };
  }
}

