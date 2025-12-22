import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from './server.js';
import type { FastifyInstance } from 'fastify';

describe('Database Service Server', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    // Set environment for in-memory backend
    process.env.STORAGE_BACKEND = 'memory';
    process.env.LOG_LEVEL = 'error';
    
    server = await createServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('should respond to health check', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.backend).toBe('memory');
  });

  it('should return random words', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/words/random?userId=550e8400-e29b-41d4-a716-446655440000&limit=3',
    });

    expect(response.statusCode).toBe(200);
    const words = JSON.parse(response.body);
    expect(Array.isArray(words)).toBe(true);
    expect(words.length).toBeLessThanOrEqual(3);
    
    if (words.length > 0) {
      expect(words[0]).toHaveProperty('textEn');
      expect(words[0]).toHaveProperty('id');
    }
  });

  it('should handle word status operations', async () => {
    // Mark word as known
    const markResponse = await server.inject({
      method: 'POST',
      url: '/api/user-progress/mark-known',
      payload: {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        wordId: '550e8400-e29b-41d4-a716-446655440001',
      },
    });

    expect(markResponse.statusCode).toBe(200);

    // Get user stats
    const statsResponse = await server.inject({
      method: 'GET',
      url: '/api/user-progress/stats?userId=550e8400-e29b-41d4-a716-446655440000',
    });

    expect(statsResponse.statusCode).toBe(200);
    const stats = JSON.parse(statsResponse.body);
    expect(stats).toHaveProperty('totalSeen');
    expect(stats).toHaveProperty('known');
    expect(stats.known).toBeGreaterThan(0);
  });

  it('should handle SRS operations', async () => {
    // Create SRS item
    const createResponse = await server.inject({
      method: 'POST',
      url: '/api/srs/create-item',
      payload: {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        wordId: '550e8400-e29b-41d4-a716-446655440002',
      },
    });

    expect(createResponse.statusCode).toBe(200);

    // Get SRS stats
    const statsResponse = await server.inject({
      method: 'GET',
      url: '/api/srs/stats?userId=550e8400-e29b-41d4-a716-446655440000',
    });

    expect(statsResponse.statusCode).toBe(200);
    const stats = JSON.parse(statsResponse.body);
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('active');
  });
});