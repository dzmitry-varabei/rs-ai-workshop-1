/**
 * Message formatter service for Telegram messages
 * Handles MarkdownV2 formatting and escaping for safe message display
 */

import type { Word, Pronunciation, UserId, WordId } from '../domain/types';
import type { MessageFormatter as IMessageFormatter } from '../domain/interfaces';
import type { UserStats, UserProfile } from '../domain/types';

export class MessageFormatter implements IMessageFormatter {
  
  /**
   * Escape text for MarkdownV2 format
   * MarkdownV2 requires escaping of special characters: _*[]()~`>#+-=|{}.!\
   */
  escapeMarkdownV2(text: string): string {
    // First escape backslashes, then other special characters
    return text
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');  // Then escape other special chars
  }

  /**
   * Format a word review message with proper MarkdownV2 escaping
   */
  formatReview(word: Word, pronunciation?: Pronunciation): string {
    const escapedWord = this.escapeMarkdownV2(word.text);
    
    let message = `*${escapedWord}*`;
    
    // Add pronunciation if available
    if (pronunciation?.ipa) {
      const escapedIpa = this.escapeMarkdownV2(pronunciation.ipa);
      message += ` /${escapedIpa}/`;
    }
    
    // Add example sentence if available
    if (word.exampleEn) {
      const escapedExample = this.escapeMarkdownV2(word.exampleEn);
      // Highlight the word in the example by making it bold
      // Escape regex special characters in word text for safe regex usage
      const escapedWordForRegex = word.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try {
        const wordRegex = new RegExp(`\\b${escapedWordForRegex}\\b`, 'gi');
        const highlightedExample = escapedExample.replace(wordRegex, `*${this.escapeMarkdownV2(word.text)}*`);
        message += `\n\n${highlightedExample}`;
      } catch (error) {
        // If regex fails, just add the example without highlighting
        message += `\n\n${escapedExample}`;
      }
    }
    
    // Add Russian translation in spoiler format if available
    if (word.exampleRu) {
      const escapedTranslation = this.escapeMarkdownV2(word.exampleRu);
      message += `\n\n||${escapedTranslation}||`;
    } else {
      // Fallback message if no translation available
      message += `\n\n||Перевод недоступен||`;
    }
    
    // Add level information if available
    if (word.level) {
      const escapedLevel = this.escapeMarkdownV2(word.level);
      message += `\n\n📚 Level: ${escapedLevel}`;
    }
    
    return message;
  }

  /**
   * Format user statistics for /stats command
   */
  formatStats(stats: UserStats): string {
    const { totalItems, dueToday, successRate, learningStreak } = stats;
    
    let message = '*📊 Your Learning Statistics*\n\n';
    
    message += `📚 *Total vocabulary items:* ${totalItems}\n`;
    message += `⏰ *Due for review today:* ${dueToday}\n`;
    message += `✅ *Success rate \\(last 30 days\\):* ${successRate.toFixed(1)}%\n`;
    message += `🔥 *Learning streak:* ${learningStreak} days\n`;
    
    // Add motivational message based on stats
    if (learningStreak >= 7) {
      message += `\n🎉 Amazing\\! You're on a ${learningStreak}\\-day streak\\!`;
    } else if (successRate >= 80) {
      message += `\n💪 Great job\\! Your success rate is excellent\\!`;
    } else if (dueToday > 0) {
      message += `\n📖 You have ${dueToday} words ready for review\\!`;
    }
    
    return message;
  }

  /**
   * Format welcome message based on user link status
   */
  formatWelcome(isLinked: boolean): string {
    if (isLinked) {
      return `🤖 *Welcome back to English Learning Bot\\!*\n\n` +
             `Your account is linked and ready\\. I'll help you learn vocabulary using spaced repetition\\.\n\n` +
             `Use /stats to see your progress or /help for available commands\\.`;
    } else {
      return `🤖 *Welcome to English Learning Bot\\!*\n\n` +
             `To get started, you need to link your account\\.\n\n` +
             `1\\. Complete the vocabulary quiz in the web app\n` +
             `2\\. Get your linking code\n` +
             `3\\. Send the code here using /link\n\n` +
             `Use /help for more information\\.`;
    }
  }

