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
} from '@english-learning/data-layer-domain';
import { createInitialSrsItem } from '@english-learning/data-layer-domain';

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

  async getGlobalDueReviews(now: Date, limit: number, offset: number): Promise<Array<{
    userId: UserId;
    wordId: WordId;
    nextReviewAt: Date;
    intervalMinutes: number;
    reviewCount: number;
    user: {
      telegramChatId?: string;
      timezone: string;
      preferredWindowStart: string;
      preferredWindowEnd: string;
    };
  }>> {
    // For memory implementation, return mock data
    // In real implementation, this would join with user profiles
    const dueItems = Array.from(this.items.values())
      .filter(item => item.active && item.nextReviewAt <= now)
      .sort((a, b) => a.nextReviewAt.getTime() - b.nextReviewAt.getTime())
      .slice(offset, offset + limit);

    return dueItems.map(item => ({
      userId: item.userId,
      wordId: item.wordId,
      nextReviewAt: item.nextReviewAt,
      intervalMinutes: item.intervalMinutes,
      reviewCount: item.reviewCount,
      user: {
        telegramChatId: `chat_${item.userId}`,
        timezone: 'UTC',
        preferredWindowStart: '09:00',
        preferredWindowEnd: '21:00',
      },
    }));
  }

  async claimReviews(limit: number): Promise<Array<{
    userId: UserId;
    wordId: WordId;
  }>> {
    const now = new Date();
    const dueItems = Array.from(this.items.values())
      .filter(item => item.active && item.nextReviewAt <= now)
      .slice(0, limit);

    // In real implementation, this would atomically claim items
    // For memory, we just return the items
    return dueItems.map(item => ({
      userId: item.userId,
      wordId: item.wordId,
    }));
  }

  async markSent(userId: UserId, wordId: WordId, messageId: string, sentAt: Date): Promise<void> {
    const key = this.getKey(userId, wordId);
    const item = this.items.get(key);
    
    if (item) {
      // In real implementation, this would update delivery state
      // For memory, we just track that it was sent
      (item as any).messageId = messageId;
      (item as any).sentAt = sentAt;
    }
  }

  async resetToDue(userId: UserId, wordId: WordId): Promise<void> {
    const key = this.getKey(userId, wordId);
    const item = this.items.get(key);
    
    if (item) {
      // Reset to due state
      delete (item as any).messageId;
      delete (item as any).sentAt;
    }
  }

  async processTimeouts(timeoutMinutes: number = 1440): Promise<number> {
    const now = new Date();
    const timeoutThreshold = new Date(now.getTime() - timeoutMinutes * 60 * 1000);
    
    let processedCount = 0;
    
    for (const item of this.items.values()) {
      const sentAt = (item as any).sentAt;
      if (sentAt && sentAt < timeoutThreshold) {
        // Process timeout - reset to due
        delete (item as any).messageId;
        delete (item as any).sentAt;
        processedCount++;
      }
    }
    
    return processedCount;
  }

  async getProcessingStats(): Promise<{
    awaitingResponse: number;
    overdue: number;
    processedToday: number;
  }> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let awaitingResponse = 0;
    let overdue = 0;
    let processedToday = 0;
    
    for (const item of this.items.values()) {
      if ((item as any).messageId) {
        awaitingResponse++;
      }
      if (item.active && item.nextReviewAt < now) {
        overdue++;
      }
      if (item.lastReviewAt && item.lastReviewAt >= todayStart) {
        processedToday++;
      }
    }
    
    return {
      awaitingResponse,
      overdue,
      processedToday,
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