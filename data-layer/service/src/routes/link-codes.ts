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

  // POST /api/link-codes/use
  fastify.post('/use', {
    schema: {
      body: {
        type: 'object',
        properties: {
          code: { type: 'string', pattern: '^[A-Z0-9]{8}$' },
          telegramChatId: { type: 'string' },
        },
        required: ['code', 'telegramChatId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            userId: { type: 'string' },
          },
          required: ['success'],
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['error', 'message'],
        },
      },
    },
  }, async (request, reply) => {
    const { code, telegramChatId } = request.body as { code: string; telegramChatId: string };
    
    try {
      const result = await linkCodeService.useLinkCode(code, telegramChatId);
      
      if (result.success) {
        return {
          success: true,
          userId: result.userId,
        };
      } else {
        return reply.code(400).send({
          error: result.error || 'invalid_code',
          message: 'Invalid or expired link code',
        });
      }
    } catch (error) {
      return reply.code(500).send({
        error: 'internal_error',
        message: 'Failed to use link code',
      });
    }
  });

  // GET /api/link-codes/connection-by-chat/:telegramChatId
  fastify.get('/connection-by-chat/:telegramChatId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          telegramChatId: { type: 'string' },
        },
        required: ['telegramChatId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            linkedAt: { type: 'string', format: 'date-time' },
          },
          required: ['userId', 'linkedAt'],
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['error', 'message'],
        },
      },
    },
  }, async (request, reply) => {
    const { telegramChatId } = request.params as { telegramChatId: string };
    
    try {
      const connection = await linkCodeService.getConnectionByChatId(telegramChatId);
      
      if (connection) {
        return {
          userId: connection.userId,
          linkedAt: connection.linkedAt.toISOString(),
        };
      } else {
        return reply.code(404).send({
          error: 'not_found',
          message: 'No connection found for this Telegram chat ID',
        });
      }
    } catch (error) {
      return reply.code(500).send({
        error: 'internal_error',
        message: 'Failed to get connection',
      });
    }
  });
}