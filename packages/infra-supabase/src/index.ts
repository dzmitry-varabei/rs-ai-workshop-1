/**
 * Infrastructure package exports
 * 
 * This package implements domain repository interfaces using Supabase.
 * It maps between database tables and domain types.
 */

export { createSupabaseClient } from './client.js';
export { SupabaseWordRepository } from './repositories/word.repository.js';

