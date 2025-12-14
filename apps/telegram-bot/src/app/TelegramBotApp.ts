import { Telegraf } from 'telegraf';
import { createClient } from '@supabase/supabase-js';
import { createLogger } from '../utils/logger';
import { CommandHandlers } from '../handlers/CommandHandlers';
import { CallbackHandlers } from '../handlers/CallbackHandlers';
import { MessageFormatter } from '../services/MessageFormatter';
import { DueReviewSelectorService } from '../services/DueReviewSelector';
import { ReviewDeliveryServiceImpl } from '../services/ReviewDeliveryService';
import { ReviewProcessorService } from '../services/ReviewProcessor';
import { AccountLinkerService } from '../services/AccountLinker';
import {
  SupabaseLinkCodeRepository,
  SupabaseLinkAttemptRepository,
  SupabaseReviewEventRepository,
  SupabaseUserProfileRepository,
} from '../repositories';

const logger = createLogger('TelegramBotApp');

export class TelegramBotApp {
  private bot: Telegraf;
  private isRunning = false;
  private schedulerInterval?: NodeJS.Timeout;
  
  // Services
  private commandHandlers: CommandHandlers;
  private callbackHandlers: CallbackHandlers;
  private dueReviewSelector: DueReviewSelectorService;
  private reviewDelivery: ReviewDeliveryServiceImpl;
  private reviewProcessor: ReviewProcessorService;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
    }
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize services
    const messageFormatter = new MessageFormatter();
    const linkCodeRepo = new SupabaseLinkCodeRepository(supabase);
    const linkAttemptRepo = new SupabaseLinkAttemptRepository(supabase);
    const reviewEventRepo = new SupabaseReviewEventRepository(supabase);
    const userProfileRepo = new SupabaseUserProfileRepository(supabase);

    const accountLinker = new AccountLinkerService(linkCodeRepo, linkAttemptRepo, userProfileRepo);
    this.dueReviewSelector = new DueReviewSelectorService(supabase);
    this.reviewDelivery = new ReviewDeliveryServiceImpl(supabase);
    this.reviewProcessor = new ReviewProcessorService(supabase);

    // Initialize handlers
    this.commandHandlers = new CommandHandlers(
      accountLinker,
      messageFormatter,
      userProfileRepo,
      reviewEventRepo,
      this.dueReviewSelector
    );

    this.callbackHandlers = new CallbackHandlers(
      this.reviewProcessor,
      messageFormatter,
      userProfileRepo
    );

    this.bot = new Telegraf(token);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Command handlers
    this.bot.start(async (ctx) => {
      const correlationId = this.generateCorrelationId();
      logger.info(`Start command from user ${ctx.from?.id}`, { correlationId });
      
      try {
        await this.commandHandlers.handleStart(ctx);
      } catch (error) {
        logger.error('Error in start handler:', error, { correlationId });
      }
    });

    this.bot.help(async (ctx) => {
      const correlationId = this.generateCorrelationId();
      logger.info(`Help command from user ${ctx.from?.id}`, { correlationId });
      
      try {
        await this.commandHandlers.handleHelp(ctx);
      } catch (error) {
        logger.error('Error in help handler:', error, { correlationId });
      }
    });

    this.bot.command('link', async (ctx) => {
      const correlationId = this.generateCorrelationId();
      logger.info(`Link command from user ${ctx.from?.id}`, { correlationId });
      
      try {
        await this.commandHandlers.handleLink(ctx);
      } catch (error) {
        logger.error('Error in link handler:', error, { correlationId });
      }
    });

    this.bot.command('stats', async (ctx) => {
      const correlationId = this.generateCorrelationId();
      logger.info(`Stats command from user ${ctx.from?.id}`, { correlationId });
      
      try {
        const allowed = await this.commandHandlers.filterCommand('stats', ctx);
        if (!allowed) {
          await ctx.reply('🔗 Your account is not linked yet.\n\nUse /link to connect your account first.');
          return;
        }
        await this.commandHandlers.handleStats(ctx);
      } catch (error) {
        logger.error('Error in stats handler:', error, { correlationId });
      }
    });

    this.bot.command('pause', async (ctx) => {
      const correlationId = this.generateCorrelationId();
      logger.info(`Pause command from user ${ctx.from?.id}`, { correlationId });
      
      try {
        const allowed = await this.commandHandlers.filterCommand('pause', ctx);
        if (!allowed) {
          await ctx.reply('🔗 Your account is not linked yet.\n\nUse /link to connect your account first.');
          return;
        }
        await this.commandHandlers.handlePause(ctx);
      } catch (error) {
        logger.error('Error in pause handler:', error, { correlationId });
      }
    });

    this.bot.command('resume', async (ctx) => {
      const correlationId = this.generateCorrelationId();
      logger.info(`Resume command from user ${ctx.from?.id}`, { correlationId });
      
      try {
        const allowed = await this.commandHandlers.filterCommand('resume', ctx);
        if (!allowed) {
          await ctx.reply('🔗 Your account is not linked yet.\n\nUse /link to connect your account first.');
          return;
        }
        await this.commandHandlers.handleResume(ctx);
      } catch (error) {
        logger.error('Error in resume handler:', error, { correlationId });
      }
    });

    this.bot.command('settings', async (ctx) => {
      const correlationId = this.generateCorrelationId();
      logger.info(`Settings command from user ${ctx.from?.id}`, { correlationId });
      
      try {
        const allowed = await this.commandHandlers.filterCommand('settings', ctx);
        if (!allowed) {
          await ctx.reply('🔗 Your account is not linked yet.\n\nUse /link to connect your account first.');
          return;
        }
        await this.commandHandlers.handleSettings(ctx);
      } catch (error) {
        logger.error('Error in settings handler:', error, { correlationId });
      }
    });

    // Handle unknown commands
    this.bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      if (text.startsWith('/')) {
        const correlationId = this.generateCorrelationId();
        logger.info(`Unknown command from user ${ctx.from?.id}: ${text}`, { correlationId });
        
        try {
          await this.commandHandlers.handleUnknownCommand(ctx);
        } catch (error) {
          logger.error('Error in unknown command handler:', error, { correlationId });
        }
      }
    });

    // Callback query handlers
    this.bot.on('callback_query', async (ctx) => {
      const correlationId = this.generateCorrelationId();
      logger.info(`Callback query from user ${ctx.from?.id}`, { correlationId });
      
      try {
        await this.callbackHandlers.handleCallbackQuery(ctx);
      } catch (error) {
        logger.error('Error in callback handler:', error, { correlationId });
      }
    });

    // Error handling
    this.bot.catch((err, ctx) => {
      const correlationId = this.generateCorrelationId();
      logger.error(`Bot error for ${ctx.updateType}:`, err, { correlationId });
    });

    // Graceful shutdown
    process.once('SIGINT', () => this.stop());
    process.once('SIGTERM', () => this.stop());
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async startScheduler(): Promise<void> {
    logger.info('Starting review scheduler');
    
    // Run scheduler every 60 seconds
    this.schedulerInterval = setInterval(async () => {
      try {
        await this.processScheduledReviews();
      } catch (error) {
        logger.error('Error in scheduler:', error);
      }
    }, 60 * 1000);

    // Process timeouts every 5 minutes
    setInterval(async () => {
      try {
        const processed = await this.reviewProcessor.processTimeouts();
        if (processed > 0) {
          logger.info(`Processed ${processed} timed out reviews`);
        }
      } catch (error) {
        logger.error('Error processing timeouts:', error);
      }
    }, 5 * 60 * 1000);
  }

  private async processScheduledReviews(): Promise<void> {
    try {
      // Get due reviews (limited to prevent overwhelming)
      const dueReviews = await this.dueReviewSelector.getDueReviews(10);
      
      if (dueReviews.length === 0) {
        return;
      }

      logger.info(`Processing ${dueReviews.length} due reviews`);

      // Process each review
      for (const review of dueReviews) {
        try {
          // For now, we'll just log the review
          // In a full implementation, we would:
          // 1. Get word data from WordRepository
          // 2. Get user's Telegram chat ID
          // 3. Send the review message
          // 4. Mark as sent
          
          logger.info(`Would send review for user ${review.userId}, word ${review.wordId}`);
        } catch (error) {
          logger.error(`Error processing review for user ${review.userId}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error in processScheduledReviews:', error);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Bot is already running');
      return;
    }

    try {
      await this.bot.launch();
      this.isRunning = true;
      logger.info('Telegram Bot started successfully');

      // Start the review scheduler
      await this.startScheduler();
      
    } catch (error) {
      logger.error('Failed to start bot:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop scheduler
      if (this.schedulerInterval) {
        clearInterval(this.schedulerInterval);
        this.schedulerInterval = undefined;
      }

      // Stop bot
      this.bot.stop('SIGTERM');
      this.isRunning = false;
      logger.info('Telegram Bot stopped');
    } catch (error) {
      logger.error('Error stopping bot:', error);
    }
  }

  /**
   * Get bot status and statistics
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    uptime: number;
    stats: any;
  }> {
    const stats = await this.reviewProcessor.getProcessingStats();
    
    return {
      isRunning: this.isRunning,
      uptime: process.uptime(),
      stats,
    };
  }
}