/**
 * Link Code Service
 * 
 * Handles link code generation and management for account linking
 * between web app and Telegram bot.
 */

import type { LinkCodeRepository, UserProfileRepository } from '@english-learning/data-layer-domain';
import type { UserId, LinkCode } from '@english-learning/data-layer-domain';

export class LinkCodeService {
  constructor(
    private readonly linkCodeRepository: LinkCodeRepository,
    private readonly userProfileRepository: UserProfileRepository
  ) {}

  /**
   * Generate a new link code for a user
   * 
   * @param userId - User ID
   * @returns Generated link code with expiration
   */
  async generateLinkCode(userId: UserId): Promise<{ code: string; expiresAt: Date }> {
    const linkCode = await this.linkCodeRepository.generateLinkCode(userId);
    
    return {
      code: linkCode.code,
      expiresAt: linkCode.expiresAt,
    };
  }

  /**
   * Get Telegram connection status for a user
   * 
   * @param userId - User ID
   * @returns Connection status information
   */
  async getTelegramConnection(userId: UserId): Promise<{
    isConnected: boolean;
    linkedAt?: Date;
    telegramChatId?: string;
  }> {
    const profile = await this.userProfileRepository.getProfile(userId);
    
    if (!profile || !profile.telegramChatId) {
      return { isConnected: false };
    }

    return {
      isConnected: true,
      linkedAt: profile.createdAt,
      telegramChatId: profile.telegramChatId,
    };
  }

  /**
   * Disconnect Telegram account for a user
   * 
   * @param userId - User ID
   */
  async disconnectTelegram(userId: UserId): Promise<void> {
    const profile = await this.userProfileRepository.getProfile(userId);
    
    if (profile) {
      await this.userProfileRepository.upsertProfile(userId, {
        telegramChatId: undefined,
      });
    }
  }
}