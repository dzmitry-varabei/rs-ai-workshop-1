/**
 * In-memory implementation of UserProfileRepository
 */

import type { UserId, UserProfile, UserProfileRepository } from '@english-learning/data-layer-domain';

export class MemoryUserProfileRepository implements UserProfileRepository {
  private profiles = new Map<string, UserProfile>();
  private reviewCounts = new Map<string, Map<string, number>>(); // userId -> date -> count

  async getProfile(userId: UserId): Promise<UserProfile | null> {
    return this.profiles.get(userId) || null;
  }

  async upsertProfile(
    userId: UserId, 
    profileData: Partial<Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<UserProfile> {
    const now = new Date();
    const existing = this.profiles.get(userId);

    const profile: UserProfile = {
      id: userId,
      telegramChatId: profileData.telegramChatId || existing?.telegramChatId,
      timezone: profileData.timezone || existing?.timezone || 'UTC',
      dailyWordLimit: profileData.dailyWordLimit || existing?.dailyWordLimit || 10,
      preferredWindowStart: profileData.preferredWindowStart || existing?.preferredWindowStart || '09:00',
      preferredWindowEnd: profileData.preferredWindowEnd || existing?.preferredWindowEnd || '21:00',
      paused: profileData.paused !== undefined ? profileData.paused : (existing?.paused || false),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.profiles.set(userId, profile);
    return profile;
  }

  async isWithinDeliveryWindow(userId: UserId, currentTime: Date): Promise<{
    withinWindow: boolean;
    windowStart: string;
    windowEnd: string;
    userTimezone: string;
  }> {
    const profile = await this.getProfile(userId);
    if (!profile) {
      // Default window if no profile
      return {
        withinWindow: true,
        windowStart: '09:00',
        windowEnd: '21:00',
        userTimezone: 'UTC',
      };
    }

    // Simple time check (ignoring timezone for now in memory implementation)
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = profile.preferredWindowStart.split(':').map(Number);
    const [endHour, endMinute] = profile.preferredWindowEnd.split(':').map(Number);
    
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;

    const withinWindow = currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;

    return {
      withinWindow,
      windowStart: profile.preferredWindowStart,
      windowEnd: profile.preferredWindowEnd,
      userTimezone: profile.timezone,
    };
  }

  async hasReachedDailyLimit(userId: UserId, date: string): Promise<{
    hasReachedLimit: boolean;
    reviewsToday: number;
    dailyLimit: number;
  }> {
    const profile = await this.getProfile(userId);
    const dailyLimit = profile?.dailyWordLimit || 10;

    const userReviews = this.reviewCounts.get(userId);
    const reviewsToday = userReviews?.get(date) || 0;

    return {
      hasReachedLimit: reviewsToday >= dailyLimit,
      reviewsToday,
      dailyLimit,
    };
  }

  // Helper method to increment review count (for testing)
  incrementReviewCount(userId: UserId, date: string): void {
    if (!this.reviewCounts.has(userId)) {
      this.reviewCounts.set(userId, new Map());
    }
    const userReviews = this.reviewCounts.get(userId)!;
    const current = userReviews.get(date) || 0;
    userReviews.set(date, current + 1);
  }

  // Helper method to reset data (for testing)
  clear(): void {
    this.profiles.clear();
    this.reviewCounts.clear();
  }
}