/**
 * User Progress API Routes
 */

import type { FastifyInstance } from 'fastify';
import type { UserProgressService } from '../services/UserProgressService.js';

export async function userProgressRoutes(
  fastify: FastifyInstance,
  { userProgressService }: { userProgressService: UserProgressService }
) {
  // POST /api/user-progress/mark-known
  fastify.post('/mark-known', {
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
    await userProgressService.markWordKnown(userId, wordId);
    return { success: true };
  });

  // POST /api/user-progress/mark-unknown
  fastify.post('/mark-unknown', {
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
    await userProgressService.markWordUnknown(userId, wordId);
    return { success: true };
  });

  // GET /api/user-progress/stats
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
    return userProgressService.getUserStats(userId);
  });

  // GET /api/user-progress/word-status
  fastify.get('/word-status', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          wordId: { type: 'string', format: 'uuid' },
        },
        required: ['userId', 'wordId'],
      },
    },
  }, async (request) => {
    const { userId, wordId } = request.query as { userId: string; wordId: string };
    const status = await userProgressService.getWordStatus(userId, wordId);
    return { status };
  });

  // POST /api/user-progress/reset
  fastify.post('/reset', {
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
    await userProgressService.resetProgress(userId);
    return { success: true };
  });
}