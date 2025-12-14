# Requirements Document

## Introduction

The Telegram Bot is a core component of the English Learning System that provides spaced repetition learning for vocabulary words. The bot integrates with the existing web quiz application through a shared Supabase database, allowing users to learn words they marked as "unknown" in the web interface. The bot uses an intelligent scheduling algorithm to send words at optimal intervals based on user performance, helping users efficiently memorize English vocabulary through proven spaced repetition techniques.

## Data Contracts

The bot operates on the following database tables and must respect these contracts:

### Core Tables
- `profiles(id, telegram_chat_id, timezone, daily_word_limit, preferred_window_start, preferred_window_end, paused)`
- `user_word_state(user_id, word_id, status, last_seen_at, seen_count)` - source of truth for vocabulary progress
- `srs_items(user_id, word_id, next_review_at, interval_minutes, review_count, awaiting_response, last_message_id, last_sent_at)` - SRS scheduling state
- `link_codes(code, user_id, expires_at, used_at)` - temporary account linking tokens
- `words(id, text_en, level, example_en, example_ru, tags)` - vocabulary dictionary
- `word_pronunciations(word_id, locale, ipa, audio_url)` - pronunciation data

### SRS Item Creation Flow
- **Source of Truth**: `user_word_state` with `status='unknown'` is the authoritative source for words needing SRS
- **Creation Trigger**: Web application creates `srs_items` when marking words as unknown (not the bot)
- **Idempotency**: SRS items are created with `ON CONFLICT DO NOTHING` to prevent duplicates
- **Initial State**: New SRS items start with `interval_minutes=10`, `next_review_at=now()+10min`, `awaiting_response=false`

## Scheduler Semantics

### Atomic Operations
- **Claim Process**: Scheduler atomically claims due items by setting `awaiting_response=true` and `last_sent_at=now()`
- **Send-Then-Update**: Messages are sent first, then `last_message_id` is recorded
- **Failure Recovery**: If send fails, `awaiting_response` is reset to `false` for retry
- **Concurrency**: Multiple bot instances use database locks to prevent duplicate sends

### Response Handling
- **No Response Policy**: After 24 hours without response, treat as "hard" difficulty with 0.5x interval multiplier
- **Duplicate Responses**: Ignore callback queries for messages older than 24 hours
- **State Cleanup**: After processing response, set `awaiting_response=false` and remove inline keyboard

## Glossary

- **Telegram_Bot**: The automated Telegram application that sends vocabulary review messages to users
- **SRS_System**: Spaced Repetition System that schedules word reviews based on difficulty ratings
- **User_Account**: A Supabase authenticated user account that can be linked to a Telegram chat
- **Word_Review**: A scheduled vocabulary learning session sent via Telegram message
- **Difficulty_Rating**: User feedback on word difficulty (Hard, Normal, Good, Easy) that affects future scheduling
- **Account_Linking**: The process of connecting a web user account with a Telegram chat ID using temporary codes
- **Review_Scheduler**: The component that determines when words should be sent for review
- **Inline_Keyboard**: Telegram interface element with clickable buttons for user responses
- **Link_Code**: A temporary, single-use alphanumeric code (8 characters) for account linking with 15-minute TTL
- **Preferred_Window**: User-configured time range (e.g., 09:00-21:00) in their timezone for receiving messages
- **MarkdownV2**: Telegram message formatting that requires escaping of special characters

## Requirements

### Requirement 1

**User Story:** As a vocabulary learner, I want to link my web account with Telegram, so that I can receive spaced repetition lessons on my mobile device.

#### Acceptance Criteria

1. WHEN a user requests account linking in the web app, THE web application SHALL generate a unique Link_Code and store it in link_codes table with 15-minute expiration
2. WHEN a user sends a valid Link_Code to the bot, THE Telegram_Bot SHALL verify the code, mark it as used, and associate the telegram_chat_id with the user profile
3. WHEN account linking is successful, THE Telegram_Bot SHALL confirm the connection and delete the used Link_Code
4. WHEN an invalid or expired Link_Code is provided, THE Telegram_Bot SHALL reject the request with specific error messaging
5. WHEN more than 5 invalid codes are attempted per hour from one chat, THE Telegram_Bot SHALL temporarily block linking attempts
6. WHERE a user account is already linked, THE Telegram_Bot SHALL allow re-linking after confirming the action with the existing linked account

