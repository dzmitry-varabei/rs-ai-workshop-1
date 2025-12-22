import { describe, it, expect, vi } from 'vitest';
import { WordService } from './WordService.js';
import type { WordRepository } from '@english-learning/domain';

describe('WordService', () => {
  it('should map domain Word to API WordResponse', async () => {
    const mockWordRepository: WordRepository = {
      getRandomBatch: vi.fn().mockResolvedValue([
        {
          id: 'word-1',
          text: 'hello',
          level: 'A1',
          exampleEn: 'Hello world',
          exampleRu: 'Привет мир',
          tags: ['greeting'],
          pronunciations: [
            {
              locale: 'en-US',
              ipa: '/həˈloʊ/',
              audioUrl: 'https://example.com/hello.mp3',
            },
          ],
        },
      ]),
      getByIds: vi.fn(),
      getTotalCount: vi.fn(),
    };

    const wordService = new WordService(mockWordRepository);
    const result = await wordService.getRandomWords('user-1', 1);

    expect(result).toEqual([
      {
        id: 'word-1',
        textEn: 'hello', // NOTE: API uses textEn, domain uses text
        level: 'A1',
        exampleEn: 'Hello world',
        exampleRu: 'Привет мир',
        tags: ['greeting'],
        pronunciations: [
          {
            locale: 'en-US',
            ipa: '/həˈloʊ/',
            audioUrl: 'https://example.com/hello.mp3',
          },
        ],
      },
    ]);

    expect(mockWordRepository.getRandomBatch).toHaveBeenCalledWith('user-1', 1);
  });
});