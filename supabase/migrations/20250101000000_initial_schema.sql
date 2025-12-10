-- Initial database schema for English Learning System
-- This migration creates base tables: profiles, words, word_pronunciations

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Enum types
create type word_status as enum ('unknown', 'learning', 'known');
create type srs_difficulty as enum ('hard', 'normal', 'good', 'easy');

-- Profiles table
-- Links to auth.users (managed by Supabase Auth)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  telegram_chat_id text unique,
  timezone text,
  daily_word_limit int not null default 10
);

-- Words table
-- Dictionary of 3000 Oxford words
create table words (
  id uuid primary key default gen_random_uuid(),
  text_en text not null unique,
  level text,                     -- CEFR level: A1, A2, B1, B2, C1, C2
  example_en text,
  example_ru text,
  tags text[] not null default '{}',
  extra jsonb not null default '{}'
);

-- Word pronunciations table
-- Supports multiple pronunciations per word (different accents, etc.)
create table word_pronunciations (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references words(id) on delete cascade,
  locale text not null,           -- 'en-US', 'en-GB', etc.
  ipa text,                       -- International Phonetic Alphabet, e.g., '/bʊst/'
  audio_url text,
  source text,                    -- 'forvo', 'tts', etc.
  unique(word_id, locale)
);

-- Indexes for better query performance
create index idx_words_text_en on words(text_en);
create index idx_words_level on words(level);
create index idx_word_pronunciations_word_id on word_pronunciations(word_id);
create index idx_profiles_telegram_chat_id on profiles(telegram_chat_id) where telegram_chat_id is not null;

-- Comments for documentation
comment on table profiles is 'User profiles linked to Supabase Auth';
comment on table words is 'Dictionary of English words (Oxford 3000)';
comment on table word_pronunciations is 'Pronunciation variants for words';
comment on column words.level is 'CEFR level: A1, A2, B1, B2, C1, C2';
comment on column word_pronunciations.locale is 'Locale code, e.g., en-US, en-GB';

