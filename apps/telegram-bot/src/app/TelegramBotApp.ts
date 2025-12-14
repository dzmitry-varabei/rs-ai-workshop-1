import { Telegraf } from 'telegraf';
import { createLogger } from '../utils/logger';

const logger = createLogger('TelegramBotApp');

export class TelegramBotApp {
  private bot: Telegraf;
  private isRunning = false;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
    }

    this.bot = new Telegraf(token);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Basic start command for now
    this.bot.start((ctx) => {
      logger.info(`Start command from user ${ctx.from?.id}`);
      return ctx.reply('🤖 English Learning Bot is starting up...\n\nMore features coming soon!');
    });

    // Error handling
    this.bot.catch((err, ctx) => {
      logger.error(`Bot error for ${ctx.updateType}:`, err);
    });
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
      this.bot.stop('SIGTERM');
      this.isRunning = false;
      logger.info('Telegram Bot stopped');
    } catch (error) {
      logger.error('Error stopping bot:', error);
    }
  }
}