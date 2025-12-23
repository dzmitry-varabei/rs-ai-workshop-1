/**
 * Repository Configuration
 * 
 * Factory functions to create repository instances based on configuration.
 * Supports multiple storage backends: Supabase, In-Memory.
 */

import type { WordRepository, UserWordStateRepository, SrsRepository, UserProfileRepository, LinkCodeRepository } from '@english-learning/data-layer-domain';
import { 
  SupabaseWordRepository,
  SupabaseUserWordStateRepository,
  SupabaseSrsRepository,
  SupabaseLinkCodeRepository,
  createSupabaseClient 
} from '@english-learning/data-layer-implementations-supabase';
import {
  MemoryWordRepository,
  MemoryUserWordStateRepository,
  MemorySrsRepository,
  MemoryUserProfileRepository,
  MemoryLinkCodeRepository
} from '@english-learning/data-layer-implementations-memory';
import { createSampleWords } from './sampleData.js';

export type StorageBackend = 'supabase' | 'memory';

export interface RepositoryConfig {
  backend: StorageBackend;
  supabase?: {
    url: string;
    key: string;
  };
}

export interface Repositories {
  wordRepository: WordRepository;
  userWordStateRepository: UserWordStateRepository;
  srsRepository: SrsRepository;
  userProfileRepository: UserProfileRepository;
  linkCodeRepository: LinkCodeRepository;
}

export function createRepositories(config: RepositoryConfig): Repositories {
  switch (config.backend) {
    case 'supabase':
      return createSupabaseRepositories(config.supabase!);
    
    case 'memory':
      return createMemoryRepositories();
    
    default:
      throw new Error(`Unsupported storage backend: ${config.backend}`);
  }
}

function createSupabaseRepositories(supabaseConfig: { url: string; key: string }): Repositories {
  const supabase = createSupabaseClient(supabaseConfig.url, supabaseConfig.key);
  
  return {
    wordRepository: new SupabaseWordRepository(supabase),
    userWordStateRepository: new SupabaseUserWordStateRepository(supabase),
    srsRepository: new SupabaseSrsRepository(supabase),
    linkCodeRepository: new SupabaseLinkCodeRepository(supabase),
    // TODO: Implement SupabaseUserProfileRepository
    userProfileRepository: new MemoryUserProfileRepository(), // Temporary fallback
  };
}

function createMemoryRepositories(): Repositories {
  // Initialize with sample data for development/testing
  const sampleWords = createSampleWords();
  
  return {
    wordRepository: new MemoryWordRepository(sampleWords),
    userWordStateRepository: new MemoryUserWordStateRepository(),
    srsRepository: new MemorySrsRepository(),
    userProfileRepository: new MemoryUserProfileRepository(),
    linkCodeRepository: new MemoryLinkCodeRepository(),
  };
}

export function getRepositoryConfigFromEnv(): RepositoryConfig {
  const backend = (process.env.STORAGE_BACKEND || 'supabase') as StorageBackend;
  
  if (backend === 'supabase') {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error('Missing Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)');
    }
    
    return {
      backend: 'supabase',
      supabase: { url, key },
    };
  }
  
  return { backend: 'memory' };
}