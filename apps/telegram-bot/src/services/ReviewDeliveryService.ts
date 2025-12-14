/**
 * Service for delivering reviews to users via Telegram
 * Handles atomic claiming, message sending, and state management
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReviewDeliveryService } from '../domain/interfaces';
import type { UserId, WordId, Word } from '../domain/types';
import { BotSrsRepository } from '../repositories';

export class ReviewDeliveryServiceImpl implements ReviewDeliveryService {
  private botSrsRepo: BotSrsRepository;

  constructor(private supabase: SupabaseClient) {
    this.botSrsRepo = new BotSrsRepository(supabase);
  }

  async claimReview(userId: UserId, wordId: WordId): Promise<boolean> {
    try {
      // Check if the review is still in 'due' state and claim it atomically
      const { data, error } = await this.supabase
        .from('srs_items')
        .update({
          delivery_state: 'sending',
          last_claimed_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('word_id', wordId)
        .eq('delivery_state', 'due')
        .select('user_id');

      if (error) {
        console.error('Error claiming review:', error);
        return false;
      }

      // Return true if we successfully updated exactly one row
      return data && data.length === 1;
    } catch (error) {
      console.error('Error claiming review:', error);
      return false;
    }
  }

  async sendReview(_userId: UserId, _wordId: WordId, _word: Word): Promise<string> {
    // This method will be implemented when we have the Telegram bot integration
    // For now, we'll simulate sending and return a mock message ID
    
    // In the real implementation, this would:
    // 1. Format the message using MessageFormatter
    // 2. Send via Telegram API
    // 3. Return the actual message ID from Telegram
    
    const mockMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return mockMessageId;
  }

  async markSent(userId: UserId, wordId: WordId, messageId: string): Promise<void> {
    try {
      await this.botSrsRepo.markSent(userId, wordId, messageId);
    } catch (error) {
      console.error('Error marking review as sent:', error);
      throw error;
    }
  }

  async resetToDue(userId: UserId, wordId: WordId): Promise<void> {
    try {
      await this.botSrsRepo.resetToDue(userId, wordId);
    } catch (error) {
      console.error('Error resetting review to due:', error);
      throw error;
    }
  }

  /**
   * Complete delivery process: claim, send, and mark as sent
   * This is the main method that orchestrates the entire delivery flow
   */
  async deliverReview(userId: UserId, wordId: WordId, word: Word): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Step 1: Atomically claim the review
      const claimed = await this.claimReview(userId, wordId);
      if (!claimed) {
        return { success: false, error: 'Failed to claim review - may have been claimed by another process' };
      }

      try {
        // Step 2: Send the message
        const messageId = await this.sendReview(userId, wordId, word);
        
        // Step 3: Mark as sent
        await this.markSent(userId, wordId, messageId);
        
        return { success: true, messageId };
      } catch (sendError) {
        // If sending failed, reset the review to 'due' state
        console.error('Failed to send review, resetting to due:', sendError);
        await this.resetToDue(userId, wordId);
        return { success: false, error: 'Failed to send message' };
      }
    } catch (error) {
      console.error('Error in deliverReview:', error);
      return { success: false, error: 'Internal error during delivery' };
    }
  }
}