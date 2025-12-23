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
    const reviewData = request.body as { 
      userId: string; 
      wordId: string; 
      difficulty: 'easy' | 'medium' | 'hard' | 'very_hard' 
    };
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

  // GET /api/srs/due-reviews (global)
  fastify.get('/due-reviews', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
          offset: { type: 'number', minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { limit = 10, offset = 0 } = request.query as { limit?: number; offset?: number };
    return srsService.getGlobalDueReviews(limit, offset);
  });

  // POST /api/srs/claim-reviews
  fastify.post('/claim-reviews', {
    schema: {
      body: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
        },
      },
    },
  }, async (request) => {
    const { limit = 10 } = request.body as { limit?: number };
    return srsService.claimReviews(limit);
  });

  // PUT /api/srs/items/:userId/:wordId/mark-sent
  fastify.put('/items/:userId/:wordId/mark-sent', {
    schema: {
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          wordId: { type: 'string', format: 'uuid' },
        },
        required: ['userId', 'wordId'],
      },
      body: {
        type: 'object',
        properties: {
          messageId: { type: 'string' },
          sentAt: { type: 'string', format: 'date-time' },
        },
        required: ['messageId', 'sentAt'],
      },
    },
  }, async (request) => {
    const { userId, wordId } = request.params as { userId: string; wordId: string };
    const { messageId, sentAt } = request.body as { messageId: string; sentAt: string };
    
    await srsService.markSent(userId, wordId, messageId, sentAt);
    return { success: true };
  });

  // PUT /api/srs/items/:userId/:wordId/reset-to-due
  fastify.put('/items/:userId/:wordId/reset-to-due', {
    schema: {
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          wordId: { type: 'string', format: 'uuid' },
        },
        required: ['userId', 'wordId'],
      },
    },
  }, async (request) => {
    const { userId, wordId } = request.params as { userId: string; wordId: string };
    
    await srsService.resetToDue(userId, wordId);
    return { success: true };
  });

  // POST /api/srs/process-timeouts
  fastify.post('/process-timeouts', {
    schema: {
      body: {
        type: 'object',
        properties: {
          timeoutMinutes: { type: 'number', minimum: 1, default: 1440 },
        },
      },
    },
  }, async (request) => {
    const { timeoutMinutes = 1440 } = request.body as { timeoutMinutes?: number };
    return srsService.processTimeouts(timeoutMinutes);
  });

  // GET /api/srs/processing-stats
  fastify.get('/processing-stats', async () => {
    return srsService.getProcessingStats();
  });

  // POST /api/srs/force-due (for testing)
  fastify.post('/force-due', {
    schema: {
      body: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
        required: ['userId'],
      },
    },
  }, async (request) => {
    const { userId } = request.body as { userId: string };
    return srsService.forceDue(userId);
  });
}