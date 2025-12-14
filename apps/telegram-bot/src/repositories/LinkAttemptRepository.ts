/**
 * Supabase implementation of LinkAttemptRepository
 * Handles rate limiting for account linking attempts
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LinkAttemptRepository } from '../domain/interfaces';
import type { LinkAttempt } from '../domain/types';

export class SupabaseLinkAttemptRepository implements LinkAttemptRepository {
  constructor(private supabase: SupabaseClient) {}

  async recordAttempt(attempt: Omit<LinkAttempt, 'id'>): Promise<void> {
    const { error } = await this.supabase
      .from('link_attempts')
      .insert({
        chat_id: attempt.chatId,
        attempted_at: attempt.attemptedAt.toISOString(),
        success: attempt.success,
        code_attempted: attempt.codeAttempted,
      });

    if (error) {
      throw new Error(`Failed to record link attempt: ${error.message}`);
    }
  }

  async getFailedAttempts(chatId: string, since: Date): Promise<LinkAttempt[]> {
    const { data, error } = await this.supabase
      .from('link_attempts')
      .select('*')
      .eq('chat_id', chatId)
      .eq('success', false)
      .gte('attempted_at', since.toISOString())
      .order('attempted_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get failed attempts: ${error.message}`);
    }

    return (data ?? []).map(row => ({
      id: row.id,
      chatId: row.chat_id,
      attemptedAt: new Date(row.attempted_at),
      success: row.success,
      codeAttempted: row.code_attempted,
    }));
  }

  async cleanupOld(before: Date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)): Promise<number> {
    const { data, error } = await this.supabase
      .from('link_attempts')
      .delete()
      .lt('attempted_at', before.toISOString())
      .select('id');

    if (error) {
      throw new Error(`Failed to cleanup old link attempts: ${error.message}`);
    }

    return data?.length ?? 0;
  }
}