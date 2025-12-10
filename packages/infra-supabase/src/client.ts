import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Create Supabase client instance
 * 
 * @param url - Supabase project URL
 * @param key - Supabase anon key (for client-side) or service_role key (for server-side)
 * @returns Supabase client instance
 */
export function createSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key);
}

