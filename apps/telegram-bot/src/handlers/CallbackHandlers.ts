/**
 * Callback query handlers for inline keyboard interactions
 * Handles difficulty rating buttons and other inline interactions
 */

import type { Context } from 'telegraf';
import type {
  ReviewProcessor,
  MessageFormatter,
  UserProfileRepository,
} from '../domain/interfaces';
import type { Difficulty, UserId, WordId } from '../domain/types';

export class CallbackHandlers {
  constructor(
    private readonly reviewProcessor: ReviewProcessor,
    private readonly messageFormatter: MessageFormatter,
    private readonly userProfileRepository: UserProfileRepository
  ) {}

  /**
   * Handle callback queries from inline keyboards
   */
  async handleCallbackQuery(ctx: Context): Promise<void> {
    try {
      if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
        await ctx.answerCbQuery('Invalid callback query');
        return;
      }

      const callbackData = ctx.callbackQuery.data;
      const chatId = ctx.chat?.id?.toString();
      
      if (!chatId) {
        await ctx.answerCbQuery('Unable to identify chat');
        return;
      }

      // Parse callback data
      const parsed = this.parseCallbackData(callbackData);
      if (!parsed) {
        await ctx.answerCbQuery('Invalid callback data');
        return;
      }

      // Verify user is linked and matches callback data
      const profile = await this.userProfileRepository.getProfileByChatId(chatId);
      if (!profile) {
        await ctx.answerCbQuery('Account not linked');
        return;
      }

      if (profile.id !== parsed.userId) {
        await ctx.answerCbQuery('Unauthorized callback');
        return;
      }

      // Handle different callback types
      switch (parsed.type) {
        case 'difficulty':
          await this.handleDifficultyCallback(ctx, parsed);
          break;
        default:
          await ctx.answerCbQuery('Unknown callback type');
      }
    } catch (error) {
      console.error('Error in handleCallbackQuery:', error);
      await ctx.answerCbQuery('Something went wrong');
    }
  }

  /**
   * Handle difficulty rating callback
   */
  private async handleDifficultyCallback(
    ctx: Context,
    parsed: { userId: UserId; wordId: WordId; difficulty: Difficulty }
  ): Promise<void> {
    try {
      const messageId = ctx.callbackQuery?.message?.message_id?.toString();
      if (!messageId) {
        await ctx.answerCbQuery('Unable to identify message');
        return;
      }

      // Process the callback with idempotency check
      const processed = await this.reviewProcessor.processCallback(
        parsed.userId,
        parsed.wordId,
        messageId,
        parsed.difficulty
      );

      if (!processed) {
        // This could be a duplicate callback or invalid state
        await ctx.answerCbQuery('This review has already been processed');
        return;
      }

      // Update the message to remove keyboard and show selected difficulty
      const acknowledgment = this.messageFormatter.formatCallbackAck(parsed.difficulty);
      
      try {
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        await ctx.answerCbQuery(acknowledgment);
      } catch (editError) {
        // If we can't edit the message (e.g., it's too old), just acknowledge
        console.warn('Could not edit message markup:', editError);
        await ctx.answerCbQuery(acknowledgment);
      }

      // Optionally send a follow-up message with next review info
      await this.sendFollowUpMessage(ctx, parsed.difficulty);
      
    } catch (error) {
      console.error('Error in handleDifficultyCallback:', error);
      await ctx.answerCbQuery('Failed to process rating');
    }
  }

  /**
   * Send follow-up message after difficulty rating
   */
  private async sendFollowUpMessage(ctx: Context, difficulty: Difficulty): Promise<void> {
    try {
      const encouragementMessages = {
        'hard': 'Don\'t worry\\! I\'ll show this word again soon\\.',
        'normal': 'Good job\\! Keep practicing\\.',
        'good': 'Great\\! You\'re making progress\\.',
        'easy': 'Excellent\\! This word is getting easier for you\\.'
      };

      const message = encouragementMessages[difficulty] || 'Thanks for the feedback\\!';
      
      // Send encouragement message (but don't wait for it to avoid blocking)
      ctx.reply(message, { parse_mode: 'MarkdownV2' }).catch(error => {
        console.warn('Could not send follow-up message:', error);
      });
    } catch (error) {
      console.warn('Error in sendFollowUpMessage:', error);
    }
  }

  /**
   * Parse callback data string into structured format
   */
  private parseCallbackData(data: string): {
    type: string;
    userId: UserId;
    wordId: WordId;
    difficulty: Difficulty;
  } | null {
    try {
      // Expected format: "difficulty:userId:wordId:difficulty"
      const parts = data.split(':');
      
      if (parts.length !== 4) {
        return null;
      }

      const [type, userId, wordId, difficulty] = parts;
      
      if (type !== 'difficulty') {
        return null;
      }

      // Validate difficulty value
      const validDifficulties: Difficulty[] = ['hard', 'normal', 'good', 'easy'];
      if (!validDifficulties.includes(difficulty as Difficulty)) {
        return null;
      }

      return {
        type,
        userId: userId as UserId,
        wordId: wordId as WordId,
        difficulty: difficulty as Difficulty
      };
    } catch (error) {
      console.error('Error parsing callback data:', error);
      return null;
    }
  }

  /**
   * Validate callback query against active reviews
   * This prevents processing callbacks for reviews that are no longer active
   */
  private async validateCallback(
    userId: UserId,
    wordId: WordId,
    messageId: string
  ): Promise<boolean> {
    try {
      // The ReviewProcessor.processCallback method already handles validation
      // by checking if the review is in 'sent' state and matches the message ID
      // So we don't need additional validation here
      return true;
    } catch (error) {
      console.error('Error validating callback:', error);
      return false;
    }
  }

  /**
   * Handle duplicate callback queries with idempotency
   * This is handled by the ReviewProcessor.processCallback method
   * which checks the current state and only processes if in 'sent' state
   */
  private async handleDuplicateCallback(ctx: Context): Promise<void> {
    await ctx.answerCbQuery('This review has already been processed');
  }

  /**
   * Clean up expired callback queries
   * This would be called periodically to clean up old callback data
   */
  async cleanupExpiredCallbacks(): Promise<void> {
    try {
      // This would typically involve cleaning up any cached callback data
      // For now, we rely on the database state machine to handle expired reviews
      console.log('Callback cleanup completed');
    } catch (error) {
      console.error('Error in callback cleanup:', error);
    }
  }

  /**
   * Get callback statistics for monitoring
   */
  async getCallbackStats(): Promise<{
    processed: number;
    duplicates: number;
    errors: number;
  }> {
    // This would return statistics about callback processing
    // For now, return empty stats
    return {
      processed: 0,
      duplicates: 0,
      errors: 0
    };
  }
}