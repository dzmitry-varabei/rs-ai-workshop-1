import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseUserWordStateRepository } from './user-word-state.repository.js';
import type { UserId, WordId } from '@english-learning/data-layer-domain';

describe('SupabaseUserWordStateRepository', () => {
  let repository: SupabaseUserWordStateRepository;
  let mockClient: {
    from: ReturnType<typeof vi.fn>;
  };

  const userId = 'user-123' as UserId;
  const wordId = 'word-456' as WordId;

  beforeEach(() => {
    mockClient = {
      from: vi.fn(),
    };
    repository = new SupabaseUserWordStateRepository(mockClient as unknown as SupabaseClient);
  });

  describe('markKnown', () => {
    it('should create new record when word not seen before', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockReturnThis(),
      };

      mockClient.from.mockReturnValue(mockQuery);
      mockQuery.upsert.mockResolvedValue({ data: null, error: null });

      await repository.markKnown(userId, wordId);

      expect(mockClient.from).toHaveBeenCalledWith('user_word_state');
      expect(mockQuery.select).toHaveBeenCalledWith('seen_count');
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockQuery.eq).toHaveBeenCalledWith('word_id', wordId);
      expect(mockQuery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          word_id: wordId,
          status: 'known',
          seen_count: 1,
        }),
        { onConflict: 'user_id,word_id' }
      );
    });

    it('should increment seen_count when word already exists', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { seen_count: 3 },
          error: null,
        }),
        upsert: vi.fn().mockReturnThis(),
      };

      mockClient.from.mockReturnValue(mockQuery);
      mockQuery.upsert.mockResolvedValue({ data: null, error: null });

      await repository.markKnown(userId, wordId);

      expect(mockQuery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          seen_count: 4,
        }),
        { onConflict: 'user_id,word_id' }
      );
    });

    it('should throw error on database failure', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      mockClient.from.mockReturnValue(mockQuery);

      await expect(repository.markKnown(userId, wordId)).rejects.toThrow(
        'Failed to mark word as known: Database error'
      );
    });
  });

  describe('markUnknown', () => {
    it('should create new record with unknown status', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockReturnThis(),
      };

      mockClient.from.mockReturnValue(mockQuery);
      mockQuery.upsert.mockResolvedValue({ data: null, error: null });

      await repository.markUnknown(userId, wordId);

      expect(mockQuery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unknown',
          seen_count: 1,
        }),
        { onConflict: 'user_id,word_id' }
      );
    });

    it('should increment seen_count when word already exists', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { seen_count: 2 },
          error: null,
        }),
        upsert: vi.fn().mockReturnThis(),
      };

      mockClient.from.mockReturnValue(mockQuery);
      mockQuery.upsert.mockResolvedValue({ data: null, error: null });

      await repository.markUnknown(userId, wordId);

      expect(mockQuery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          seen_count: 3,
        }),
        { onConflict: 'user_id,word_id' }
      );
    });
  });

  describe('getStats', () => {
    it('should return empty stats when user has no words', async () => {
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
        totalSeen: 0,
        known: 0,
        unknown: 0,
        learning: 0,
        knowledgePercentage: 0,
      });
    });

    it('should calculate stats correctly', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [
            { status: 'known' },
            { status: 'known' },
            { status: 'unknown' },
            { status: 'learning' },
            { status: 'known' },
          ],
          error: null,
        }),
      };

      mockClient.from.mockReturnValue(mockQuery);

      const stats = await repository.getStats(userId);

      expect(stats).toEqual({
        totalSeen: 5,
        known: 3,
        unknown: 1,
        learning: 1,
        knowledgePercentage: 60, // 3/5 * 100 = 60
      });
    });

    it('should handle 100% knowledge correctly', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ status: 'known' }, { status: 'known' }],
          error: null,
        }),
      };

      mockClient.from.mockReturnValue(mockQuery);

      const stats = await repository.getStats(userId);

      expect(stats.knowledgePercentage).toBe(100);
    });

    it('should throw error on database failure', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      mockClient.from.mockReturnValue(mockQuery);

      await expect(repository.getStats(userId)).rejects.toThrow(
        'Failed to get user word stats: Database error'
      );
    });
  });

  describe('getStatus', () => {
    it('should return status when word exists', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [{ status: 'known' }],
          error: null,
        }),
      };

      mockClient.from.mockReturnValue(mockQuery);

      const status = await repository.getStatus(userId, wordId);

      expect(status).toBe('known');
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockQuery.eq).toHaveBeenCalledWith('word_id', wordId);
    });

    it('should return null when word not found', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      mockClient.from.mockReturnValue(mockQuery);

      const status = await repository.getStatus(userId, wordId);

      expect(status).toBeNull();
    });

    it('should throw error on other database errors', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'OTHER_ERROR', message: 'Database error' },
        }),
      };

      mockClient.from.mockReturnValue(mockQuery);

      await expect(repository.getStatus(userId, wordId)).rejects.toThrow(
        'Failed to get word status: Database error'
      );
    });
  });

  describe('resetProgress', () => {
    it('should delete all user word states', async () => {
      const mockQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockClient.from.mockReturnValue(mockQuery);

      await repository.resetProgress(userId);

      expect(mockClient.from).toHaveBeenCalledWith('user_word_state');
      expect(mockQuery.delete).toHaveBeenCalled();
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', userId);
    });

    it('should throw error on database failure', async () => {
      const mockQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      mockClient.from.mockReturnValue(mockQuery);

      await expect(repository.resetProgress(userId)).rejects.toThrow(
        'Failed to reset user progress: Database error'
      );
    });
  });
});

