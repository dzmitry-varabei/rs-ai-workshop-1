/**
 * Supabase implementation of LinkCodeRepository
 * Handles account linking codes with validation and cleanup
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LinkCodeRepository } from '../domain/interfaces';
import type { LinkCode } from '../domain/types';

export class SupabaseLinkCodeRepository implements LinkCodeRepository {
  constructor(private supabase: SupabaseClient) {}

  async getLinkCode(code: string): Promise<LinkCode | null> {
    const { data, error } = await this.supabase
      .from('link_codes')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      code: data.code,
      userId: data.user_id,
      expiresAt: new Date(data.expires_at),
      usedAt: data.used_at ? new Date(data.used_at) : undefined,
      createdAt: new Date(data.created_at),
    };
  }

  async markUsed(code: string, usedAt: Date = new Date()): Promise<void> {
    const { error } = await this.supabase
      .from('link_codes')
      .update({ used_at: usedAt.toISOString() })
      .eq('code', code);

    if (error) {
      throw new Error(`Failed to mark link code as used: ${error.message}`);
    }
  }

  async cleanupExpired(before: Date = new Date()): Promise<number> {
    const { data, error } = await this.supabase
      .from('link_codes')
      .delete()
      .lt('expires_at', before.toISOString())
      .select('code');

    if (error) {
      throw new Error(`Failed to cleanup expired link codes: ${error.message}`);
    }

    return data?.length ?? 0;
  }
}