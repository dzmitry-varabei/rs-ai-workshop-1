/**
 * Database Service HTTP Server
 * 
 * Fastify server that exposes database operations via REST API.
 */

import Fastify from 'fastify';
import { createSupabaseClient } from '@english-learning/infra-supabase';
import { 
  SupabaseWordRepository,
  SupabaseUserWordStateRepository,
  SupabaseSrsRepository 
} from '@english-learning/infra-supabase';

import { WordService } from './services/WordService.js';
import { UserProgressService } from './services/UserProgressService.js';
import { SrsService } from './services/SrsService.js';

import { wordsRoutes } from './routes/words.js';
import { userProgressRoutes } from './routes/user-progress.js';
import { srsRoutes } from './routes/srs.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const HOST = process.env.HOST || '127.0.0.1';

async function createServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

  // Initialize repositories
  const wordRepository = new SupabaseWordRepository(supabase);
  const userWordStateRepository = new SupabaseUserWordStateRepository(supabase);
  const srsRepository = new SupabaseSrsRepository(supabase);

  // Initialize services
  const wordService = new WordService(wordRepository);
  const userProgressService = new UserProgressService(userWordStateRepository);
  const srsService = new SrsService(srsRepository, wordRepository);

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register API routes
  await fastify.register(wordsRoutes, { 
    prefix: '/api/words',
    wordService 
  });

  await fastify.register(userProgressRoutes, { 
    prefix: '/api/user-progress',
    userProgressService 
  });

  await fastify.register(srsRoutes, { 
    prefix: '/api/srs',
    srsService 
  });

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);
    
    // Validation errors
    if (error.validation) {
      return reply.code(400).send({
        error: 'Validation Error',
        message: error.message,
        statusCode: 400,
      });
    }

    // Default error response
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Something went wrong',
      statusCode: 500,
    });
  });

  return fastify;
}

async function start() {
  try {
    const server = await createServer();
    
    await server.listen({ 
      port: PORT, 
      host: HOST 
    });
    
    console.log(`Database service running on http://${HOST}:${PORT}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { createServer };