/**
 * Database Service HTTP Server
 * 
 * Fastify server that exposes database operations via REST API.
 * Supports multiple storage backends: Supabase, In-Memory.
 */

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createRepositories, getRepositoryConfigFromEnv } from './config/repositories.js';

import { WordService } from './services/WordService.js';
import { UserProgressService } from './services/UserProgressService.js';
import { SrsService } from './services/SrsService.js';
import { UserProfileService } from './services/UserProfileService.js';
import { LinkCodeService } from './services/LinkCodeService.js';

import { wordsRoutes } from './routes/words.js';
import { userProgressRoutes } from './routes/user-progress.js';
import { srsRoutes } from './routes/srs.js';
import { userProfileRoutes } from './routes/user-profiles.js';
import { linkCodeRoutes } from './routes/link-codes.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const HOST = process.env.HOST || '127.0.0.1';

async function createServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Enable CORS for web app
  await fastify.register(cors, {
    origin: [
      'http://localhost:3000', 
      'http://127.0.0.1:3000',
      'http://localhost:3002',
      'http://127.0.0.1:3002',
      'http://localhost:3003',
      'http://127.0.0.1:3003'
    ],
    credentials: true,
  });

  // Initialize repositories based on configuration
  const repositoryConfig = getRepositoryConfigFromEnv();
  const repositories = createRepositories(repositoryConfig);
  
  fastify.log.info(`Using storage backend: ${repositoryConfig.backend}`);

  // Initialize services
  const wordService = new WordService(repositories.wordRepository);
  const userProgressService = new UserProgressService(repositories.userWordStateRepository);
  const srsService = new SrsService(repositories.srsRepository, repositories.wordRepository);
  const userProfileService = new UserProfileService(repositories.userProfileRepository);
  const linkCodeService = new LinkCodeService(repositories.linkCodeRepository, repositories.userProfileRepository);

  // Health check
  fastify.get('/health', async () => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      backend: repositoryConfig.backend,
    };
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

  await fastify.register(userProfileRoutes, { 
    prefix: '/api/user-profiles',
    userProfileService 
  });

  await fastify.register(linkCodeRoutes, { 
    prefix: '/api/link-codes',
    linkCodeService 
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