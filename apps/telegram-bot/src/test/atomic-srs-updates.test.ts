/**
 * Property tests for atomic SRS updates
 * Tests requirement 3.3: Atomic Schedule Updates
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Difficulty, UserId, WordId } from '../domain/types';

// Mock implementation for testing atomic SRS update logic
class MockAtomicSrsUpdater {
  private srsItems: Map<string, {
    userId: UserId;
    wordId: WordId;
    deliveryState: 'due' | 'sending' | 'awaiting_response' | 'scheduled';
    lastMessageId?: string;
    reviewCount: number;
    intervalMinutes: number;
    nextReviewAt: Date;
  }> = new Map();

  private reviewEvents: Array<{
    userId: UserId;
    wordId: WordId;
    difficulty: Difficulty;
    messageId?: string;
    reviewedAt: Date;
  }> = [];

  addSrsItem(userId: UserId, wordId: WordId, messageId?: string) {
    const key = `${userId}-${wordId}`;
    this.srsItems.set(key, {
      userId,
      wordId,
      deliveryState: 'awaiting_response',
      lastMessageId: messageId,
      reviewCount: 0,
      intervalMinutes: 1440, // 24 hours
      nextReviewAt: new Date(),
    });
  }

  // Simulate the atomic RPC function behavior
  processDifficultyRating(
    userId: UserId,
    wordId: WordId,
    messageId: string,
    difficulty: Difficulty
  ): { success: boolean; reason?: string } {
    const key = `${userId}-${wordId}`;
    const item = this.srsItems.get(key);

    // Property 9: Atomic Schedule Updates
    
    // Verify item exists and is in correct state
    if (!item) {
      return { success: false, reason: 'item_not_found' };
    }

    if (item.deliveryState !== 'awaiting_response') {
      return { success: false, reason: 'invalid_state' };
    }

    if (item.lastMessageId !== messageId) {
      return { success: false, reason: 'message_id_mismatch' };
    }

    // Calculate new interval based on difficulty
    const baseIntervals = {
      hard: 10,
      normal: 1440,
      good: 4320,
      easy: 10080,
    };

    const newInterval = Math.max(10, baseIntervals[difficulty] * Math.max(1, item.reviewCount + 1));
    const nextReviewAt = new Date(Date.now() + newInterval * 60 * 1000);

    // Atomic update: both SRS item and review event
    item.deliveryState = 'scheduled';
    item.reviewCount += 1;
    item.intervalMinutes = newInterval;
    item.nextReviewAt = nextReviewAt;

    this.reviewEvents.push({
      userId,
      wordId,
      difficulty,
      messageId,
      reviewedAt: new Date(),
    });

    return { success: true };
  }

  getSrsItem(userId: UserId, wordId: WordId) {
    return this.srsItems.get(`${userId}-${wordId}`);
  }

  getReviewEvents() {
    return [...this.reviewEvents];
  }
}

describe('Atomic SRS Updates Properties', () => {
  it('Property 9: Atomic Schedule Updates - successful update creates both SRS and event records', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.constantFrom('hard', 'normal', 'good', 'easy'),
        (userId, wordId, messageId, difficulty) => {
          const updater = new MockAtomicSrsUpdater();
          updater.addSrsItem(userId as UserId, wordId as WordId, messageId);

          const result = updater.processDifficultyRating(
            userId as UserId,
            wordId as WordId,
            messageId,
            difficulty as Difficulty
          );

          expect(result.success).toBe(true);

          // Verify SRS item was updated
          const srsItem = updater.getSrsItem(userId as UserId, wordId as WordId);
          expect(srsItem?.deliveryState).toBe('scheduled');
          expect(srsItem?.reviewCount).toBe(1);
          expect(srsItem?.intervalMinutes).toBeGreaterThan(0);

          // Verify review event was created
          const events = updater.getReviewEvents();
          expect(events).toHaveLength(1);
          expect(events[0].userId).toBe(userId);
          expect(events[0].wordId).toBe(wordId);
          expect(events[0].difficulty).toBe(difficulty);
          expect(events[0].messageId).toBe(messageId);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 9: Atomic Schedule Updates - rejects mismatched message IDs', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.constantFrom('hard', 'normal', 'good', 'easy'),
        (userId, wordId, correctMessageId, wrongMessageId, difficulty) => {
          fc.pre(correctMessageId !== wrongMessageId);

          const updater = new MockAtomicSrsUpdater();
          updater.addSrsItem(userId as UserId, wordId as WordId, correctMessageId);

          const result = updater.processDifficultyRating(
            userId as UserId,
            wordId as WordId,
            wrongMessageId,
            difficulty as Difficulty
          );

          expect(result.success).toBe(false);
          expect(result.reason).toBe('message_id_mismatch');

          // Verify no changes were made
          const srsItem = updater.getSrsItem(userId as UserId, wordId as WordId);
          expect(srsItem?.deliveryState).toBe('awaiting_response');
          expect(srsItem?.reviewCount).toBe(0);

          const events = updater.getReviewEvents();
          expect(events).toHaveLength(0);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('Property 9: Atomic Schedule Updates - interval calculation follows difficulty rules', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.constantFrom('hard', 'normal', 'good', 'easy'),
        fc.integer({ min: 0, max: 10 }),
        (userId, wordId, messageId, difficulty, initialReviewCount) => {
          const updater = new MockAtomicSrsUpdater();
          updater.addSrsItem(userId as UserId, wordId as WordId, messageId);

          // Set initial review count
          const item = updater.getSrsItem(userId as UserId, wordId as WordId);
          if (item) {
            item.reviewCount = initialReviewCount;
          }

          const result = updater.processDifficultyRating(
            userId as UserId,
            wordId as WordId,
            messageId,
            difficulty as Difficulty
          );

          expect(result.success).toBe(true);

          const updatedItem = updater.getSrsItem(userId as UserId, wordId as WordId);
          expect(updatedItem?.reviewCount).toBe(initialReviewCount + 1);

          // Verify interval follows difficulty rules
          const expectedBaseIntervals = {
            hard: 10,
            normal: 1440,
            good: 4320,
            easy: 10080,
          };

          const expectedInterval = Math.max(
            10,
            expectedBaseIntervals[difficulty as Difficulty] * Math.max(1, initialReviewCount + 1)
          );

          expect(updatedItem?.intervalMinutes).toBe(expectedInterval);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 9: Atomic Schedule Updates - rejects non-existent items', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.constantFrom('hard', 'normal', 'good', 'easy'),
        (userId, wordId, messageId, difficulty) => {
          const updater = new MockAtomicSrsUpdater();
          // Don't add the item

          const result = updater.processDifficultyRating(
            userId as UserId,
            wordId as WordId,
            messageId,
            difficulty as Difficulty
          );

          expect(result.success).toBe(false);
          expect(result.reason).toBe('item_not_found');

          // Verify no events were created
          const events = updater.getReviewEvents();
          expect(events).toHaveLength(0);
        }
      ),
      { numRuns: 30 }
    );
  });
});