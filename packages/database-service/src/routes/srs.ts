/**
 * SRS (Spaced Repetition System) API Routes
 */

import type { FastifyInstance } from 'fastify';
import type { SrsService } from '../services/SrsService.js';

export async function srsRoutes(
  fastify: FastifyInstance,
  { srsService }: { srsService: SrsService }
) {
  // GET /api/srs/due-words
  fastify.get('/due-words', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
        },
        required: ['userId'],
      },
    },
  }, async (request) => {
    const { userId, limit = 10 } = request.query as { userId: string; limit?: number };
    return srsService.getDueWords(userId, limit);
  });

  // POST /api/srs/record-review
  fastify.post('/record-review', {
    schema: {
      body: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          wordId: { type: 'string', format: 'uuid' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard', 'very_hard'] },
        },
        required: ['userId', 'wordId', 'difficulty'],
      },
    },
  }, async (request) => {
    const reviewData = request.body as { userId: string; wordId: string; difficulty: string };
    await srsService.recordReview(reviewData);
    return { success: true };
  });

  // GET /api/srs/stats
  fastify.get('/stats', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
        required: ['userId'],
      },
    },
  }, async (request) => {
    const { userId } = request.query as { userId: string };
    return srsService.getSrsStats(userId);
  });

  // POST /api/srs/create-item
  fastify.post('/create-item', {
    schema: {
      body: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          wordId: { type: 'string', format: 'uuid' },
        },
        required: ['userId', 'wordId'],
      },
    },
  }, async (request) => {
    const { userId, wordId } = request.body as { userId: string; wordId: string };
    await srsService.createSrsItem(userId, wordId);
    return { success: true };
  });

  // POST /api/srs/deactivate-item
  fastify.post('/deactivate-item', {
    schema: {
      body: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          wordId: { type: 'string', format: 'uuid' },
        },
        required: ['userId', 'wordId'],
      },
    },
  }, async (request) => {
    const { userId, wordId } = request.body as { userId: string; wordId: string };
    await srsService.deactivateSrsItem(userId, wordId);
    return { success: true };
  });
}