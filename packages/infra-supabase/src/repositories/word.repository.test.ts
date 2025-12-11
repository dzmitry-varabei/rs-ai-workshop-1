import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseWordRepository } from './word.repository.js';
import type { UserId, WordId } from '@english-learning/domain';

describe('SupabaseWordRepository', () => {
  let mockClient: SupabaseClient;
  let repository: SupabaseWordRepository;
  const mockUserId = 'user-123' as UserId;

  beforeEach(() => {
    // Create mock Supabase client
    mockClient = {
      from: vi.fn(),
    } as unknown as SupabaseClient;

    repository = new SupabaseWordRepository(mockClient);
  });

  describe('getRandomBatch', () => {
    it('should fetch random words and map them correctly', async () => {
      const mockWords = [
        {
          id: 'word-1',
          text_en: 'boost',
          level: 'B1',
          example_en: 'I need a boost',
          example_ru: 'Мне нужен заряд',
          tags: ['energy'],
          extra: {},
        },
      ];

      const mockPronunciations = [
        {
          word_id: 'word-1',
          locale: 'en-US',
          ipa: '/buːst/',
          audio_url: 'https://example.com/boost.mp3',
          source: 'forvo',
        },
      ];

      const countSelect = vi.fn().mockResolvedValue({ count: 1, error: null });
      const range = vi.fn().mockResolvedValue({ data: mockWords, error: null });
      const wordQuery = {
        select: vi.fn().mockReturnThis(),
        range,
      };

      // Mock pronunciations query
      const mockPronSelect = vi.fn().mockReturnThis();
      const mockPronIn = vi.fn().mockResolvedValue({
        data: mockPronunciations,
        error: null,
      });

      (mockClient.from as ReturnType<typeof vi.fn>)
        // count query
        .mockReturnValueOnce({
          select: countSelect,
        })
        // words query with range
        .mockReturnValueOnce(wordQuery)
        // pronunciations query
        .mockReturnValueOnce({
          select: mockPronSelect,
          in: mockPronIn,
        });

      const result = await repository.getRandomBatch(mockUserId, 1);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('word-1' as WordId);
      expect(result[0].text).toBe('boost');
      expect(result[0].level).toBe('B1');
      expect(result[0].pronunciations).toHaveLength(1);
      expect(result[0].pronunciations[0].locale).toBe('en-US');
    });

    it('should handle empty result', async () => {
      const countSelect = vi.fn().mockResolvedValue({ count: 0, error: null });
      (mockClient.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: countSelect,
      });

      const result = await repository.getRandomBatch(mockUserId, 10);

      expect(result).toHaveLength(0);
    });

    it('should throw error on database error', async () => {
      const countSelect = vi.fn().mockResolvedValue({ count: 5, error: null });
      const range = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });
      const wordQuery = {
        select: vi.fn().mockReturnThis(),
        range,
      };

      (mockClient.from as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce({ select: countSelect })
        .mockReturnValueOnce(wordQuery);

      await expect(repository.getRandomBatch(mockUserId, 10)).rejects.toThrow(
        'Failed to fetch random words'
      );
    });
  });

  describe('getByIds', () => {
    it('should fetch words by IDs', async () => {
      const mockWords = [
        {
          id: 'word-1',
          text_en: 'boost',
          level: null,
          example_en: null,
          example_ru: null,
          tags: [],
          extra: {},
        },
      ];

      const mockSelect = vi.fn().mockReturnThis();
      const mockIn = vi.fn().mockResolvedValue({ data: mockWords, error: null });

      (mockClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: mockSelect,
        in: mockIn,
      });

      // Mock pronunciations (empty)
      const mockPronSelect = vi.fn().mockReturnThis();
      const mockPronIn = vi.fn().mockResolvedValue({ data: [], error: null });

      (mockClient.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        if (table === 'word_pronunciations') {
          return {
            select: mockPronSelect,
            in: mockPronIn,
          };
        }
        return {
          select: mockSelect,
          in: mockIn,
        };
      });

      const result = await repository.getByIds(['word-1' as WordId]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('word-1' as WordId);
    });

    it('should return empty array for empty input', async () => {
      const result = await repository.getByIds([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('getTotalCount', () => {
    it('should return total word count', async () => {
      const mockSelect = vi.fn().mockResolvedValue({ count: 3000, error: null });

      (mockClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: mockSelect,
      });

      const result = await repository.getTotalCount();

      expect(result).toBe(3000);
    });

    it('should return 0 if count is null', async () => {
      const mockSelect = vi.fn().mockResolvedValue({ count: null, error: null });

      (mockClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: mockSelect,
      });

      const result = await repository.getTotalCount();

      expect(result).toBe(0);
    });
  });
});

