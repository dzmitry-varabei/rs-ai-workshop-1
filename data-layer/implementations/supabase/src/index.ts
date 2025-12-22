/**
 * Infrastructure package exports
 * 
 * This package implements domain repository interfaces using Supabase.
 * It maps between database tables and domain types.
 */

export { createSupabaseClient } from './client.js';
export { SupabaseWordRepository } from './repositories/word.repository.js';
export { SupabaseUserWordStateRepository } from './repositories/user-word-state.repository.js';
export { SupabaseSrsRepository } from './repositories/srs.repository.js';

