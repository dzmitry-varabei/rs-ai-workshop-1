/**
 * User Profile API Routes
 */

import type { FastifyInstance } from 'fastify';
import type { UserProfileService } from '../services/UserProfileService.js';
import { UpdateProfileRequestSchema } from '../types/api.js';

export async function userProfileRoutes(
  fastify: FastifyInstance,
  { userProfileService }: { userProfileService: UserProfileService }
) {
  // GET /api/user-profiles/:userId
  fastify.get('/:userId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
        required: ['userId'],
      },
    },
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const profile = await userProfileService.getProfile(userId);
    
    if (!profile) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'User profile not found',
        statusCode: 404,
      });
    }
    
    return profile;
  });

  // PUT /api/user-profiles/:userId
  fastify.put('/:userId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
        required: ['userId'],
      },
      body: {
        type: 'object',
        properties: {
          timezone: { type: 'string' },
          dailyWordLimit: { type: 'number', minimum: 1, maximum: 100 },
          preferredWindowStart: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
          preferredWindowEnd: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
          paused: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    const updateData = request.body as any;
    
    return userProfileService.updateProfile(userId, updateData);
  });

  // GET /api/user-profiles/:userId/delivery-window
  fastify.get('/:userId/delivery-window', {
    schema: {
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
        required: ['userId'],
      },
      querystring: {
        type: 'object',
        properties: {
          currentTime: { type: 'string', format: 'date-time' },
        },
      },
    },
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    const { currentTime } = request.query as { currentTime?: string };
    
    return userProfileService.checkDeliveryWindow(userId, currentTime);
  });

  // GET /api/user-profiles/:userId/daily-limit
  fastify.get('/:userId/daily-limit', {
    schema: {
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
        required: ['userId'],
      },
      querystring: {
        type: 'object',
        properties: {
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, // YYYY-MM-DD
        },
      },
    },
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    const { date } = request.query as { date?: string };
    
    return userProfileService.checkDailyLimit(userId, date);
  });
}