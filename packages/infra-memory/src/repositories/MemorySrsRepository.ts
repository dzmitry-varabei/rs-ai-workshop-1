/**
 * In-memory implementation of SrsRepository
 */

import type { 
  SrsRepository, 
  SrsItem,
  UserId, 
  WordId, 
  SrsDifficulty,
  ScheduleNextReviewResult 
} from '@english-learning/domain';
import { createInitialSrsItem } from '@english-learning/domain';

export class MemorySrsRepository implements SrsRepository {
  private items: Map<string, SrsItem> = new Map();

  private getKey(userId: UserId, wordId: WordId): string {
    return `${userId}:${wordId}`;
  }

  async createOrGet(userId: UserId, wordId: WordId, now: Date): Promise<SrsItem> {
    const key = this.getKey(userId, wordId);
    const existing = this.items.get(key);
    
    if (existing) {
      return existing;
    }

    const initial = createInitialSrsItem(now);
    const newItem: SrsItem = {
      userId,
      wordId,
      nextReviewAt: initial.nextReviewAt,
      lastReviewAt: null,
      intervalMinutes: initial.intervalMinutes,
      difficultyLast: null,
      reviewCount: 0,
      active: true,
    };

    this.items.set(key, newItem);
    return newItem;
  }

  async getDueItems(userId: UserId, now: Date, limit: number): Promise<SrsItem[]> {
    const userItems = Array.from(this.items.values())
      .filter(item => 
        item.userId === userId && 
        item.active && 
        item.nextReviewAt <= now
      )
      .sort((a, b) => a.nextReviewAt.getTime() - b.nextReviewAt.getTime())
      .slice(0, limit);

    return userItems;
  }

  async updateAfterReview(
    userId: UserId,
    wordId: WordId,
    scheduleResult: ScheduleNextReviewResult,
    difficulty: SrsDifficulty,
    now: Date
  ): Promise<void> {
    const key = this.getKey(userId, wordId);
    const item = this.items.get(key);
    
    if (!item) {
      throw new Error(`SRS item not found: ${key}`);
    }

    const updatedItem: SrsItem = {
      ...item,
      nextReviewAt: scheduleResult.nextReviewAt,
      lastReviewAt: now,
      intervalMinutes: scheduleResult.nextIntervalMinutes,
      difficultyLast: difficulty,
      reviewCount: item.reviewCount + 1,
    };

    this.items.set(key, updatedItem);
  }

  async getItem(userId: UserId, wordId: WordId): Promise<SrsItem | null> {
    const key = this.getKey(userId, wordId);
    return this.items.get(key) || null;
  }

  async deactivate(userId: UserId, wordId: WordId): Promise<void> {
    const key = this.getKey(userId, wordId);
    const item = this.items.get(key);
    
    if (item) {
      this.items.set(key, { ...item, active: false });
    }
  }

  async getStats(userId: UserId): Promise<{
    total: number;
    active: number;
    due: number;
    reviewCount: number;
  }> {
    const userItems = Array.from(this.items.values())
      .filter(item => item.userId === userId);

    const now = new Date();
    const active = userItems.filter(item => item.active);
    const due = active.filter(item => item.nextReviewAt <= now);
    const totalReviews = userItems.reduce((sum, item) => sum + item.reviewCount, 0);

    return {
      total: userItems.length,
      active: active.length,
      due: due.length,
      reviewCount: totalReviews,
    };
  }

  // Additional methods for testing
  clear(): void {
    this.items.clear();
  }

  getUserItems(userId: UserId): SrsItem[] {
    return Array.from(this.items.values())
      .filter(item => item.userId === userId);
  }

  getAllItems(): SrsItem[] {
    return Array.from(this.items.values());
  }
}