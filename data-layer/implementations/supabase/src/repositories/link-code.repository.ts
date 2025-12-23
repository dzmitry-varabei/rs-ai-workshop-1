import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId, LinkCode, LinkCodeRepository } from '@english-learning/data-layer-domain';

/**
 * Database row type (matching Supabase schema)
 */
interface LinkCodeRow {
  code: string;
  user_id: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

/**
 * Supabase implementation of LinkCodeRepository
 */
export class SupabaseLinkCodeRepository implements LinkCodeRepository {
  constructor(private readonly client: SupabaseClient) {}

  async generateLinkCode(userId: UserId): Promise<LinkCode> {
    // Generate 8-character alphanumeric code
    const code = this.generateRandomCode();
    
    // Set expiration to 15 minutes from now
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);
    
    const now = new Date();

    const { data, error } = await this.client
      .from('link_codes')
      .insert({
        code,
        user_id: userId,
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to generate link code: ${error.message}`);
    }

    return this.mapRowToDomain(data);
  }

  async getLinkCode(code: string): Promise<LinkCode | null> {
    const { data, error } = await this.client
      .from('link_codes')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapRowToDomain(data);
  }

  async markUsed(code: string, usedAt: Date = new Date()): Promise<void> {
    const { error } = await this.client
      .from('link_codes')
      .update({ used_at: usedAt.toISOString() })
      .eq('code', code);

    if (error) {
      throw new Error(`Failed to mark link code as used: ${error.message}`);
    }
  }

  async cleanupExpired(before: Date = new Date()): Promise<number> {
    const { data, error } = await this.client
      .from('link_codes')
      .delete()
      .lt('expires_at', before.toISOString())
      .select('code');

    if (error) {
      throw new Error(`Failed to cleanup expired link codes: ${error.message}`);
    }

    return data?.length ?? 0;
  }

  /**
   * Generate a random 8-character alphanumeric code
   */
  private generateRandomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Map database row to domain LinkCode object
   */
  private mapRowToDomain(row: LinkCodeRow): LinkCode {
    return {
      code: row.code,
      userId: row.user_id as UserId,
      expiresAt: new Date(row.expires_at),
      usedAt: row.used_at ? new Date(row.used_at) : undefined,
      createdAt: new Date(row.created_at),
    };
  }
}