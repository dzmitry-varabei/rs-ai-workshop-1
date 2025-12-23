/**
 * Link Code Service
 * 
 * Handles link code generation and management for account linking
 * between web app and Telegram bot.
 */

import type { LinkCodeRepository, UserProfileRepository } from '@english-learning/data-layer-domain';
import type { UserId, LinkCode } from '@english-learning/data-layer-domain';

// Simple in-memory store for telegramChatId -> userId mapping
const chatIdToUserIdMap = new Map<string, string>();

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
    
    if (profile && profile.telegramChatId) {
      // Remove from our mapping
      chatIdToUserIdMap.delete(profile.telegramChatId);
      
      await this.userProfileRepository.upsertProfile(userId, {
        telegramChatId: undefined,
      });
    }
  }

  /**
   * Use a link code to connect Telegram account
   * 
   * @param code - Link code
   * @param telegramChatId - Telegram chat ID
   * @returns Result of the linking operation
   */
  async useLinkCode(code: string, telegramChatId: string): Promise<{
    success: boolean;
    userId?: string;
    error?: string;
  }> {
    try {
      // Get the link code
      const linkCode = await this.linkCodeRepository.getLinkCode(code);
      
      if (!linkCode) {
        return { success: false, error: 'invalid_code' };
      }

      // Check if expired
      if (linkCode.expiresAt < new Date()) {
        return { success: false, error: 'expired' };
      }

      // Check if already used
      if (linkCode.usedAt) {
        return { success: false, error: 'already_used' };
      }

      // Mark code as used
      await this.linkCodeRepository.markUsed(code);

      // Update user profile with Telegram chat ID
      await this.userProfileRepository.upsertProfile(linkCode.userId, {
        telegramChatId,
      });

      // Store the mapping in memory
      chatIdToUserIdMap.set(telegramChatId, linkCode.userId);

      return {
        success: true,
        userId: linkCode.userId,
      };
    } catch (error) {
      console.error('Error using link code:', error);
      return { success: false, error: 'internal_error' };
    }
  }

  /**
   * Get connection info by Telegram chat ID
   * 
   * @param telegramChatId - Telegram chat ID
   * @returns Connection info or null if not found
   */
  async getConnectionByChatId(telegramChatId: string): Promise<{
    userId: string;
    linkedAt: Date;
  } | null> {
    try {
      // Check our in-memory mapping first
      const userId = chatIdToUserIdMap.get(telegramChatId);
      
      if (!userId) {
        return null;
      }

      const profile = await this.userProfileRepository.getProfile(userId as UserId);
      
      if (!profile || profile.telegramChatId !== telegramChatId) {
        // Clean up stale mapping
        chatIdToUserIdMap.delete(telegramChatId);
        return null;
      }

      return {
        userId,
        linkedAt: profile.createdAt,
      };
    } catch (error) {
      console.error('Error getting connection by chat ID:', error);
      return null;
    }
  }
}