### Requirement 2

**User Story:** As a vocabulary learner, I want to receive word reviews via Telegram messages, so that I can learn unknown words through spaced repetition.

#### Acceptance Criteria

1. WHEN the Review_Scheduler determines a word is due for review, THE Telegram_Bot SHALL atomically claim the item and send a MarkdownV2-formatted message with escaped text
2. WHEN sending a word review, THE Telegram_Bot SHALL include the Russian translation in Telegram spoiler format using ||text|| syntax
3. WHEN displaying a word review, THE Telegram_Bot SHALL provide an Inline_Keyboard with four emoji-labeled difficulty options (😰 Hard, 🤔 Normal, 👍 Good, 😎 Easy)
4. WHEN a user has no words due within their Preferred_Window, THE Telegram_Bot SHALL not send any messages until the next window opens
5. WHERE pronunciation IPA data is available, THE Telegram_Bot SHALL include it in the message using proper MarkdownV2 escaping
6. WHEN sending messages, THE Telegram_Bot SHALL record the message_id and set awaiting_response=true to prevent duplicate sends

### Requirement 3

**User Story:** As a vocabulary learner, I want to rate word difficulty after each review, so that the system can optimize my learning schedule.

#### Acceptance Criteria

1. WHEN a user clicks a difficulty button, THE Telegram_Bot SHALL validate the callback is for an active review and record the Difficulty_Rating
2. WHEN processing a difficulty rating, THE SRS_System SHALL calculate the next review interval using base intervals (Hard: 10min, Normal: 1440min, Good: 4320min, Easy: 10080min) multiplied by review_count factor
3. WHEN updating review schedules, THE SRS_System SHALL atomically update next_review_at, interval_minutes, review_count, and set awaiting_response=false
4. WHEN a user provides a difficulty rating, THE Telegram_Bot SHALL edit the message to remove the inline keyboard and show the selected difficulty
5. IF a user does not respond within 24 hours, THEN THE Telegram_Bot SHALL treat it as "Hard" difficulty with 0.5x interval multiplier and set awaiting_response=false
6. WHEN processing duplicate callback queries for the same message, THE Telegram_Bot SHALL ignore them and respond with "Already processed"

### Requirement 4

**User Story:** As a vocabulary learner, I want the bot to respect my timezone and daily limits, so that I receive reviews at appropriate times and quantities.

#### Acceptance Criteria

1. WHEN scheduling reviews, THE Review_Scheduler SHALL convert all times to the user's configured timezone before checking delivery windows
2. WHEN determining review delivery, THE Review_Scheduler SHALL only send messages between preferred_window_start and preferred_window_end in user's local time
3. WHEN counting daily reviews, THE Telegram_Bot SHALL track sent messages per calendar day in user's timezone and not exceed daily_word_limit
4. WHEN the daily limit is reached, THE Review_Scheduler SHALL mark remaining due items for next available delivery slot
5. WHERE no timezone is configured, THE Telegram_Bot SHALL use "UTC" as default and set preferred_window_start="09:00", preferred_window_end="21:00"
6. WHEN handling daylight saving time transitions, THE Review_Scheduler SHALL use the user's timezone database for accurate time calculations

### Requirement 5

**User Story:** As a vocabulary learner, I want to view my learning statistics, so that I can track my progress and motivation.

#### Acceptance Criteria

1. WHEN a user sends the /stats command, THE Telegram_Bot SHALL display total count of active SRS items for the user
2. WHEN showing statistics, THE Telegram_Bot SHALL include count of words due for review today in user's timezone
3. WHEN displaying progress metrics, THE Telegram_Bot SHALL calculate success rate as percentage of "Good" or "Easy" responses in last 30 days
4. WHEN showing learning streak, THE Telegram_Bot SHALL count consecutive days with at least one difficulty rating provided
5. WHEN generating statistics, THE Telegram_Bot SHALL query fresh data from srs_items and calculate metrics in real-time
6. WHERE no learning data exists, THE Telegram_Bot SHALL display "No vocabulary items yet. Complete the web quiz to start learning!"

