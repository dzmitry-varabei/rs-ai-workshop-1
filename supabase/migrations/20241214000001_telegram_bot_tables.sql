-- Migration: Add Telegram Bot specific tables and columns
-- Created: 2024-12-14
-- Description: Adds tables for account linking, rate limiting, review events, and extends existing tables

-- Create delivery state enum for SRS items
CREATE TYPE delivery_state AS ENUM ('due', 'sending', 'awaiting_response', 'scheduled');

-- Table for temporary account linking codes
CREATE TABLE link_codes (
  code VARCHAR(8) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cleanup of expired codes
CREATE INDEX idx_link_codes_expires_at ON link_codes(expires_at);

-- Table for rate limiting link attempts
CREATE TABLE link_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT FALSE,
  code_attempted VARCHAR(8)
);

-- Index for rate limiting queries
CREATE INDEX idx_link_attempts_chat_time ON link_attempts(chat_id, attempted_at);

-- Table for review events (needed for statistics)
CREATE TABLE review_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  difficulty srs_difficulty NOT NULL,
  source TEXT DEFAULT 'telegram',
  message_id BIGINT
);

-- Indexes for statistics queries
CREATE INDEX idx_review_events_user_time ON review_events(user_id, reviewed_at);
CREATE INDEX idx_review_events_user_difficulty ON review_events(user_id, difficulty);

-- Extend profiles table with bot-specific columns
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS preferred_window_start TIME DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS preferred_window_end TIME DEFAULT '21:00',
ADD COLUMN IF NOT EXISTS paused BOOLEAN DEFAULT FALSE;

-- Extend srs_items table with delivery state management
ALTER TABLE srs_items 
ADD COLUMN IF NOT EXISTS delivery_state delivery_state DEFAULT 'due',
ADD COLUMN IF NOT EXISTS last_message_id BIGINT,
ADD COLUMN IF NOT EXISTS last_claimed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;

-- Index for efficient due review queries
CREATE INDEX IF NOT EXISTS idx_srs_items_delivery_state ON srs_items(delivery_state, next_review_at) WHERE delivery_state = 'due';

-- Index for timeout processing
CREATE INDEX IF NOT EXISTS idx_srs_items_awaiting_timeout ON srs_items(delivery_state, last_sent_at) WHERE delivery_state = 'awaiting_response';

-- Function to atomically claim due reviews
CREATE OR REPLACE FUNCTION rpc_claim_due_reviews(
  p_limit INTEGER DEFAULT 10,
  p_now TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE(user_id UUID, word_id UUID) AS $$
BEGIN
  RETURN QUERY
  UPDATE srs_items 
  SET delivery_state = 'sending', 
      last_claimed_at = p_now
  WHERE (srs_items.user_id, srs_items.word_id) IN (
    SELECT s.user_id, s.word_id 
    FROM srs_items s
    JOIN profiles p ON s.user_id = p.id
    WHERE s.delivery_state = 'due' 
      AND s.next_review_at <= p_now
      AND p.paused = FALSE
      -- Check time window (simplified - assumes no wrap-around for now)
      AND EXTRACT(HOUR FROM (p_now AT TIME ZONE COALESCE(p.timezone, 'UTC')))::TIME 
          BETWEEN p.preferred_window_start AND p.preferred_window_end
    ORDER BY s.next_review_at ASC
    LIMIT p_limit
  )
  RETURNING srs_items.user_id, srs_items.word_id;
END;
$$ LANGUAGE plpgsql;

-- Function to process difficulty rating atomically
CREATE OR REPLACE FUNCTION rpc_process_difficulty_rating(
  p_user_id UUID,
  p_word_id UUID,
  p_message_id BIGINT,
  p_difficulty srs_difficulty
) RETURNS BOOLEAN AS $$
DECLARE
  v_review_count INTEGER;
  v_base_interval INTEGER;
  v_next_interval INTEGER;
BEGIN
  -- Verify message_id matches and item is awaiting response
  SELECT review_count INTO v_review_count
  FROM srs_items 
  WHERE user_id = p_user_id 
    AND word_id = p_word_id 
    AND last_message_id = p_message_id
    AND delivery_state = 'awaiting_response';
    
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate next interval with base values from requirements
  v_base_interval := CASE p_difficulty
    WHEN 'hard' THEN 10
    WHEN 'normal' THEN 1440  -- 24 hours
    WHEN 'good' THEN 4320    -- 72 hours  
    WHEN 'easy' THEN 10080   -- 168 hours (1 week)
  END;
  
  -- Apply review count multiplier, ensure minimum 10 minutes
  v_next_interval := GREATEST(10, v_base_interval * GREATEST(1, v_review_count + 1));
  
  -- Update SRS item atomically
  UPDATE srs_items 
  SET delivery_state = 'scheduled',
      next_review_at = NOW() + (v_next_interval || ' minutes')::INTERVAL,
      interval_minutes = v_next_interval,
      review_count = v_review_count + 1,
      last_review_at = NOW()
  WHERE user_id = p_user_id AND word_id = p_word_id;
  
  -- Record review event for statistics
  INSERT INTO review_events (user_id, word_id, difficulty, message_id)
  VALUES (p_user_id, p_word_id, p_difficulty, p_message_id);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to handle timeout processing
CREATE OR REPLACE FUNCTION rpc_process_timeout_reviews(
  p_timeout_minutes INTEGER DEFAULT 1440, -- 24 hours
  p_now TIMESTAMPTZ DEFAULT NOW()
) RETURNS INTEGER AS $$
DECLARE
  v_processed_count INTEGER := 0;
  v_timeout_threshold TIMESTAMPTZ;
BEGIN
  v_timeout_threshold := p_now - (p_timeout_minutes || ' minutes')::INTERVAL;
  
  -- Process timed out reviews as "hard" with 0.5x multiplier
  WITH timeout_reviews AS (
    UPDATE srs_items
    SET delivery_state = 'scheduled',
        next_review_at = p_now + GREATEST(10, (interval_minutes * 0.5))::INTEGER * INTERVAL '1 minute',
        interval_minutes = GREATEST(10, (interval_minutes * 0.5)::INTEGER),
        last_review_at = p_now
    WHERE delivery_state = 'awaiting_response'
      AND last_sent_at <= v_timeout_threshold
    RETURNING user_id, word_id, last_message_id
  )
  INSERT INTO review_events (user_id, word_id, difficulty, message_id, source)
  SELECT user_id, word_id, 'hard', last_message_id, 'timeout'
  FROM timeout_reviews;
  
  GET DIAGNOSTICS v_processed_count = ROW_COUNT;
  RETURN v_processed_count;
END;
$$ LANGUAGE plpgsql;