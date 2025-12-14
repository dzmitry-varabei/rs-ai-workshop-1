/**
 * Telegram API wrapper with error handling, retries, and exponential backoff
 * Provides resilient communication with Telegram Bot API
 */

// Telegram API wrapper - no external imports needed for types

export interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: 'MarkdownV2' | 'HTML';
  reply_markup?: unknown;
}

export interface TelegramEditMessage {
  chat_id: string;
  message_id: string;
  text: string;
  parse_mode?: 'MarkdownV2' | 'HTML';
  reply_markup?: unknown;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface TelegramApiError extends Error {
  code?: number;
  description?: string;
  parameters?: {
    retry_after?: number;
  };
}

/**
 * Telegram API wrapper with exponential backoff and error handling
 */
export class TelegramApiWrapper {
  private readonly defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  };

  constructor(
    private readonly bot: any, // Telegraf bot instance
    private readonly retryConfig: Partial<RetryConfig> = {}
  ) {}

  /**
   * Send a message with retry logic and exponential backoff
   */
  async sendMessage(
    message: TelegramMessage,
    retryConfig?: Partial<RetryConfig>
  ): Promise<string> {
    const config = { ...this.defaultRetryConfig, ...this.retryConfig, ...retryConfig };
    
    return this.executeWithRetry(
      async () => {
        const result = await this.bot.telegram.sendMessage(
          message.chat_id,
          message.text,
          {
            parse_mode: message.parse_mode,
            reply_markup: message.reply_markup,
          }
        );
        return result.message_id.toString();
      },
      config,
      'sendMessage'
    );
  }

  /**
   * Edit a message with retry logic and exponential backoff
   */
  async editMessage(
    editMessage: TelegramEditMessage,
    retryConfig?: Partial<RetryConfig>
  ): Promise<void> {
    const config = { ...this.defaultRetryConfig, ...this.retryConfig, ...retryConfig };
    
    await this.executeWithRetry(
      async () => {
        await this.bot.telegram.editMessageText(
          editMessage.chat_id,
          parseInt(editMessage.message_id),
          undefined, // inline_message_id
          editMessage.text,
          {
            parse_mode: editMessage.parse_mode,
            reply_markup: editMessage.reply_markup,
          }
        );
      },
      config,
      'editMessage'
    );
  }

  /**
   * Answer callback query with retry logic
   */
  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
    retryConfig?: Partial<RetryConfig>
  ): Promise<void> {
    const config = { ...this.defaultRetryConfig, ...this.retryConfig, ...retryConfig };
    
    await this.executeWithRetry(
      async () => {
        await this.bot.telegram.answerCbQuery(callbackQueryId, text);
      },
      config,
      'answerCallbackQuery'
    );
  }

  /**
   * Execute an operation with exponential backoff retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    operationName: string
  ): Promise<T> {
    let lastError: TelegramApiError | undefined;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.normalizeTelegramError(error);
        
        // Don't retry on certain error types
        if (this.isNonRetryableError(lastError)) {
          throw lastError;
        }
        
        // If this was the last attempt, throw the error
        if (attempt === config.maxRetries) {
          throw lastError;
        }
        
        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, config, lastError);
        
        console.warn(
          `${operationName} attempt ${attempt + 1} failed: ${lastError.message}. ` +
          `Retrying in ${delay}ms...`
        );
        
        await this.sleep(delay);
      }
    }
    
    // This should never be reached, but TypeScript requires it
    throw lastError || new Error(`${operationName} failed after ${config.maxRetries} retries`);
  }

  /**
   * Calculate delay for next retry attempt using exponential backoff
   */
  private calculateDelay(
    attempt: number,
    config: RetryConfig,
    error: TelegramApiError
  ): number {
    // If Telegram API provides retry_after, respect it
    if (error.parameters?.retry_after) {
      return Math.min(error.parameters.retry_after * 1000, config.maxDelayMs);
    }
    
    // Calculate exponential backoff delay
    const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * exponentialDelay;
    
    return Math.min(exponentialDelay + jitter, config.maxDelayMs);
  }

  /**
   * Normalize different error types to a consistent format
   */
  private normalizeTelegramError(error: unknown): TelegramApiError {
    if (error instanceof Error) {
      const telegramError = error as TelegramApiError;
      
      // Extract Telegram API error details if available
      if ('response' in error && typeof error.response === 'object' && error.response) {
        const response = error.response as any;
        telegramError.code = response.error_code;
        telegramError.description = response.description;
        telegramError.parameters = response.parameters;
      }
      
      return telegramError;
    }
    
    // Fallback for non-Error objects
    return new Error(`Unknown error: ${String(error)}`) as TelegramApiError;
  }

  /**
   * Check if an error should not be retried
   */
  private isNonRetryableError(error: TelegramApiError): boolean {
    // Don't retry on client errors (4xx)
    if (error.code && error.code >= 400 && error.code < 500) {
      // Exception: rate limiting (429) should be retried
      if (error.code === 429) {
        return false;
      }
      return true;
    }
    
    // Don't retry on specific error messages
    const nonRetryableMessages = [
      'Bad Request: message is not modified',
      'Bad Request: query is too old',
      'Bad Request: message to edit not found',
      'Forbidden: bot was blocked by the user',
      'Forbidden: user is deactivated',
      'Forbidden: bot can\'t send messages to bots',
    ];
    
    return nonRetryableMessages.some(msg => 
      error.message.includes(msg) || error.description?.includes(msg)
    );
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if the bot can send messages to a chat
   */
  async canSendMessage(chatId: string): Promise<boolean> {
    try {
      await this.bot.telegram.getChat(chatId);
      return true;
    } catch (error) {
      const telegramError = this.normalizeTelegramError(error);
      
      // These errors indicate we can't send messages
      if (
        telegramError.message.includes('Forbidden') ||
        telegramError.message.includes('chat not found') ||
        telegramError.code === 403
      ) {
        return false;
      }
      
      // For other errors, assume we can send (will be handled by retry logic)
      return true;
    }
  }

  /**
   * Get current retry configuration
   */
  getRetryConfig(): RetryConfig {
    return { ...this.defaultRetryConfig, ...this.retryConfig };
  }

  /**
   * Update retry configuration
   */
  updateRetryConfig(newConfig: Partial<RetryConfig>): void {
    Object.assign(this.retryConfig, newConfig);
  }
}