### Requirement 6

**User Story:** As a vocabulary learner, I want to pause and resume my learning, so that I can control when I receive vocabulary reviews.

#### Acceptance Criteria

1. WHEN a user sends /pause command, THE Telegram_Bot SHALL set paused=true in profiles table and confirm "Learning paused. Send /resume to continue."
2. WHEN learning is paused, THE Review_Scheduler SHALL skip the user when selecting due items for delivery
3. WHEN a user sends /resume command, THE Telegram_Bot SHALL set paused=false and process overdue items respecting daily_word_limit
4. WHEN resuming after pause longer than 7 days, THE Review_Scheduler SHALL limit initial delivery to 3 words maximum to prevent overwhelming
5. WHEN toggling pause state, THE Telegram_Bot SHALL send confirmation message with current status and available commands
6. WHERE a user has been paused for more than 30 days, THE SRS_System SHALL reset all intervals to minimum values to restart learning gradually

### Requirement 7

**User Story:** As a system administrator, I want the bot to handle errors gracefully, so that users have a reliable learning experience.

#### Acceptance Criteria

1. WHEN database connection fails, THE Telegram_Bot SHALL log the error and retry with exponential backoff
2. WHEN invalid user data is encountered, THE Telegram_Bot SHALL handle the error without crashing and notify administrators
3. WHEN Telegram API rate limits are hit, THE Telegram_Bot SHALL queue messages and retry with appropriate delays
4. WHEN processing user input, THE Telegram_Bot SHALL validate all data before database operations
5. IF critical errors occur, THEN THE Telegram_Bot SHALL continue operating for other users while logging the specific failure

### Requirement 8

**User Story:** As a vocabulary learner, I want clear bot commands and help, so that I can easily navigate and use all available features.

#### Acceptance Criteria

1. WHEN a user sends /start command, THE Telegram_Bot SHALL display welcome message with linking instructions if not connected, or learning status if connected
2. WHEN a user sends /help command, THE Telegram_Bot SHALL display all available commands with brief descriptions
3. WHEN a user sends /link command, THE Telegram_Bot SHALL provide instructions for account linking with web application
4. WHEN a user sends /settings command, THE Telegram_Bot SHALL display current timezone, daily limit, and preferred window with options to modify
5. WHEN a user sends an unrecognized command, THE Telegram_Bot SHALL respond with "Unknown command. Send /help for available commands."
6. WHERE a user is not linked, THE Telegram_Bot SHALL only respond to /start, /help, and /link commands

### Requirement 9

**User Story:** As a system architect, I want the bot to integrate cleanly with existing domain logic, so that the system remains maintainable and consistent.

#### Acceptance Criteria

1. WHEN accessing word data, THE Telegram_Bot SHALL use the existing WordRepository interface from the domain layer
2. WHEN updating SRS items, THE Telegram_Bot SHALL use the existing SrsRepository interface without direct database access
3. WHEN calculating review schedules, THE Telegram_Bot SHALL use the existing SRS scheduling functions from the domain layer
4. WHEN handling user profiles, THE Telegram_Bot SHALL use the existing UserRepository interface for all profile operations
5. WHERE new functionality is needed, THE Telegram_Bot SHALL extend domain interfaces rather than bypass the architecture

### Requirement 10

**User Story:** As a system administrator, I want secure and observable bot operations, so that user data is protected and system health is monitored.

#### Acceptance Criteria

1. WHEN accessing Supabase, THE Telegram_Bot SHALL use service role key stored securely in environment variables
2. WHEN processing user data, THE Telegram_Bot SHALL respect Row Level Security policies for all database operations
3. WHEN logging operations, THE Telegram_Bot SHALL use structured logging with correlation IDs for request tracing
4. WHEN handling sensitive data, THE Telegram_Bot SHALL never log Link_Code values or user message content
5. WHEN rate limits are exceeded, THE Telegram_Bot SHALL implement exponential backoff with maximum 5 retry attempts
6. WHERE user requests account deletion, THE Telegram_Bot SHALL provide instructions to delete data through the web application