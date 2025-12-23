/**
 * Statistics API Routes
 */

import type { FastifyInstance } from 'fastify';
import type { StatsService } from '../services/StatsService.js';
import type { UserId } from '@english-learning/data-layer-domain';

export async function statsRoutes(
  fastify: FastifyInstance,
  { statsService }: { statsService: StatsService }
) {
  // GET /api/stats/:userId
  fastify.get('/:userId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
        required: ['userId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            totalItems: { type: 'number' },
            dueToday: { type: 'number' },
            successRate: { type: 'number' },
            learningStreak: { type: 'number' },
          },
          required: ['totalItems', 'dueToday', 'successRate', 'learningStreak'],
        },
      },
    },
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    const stats = await statsService.getUserStats(userId as UserId);
    
    return stats;
  });

  // GET /api/stats/:userId/daily-limit
  fastify.get('/:userId/daily-limit', {
    schema: {
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
        required: ['userId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            hasReachedLimit: { type: 'boolean' },
            reviewsToday: { type: 'number' },
            dailyLimit: { type: 'number' },
          },
          required: ['hasReachedLimit', 'reviewsToday', 'dailyLimit'],
        },
      },
    },
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    const limitInfo = await statsService.hasReachedDailyLimit(userId as UserId);
    
    return limitInfo;
  });

  // GET /api/stats/:userId/delivery-window
  fastify.get('/:userId/delivery-window', {
    schema: {
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
        required: ['userId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            withinWindow: { type: 'boolean' },
            windowStart: { type: 'string' },
            windowEnd: { type: 'string' },
            userTimezone: { type: 'string' },
          },
          required: ['withinWindow', 'windowStart', 'windowEnd', 'userTimezone'],
        },
      },
    },
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    const windowInfo = await statsService.isWithinDeliveryWindow(userId as UserId);
    
    return windowInfo;
  });
}