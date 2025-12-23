/**
 * Link Code API Routes
 */

import type { FastifyInstance } from 'fastify';
import type { LinkCodeService } from '../services/LinkCodeService.js';
import type { UserId } from '@english-learning/data-layer-domain';
import { 
  GenerateLinkCodeRequestSchema,
  GetTelegramConnectionRequestSchema,
  DisconnectTelegramRequestSchema 
} from '../types/api.js';

export async function linkCodeRoutes(
  fastify: FastifyInstance,
  { linkCodeService }: { linkCodeService: LinkCodeService }
) {
  // POST /api/link-codes/generate
  fastify.post('/generate', {
    schema: {
      body: {
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
            code: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time' },
          },
          required: ['code', 'expiresAt'],
        },
      },
    },
  }, async (request) => {
    const { userId } = request.body as { userId: string };
    const result = await linkCodeService.generateLinkCode(userId as UserId);
    
    return {
      code: result.code,
      expiresAt: result.expiresAt.toISOString(),
    };
  });

  // GET /api/link-codes/connection/:userId
  fastify.get('/connection/:userId', {
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
            isConnected: { type: 'boolean' },
            linkedAt: { type: 'string', format: 'date-time' },
            telegramChatId: { type: 'string' },
          },
          required: ['isConnected'],
        },
      },
    },
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    const connection = await linkCodeService.getTelegramConnection(userId as UserId);
    
    return {
      isConnected: connection.isConnected,
      linkedAt: connection.linkedAt?.toISOString(),
      telegramChatId: connection.telegramChatId,
    };
  });

  // DELETE /api/link-codes/connection/:userId
  fastify.delete('/connection/:userId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
        required: ['userId'],
      },
      response: {
        204: {
          type: 'null',
        },
      },
    },
  }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    await linkCodeService.disconnectTelegram(userId as UserId);
    
    return reply.code(204).send();
  });
}