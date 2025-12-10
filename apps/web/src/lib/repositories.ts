import { getSupabaseClient } from './supabase';
import {
  SupabaseWordRepository,
  SupabaseUserWordStateRepository,
  SupabaseSrsRepository,
} from '@english-learning/infra-supabase';
import type {
  WordRepository,
  UserWordStateRepository,
  SrsRepository,
} from '@english-learning/domain';

/**
 * Create repository instances for the web app
 */
export function createRepositories() {
  const client = getSupabaseClient();

  return {
    wordRepository: new SupabaseWordRepository(client) as WordRepository,
    userWordStateRepository: new SupabaseUserWordStateRepository(
      client
    ) as UserWordStateRepository,
    srsRepository: new SupabaseSrsRepository(client) as SrsRepository,
  };
}

