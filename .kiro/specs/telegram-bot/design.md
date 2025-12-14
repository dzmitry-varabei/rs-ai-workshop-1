# Telegram Bot Design Document

## Overview

The Telegram Bot is a Node.js application that provides spaced repetition learning through Telegram messages. It integrates with the existing English Learning System by consuming vocabulary data from Supabase and sending scheduled review messages to users. The bot follows a clean architecture pattern, using domain interfaces for data access and business logic while handling Telegram-specific concerns in the application layer.

The bot operates on a polling or webhook model, processing user commands and callback queries while maintaining state in the shared Supabase database. It implements sophisticated scheduling logic to deliver vocabulary reviews at optimal intervals based on spaced repetition algorithms.

## Architecture

### High-Level Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Telegram API  │◄──►│  Telegram Bot    │◄──►│   Supabase DB   │
│                 │    │   Application    │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Domain Layer    │
                       │  (Repositories   │
                       │   & Services)    │
                       └──────────────────┘
```

### Layer Responsibilities

- **Telegram Application Layer**: Handles Telegram API interactions, command parsing, message formatting
- **Domain Layer**: Business logic for SRS scheduling, user management, vocabulary operations
- **Infrastructure Layer**: Supabase database access, external API integrations

### Key Components

1. **Bot Controller**: Main entry point, handles webhook/polling setup
2. **Command Handler**: Processes user commands (/start, /help, /stats, etc.)
3. **Callback Handler**: Processes inline keyboard button presses
4. **Review Scheduler**: Determines when to send vocabulary reviews
5. **Message Formatter**: Formats vocabulary messages with MarkdownV2
6. **Account Linker**: Handles linking Telegram accounts with web users

## Components and Interfaces

### Core Interfaces

```typescript
interface TelegramBotService {
  start(): Promise<void>;
  stop(): Promise<void>;
  sendReview(userId: string, word: Word): Promise<void>;
  processCallback(callbackQuery: CallbackQuery): Promise<void>;
}

interface DueReviewSelector {
  getDueReviews(limit?: number): Promise<ScheduledReview[]>;
  getUserDueReviews(userId: string): Promise<ScheduledReview[]>;
}

interface ReviewDeliveryService {
  claimReview(userId: string, wordId: string): Promise<boolean>;
  sendReview(userId: string, wordId: string, word: Word): Promise<string>; // returns message_id
  markSent(userId: string, wordId: string, messageId: string): Promise<void>;
}

interface ReviewProcessor {
  processCallback(userId: string, wordId: string, messageId: string, difficulty: Difficulty): Promise<void>;
  processTimeout(userId: string, wordId: string): Promise<void>;
  scheduleNextReview(userId: string, wordId: string, difficulty: Difficulty, reviewCount: number): Promise<void>;
}

interface AccountLinker {
  validateLinkCode(code: string): Promise<LinkCodeValidation>;
  linkAccount(code: string, telegramChatId: string): Promise<boolean>;
  recordLinkAttempt(chatId: string, code: string, success: boolean): Promise<void>;
  isRateLimited(chatId: string): Promise<boolean>;
}

interface MessageFormatter {
  formatReview(word: Word, pronunciation?: Pronunciation): string;
  formatStats(stats: UserStats): string;
  escapeMarkdownV2(text: string): string;
}
```

### Repository Dependencies

The bot uses existing domain repositories:
- `WordRepository`: Access vocabulary data
- `SrsRepository`: Manage SRS items and scheduling
- `UserRepository`: Handle user profiles and settings
- `LinkCodeRepository`: Manage temporary linking codes

## Data Models

### Extended Database Schema

```sql
-- New table for account linking
CREATE TABLE link_codes (
  code VARCHAR(8) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limiting for link attempts
CREATE TABLE link_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT FALSE,
  code_attempted VARCHAR(8)
);
CREATE INDEX idx_link_attempts_chat_time ON link_attempts(chat_id, attempted_at);

-- Review events for statistics
CREATE TABLE review_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  word_id UUID NOT NULL REFERENCES words(id),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  difficulty srs_difficulty NOT NULL,
  source TEXT DEFAULT 'telegram',
  message_id BIGINT
);
CREATE INDEX idx_review_events_user_time ON review_events(user_id, reviewed_at);

-- Extended profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_window_start TIME DEFAULT '09:00';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_window_end TIME DEFAULT '21:00';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paused BOOLEAN DEFAULT FALSE;

