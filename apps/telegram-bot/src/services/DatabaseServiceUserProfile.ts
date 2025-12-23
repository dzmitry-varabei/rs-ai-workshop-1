/**
 * UserProfile implementation that uses Database Service API
 * instead of direct Supabase access
 */

import type { UserProfileRepository } from '../domain/interfaces';
import type { UserProfile, UserId } from '../domain/types';

export class DatabaseServiceUserProfile implements UserProfileRepository {
  constructor(private readonly baseUrl: string) {}

  async getProfile(userId: UserId): Promise<UserProfile | null> {
    try {
      // Use Database Service API to get user profile
      const response = await fetch(`${this.baseUrl}/users/${userId}/profile`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const profile = await response.json() as UserProfile;
      return profile;
    } catch (error) {
      console.error('Error getting profile:', error);
      return null;
    }
  }

  async getProfileByChatId(telegramChatId: string): Promise<UserProfile | null> {
    try {
      // We need to find user by telegramChatId
      // For now, we'll use the connection endpoint to check if this chatId is linked
      const response = await fetch(`${this.baseUrl}/api/link-codes/connection-by-chat/${telegramChatId}`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const connection = await response.json() as { userId: string; linkedAt: string };
      
      // Create a basic profile from the connection info
      return {
        id: connection.userId as UserId,
        telegramChatId,
        createdAt: new Date(connection.linkedAt),
        timezone: 'UTC',
        dailyWordLimit: 10,
        preferredWindow: {
          start: '09:00',
          end: '21:00',
          timezone: 'UTC',
        },
        paused: false,
      };
    } catch (error) {
      console.error('Error getting profile by chat ID:', error);
      return null;
    }
  }

  async upsertProfile(_userId: UserId, _updates: Partial<UserProfile>): Promise<void> {
    try {
      // For now, we don't support updating profiles through Database Service
      // This would need to be implemented in the Database Service API
      console.log('Profile update not implemented for Database Service');
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  }

  async updateSettings(_userId: UserId, _settings: {
    isPaused?: boolean;
    timezone?: string;
    dailyGoal?: number;
    reviewTime?: string;
  }): Promise<void> {
    try {
      // For now, we don't support updating settings through Database Service
      console.log('Settings update not implemented for Database Service');
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  }

  async updateProfile(_userId: UserId, _updates: Partial<UserProfile>): Promise<void> {
    try {
      // For now, we don't support updating profiles through Database Service
      // This would need to be implemented in the Database Service API
      console.log('Profile update not implemented for Database Service');
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  }

  async setPaused(_userId: UserId, _paused: boolean): Promise<void> {
    try {
      // For now, we don't support updating pause state through Database Service
      console.log('Pause state update not implemented for Database Service');
    } catch (error) {
      console.error('Error setting pause state:', error);
    }
  }
}