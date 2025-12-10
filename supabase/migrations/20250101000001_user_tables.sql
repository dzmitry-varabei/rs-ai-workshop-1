-- User-related tables: user_word_state and srs_items
-- These tables depend on profiles and words tables from initial migration

-- User word state table (quiz results)
-- Tracks which words the user knows/doesn't know from the quiz
create table user_word_state (
  user_id uuid not null references profiles(id) on delete cascade,
  word_id uuid not null references words(id) on delete cascade,
  status word_status not null,
  last_seen_at timestamptz not null default now(),
  seen_count int not null default 1,
  primary key (user_id, word_id)
);

-- SRS items table (spaced repetition for Telegram bot)
-- Tracks words that need to be reviewed using spaced repetition algorithm
create table srs_items (
  user_id uuid not null references profiles(id) on delete cascade,
  word_id uuid not null references words(id) on delete cascade,
  next_review_at timestamptz not null,
  last_review_at timestamptz,
  interval_minutes int not null,
  difficulty_last srs_difficulty,
  review_count int not null default 0,
  active boolean not null default true,
  primary key (user_id, word_id)
);

-- Indexes for better query performance
create index idx_user_word_state_user_id on user_word_state(user_id);
create index idx_user_word_state_status on user_word_state(status);
create index idx_user_word_state_user_status on user_word_state(user_id, status);
create index idx_srs_items_user_id on srs_items(user_id);
create index idx_srs_items_next_review on srs_items(user_id, next_review_at) where active = true;
create index idx_srs_items_active on srs_items(user_id, active) where active = true;

-- Comments for documentation
comment on table user_word_state is 'Tracks user quiz results: which words are known/unknown';
comment on table srs_items is 'Spaced repetition items for Telegram bot';
comment on column srs_items.interval_minutes is 'Review interval in minutes (10 min, 1 day, 3 days, 7 days)';
comment on column srs_items.next_review_at is 'When this word should be reviewed next';
comment on column srs_items.active is 'Whether this SRS item is currently active';