-- Extended srs_items with state machine
CREATE TYPE delivery_state AS ENUM ('due', 'sending', 'awaiting_response', 'scheduled');
ALTER TABLE srs_items ADD COLUMN IF NOT EXISTS delivery_state delivery_state DEFAULT 'due';
ALTER TABLE srs_items ADD COLUMN IF NOT EXISTS last_message_id BIGINT;
ALTER TABLE srs_items ADD COLUMN IF NOT EXISTS last_claimed_at TIMESTAMPTZ;
ALTER TABLE srs_items ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;
```

### SRS Item Creation Flow

**Source of Truth**: `user_word_state` with `status='unknown'` is the authoritative source for words needing SRS.

**Creation Process**: Web application performs atomic operations when user swipes "unknown":
1. `INSERT INTO user_word_state (user_id, word_id, status) VALUES (...) ON CONFLICT (user_id, word_id) DO UPDATE SET status='unknown'`
2. `INSERT INTO srs_items (user_id, word_id, interval_minutes, next_review_at, delivery_state) VALUES (..., 10, now() + interval '10 minutes', 'due') ON CONFLICT DO NOTHING`

**Idempotency**: Both operations use `ON CONFLICT` clauses to prevent duplicates and ensure safe retries.

### SRS State Machine

SRS items follow a strict state machine to prevent race conditions:

- **due**: `next_review_at <= now()` and ready for delivery
- **sending**: Claimed by scheduler but not yet sent to Telegram
- **awaiting_response**: Message sent, waiting for user difficulty rating
- **scheduled**: `next_review_at > now()`, waiting for next review time

**State Transitions**:
- `due` → `sending`: When scheduler claims the item
- `sending` → `awaiting_response`: When message successfully sent to Telegram
- `sending` → `due`: If send fails (for retry)
- `awaiting_response` → `scheduled`: When user provides difficulty rating
- `awaiting_response` → `scheduled`: After 24h timeout (treated as "hard")

### Core Domain Types

```typescript
interface ScheduledReview {
  userId: string;
  wordId: string;
  nextReviewAt: Date;
  intervalMinutes: number;
  reviewCount: number;
  awaitingResponse: boolean;
}

interface LinkCodeValidation {
  isValid: boolean;
  userId?: string;
  error?: 'expired' | 'used' | 'not_found';
}

interface UserStats {
  totalItems: number;
  dueToday: number;
  successRate: number;
  learningStreak: number;
}

type Difficulty = 'hard' | 'normal' | 'good' | 'easy';

