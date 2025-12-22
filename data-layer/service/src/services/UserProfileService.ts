/**
 * User Profile Service
 * 
 * Business logic for user profile operations.
 */

import type { UserProfileRepository, UserId } from '@english-learning/data-layer-domain';
import type { UserProfileResponse, UpdateProfileRequest } from '../types/api.js';

export class UserProfileService {
  constructor(private userProfileRepository: UserProfileRepository) {}

  async getProfile(userId: string): Promise<UserProfileResponse | null> {
    const profile = await this.userProfileRepository.getProfile(userId as UserId);
    if (!profile) {
      return null;
    }

    return {
      id: profile.id,
      telegramChatId: profile.telegramChatId,
      timezone: profile.timezone,
      dailyWordLimit: profile.dailyWordLimit,
      preferredWindowStart: profile.preferredWindowStart,
      preferredWindowEnd: profile.preferredWindowEnd,
      paused: profile.paused,
    };
  }

  async updateProfile(userId: string, updateData: UpdateProfileRequest): Promise<UserProfileResponse> {
    const profile = await this.userProfileRepository.upsertProfile(userId as UserId, updateData);

    return {
      id: profile.id,
      telegramChatId: profile.telegramChatId,
      timezone: profile.timezone,
      dailyWordLimit: profile.dailyWordLimit,
      preferredWindowStart: profile.preferredWindowStart,
      preferredWindowEnd: profile.preferredWindowEnd,
      paused: profile.paused,
    };
  }

  async checkDeliveryWindow(userId: string, currentTime?: string) {
    const checkTime = currentTime ? new Date(currentTime) : new Date();
    return this.userProfileRepository.isWithinDeliveryWindow(userId as UserId, checkTime);
  }

  async checkDailyLimit(userId: string, date?: string) {
    const checkDate = date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return this.userProfileRepository.hasReachedDailyLimit(userId as UserId, checkDate);
  }
}