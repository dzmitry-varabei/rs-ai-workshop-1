/**
 * Command handlers for Telegram bot commands
 * Handles all user commands with proper state management and validation
 */

import type { Context } from 'telegraf';
import type {
  AccountLinker,
  MessageFormatter,
  UserProfileRepository,
  ReviewEventRepository,
  DueReviewSelector,
} from '../domain/interfaces';
import type { UserId } from '../domain/types';

export class CommandHandlers {
  constructor(
    private readonly accountLinker: AccountLinker,
    private readonly messageFormatter: MessageFormatter,
    private readonly userProfileRepository: UserProfileRepository,
    private readonly reviewEventRepository: ReviewEventRepository,
    private readonly dueReviewSelector: DueReviewSelector
  ) {}

  /**
   * Handle /start command - show welcome message based on link status
   */
  async handleStart(ctx: Context): Promise<void> {
    try {
      const chatId = ctx.chat?.id?.toString();
      if (!chatId) {
        await ctx.reply(this.messageFormatter.formatError('Unable to identify chat'));
        return;
      }

      // Check if user account is already linked
      const profile = await this.userProfileRepository.getProfileByChatId(chatId);
      const isLinked = profile !== null;

      const welcomeMessage = this.messageFormatter.formatWelcome(isLinked);
      await ctx.reply(welcomeMessage, { parse_mode: 'MarkdownV2' });

      // If linked, also show current stats briefly
      if (isLinked && profile) {
        const stats = await this.reviewEventRepository.calculateStats(profile.userId);
        if (stats.dueToday > 0) {
          const dueMessage = `📚 You have ${stats.dueToday} words ready for review\\!`;
          await ctx.reply(dueMessage, { parse_mode: 'MarkdownV2' });
        }
      }
    } catch (error) {
      console.error('Error in handleStart:', error);
      await ctx.reply(this.messageFormatter.formatError('Something went wrong. Please try again.'));
    }
  }