interface DeliveryWindow {
  start: string; // HH:MM format
  end: string;   // HH:MM format
  timezone: string;
}
```

### Missing Data Handling

The bot must gracefully handle incomplete vocabulary data:

**Missing Example Sentence**: Display only the English word without example context
**Missing Russian Translation**: Show "Перевод недоступен" instead of spoiler text
**Missing Pronunciation**: Skip IPA notation entirely, don't show empty brackets
**Wrap-around Time Windows**: Support overnight windows (e.g., 22:00-06:00) using logic: `now >= start OR now <= end`

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Account Linking Validation
*For any* valid Link_Code and Telegram chat ID, successful linking should create exactly one profile association and mark the code as used
**Validates: Requirements 1.2, 1.3**

### Property 2: Link Code Rate Limiting
*For any* Telegram chat ID, attempting more than 5 invalid link codes within one hour should result in temporary blocking of further attempts
**Validates: Requirements 1.5**

### Property 3: Invalid Link Code Rejection
*For any* invalid, expired, or already-used Link_Code, the linking attempt should be rejected with appropriate error messaging
**Validates: Requirements 1.4**

### Property 4: Atomic Review Claiming
*For any* due SRS item, the claiming process should atomically set awaiting_response=true and last_sent_at, preventing duplicate sends
**Validates: Requirements 2.1, 2.6**

### Property 5: Review Message Format Consistency
*For any* word review, the message should include escaped English text, spoiler-formatted Russian translation, and exactly 4 difficulty buttons
**Validates: Requirements 2.2, 2.3**

### Property 6: Time Window Enforcement
*For any* user with configured preferred window, reviews should only be sent within their local time window boundaries
**Validates: Requirements 2.4, 4.2**

### Property 7: Pronunciation Inclusion
*For any* word with available pronunciation data, the review message should include properly escaped IPA notation
**Validates: Requirements 2.5**

### Property 8: SRS Interval Calculation
*For any* difficulty rating and review history, the next interval should be calculated as base_interval × max(1, review_count) with correct base values (Hard: 10min, Normal: 1440min, Good: 4320min, Easy: 10080min), with minimum interval clamped to 10 minutes
**Validates: Requirements 3.2**

### Property 9: Atomic Schedule Updates
*For any* difficulty rating processing, all SRS fields (next_review_at, interval_minutes, review_count, awaiting_response) should be updated atomically
**Validates: Requirements 3.3**

### Property 10: Callback Validation and Response
*For any* valid difficulty callback, the bot should update the SRS item, edit the message to remove keyboard, and show selected difficulty
**Validates: Requirements 3.1, 3.4**

### Property 11: Timeout Handling
*For any* SRS item awaiting response for more than 24 hours, it should be treated as "Hard" difficulty with 0.5x interval multiplier, with result clamped to minimum 10 minutes
**Validates: Requirements 3.5**

### Property 12: Duplicate Callback Handling
*For any* duplicate callback query for the same message, subsequent callbacks should be ignored with "Already processed" response
**Validates: Requirements 3.6**

### Property 13: Timezone Conversion Accuracy
*For any* user timezone and review time, all scheduling calculations should use correct timezone conversion before window checking
**Validates: Requirements 4.1**

### Property 14: Daily Limit Enforcement
*For any* user with configured daily_word_limit, the number of reviews sent per calendar day (in user's timezone) should never exceed the limit
**Validates: Requirements 4.3**

### Property 15: Limit Overflow Handling
*For any* situation where daily limit is reached, remaining due items should be deferred to the next available delivery slot
**Validates: Requirements 4.4**

### Property 16: Default Configuration
*For any* user without configured timezone, the system should use UTC timezone with 09:00-21:00 preferred window
**Validates: Requirements 4.5**

### Property 17: Statistics Accuracy
*For any* user's SRS data, the /stats command should display accurate counts of total items, due today, success rate, and learning streak
**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 18: Pause State Enforcement
*For any* paused user, the Review_Scheduler should skip them when selecting due items for delivery
**Validates: Requirements 6.2**

### Property 19: Resume Processing
*For any* user resuming after pause, overdue items should be processed respecting daily_word_limit constraints
**Validates: Requirements 6.3**

### Property 20: Long Pause Handling
*For any* user resuming after 7+ days pause, initial delivery should be limited to maximum 3 words to prevent overwhelming
**Validates: Requirements 6.4**

### Property 21: Extended Pause Reset
*For any* user paused for more than 30 days, all SRS intervals should be reset to minimum values upon resume
**Validates: Requirements 6.6**

### Property 22: Command State Filtering
*For any* unlinked user, only /start, /help, and /link commands should receive responses, all others should be rejected
**Validates: Requirements 8.6**

### Property 23: Settings Display Completeness
*For any* /settings command, the response should include current timezone, daily_word_limit, and preferred_window values
**Validates: Requirements 8.4**

### Property 24: Unknown Command Handling
*For any* unrecognized command, the bot should respond with the standard "Unknown command. Send /help for available commands." message
**Validates: Requirements 8.5**

### Property 25: Exponential Backoff Retry
*For any* rate limit error from Telegram API, retry attempts should follow exponential backoff pattern with maximum 5 attempts
**Validates: Requirements 10.5**

## Error Handling

### Error Categories and Strategies

1. **Telegram API Errors**
   - Rate limiting: Exponential backoff with jitter
   - Network failures: Retry with circuit breaker
   - Invalid requests: Log and skip

2. **Database Errors**
   - Connection failures: Retry with exponential backoff
   - Constraint violations: Handle gracefully, log for investigation
   - Timeouts: Implement query timeouts and fallbacks

3. **User Input Errors**
   - Invalid commands: Provide helpful error messages
   - Malformed callbacks: Ignore and log
   - Invalid link codes: Rate limit and provide feedback

4. **Business Logic Errors**
   - Missing user data: Handle gracefully with appropriate messages
   - Scheduling conflicts: Resolve with defined precedence rules
   - State inconsistencies: Log for investigation, attempt recovery

### Error Recovery Mechanisms

- **Graceful Degradation**: Continue serving other users when individual operations fail
- **State Recovery**: Implement cleanup jobs for inconsistent states
- **Circuit Breakers**: Prevent cascade failures to external services
- **Dead Letter Queues**: Handle messages that repeatedly fail processing

## Testing Strategy

### Unit Testing Approach

Unit tests will focus on:
- Command parsing and validation logic
- Message formatting and MarkdownV2 escaping
- SRS calculation algorithms
- Error handling edge cases
- State transition logic

Key areas for unit testing:
- `MessageFormatter.escapeMarkdownV2()` with various special characters
- `ReviewScheduler.calculateNextInterval()` with different difficulties and counts
- `AccountLinker.validateLinkCode()` with expired, used, and invalid codes
- Command handlers with various user states (linked/unlinked, paused/active)

### Property-Based Testing Approach

Property-based tests will use **fast-check** library for TypeScript and run minimum 100 iterations per property. Each test will be tagged with comments referencing the design document property:

```typescript
// **Feature: telegram-bot, Property 8: SRS Interval Calculation**
it('should calculate intervals correctly for all difficulties', () => {
  fc.assert(fc.property(
    fc.oneof(fc.constant('hard'), fc.constant('normal'), fc.constant('good'), fc.constant('easy')),
    fc.integer(0, 100), // review count
    (difficulty, reviewCount) => {
      const result = calculateNextInterval(difficulty, reviewCount);
      const expectedBase = getBaseDifficulty(difficulty);
      const expectedInterval = expectedBase * Math.max(1, reviewCount);
      expect(result.intervalMinutes).toBe(expectedInterval);
    }
  ));
});
```

Property tests will cover:
- SRS interval calculations across all difficulty combinations
- Message formatting with random text containing special characters
- Timezone conversions with various timezones and times
- Rate limiting behavior with different attempt patterns
- Account linking with various code formats and states

### Integration Testing

Integration tests will verify:
- End-to-end message flows from command to database update
- Telegram webhook processing with real payload formats
- Database transaction consistency during concurrent operations
- Error propagation through the application layers

### Test Data Management

- Use factories for generating test data with realistic constraints
- Implement database cleanup between tests
- Mock Telegram API calls to avoid external dependencies
- Use time mocking for testing scheduling logic

The testing approach ensures both concrete examples work correctly (unit tests) and universal properties hold across all inputs (property tests), providing comprehensive coverage of the bot's correctness guarantees.

## Deployment Model

### Bot Operation Mode
**Primary Mode**: Polling (simpler for development and deployment)
- Bot polls Telegram API every 1-2 seconds for updates
- Suitable for development and small-scale production
- No webhook infrastructure required

**Alternative Mode**: Webhook (for production scale)
- Telegram sends updates to configured HTTPS endpoint
- Requires SSL certificate and public domain
- Better for high-volume production deployments

### Scheduler Architecture
**Integrated Scheduler**: Review scheduler runs in the same process as the bot
- `setInterval` every 60 seconds to check for due reviews
- Processes reviews within user time windows and daily limits
- Simpler deployment, single process to manage

**Separate Worker**: Alternative architecture for scale
- Dedicated scheduler process/cron job
- Communicates with bot via database state
- Better separation of concerns for large deployments

### Atomic Operations via Postgres Functions

To ensure consistency and reduce race conditions, critical operations are implemented as Postgres RPC functions:

```sql
-- Atomically claim due reviews
CREATE OR REPLACE FUNCTION rpc_claim_due_reviews(
  p_limit INTEGER DEFAULT 10,
  p_now TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE(user_id UUID, word_id UUID) AS $$
BEGIN
  RETURN QUERY
  UPDATE srs_items 
  SET delivery_state = 'sending', 
      last_claimed_at = p_now
  WHERE (user_id, word_id) IN (
    SELECT s.user_id, s.word_id 
    FROM srs_items s
    JOIN profiles p ON s.user_id = p.id
    WHERE s.delivery_state = 'due' 
      AND s.next_review_at <= p_now
      AND p.paused = FALSE
    LIMIT p_limit
  )
  RETURNING srs_items.user_id, srs_items.word_id;
END;
$$ LANGUAGE plpgsql;

-- Process difficulty rating atomically
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
  
  -- Calculate next interval
  v_base_interval := CASE p_difficulty
    WHEN 'hard' THEN 10
    WHEN 'normal' THEN 1440
    WHEN 'good' THEN 4320
    WHEN 'easy' THEN 10080
  END;
  
  v_next_interval := GREATEST(10, v_base_interval * GREATEST(1, v_review_count + 1));
  
  -- Update SRS item
  UPDATE srs_items 
  SET delivery_state = 'scheduled',
      next_review_at = NOW() + (v_next_interval || ' minutes')::INTERVAL,
      interval_minutes = v_next_interval,
      review_count = v_review_count + 1,
      last_review_at = NOW()
  WHERE user_id = p_user_id AND word_id = p_word_id;
  
  -- Record review event
  INSERT INTO review_events (user_id, word_id, difficulty, message_id)
  VALUES (p_user_id, p_word_id, p_difficulty, p_message_id);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```