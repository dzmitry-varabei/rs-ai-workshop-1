/**
 * Service for handling account linking between web and Telegram
 * Implements validation, rate limiting, and secure linking process
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountLinker } from '../domain/interfaces';
import type { LinkCodeValidation } from '../domain/types';
import { SupabaseLinkCodeRepository, SupabaseLinkAttemptRepository } from '../repositories';

export class AccountLinkerService implements AccountLinker {
  private linkCodeRepo: SupabaseLinkCodeRepository;
  private linkAttemptRepo: SupabaseLinkAttemptRepository;

  constructor(private supabase: SupabaseClient) {
    this.linkCodeRepo = new SupabaseLinkCodeRepository(supabase);
    this.linkAttemptRepo = new SupabaseLinkAttemptRepository(supabase);
  }

  async validateLinkCode(code: string): Promise<LinkCodeValidation> {
    // Check format: must be exactly 8 characters, alphanumeric
    if (!/^[A-Z0-9]{8}$/.test(code)) {
      return { isValid: false, error: 'not_found' };
    }

    try {
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
      // First validate the code
      const validation = await this.validateLinkCode(code);
      if (!validation.isValid || !validation.userId) {
        return false;
      }

      // Update user profile with Telegram chat ID
      const { error: profileError } = await this.supabase
        .from('profiles')
        .update({ telegram_chat_id: telegramChatId })
        .eq('id', validation.userId);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        return false;
      }

      // Mark the link code as used
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
      // Don't throw - this is logging, not critical functionality
    }
  }

  async isRateLimited(chatId: string): Promise<boolean> {
    try {
      const failedCount = await this.getFailedAttempts(chatId);
      return failedCount >= 5;
    } catch (error) {
      console.error('Error checking rate limit:', error);
      // On error, assume not rate limited to avoid blocking legitimate users
      return false;
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