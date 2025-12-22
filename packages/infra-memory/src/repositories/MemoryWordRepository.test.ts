import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryWordRepository } from './MemoryWordRepository.js';
import type { Word } from '@english-learning/domain';

describe('MemoryWordRepository', () => {
  let repository: MemoryWordRepository;
  const mockWords: Word[] = [
    {
      id: 'word-1' as any,
      text: 'hello',
      level: 'A1',
      exampleEn: 'Hello world',
      exampleRu: 'Привет мир',
      tags: ['greeting'],
      pronunciations: [],
    },
    {
      id: 'word-2' as any,
      text: 'goodbye',
      level: 'A1',
      exampleEn: 'Goodbye friend',
      exampleRu: 'До свидания друг',
      tags: ['greeting'],
      pronunciations: [],
    },
  ];

  beforeEach(() => {
    repository = new MemoryWordRepository(mockWords);
  });

  it('should return random words', async () => {
    const words = await repository.getRandomBatch('user-1' as any, 1);
    
    expect(words).toHaveLength(1);
    expect(mockWords).toContainEqual(words[0]);
  });

  it('should return words by IDs', async () => {
    const words = await repository.getByIds(['word-1' as any]);
    
    expect(words).toHaveLength(1);
    expect(words[0].text).toBe('hello');
  });

  it('should return total count', async () => {
    const count = await repository.getTotalCount();
    
    expect(count).toBe(2);
  });

  it('should handle empty ID list', async () => {
    const words = await repository.getByIds([]);
    
    expect(words).toHaveLength(0);
  });

  it('should handle non-existent IDs', async () => {
    const words = await repository.getByIds(['non-existent' as any]);
    
    expect(words).toHaveLength(0);
  });
});