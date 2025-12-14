/**
 * Service for handling account linking between web and Telegram
 * Manages link codes, validation, and rate limiting
 */

import type { AccountLinker } from '../domain/interfaces';
import type {
  LinkCodeRepository,
  LinkAttemptRepository,
  UserProfileRepository,
} from '../domain/interfaces';
import type { LinkCodeValidation, UserId } from '../domain/types';

export class AccountLinkerService implements AccountLinker {
  constructor(
    private readonly linkCodeRepo: LinkCodeRepository,
    private readonly linkAttemptRepo: LinkAttemptRepository,
    private readonly userProfileRepo: UserProfileRepository
  ) {}

  async validateLinkCode(code: string): Promise<LinkCodeValidation> {
    try {
      // Check format: must be exactly 8 characters, alphanumeric
      if (!/^[A-Z0-9]{8}$/.test(code)) {
        return { isValid: false, error: 'not_found' };
      }

      const linkCode = await this.linkCodeRepo.getLinkCode(code);
      
      if (!linkCode) {
        return { isValid: false, error: 'not_found' };
      }

      // Check if expired
      if (linkCode.expiresAt < new Date()) {
        return { isValid: false, error: 'expired' };
      }

      // Check if already used
      if (linkCode.usedAt) {
        return { isValid: false, error: 'used' };
      }

      return { isValid: true, userId: linkCode.userId };
    } catch (error) {
      console.error('Error validating link code:', error);
      return { isValid: false, error: 'not_found' };
    }
  }

  async linkAccount(code: string, telegramChatId: string): Promise<boolean> {
    try {
      // Validate the code first
      const validation = await this.validateLinkCode(code);
      if (!validation.isValid || !validation.userId) {
        return false;
      }

      // Update user profile with Telegram chat ID
      await this.userProfileRepo.updateProfile(validation.userId, {
        telegramChatId,
      });

      // Mark the code as used
      await this.linkCodeRepo.markUsed(code);

      return true;
    } catch (error) {
      console.error('Error linking account:', error);
      return false;
    }
  }

  async recordLinkAttempt(chatId: string, code: string, success: boolean): Promise<void> {
    try {
      await this.linkAttemptRepo.recordAttempt({
        chatId,
        attemptedAt: new Date(),
        success,
        codeAttempted: code,
      });
    } catch (error) {
      console.error('Error recording link attempt:', error);
    }
  }

  async isRateLimited(chatId: string): Promise<boolean> {
    try {
      const failedAttempts = await this.getFailedAttempts(chatId);
      return failedAttempts >= 5;
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return false; // On error, don't block the user
    }
  }

  async getFailedAttempts(chatId: string): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const attempts = await this.linkAttemptRepo.getFailedAttempts(chatId, oneHourAgo);
      return attempts.length;
    } catch (error) {
      console.error('Error getting failed attempts:', error);
      return 0;
    }
  }
}