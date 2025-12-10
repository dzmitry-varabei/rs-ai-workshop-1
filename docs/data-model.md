# Data Model

This document describes the main tables in the Supabase (Postgres) database.

## Users

- `auth.users` — managed by Supabase Auth.
- `profiles`
  - `id` (uuid, PK, references `auth.users.id`)
  - `created_at` (timestamptz)
  - `telegram_chat_id` (text, unique, nullable)
  - `timezone` (text)
  - `daily_word_limit` (int)

## Words

- `words`
  - `id` (uuid, PK)
  - `text_en` (text)
  - `level` (text, optional)
  - `example_en` (text, optional)
  - `example_ru` (text, optional)
  - `tags` (text[])
  - `extra` (jsonb) — reserved for future properties

- `word_pronunciations`
  - `id` (uuid, PK)
  - `word_id` (uuid, FK → `words.id`)
  - `locale` (text)
  - `ipa` (text, optional)
  - `audio_url` (text, optional)
  - `source` (text, optional)

## User word state (quiz)

- `user_word_state`
  - `user_id` (uuid, FK → `profiles.id`)
  - `word_id` (uuid, FK → `words.id`)
  - `status` (`word_status` enum: `unknown`, `learning`, `known`)
  - `last_seen_at` (timestamptz)
  - `seen_count` (int)

PK: (`user_id`, `word_id`).

## Spaced repetition

- `srs_items`
  - `user_id` (uuid, FK → `profiles.id`)
  - `word_id` (uuid, FK → `words.id`)
  - `next_review_at` (timestamptz)
  - `last_review_at` (timestamptz, nullable)
  - `interval_minutes` (int)
  - `difficulty_last` (`srs_difficulty` enum)
  - `review_count` (int)
  - `active` (boolean)

PK: (`user_id`, `word_id`).

## Optional: quiz sessions

If needed, we can add:

- `quiz_runs`
- `quiz_answers`

See comments in `docs/overview.md` for how they would be used.

