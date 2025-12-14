import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { MessageFormatter } from '../services/MessageFormatter';
import type { Word, Pronunciation, UserStats } from '../domain/types';

/**
 * **Feature: telegram-bot, Property 5: Review Message Format Consistency**
 * **Validates: Requirements 2.2, 2.3**
 * 
 * Property-based tests for message formatting and MarkdownV2 escaping.
 * These tests verify that all messages are properly formatted and safe for Telegram.
 */

describe('MessageFormatter', () => {
  const formatter = new MessageFormatter();

  describe('MarkdownV2 Escaping', () => {
    it('should escape all special MarkdownV2 characters', () => {
      // **Property 5: Review Message Format Consistency**
      // For any word review, the message should include escaped English text, 
      // spoiler-formatted Russian translation, and exactly 4 difficulty buttons
      
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (text) => {
          const escaped = formatter.escapeMarkdownV2(text);
          
          // Test that all special characters are escaped
          const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
          
          specialChars.forEach(char => {
            if (text.includes(char)) {
              // If original text contains special char, escaped version should have it escaped
              expect(escaped).toContain(`\\${char}`);
            }
          });
          
          // Test that escaping doesn't break the text structure
          expect(escaped.length).toBeGreaterThanOrEqual(text.length);
          
          // Test that double escaping works correctly
          const doubleEscaped = formatter.escapeMarkdownV2(escaped);
          // Double escaping should escape the backslashes that were already added
          expect(doubleEscaped.length).toBeGreaterThanOrEqual(escaped.length);
        }
      ), { numRuns: 100 });
    });

    it('should handle edge cases in escaping', () => {
      fc.assert(fc.property(
        fc.oneof(
          fc.constant(''), // Empty string
          fc.constant('_*[]()~`>#+-=|{}.!'), // All special chars
          fc.constant('\\'), // Backslash
          fc.constant('Hello_world*test'), // Mixed content
          fc.string({ minLength: 0, maxLength: 10 }).filter(s => /^[a-zA-Z0-9\s]*$/.test(s)) // Safe strings
        ),
        (text) => {
          const escaped = formatter.escapeMarkdownV2(text);
          
          // Empty strings should remain empty
          if (text === '') {
            expect(escaped).toBe('');
          }
          
          // Safe strings (no special chars) should be unchanged
          if (/^[a-zA-Z0-9\s]*$/.test(text)) {
            expect(escaped).toBe(text);
          }
          
          // Result should never contain unescaped special characters
          const unescapedSpecialChars = /(?<!\\)[_*[\]()~`>#+=|{}.!-]/;
          expect(escaped).not.toMatch(unescapedSpecialChars);
        }
      ), { numRuns: 100 });
    });
  });

  describe('Review Message Formatting', () => {
    it('should format review messages consistently', () => {
      fc.assert(fc.property(
        fc.record({
          id: fc.uuid(),
          text: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          level: fc.option(fc.constantFrom('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
          exampleEn: fc.option(fc.string({ minLength: 10, maxLength: 100 })),
          exampleRu: fc.option(fc.string({ minLength: 10, maxLength: 100 })),
          tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 })
        }),
        fc.option(fc.record({
          locale: fc.constant('en-US'),
          ipa: fc.option(fc.string({ minLength: 1, maxLength: 20 }))
        })),
        (word: Word, pronunciation?: Pronunciation) => {
          const message = formatter.formatReview(word, pronunciation);
          
          // Test that message contains the word (escaped)
          const escapedWord = formatter.escapeMarkdownV2(word.text);
          expect(message).toContain(`*${escapedWord}*`);
          
          // Test that pronunciation is included if available
          if (pronunciation?.ipa) {
            const escapedIpa = formatter.escapeMarkdownV2(pronunciation.ipa);
            expect(message).toContain(`/${escapedIpa}/`);
          }
          
          // Test that example is included if available (just check structure)
          if (word.exampleEn && word.exampleEn.trim().length > 0) {
            // Message should have more than just the word if example is present
            expect(message.split('\n').length).toBeGreaterThan(1);
          }
          
          // Test that translation or fallback is included
          // Should always contain spoiler section
          expect(message).toContain('||');
          
          if (word.exampleRu) {
            // Should contain the actual translation (possibly escaped)
            const escapedTranslation = formatter.escapeMarkdownV2(word.exampleRu);
            expect(message).toContain(escapedTranslation);
          } else if (word.exampleEn) {
            // Should contain fallback message for missing translation
            expect(message).toContain('Translation not available');
          } else {
            // Should contain encouraging message when both are missing
            expect(message).toContain('Think about what this word means');
          }
          
          // Test that level is included if available
          if (word.level) {
            expect(message).toContain(`Level: ${word.level}`);
          }
        }
      ), { numRuns: 100 });
    });
  });

  describe('Statistics Formatting', () => {
    it('should format statistics consistently', () => {
      fc.assert(fc.property(
        fc.record({
          totalItems: fc.integer({ min: 0, max: 10000 }),
          dueToday: fc.integer({ min: 0, max: 100 }),
          successRate: fc.float({ min: 0, max: 100, noNaN: true }),
          learningStreak: fc.integer({ min: 0, max: 365 })
        }),
        (stats: UserStats) => {
          const message = formatter.formatStats(stats);
          
          // Test that all stats are included
          expect(message).toContain(`${stats.totalItems}`);
          expect(message).toContain(`${stats.dueToday}`);
          expect(message).toContain(`${stats.successRate.toFixed(1)}%`);
          expect(message).toContain(`${stats.learningStreak} days`);
          
          // Test that message starts with title
          expect(message).toMatch(/^\*📊 Your Learning Statistics\*/);
          
          // Test motivational messages based on stats
          if (stats.learningStreak >= 7) {
            expect(message).toContain('Amazing');
          } else if (stats.successRate >= 80) {
            expect(message).toContain('Great job');
          } else if (stats.dueToday > 0) {
            expect(message).toContain('ready for review');
          }
        }
      ), { numRuns: 100 });
    });
  });

  describe('Keyboard Generation', () => {
    it('should create consistent difficulty keyboards', () => {
      fc.assert(fc.property(
        fc.uuid(),
        fc.uuid(),
        (userId: string, wordId: string) => {
          const keyboard = formatter.createDifficultyKeyboard(userId, wordId) as any;
          
          // Test keyboard structure
          expect(keyboard).toHaveProperty('inline_keyboard');
          expect(keyboard.inline_keyboard).toHaveLength(2); // 2 rows
          
          // Test first row (Hard, Normal)
          expect(keyboard.inline_keyboard[0]).toHaveLength(2);
          expect(keyboard.inline_keyboard[0][0].text).toBe('😰 Hard');
          expect(keyboard.inline_keyboard[0][1].text).toBe('🤔 Normal');
          
          // Test second row (Good, Easy)
          expect(keyboard.inline_keyboard[1]).toHaveLength(2);
          expect(keyboard.inline_keyboard[1][0].text).toBe('👍 Good');
          expect(keyboard.inline_keyboard[1][1].text).toBe('😎 Easy');
          
          // Test callback data format
          const difficulties = ['hard', 'normal', 'good', 'easy'];
          let buttonIndex = 0;
          
          keyboard.inline_keyboard.forEach((row: any[]) => {
            row.forEach((button: any) => {
              const expectedCallback = `difficulty:${userId}:${wordId}:${difficulties[buttonIndex]}`;
              expect(button.callback_data).toBe(expectedCallback);
              buttonIndex++;
            });
          });
        }
      ), { numRuns: 100 });
    });
  });

  describe('Welcome Message Formatting', () => {
    it('should format welcome messages based on link status', () => {
      fc.assert(fc.property(
        fc.boolean(),
        (isLinked: boolean) => {
          const message = formatter.formatWelcome(isLinked);
          
          // Test that message starts with welcome
          expect(message).toMatch(/^🤖 \*Welcome/);
          
          if (isLinked) {
            // Linked users should see progress/help info
            expect(message).toContain('account is linked');
            expect(message).toContain('/stats');
            expect(message).toContain('/help');
          } else {
            // Unlinked users should see linking instructions
            expect(message).toContain('link your account');
            expect(message).toContain('vocabulary quiz');
            expect(message).toContain('/link');
          }
          
          // Test that message is properly formatted (contains expected elements)
          expect(message).toContain('Welcome');
          expect(message).toContain('Bot');
        }
      ), { numRuns: 100 });
    });
  });
});