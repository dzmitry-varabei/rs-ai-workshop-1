/**
 * Service for processing user responses and scheduling next reviews
 * Handles difficulty ratings, timeout processing, and SRS calculations
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReviewProcessor } from '../domain/interfaces';
import type { UserId, WordId, Difficulty } from '../domain/types';
import { BotSrsRepository } from '../repositories';

export class ReviewProcessorService implements ReviewProcessor {
  private botSrsRepo: BotSrsRepository;

  constructor(private supabase: SupabaseClient) {
    this.botSrsRepo = new BotSrsRepository(supabase);
  }

  async processCallback(
    userId: UserId,
    wordId: WordId,
    messageId: string,
    difficulty: Difficulty
  ): Promise<boolean> {
    try {
      // Use the atomic RPC function to process the difficulty rating
      // This ensures consistency between SRS updates and event recording
      return await this.botSrsRepo.processDifficultyRating(userId, wordId, messageId, difficulty);
    } catch (error) {
      console.error('Error processing callback:', error);
      return false;
    }
  }

  async processTimeouts(timeoutMinutes: number = 1440): Promise<number> {
    try {
      // Use the RPC function to process timed out reviews
      return await this.botSrsRepo.processTimeouts(timeoutMinutes);
    } catch (error) {
      console.error('Error processing timeouts:', error);
      return 0;
    }
  }

  async scheduleNextReview(
    userId: UserId,
    wordId: WordId,
    difficulty: Difficulty,
    reviewCount: number
  ): Promise<void> {
    try {
      // Calculate the next interval
      const intervalMinutes = this.calculateInterval(difficulty, reviewCount);
      const nextReviewAt = new Date(Date.now() + intervalMinutes * 60 * 1000);

      // Update the SRS item
      const { error } = await this.supabase
        .from('srs_items')
        .update({
          delivery_state: 'scheduled',
          next_review_at: nextReviewAt.toISOString(),
          interval_minutes: intervalMinutes,
          review_count: reviewCount + 1,
          last_review_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('word_id', wordId);

      if (error) {
        throw new Error(`Failed to schedule next review: ${error.message}`);
      }
    } catch (error) {
      console.error('Error scheduling next review:', error);
      throw error;
    }
  }

  calculateInterval(difficulty: Difficulty, reviewCount: number): number {
    // Base intervals in minutes based on difficulty
    const baseIntervals = {
      hard: 10,      // 10 minutes
      normal: 1440,  // 24 hours
      good: 4320,    // 72 hours (3 days)
      easy: 10080,   // 168 hours (1 week)
    };

    const baseInterval = baseIntervals[difficulty];
    
    // Apply review count multiplier
    // Each successful review increases the interval
    const multiplier = Math.max(1, reviewCount + 1);
    
    // Calculate final interval with minimum of 10 minutes
    const finalInterval = Math.max(10, baseInterval * multiplier);
    
    return finalInterval;
  }

  /**
   * Process a batch of callbacks efficiently
   * Useful for handling multiple user responses at once
   */
  async processBatchCallbacks(
    callbacks: Array<{
      userId: UserId;
      wordId: WordId;
      messageId: string;
      difficulty: Difficulty;
    }>
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    // Process callbacks in parallel with limited concurrency
    const batchSize = 5;
    for (let i = 0; i < callbacks.length; i += batchSize) {
      const batch = callbacks.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(callback =>
          this.processCallback(
            callback.userId,
            callback.wordId,
            callback.messageId,
            callback.difficulty
          )
        )
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          processed++;
        } else {
          failed++;
        }
      }
    }

    return { processed, failed };
  }

  /**
   * Get statistics about review processing
   */
  async getProcessingStats(): Promise<{
    awaitingResponse: number;
    overdue: number;
    processedToday: number;
  }> {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Count items awaiting response
      const { count: awaitingCount, error: awaitingError } = await this.supabase
        .from('srs_items')
        .select('*', { count: 'exact', head: true })
        .eq('delivery_state', 'awaiting_response');

      if (awaitingError) {
        console.error('Error counting awaiting responses:', awaitingError);
      }

      // Count overdue items (awaiting response for more than 24 hours)
      const overdueThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const { count: overdueCount, error: overdueError } = await this.supabase
        .from('srs_items')
        .select('*', { count: 'exact', head: true })
        .eq('delivery_state', 'awaiting_response')
        .lt('last_sent_at', overdueThreshold.toISOString());

      if (overdueError) {
        console.error('Error counting overdue items:', overdueError);
      }

      // Count reviews processed today
      const { count: processedCount, error: processedError } = await this.supabase
        .from('review_events')
        .select('*', { count: 'exact', head: true })
        .gte('reviewed_at', todayStart.toISOString());

      if (processedError) {
        console.error('Error counting processed reviews:', processedError);
      }

      return {
        awaitingResponse: awaitingCount ?? 0,
        overdue: overdueCount ?? 0,
        processedToday: processedCount ?? 0,
      };
    } catch (error) {
      console.error('Error getting processing stats:', error);
      return {
        awaitingResponse: 0,
        overdue: 0,
        processedToday: 0,
      };
    }
  }
}