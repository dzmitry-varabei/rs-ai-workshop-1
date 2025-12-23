/**
 * User Profile Repository implementation that uses Database Service API
 * instead of direct Supabase access
 */

import type { UserProfileRepository } from '../domain/interfaces';
import type { UserProfile, UserId } from '../domain/types';

export class DatabaseServiceUserProfileRepository implements UserProfileRepository {
  constructor(private readonly baseUrl: string) {}

  async getProfile(userId: UserId): Promise<UserProfile | null> {
    try {
      // Use Database Service API to get user profile
      const response = await fetch(`${this.baseUrl}/users/${userId}/profile`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to get profile: ${response.status}`);
      }
      
      const data = await response.json() as UserProfile;
      return data;
    } catch (error) {
      console.error('Error getting profile:', error);
      return null;
    }
  }

  async getProfileByChatId(_telegramChatId: string): Promise<UserProfile | null> {
    try {
      // We need to find user by telegramChatId
      // Since we don't have a direct endpoint for this, we'll need to check
      // the connection status through the link codes API
      
      // For now, we'll create a mock profile based on the telegramChatId
      // This is a temporary solution until we have proper user profile management
      
      // Check if there's an active connection for this chat ID
      // We can do this by trying to find a user with this telegramChatId
      
      // For now, return null to indicate no profile found
      // This will be improved when we have proper user profile endpoints
      return null;
    } catch (error) {
      console.error('Error getting profile by chat ID:', error);
      return null;
    }
  }

  async upsertProfile(userId: UserId, updates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      // Use Database Service API to update user profile
      const response = await fetch(`${this.baseUrl}/users/${userId}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update profile: ${response.status}`);
      }
      
      const data = await response.json() as UserProfile;
      return data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  async deleteProfile(userId: UserId): Promise<void> {
    try {
      // Use Database Service API to delete user profile
      const response = await fetch(`${this.baseUrl}/users/${userId}/profile`, {
        method: 'DELETE',
      });
      
      if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to delete profile: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting profile:', error);
      throw error;
    }
  }

  async updateProfile(userId: UserId, updates: Partial<UserProfile>): Promise<void> {
    try {
      await this.upsertProfile(userId, updates);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  async setPaused(userId: UserId, paused: boolean): Promise<void> {
    try {
      await this.upsertProfile(userId, { paused });
    } catch (error) {
      console.error('Error setting pause state:', error);
      throw error;
    }
  }
}