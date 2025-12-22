import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseSrsRepository } from './srs.repository.js';
import type { UserId, WordId, SrsDifficulty } from '@english-learning/domain';
import { scheduleNextReview } from '@english-learning/domain';

describe('SupabaseSrsRepository', () => {
  let repository: SupabaseSrsRepository;
  let mockClient: {
    from: ReturnType<typeof vi.fn>;
  };

  const userId = 'user-123' as UserId;
  const wordId = 'word-456' as WordId;
  const now = new Date('2025-01-01T12:00:00Z');

  beforeEach(() => {
    mockClient = {
      from: vi.fn(),
    };
    repository = new SupabaseSrsRepository(mockClient as unknown as SupabaseClient);
  });

  describe('createOrGet', () => {
    it('should create new item when not exists', async () => {
      const existingQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' },
        }),
      };

      const insertSelectSingle = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            user_id: userId,
            word_id: wordId,
            next_review_at: '2025-01-01T12:10:00Z',
            last_review_at: null,
            interval_minutes: 10,
            difficulty_last: null,
            review_count: 0,
            active: true,
          },
          error: null,
        }),
      };

      const insertQuery = {
        insert: vi.fn().mockReturnValue(insertSelectSingle),
      };

      mockClient.from
        .mockReturnValueOnce(existingQuery) // fetch existing
        .mockReturnValueOnce(insertQuery); // insert

      const item = await repository.createOrGet(userId, wordId, now);

      expect(item.userId).toBe(userId);
      expect(item.wordId).toBe(wordId);
      expect(item.active).toBe(true);
      expect(item.reviewCount).toBe(0);
      expect(insertQuery.insert).toHaveBeenCalled();
    });

    it('should return existing item when exists', async () => {
      const existingData = {
        user_id: userId,
        word_id: wordId,
        next_review_at: '2025-01-01T13:00:00Z',
        last_review_at: '2025-01-01T12:00:00Z',
        interval_minutes: 60,
        difficulty_last: 'normal' as SrsDifficulty,
        review_count: 2,
        active: true,
      };

      const existingQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: existingData,
          error: null,
        }),
      };

      mockClient.from.mockReturnValue(existingQuery);

      const item = await repository.createOrGet(userId, wordId, now);

      expect(item.userId).toBe(userId);
      expect(item.wordId).toBe(wordId);
      expect(item.reviewCount).toBe(2);
      expect(item.difficultyLast).toBe('normal');
      // insert was never returned from mockClient.from, so implicitly not called
    });
  });

  describe('getDueItems', () => {
    it('should return items due for review', async () => {
      const dueItems = [
        {
          user_id: userId,
          word_id: 'word-1' as WordId,
          next_review_at: '2025-01-01T11:00:00Z',
          last_review_at: null,
          interval_minutes: 10,
          difficulty_last: null,
          review_count: 0,
          active: true,
        },
        {
          user_id: userId,
          word_id: 'word-2' as WordId,
          next_review_at: '2025-01-01T12:00:00Z',
          last_review_at: '2025-01-01T11:00:00Z',
          interval_minutes: 60,
          difficulty_last: 'normal' as SrsDifficulty,
          review_count: 1,
          active: true,
        },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: dueItems,
          error: null,
        }),
      };

      mockClient.from.mockReturnValue(mockQuery);

      const items = await repository.getDueItems(userId, now, 10);

      expect(items).toHaveLength(2);
      expect(items[0].wordId).toBe('word-1');
      expect(items[1].wordId).toBe('word-2');
      expect(mockQuery.lte).toHaveBeenCalledWith('next_review_at', now.toISOString());
      expect(mockQuery.eq).toHaveBeenCalledWith('active', true);
    });

    it('should return empty array when no items due', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      mockClient.from.mockReturnValue(mockQuery);

      const items = await repository.getDueItems(userId, now, 10);

      expect(items).toHaveLength(0);
    });
  });

  describe('updateAfterReview', () => {
    it('should update item after review', async () => {
      const scheduleResult = scheduleNextReview({
        now,
        previousIntervalMinutes: 10,
        previousReviewCount: 0,
        difficulty: 'normal',
      });

      const fetchQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { review_count: 1 },
          error: null,
        }),
      };

      const updateQuery = {
        update: vi.fn(),
        eq: vi.fn(),
      };

      updateQuery.update.mockReturnValue(updateQuery);
      updateQuery.eq
        .mockImplementationOnce(() => updateQuery)
        .mockResolvedValue({ data: null, error: null });

      mockClient.from
        .mockReturnValueOnce(fetchQuery) // fetch current
        .mockReturnValueOnce(updateQuery); // update

      await repository.updateAfterReview(userId, wordId, scheduleResult, 'normal', now);

      expect(updateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          next_review_at: scheduleResult.nextReviewAt.toISOString(),
          last_review_at: now.toISOString(),
          interval_minutes: scheduleResult.nextIntervalMinutes,
          difficulty_last: 'normal',
          review_count: 2, // incremented from 1
          active: true,
        })
      );
      expect(updateQuery.eq).toHaveBeenCalledWith('user_id', userId);
      expect(updateQuery.eq).toHaveBeenCalledWith('word_id', wordId);
    });
  });

  describe('getItem', () => {
    it('should return item when exists', async () => {
      const itemData = {
        user_id: userId,
        word_id: wordId,
        next_review_at: '2025-01-01T13:00:00Z',
        last_review_at: '2025-01-01T12:00:00Z',
        interval_minutes: 60,
        difficulty_last: 'good' as SrsDifficulty,
        review_count: 3,
        active: true,
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: itemData,
          error: null,
        }),
      };

      mockClient.from.mockReturnValue(mockQuery);

      const item = await repository.getItem(userId, wordId);

      expect(item).not.toBeNull();
      expect(item?.userId).toBe(userId);
      expect(item?.wordId).toBe(wordId);
      expect(item?.reviewCount).toBe(3);
    });

    it('should return null when item not found', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' },
        }),
      };

      mockClient.from.mockReturnValue(mockQuery);

      const item = await repository.getItem(userId, wordId);

      expect(item).toBeNull();
    });
  });

  describe('deactivate', () => {
    it('should deactivate SRS item', async () => {
      const updateQuery = {
        update: vi.fn(),
        eq: vi.fn(),
      };
      updateQuery.update.mockReturnValue(updateQuery);
      updateQuery.eq
        .mockImplementationOnce(() => updateQuery)
        .mockResolvedValue({ data: null, error: null });

      mockClient.from.mockReturnValue(updateQuery);

      await repository.deactivate(userId, wordId);

      expect(mockClient.from).toHaveBeenCalledWith('srs_items');
      expect(updateQuery.update).toHaveBeenCalledWith({ active: false });
      expect(updateQuery.eq).toHaveBeenCalledWith('user_id', userId);
      expect(updateQuery.eq).toHaveBeenCalledWith('word_id', wordId);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should calculate stats correctly', async () => {
      const items = [
        {
          active: true,
          next_review_at: '2025-01-01T11:00:00Z', // due
          review_count: 2,
        },
        {
          active: true,
          next_review_at: '2025-01-01T13:00:00Z', // not due
          review_count: 1,
        },
        {
          active: false,
          next_review_at: '2025-01-01T10:00:00Z',
          review_count: 5,
        },
      ];

      const statsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: items,
          error: null,
        }),
      };

      mockClient.from.mockReturnValue(statsQuery);

      const stats = await repository.getStats(userId);

      expect(stats.total).toBe(3);
      expect(stats.active).toBe(2);
      expect(stats.due).toBe(1); // only first item is due
      expect(stats.reviewCount).toBe(8); // 2 + 1 + 5
    });

    it('should return zero stats when no items', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      mockClient.from.mockReturnValue(mockQuery);

      const stats = await repository.getStats(userId);

      expect(stats).toEqual({
        total: 0,
        active: 0,
        due: 0,
        reviewCount: 0,
      });
    });
  });
});