  /**
   * Handle /help command - show available commands and instructions
   */
  async handleHelp(ctx: Context): Promise<void> {
    try {
      const helpMessage = this.messageFormatter.formatHelp();
      await ctx.reply(helpMessage, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      console.error('Error in handleHelp:', error);
      await ctx.reply(this.messageFormatter.formatError('Unable to show help. Please try again.'));
    }
  }

  /**
   * Handle /link command - show linking instructions or process link code
   */
  async handleLink(ctx: Context): Promise<void> {
    try {
      const chatId = ctx.chat?.id?.toString();
      if (!chatId) {
        await ctx.reply(this.messageFormatter.formatError('Unable to identify chat'));
        return;
      }

      // Check if already linked
      const existingProfile = await this.userProfileRepository.getProfileByChatId(chatId);
      if (existingProfile) {
        await ctx.reply(
          this.messageFormatter.formatSuccess('Your account is already linked!'),
          { parse_mode: 'MarkdownV2' }
        );
        return;
      }

      // Check for rate limiting
      if (await this.accountLinker.isRateLimited(chatId)) {
        const failedAttempts = await this.accountLinker.getFailedAttempts(chatId);
        await ctx.reply(
          this.messageFormatter.formatError(
            `Too many failed attempts (${failedAttempts}). Please wait an hour before trying again.`
          ),
          { parse_mode: 'MarkdownV2' }
        );
        return;
      }

      // Extract potential link code from message
      const messageText = 'text' in ctx.message! ? ctx.message.text : '';
      const codeMatch = messageText.match(/\/link\s+([A-Z0-9]{8})/);
      
      if (codeMatch) {
        // Process the link code
        const code = codeMatch[1];
        await this.processLinkCode(ctx, chatId, code);
      } else {
        // Show linking instructions
        const instructions = this.messageFormatter.formatLinkInstructions();
        await ctx.reply(instructions, { parse_mode: 'MarkdownV2' });
      }
    } catch (error) {
      console.error('Error in handleLink:', error);
      await ctx.reply(this.messageFormatter.formatError('Something went wrong. Please try again.'));
    }
  }

  /**
   * Process a link code attempt
   */
  private async processLinkCode(ctx: Context, chatId: string, code: string): Promise<void> {
    try {
      // Validate the link code
      const validation = await this.accountLinker.validateLinkCode(code);
      
      if (!validation.isValid) {
        // Record failed attempt
        await this.accountLinker.recordLinkAttempt(chatId, code, false);
        
        let errorMessage = 'Invalid or expired link code.';
        if (validation.reason === 'expired') {
          errorMessage = 'This link code has expired. Please generate a new one.';
        } else if (validation.reason === 'used') {
          errorMessage = 'This link code has already been used.';
        }
        
        await ctx.reply(
          this.messageFormatter.formatError(errorMessage),
          { parse_mode: 'MarkdownV2' }
        );
        return;
      }

      // Attempt to link the account
      const linked = await this.accountLinker.linkAccount(code, chatId);
      
      if (linked) {
        // Record successful attempt
        await this.accountLinker.recordLinkAttempt(chatId, code, true);
        
        await ctx.reply(
          this.messageFormatter.formatSuccess('Account linked successfully! Welcome to English Learning Bot.'),
          { parse_mode: 'MarkdownV2' }
        );
        
        // Show initial stats if available
        if (validation.userId) {
          const stats = await this.reviewEventRepository.calculateStats(validation.userId);
          if (stats.totalItems > 0) {
            const statsMessage = this.messageFormatter.formatStats(stats);
            await ctx.reply(statsMessage, { parse_mode: 'MarkdownV2' });
          }
        }
      } else {
        // Record failed attempt
        await this.accountLinker.recordLinkAttempt(chatId, code, false);
        
        await ctx.reply(
          this.messageFormatter.formatError('Failed to link account. Please try again.'),
          { parse_mode: 'MarkdownV2' }
        );
      }
    } catch (error) {
      console.error('Error processing link code:', error);
      await ctx.reply(this.messageFormatter.formatError('Something went wrong. Please try again.'));
    }
  }

  /**
   * Handle /stats command - show user learning statistics
   */
  async handleStats(ctx: Context): Promise<void> {
    try {
      const profile = await this.getLinkedProfile(ctx);
      if (!profile) return;

      const stats = await this.reviewEventRepository.calculateStats(profile.userId);
      const statsMessage = this.messageFormatter.formatStats(stats);
      
      await ctx.reply(statsMessage, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      console.error('Error in handleStats:', error);
      await ctx.reply(this.messageFormatter.formatError('Unable to load statistics. Please try again.'));
    }
  }

  /**
   * Handle /pause command - pause vocabulary reviews
   */
  async handlePause(ctx: Context): Promise<void> {
    try {
      const profile = await this.getLinkedProfile(ctx);
      if (!profile) return;

      if (profile.paused) {
        await ctx.reply(
          this.messageFormatter.formatError('Your reviews are already paused.'),
          { parse_mode: 'MarkdownV2' }
        );
        return;
      }

      await this.userProfileRepository.setPaused(profile.userId, true);
      
      const confirmationMessage = this.messageFormatter.formatPauseConfirmation();
      await ctx.reply(confirmationMessage, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      console.error('Error in handlePause:', error);
      await ctx.reply(this.messageFormatter.formatError('Unable to pause reviews. Please try again.'));
    }
  }

  /**
   * Handle /resume command - resume vocabulary reviews
   */
  async handleResume(ctx: Context): Promise<void> {
    try {
      const profile = await this.getLinkedProfile(ctx);
      if (!profile) return;

      if (!profile.paused) {
        await ctx.reply(
          this.messageFormatter.formatError('Your reviews are already active.'),
          { parse_mode: 'MarkdownV2' }
        );
        return;
      }

      await this.userProfileRepository.setPaused(profile.userId, false);
      
      // Check for overdue reviews
      const dueReviews = await this.dueReviewSelector.getUserDueReviews(profile.userId);
      const overdueCount = dueReviews.length;
      
      const confirmationMessage = this.messageFormatter.formatResumeConfirmation(overdueCount);
      await ctx.reply(confirmationMessage, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      console.error('Error in handleResume:', error);
      await ctx.reply(this.messageFormatter.formatError('Unable to resume reviews. Please try again.'));
    }
  }

  /**
   * Handle /settings command - show current user settings
   */
  async handleSettings(ctx: Context): Promise<void> {
    try {
      const profile = await this.getLinkedProfile(ctx);
      if (!profile) return;

      const settingsMessage = this.messageFormatter.formatSettings(profile);
      await ctx.reply(settingsMessage, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      console.error('Error in handleSettings:', error);
      await ctx.reply(this.messageFormatter.formatError('Unable to load settings. Please try again.'));
    }
  }

  /**
   * Handle unknown commands - provide helpful guidance
   */
  async handleUnknownCommand(ctx: Context): Promise<void> {
    try {
      const message = `❓ Unknown command\\. Use /help to see available commands\\.`;
      await ctx.reply(message, { parse_mode: 'MarkdownV2' });
    } catch (error) {
      console.error('Error in handleUnknownCommand:', error);
      await ctx.reply('Unknown command. Use /help for available commands.');
    }
  }

  /**
   * Helper method to get linked user profile and handle unlinked state
   */
  private async getLinkedProfile(ctx: Context) {
    const chatId = ctx.chat?.id?.toString();
    if (!chatId || chatId.trim() === '' || isNaN(parseInt(chatId))) {
      await ctx.reply(this.messageFormatter.formatError('Unable to identify chat'), { parse_mode: 'MarkdownV2' });
      return null;
    }

    const profile = await this.userProfileRepository.getProfileByChatId(chatId);
    if (!profile) {
      const message = `🔗 Your account is not linked yet\\.\n\nUse /link to connect your account first\\.`;
      await ctx.reply(message, { parse_mode: 'MarkdownV2' });
      return null;
    }

    return profile;
  }

  /**
   * Check if user has required permissions for command
   */
  private async checkCommandPermissions(ctx: Context, requiresLink: boolean = true): Promise<boolean> {
    if (!requiresLink) return true;

    const profile = await this.getLinkedProfile(ctx);
    return profile !== null;
  }

  /**
   * Filter commands based on user state (linked/unlinked, paused/active)
   */
  async filterCommand(command: string, ctx: Context): Promise<boolean> {
    try {
      const chatId = ctx.chat?.id?.toString();
      if (!chatId || chatId.trim() === '' || isNaN(parseInt(chatId))) {
        return false;
      }

      const profile = await this.userProfileRepository.getProfileByChatId(chatId);
      
      // Commands available to unlinked users
      const unlinkedCommands = ['start', 'help', 'link'];
      if (!profile && !unlinkedCommands.includes(command)) {
        return false;
      }

      // Commands available to paused users (all commands work when paused)
      // Paused state only affects automatic review delivery, not manual commands
      
      return true;
    } catch (error) {
      console.error('Error in filterCommand:', error);
      return false;
    }
  }
}