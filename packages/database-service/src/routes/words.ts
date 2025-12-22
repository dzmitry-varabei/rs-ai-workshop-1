/**
 * Words API Routes
 */

import type { FastifyInstance } from 'fastify';
import { GetRandomWordsRequestSchema } from '../types/api.js';
import type { WordService } from '../services/WordService.js';

export async function wordsRoutes(
  fastify: FastifyInstance,
  { wordService }: { wordService: WordService }
) {
  // GET /api/words/random
  fastify.get('/random', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
        },
        required: ['userId'],
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              textEn: { type: 'string' },
              level: { type: 'string' },
              exampleEn: { type: 'string' },
              exampleRu: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              pronunciations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    locale: { type: 'string' },
                    ipa: { type: 'string' },
                    audioUrl: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request) => {
    const { userId, limit = 10 } = request.query as { userId: string; limit?: number };
    return wordService.getRandomWords(userId, limit);
  });

  // GET /api/words/:id
  fastify.get('/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const word = await wordService.getWordById(id);
    
    if (!word) {
      return reply.code(404).send({ error: 'Word not found' });
    }
    
    return word;
  });

  // GET /api/words/count
  fastify.get('/count', async () => {
    const count = await wordService.getTotalCount();
    return { count };
  });
}