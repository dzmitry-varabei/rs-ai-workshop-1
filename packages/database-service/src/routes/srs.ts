/**
 * SRS (Spaced Repetition System) API Routes
 */

import type { FastifyInstance } from 'fastify';
import { 
  GetDueWordsRequestSchema,
  RecordReviewRequestSchema,
  GetUserStatsRequestSchema 
} from '../types/api.js';
import type { SrsService } from '../services/SrsService.js';

export async function srsRoutes(
  fastify: FastifyInstance,
  { srsService }: { srsService: SrsService }
) {
  // GET /api/srs/due-words
  fastify.get('/due-words', {
    schema: {
      querystring: GetDueWordsRequestSchema,
    },
  }, async (request) => {
    const { userId, limit } = GetDueWordsRequestSchema.parse(request.query);
    return srsService.getDueWords(userId, limit);
  });

  // POST /api/srs/record-review
  fastify.post('/record-review', {
    schema: {
      body: RecordReviewRequestSchema,
    },
  }, async (request) => {
    const reviewData = RecordReviewRequestSchema.parse(request.body);
    await srsService.recordReview(reviewData);
    return { success: true };
  });

  // GET /api/srs/stats
  fastify.get('/stats', {
    schema: {
      querystring: GetUserStatsRequestSchema,
    },
  }, async (request) => {
    const { userId } = GetUserStatsRequestSchema.parse(request.query);
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