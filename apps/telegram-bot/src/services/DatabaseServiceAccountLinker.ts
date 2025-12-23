/**
 * Account Linker implementation that uses Database Service API
 * instead of direct Supabase access
 */

import type { AccountLinker } from '../domain/interfaces';
import type { LinkCodeValidation, UserId } from '../domain/types';

export class DatabaseServiceAccountLinker implements AccountLinker {
  constructor(private readonly baseUrl: string) {}

  async validateLinkCode(code: string): Promise<LinkCodeValidation> {
    try {
      // Check format: must be exactly 8 characters, alphanumeric
      if (!/^[A-Z0-9]{8}$/.test(code)) {
        return { isValid: false, error: 'not_found' };
      }

      // We'll validate the code by trying to use it in linkAccount
      // This is not ideal but works for the current API design
      return { isValid: true, userId: 'temp' as UserId };
    } catch (error) {
      console.error('Error validating link code:', error);
      return { isValid: false, error: 'not_found' };
    }
  }

  async linkAccount(code: string, telegramChatId: string): Promise<boolean> {
    try {
      // Use the new /api/link-codes/use endpoint
      const response = await fetch(`${this.baseUrl}/api/link-codes/use`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          telegramChatId,
        }),
      });

      if (response.ok) {
        const result = await response.json() as { success: boolean; userId?: string };
        return result.success === true;
      }

      return false;
    } catch (error) {
      console.error('Error linking account:', error);
      return false;
    }
  }

  async isRateLimited(_telegramChatId: string): Promise<boolean> {
    // For now, no rate limiting
    return false;
  }

  async getFailedAttempts(_telegramChatId: string): Promise<number> {
    // For now, return 0 failed attempts
    return 0;
  }

  async recordLinkAttempt(_telegramChatId: string, _code: string, _success: boolean): Promise<void> {
    // For now, do nothing
  }
}