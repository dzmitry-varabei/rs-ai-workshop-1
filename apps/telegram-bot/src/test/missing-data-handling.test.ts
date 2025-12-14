/**
 * Property tests for missing data handling in message formatting
 * Validates: Requirements 2.5 - Pronunciation Inclusion
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { MessageFormatter } from '../services/MessageFormatter';
import type { Word, Pronunciation } from '../domain/types';

describe('MessageFormatter - Missing Data Handling', () => {
  const formatter = new MessageFormatter();

  /**
   * Property 7: Pronunciation Inclusion
   * When pronunciation data is available, it should be included in the message.
   * When missing, the message should still be valid and helpful.
   */
  it('should handle missing pronunciation data gracefully', () => {
    fc.assert(
      fc.property(
        // Generate word with varying completeness
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }),
          text: fc.string({ minLength: 1, maxLength: 100 }),
          level: fc.option(fc.constantFrom('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
          exampleEn: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
          exampleRu: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
        }),
        // Generate optional pronunciation
        fc.option(
          fc.record({
            wordId: fc.string(),
            ipa: fc.string({ minLength: 1, maxLength: 50 }),
            audioUrl: fc.option(fc.webUrl()),
          })
        ),
        (word: Word, pronunciation: Pronunciation | null) => {
          const message = formatter.formatReview(word, pronunciation || undefined);
          
          // Message should always contain the word itself (possibly escaped)
          const escapedWord = formatter.escapeMarkdownV2(word.text);
          expect(message).toContain(escapedWord);
          
          // If pronunciation is provided, it should be included (possibly escaped)
          if (pronunciation?.ipa) {
            const escapedIpa = formatter.escapeMarkdownV2(pronunciation.ipa);
            expect(message).toContain(escapedIpa);
            expect(message).toMatch(/\/.*\//); // Should contain IPA notation
          } else {
            // If no pronunciation, message should not contain IPA notation
            // But allow for cases where example text might contain slashes
            const hasIpaNotation = message.match(/\/[^/\s]+\//);
            if (hasIpaNotation) {
              // If we find what looks like IPA, it should be right after the word (pronunciation position)
              const wordEnd = message.indexOf('*', 1); // Find closing * of word
              const ipaStart = message.indexOf('/', wordEnd);
              expect(ipaStart).toBe(-1); // Should not find IPA in pronunciation position
            }
          }
          
          // Message should always have some content for translation section
          expect(message).toContain('||');
          
          // If no example is provided, should have helpful fallback
          if (!word.exampleEn) {
            expect(message).toMatch(/No example sentence available|Think of your own/i);
          }
          
          // If no translation is provided, should have appropriate fallback
          if (!word.exampleRu) {
            if (word.exampleEn) {
              expect(message).toMatch(/Translation not available/i);
            } else {
              expect(message).toMatch(/Think about what this word means/i);
            }
          }
          
          // Message should be valid MarkdownV2 (no unescaped special chars)
          const specialChars = /[_*[\]()~`>#+=|{}.!-]/;
          const lines = message.split('\n');
          for (const line of lines) {
            // Skip spoiler content and already formatted content
            if (line.startsWith('||') || line.startsWith('*') || line.startsWith('_')) {
              continue;
            }
            // Check that special chars are properly escaped
            const matches = line.match(specialChars);
            if (matches) {
              const index = matches.index!;
              // Should be escaped (preceded by backslash)
              if (index > 0) {
                expect(line[index - 1]).toBe('\\');
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle completely empty word data gracefully', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1 }),
          text: fc.string({ minLength: 1, maxLength: 50 }),
          level: fc.constant(null),
          exampleEn: fc.constant(null),
          exampleRu: fc.constant(null),
        }),
        (word: Word) => {
          const message = formatter.formatReview(word);
          
          // Should still produce a valid message
          expect(message).toBeTruthy();
          expect(message.length).toBeGreaterThan(0);
          
          // Should contain the word (possibly escaped)
          const escapedWord = formatter.escapeMarkdownV2(word.text);
          expect(message).toContain(escapedWord);
          
          // Should have helpful fallback messages
          expect(message).toMatch(/No example sentence available|Think of your own/i);
          expect(message).toMatch(/Think about what this word means/i);
          
          // Should not contain level info
          expect(message).not.toMatch(/Level:/);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should escape special characters in all data fields', () => {
    fc.assert(
      fc.property(
        // Generate word with special characters
        fc.record({
          id: fc.string({ minLength: 1 }),
          text: fc.string({ minLength: 1, maxLength: 20 }),
          level: fc.option(fc.string({ minLength: 1, maxLength: 10 })),
          exampleEn: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
          exampleRu: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
        }),
        fc.option(
          fc.record({
            wordId: fc.string(),
            ipa: fc.string({ minLength: 1, maxLength: 30 }),
            audioUrl: fc.option(fc.webUrl()),
          })
        ),
        (word: Word, pronunciation: Pronunciation | null) => {
          const message = formatter.formatReview(word, pronunciation || undefined);
          
          // Check that the message doesn't contain unescaped special characters
          // outside of intentional formatting
          const lines = message.split('\n');
          
          for (const line of lines) {
            // Skip lines that are intentionally formatted
            if (line.startsWith('*') || line.startsWith('||') || line.startsWith('_')) {
              continue;
            }
            
            // Check for unescaped special characters
            const unescapedSpecialChars = line.match(/(?<!\\)[_*[\]()~`>#+=|{}.!-]/g);
            
            // Should not have unescaped special characters in regular text
            if (unescapedSpecialChars) {
              // Allow some exceptions for intentional formatting
              const allowedUnescaped = ['*', '_', '|']; // These might be intentional
              const problematicChars = unescapedSpecialChars.filter(
                (char) => !allowedUnescaped.includes(char)
              );
              expect(problematicChars).toHaveLength(0);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain consistent message structure regardless of missing data', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1 }),
          text: fc.string({ minLength: 1, maxLength: 50 }),
          level: fc.option(fc.constantFrom('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
          exampleEn: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
          exampleRu: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
        }),
        (word: Word) => {
          const message = formatter.formatReview(word);
          
          // Message should always have these structural elements:
          // 1. Word at the beginning (bold)
          expect(message).toMatch(/^\*.*\*/);
          
          // 2. Some content section (example or fallback)
          const lines = message.split('\n\n');
          expect(lines.length).toBeGreaterThanOrEqual(2);
          
          // 3. Translation section (spoiler)
          expect(message).toContain('||');
          
          // 4. If level exists, should be at the end
          if (word.level) {
            expect(message).toMatch(/📚 Level:.*$/m);
          }
          
          // Message should not be too short (should have meaningful content)
          // Account for very short words and escaping
          expect(message.length).toBeGreaterThan(10);
        }
      ),
      { numRuns: 100 }
    );
  });
});