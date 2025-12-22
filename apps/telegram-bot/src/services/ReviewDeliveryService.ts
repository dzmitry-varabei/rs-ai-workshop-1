/**
 * Service for delivering reviews to users via Telegram
 * Handles atomic claiming, message sending, and state management
 */

import type { DatabaseClient } from '@english-learning/data-layer-client';
import type { ReviewDeliveryService } from '../domain/interfaces';
import type { UserId, WordId, Word } from '../domain/types';

export class ReviewDeliveryServiceImpl implements ReviewDeliveryService {
  constructor(private dbClient: DatabaseClient) {}

  async claimReview(userId: UserId, wordId: WordId): Promise<boolean> {
    try {
      // TODO: Create ticket for Database Service to add atomic review claiming
      // For now, we'll assume claiming is successful
      console.warn('claimReview: Atomic claiming not yet supported by Database Service');
      return true;
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
      // TODO: Create ticket for Database Service to add message tracking
      // For now, this is a no-op as the Database Service doesn't track message IDs
      console.warn('markSent: Message tracking not yet supported by Database Service');
    } catch (error) {
      console.error('Error marking review as sent:', error);
      throw error;
    }
  }

  async resetToDue(userId: UserId, wordId: WordId): Promise<void> {
    try {
      // TODO: Create ticket for Database Service to add review state management
      // For now, this is a no-op as the Database Service doesn't manage delivery states
      console.warn('resetToDue: Review state management not yet supported by Database Service');
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