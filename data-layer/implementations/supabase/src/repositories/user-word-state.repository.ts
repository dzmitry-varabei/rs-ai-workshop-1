import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  UserId,
  WordId,
  WordStatus,
  UserWordStateRepository,
  UserWordStats,
} from '@english-learning/data-layer-domain';

/**
 * Database row type for user_word_state table
 */
interface UserWordStateRow {
  user_id: string;
  word_id: string;
  status: WordStatus;
  last_seen_at: string;
  seen_count: number;
}

/**
 * Supabase implementation of UserWordStateRepository
 */
export class SupabaseUserWordStateRepository implements UserWordStateRepository {
  constructor(private readonly client: SupabaseClient) {}

  async markKnown(userId: UserId, wordId: WordId): Promise<void> {
    // First, try to get existing record
    const { data: existing } = await this.client
      .from('user_word_state')
      .select('seen_count')
      .eq('user_id', userId)
      .eq('word_id', wordId)
      .single();

    const newSeenCount = existing ? existing.seen_count + 1 : 1;

    const { error } = await this.client
      .from('user_word_state')
      .upsert(
        {
          user_id: userId,
          word_id: wordId,
          status: 'known',
          last_seen_at: new Date().toISOString(),
          seen_count: newSeenCount,
        },
        {
          onConflict: 'user_id,word_id',
        }
      );

    if (error) {
      throw new Error(`Failed to mark word as known: ${error.message}`);
    }
  }

  async markUnknown(userId: UserId, wordId: WordId): Promise<void> {
    // First, try to get existing record
    const { data: existing } = await this.client
      .from('user_word_state')
      .select('seen_count')
      .eq('user_id', userId)
      .eq('word_id', wordId)
      .single();

    const newSeenCount = existing ? existing.seen_count + 1 : 1;

    const { error } = await this.client
      .from('user_word_state')
      .upsert(
        {
          user_id: userId,
          word_id: wordId,
          status: 'unknown',
          last_seen_at: new Date().toISOString(),
          seen_count: newSeenCount,
        },
        {
          onConflict: 'user_id,word_id',
        }
      );

    if (error) {
      throw new Error(`Failed to mark word as unknown: ${error.message}`);
    }
  }

  async getStats(userId: UserId): Promise<UserWordStats> {
    const { data, error } = await this.client
      .from('user_word_state')
      .select('status')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to get user word stats: ${error.message}`);
    }

    const stats: UserWordStats = {
      totalSeen: 0,
      known: 0,
      unknown: 0,
      learning: 0,
      knowledgePercentage: 0,
    };

    if (!data || data.length === 0) {
      return stats;
    }

    stats.totalSeen = data.length;

    for (const row of data) {
      switch (row.status) {
        case 'known':
          stats.known++;
          break;
        case 'unknown':
          stats.unknown++;
          break;
        case 'learning':
          stats.learning++;
          break;
      }
    }

    stats.knowledgePercentage =
      stats.totalSeen > 0 ? Math.round((stats.known / stats.totalSeen) * 100) : 0;

    return stats;
  }

  async getStatus(userId: UserId, wordId: WordId): Promise<WordStatus | null> {
    const { data, error } = await this.client
      .from('user_word_state')
      .select('status')
      .eq('user_id', userId)
      .eq('word_id', wordId)
      .limit(1);

    if (error) {
      throw new Error(`Failed to get word status: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0]?.status ?? null;
  }

  async resetProgress(userId: UserId): Promise<void> {
    const { error } = await this.client
      .from('user_word_state')
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to reset user progress: ${error.message}`);
    }
  }

  async getWordIdsByStatus(userId: UserId, status: WordStatus): Promise<WordId[]> {
    const { data, error } = await this.client
      .from('user_word_state')
      .select('word_id')
      .eq('user_id', userId)
      .eq('status', status);

    if (error) {
      throw new Error(`Failed to get word IDs by status: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data.map((row) => row.word_id as WordId);
  }
}