  /**
   * Format help message with available commands
   */
  formatHelp(): string {
    return `*🤖 English Learning Bot Help*\n\n` +
           `*Available Commands:*\n\n` +
           `/start \\- Show welcome message\n` +
           `/help \\- Show this help message\n` +
           `/link \\- Link your account with a code\n` +
           `/stats \\- View your learning statistics\n` +
           `/pause \\- Pause vocabulary reviews\n` +
           `/resume \\- Resume vocabulary reviews\n` +
           `/settings \\- View and modify your settings\n\n` +
           `*How it works:*\n` +
           `1\\. Complete the vocabulary quiz in the web app\n` +
           `2\\. Link your account using /link command\n` +
           `3\\. I'll send you words to review at optimal intervals\n` +
           `4\\. Rate each word's difficulty to improve scheduling\n\n` +
           `*Need help?* Contact support through the web app\\.`;
  }

  /**
   * Format settings display message
   */
  formatSettings(profile: UserProfile): string {
    const { timezone, dailyWordLimit, preferredWindow, paused } = profile;
    
    let message = `*⚙️ Your Settings*\n\n`;
    
    message += `🌍 *Timezone:* ${this.escapeMarkdownV2(timezone)}\n`;
    message += `📊 *Daily word limit:* ${dailyWordLimit}\n`;
    message += `⏰ *Preferred time:* ${this.escapeMarkdownV2(preferredWindow.start)} \\- ${this.escapeMarkdownV2(preferredWindow.end)}\n`;
    message += `⏸️ *Status:* ${paused ? 'Paused' : 'Active'}\n\n`;
    
    if (paused) {
      message += `ℹ️ Reviews are currently paused\\. Use /resume to continue learning\\.`;
    } else {
      message += `ℹ️ Reviews are active\\. Use /pause to temporarily stop reviews\\.`;
    }
    
    return message;
  }

  /**
   * Create inline keyboard for difficulty selection
   * Returns the structure expected by Telegraf
   */
  createDifficultyKeyboard(userId: UserId, wordId: WordId): unknown {
    return {
      inline_keyboard: [
        [
          { text: '😰 Hard', callback_data: `difficulty:${userId}:${wordId}:hard` },
          { text: '🤔 Normal', callback_data: `difficulty:${userId}:${wordId}:normal` }
        ],
        [
          { text: '👍 Good', callback_data: `difficulty:${userId}:${wordId}:good` },
          { text: '😎 Easy', callback_data: `difficulty:${userId}:${wordId}:easy` }
        ]
      ]
    };
  }

  /**
   * Format error messages for users
   */
  formatError(message: string): string {
    return `❌ ${this.escapeMarkdownV2(message)}`;
  }

  /**
   * Format success messages for users
   */
  formatSuccess(message: string): string {
    return `✅ ${this.escapeMarkdownV2(message)}`;
  }

  /**
   * Format linking instructions
   */
  formatLinkInstructions(): string {
    return `*🔗 Account Linking*\n\n` +
           `To link your account:\n\n` +
           `1\\. Open the English Learning web app\n` +
           `2\\. Complete the vocabulary quiz\n` +
           `3\\. Click "Connect Telegram Bot"\n` +
           `4\\. Copy the 8\\-character code\n` +
           `5\\. Send me the code \\(just the code, nothing else\\)\n\n` +
           `Example: \`ABC12345\`\n\n` +
           `⚠️ *Note:* Codes expire after 15 minutes and can only be used once\\.`;
  }

  /**
   * Format pause confirmation message
   */
  formatPauseConfirmation(): string {
    return `⏸️ *Learning paused*\n\n` +
           `I won't send you any vocabulary reviews until you resume\\.\n\n` +
           `Use /resume when you're ready to continue learning\\.`;
  }

  /**
   * Format resume confirmation message
   */
  formatResumeConfirmation(overdueCount: number): string {
    let message = `▶️ *Learning resumed*\n\n`;
    
    if (overdueCount > 0) {
      message += `You have ${overdueCount} overdue reviews\\. I'll send them gradually to avoid overwhelming you\\.\n\n`;
    }
    
    message += `Welcome back\\! Your vocabulary reviews will continue according to your schedule\\.`;
    
    return message;
  }

  /**
   * Format callback acknowledgment when user rates a word
   */
  formatCallbackAck(difficulty: string): string {
    const emoji = {
      'hard': '😰',
      'normal': '🤔', 
      'good': '👍',
      'easy': '😎'
    }[difficulty] || '✅';
    
    return `${emoji} Rated as: ${difficulty}`;
  }
}