/**
 * Supabase implementation of UserProfileRepository
 * Handles user profile management with bot-specific settings
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserProfileRepository } from '../domain/interfaces';
import type { UserProfile, UserId } from '../domain/types';

export class SupabaseUserProfileRepository implements UserProfileRepository {
  constructor(private supabase: SupabaseClient) {}

  async getProfile(userId: UserId): Promise<UserProfile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToUserProfile(data);
  }

  async getProfileByChatId(chatId: string): Promise<UserProfile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('telegram_chat_id', chatId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToUserProfile(data);
  }

  async updateProfile(userId: UserId, updates: Partial<UserProfile>): Promise<void> {
    const dbUpdates: any = {};

    if (updates.preferredWindow?.start !== undefined) {
      dbUpdates.preferred_window_start = updates.preferredWindow.start;
    }
    if (updates.preferredWindow?.end !== undefined) {
      dbUpdates.preferred_window_end = updates.preferredWindow.end;
    }
    if (updates.paused !== undefined) {
      dbUpdates.paused = updates.paused;
    }
    if (updates.timezone !== undefined) {
      dbUpdates.timezone = updates.timezone;
    }
    if (updates.dailyWordLimit !== undefined) {
      dbUpdates.daily_limit = updates.dailyWordLimit;
    }

    const { error } = await this.supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }
  }
  async setPaused(userId: UserId, paused: boolean): Promise<void> {
    const { error } = await this.supabase
      .from('profiles')
      .update({ paused })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to set pause state: ${error.message}`);
    }
  }

  private mapToUserProfile(data: any): UserProfile {
    return {
      id: data.id,
      telegramChatId: data.telegram_chat_id,
      timezone: data.timezone || 'UTC',
      dailyWordLimit: data.daily_limit || 20,
      preferredWindow: {
        start: data.preferred_window_start || '09:00',
        end: data.preferred_window_end || '21:00',
        timezone: data.timezone || 'UTC',
      },
      paused: data.paused || false,
      createdAt: new Date(data.created_at),
    };
  }
}