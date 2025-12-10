import { createSupabaseClient } from '@english-learning/infra-supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get Supabase client for web app
 * Uses environment variables for configuration
 */
export function getSupabaseClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
    );
  }

  return createSupabaseClient(url, key);
}

