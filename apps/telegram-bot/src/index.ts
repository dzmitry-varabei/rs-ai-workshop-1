import 'dotenv/config';
import { TelegramBotApp } from './app/TelegramBotApp';
import { createLogger } from './utils/logger';

const logger = createLogger('main');

async function main(): Promise<void> {
  try {
    logger.info('Starting Telegram Bot...');
    
    const app = new TelegramBotApp();
    await app.start();
    
    // Graceful shutdown
    process.once('SIGINT', () => app.stop());
    process.once('SIGTERM', () => app.stop());
    
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});