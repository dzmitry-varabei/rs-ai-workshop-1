import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseClient } from './DatabaseClient.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('DatabaseClient', () => {
  let client: DatabaseClient;

  beforeEach(() => {
    client = new DatabaseClient({
      baseUrl: 'http://localhost:3001',
    });
    mockFetch.mockClear();
  });

  it('should construct URLs correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await client.getRandomWords('user-1', 5);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/words/random?userId=user-1&limit=5',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('should handle API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Not Found',
        message: 'Word not found',
        statusCode: 404,
      }),
    });

    await expect(client.getWordById('invalid-id')).rejects.toThrow('API Error: Word not found');
  });

  it('should remove trailing slash from baseUrl', () => {
    const clientWithSlash = new DatabaseClient({
      baseUrl: 'http://localhost:3001/',
    });

    expect((clientWithSlash as any).baseUrl).toBe('http://localhost:3001');
  });
});