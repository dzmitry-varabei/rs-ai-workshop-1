# Implementation Plan

- [x] 1. Set up project structure and core dependencies
  - Create `apps/telegram-bot` directory with TypeScript configuration
  - Install core dependencies: telegraf, @supabase/supabase-js, fast-check for testing
  - Set up ESLint, Prettier, and Vitest configuration matching project standards
  - Create basic package.json with dev scripts (dev, build, test, typecheck)
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 1.1 Create database migrations for bot-specific tables
  - Add migration for link_codes table with proper indexes
  - Add migration for link_attempts table for rate limiting
  - Add migration for review_events table for statistics
  - Add migration to extend profiles table with bot-specific columns
  - Add migration to extend srs_items table with delivery state machine
  - _Requirements: 1.2, 1.5, 5.3, 5.4_

- [x] 1.2 Write property test for database schema constraints
  - **Property 1: Account Linking Validation**
  - **Validates: Requirements 1.2, 1.3**

- [x] 2. Implement domain interfaces and types
  - Create core TypeScript interfaces (DueReviewSelector, ReviewDeliveryService, ReviewProcessor, AccountLinker)
  - Define domain types (ScheduledReview, LinkCodeValidation, UserStats, Difficulty, DeliveryWindow)
  - Implement MessageFormatter interface with MarkdownV2 escaping
  - Create error types for different failure scenarios
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 2.1 Write property test for MarkdownV2 escaping
  - **Property 5: Review Message Format Consistency**
  - **Validates: Requirements 2.2, 2.3**

- [x] 2.2 Write property test for SRS interval calculations
  - **Property 8: SRS Interval Calculation**
  - **Validates: Requirements 3.2**

- [ ] 3. Implement Supabase repository layer
  - Create LinkCodeRepository with validation and rate limiting methods
  - Create ReviewEventRepository for statistics tracking
  - Extend existing SrsRepository with bot-specific state management methods
  - Extend existing UserRepository with bot profile management
  - Implement atomic operations using Postgres RPC functions
  - _Requirements: 1.2, 1.4, 1.5, 3.2, 3.3, 5.1, 5.2_

- [ ] 3.1 Write property test for link code validation
  - **Property 3: Invalid Link Code Rejection**
  - **Validates: Requirements 1.4**

- [ ] 3.2 Write property test for rate limiting
  - **Property 2: Link Code Rate Limiting**
  - **Validates: Requirements 1.5**

- [ ] 3.3 Write property test for atomic SRS updates
  - **Property 9: Atomic Schedule Updates**
  - **Validates: Requirements 3.3**

- [ ] 4. Implement core bot services
  - Create AccountLinker service with validation and linking logic
  - Create DueReviewSelector service with timezone and window filtering
  - Create ReviewDeliveryService with atomic claiming and sending
  - Create ReviewProcessor service with callback handling and scheduling
  - Implement proper error handling and logging for all services
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.1, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2_

- [ ] 4.1 Write property test for timezone conversions
  - **Property 13: Timezone Conversion Accuracy**
  - **Validates: Requirements 4.1**

- [ ] 4.2 Write property test for time window enforcement
  - **Property 6: Time Window Enforcement**
  - **Validates: Requirements 2.4, 4.2**

- [ ] 4.3 Write property test for daily limit enforcement
  - **Property 14: Daily Limit Enforcement**
  - **Validates: Requirements 4.3**

- [ ] 5. Implement message formatting and Telegram integration
  - Create MessageFormatter with MarkdownV2 escaping and review formatting
  - Handle missing data gracefully (no example, no translation, no pronunciation)
  - Create inline keyboard builders for difficulty selection
  - Implement Telegram API wrapper with error handling and retries
  - Add exponential backoff for rate limiting scenarios
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 7.3, 10.5_

- [ ] 5.1 Write property test for missing data handling
  - **Property 7: Pronunciation Inclusion**
  - **Validates: Requirements 2.5**

- [ ] 5.2 Write property test for exponential backoff
  - **Property 25: Exponential Backoff Retry**
  - **Validates: Requirements 10.5**

- [ ] 6. Checkpoint - Ensure all tests pass, ask the user if questions arise

- [ ] 7. Implement command handlers
  - Create /start command handler with conditional welcome messages
  - Create /help command handler with command descriptions
  - Create /link command handler with linking instructions
  - Create /stats command handler with real-time statistics calculation
  - Create /pause and /resume command handlers with state management
  - Create /settings command handler with current configuration display
  - _Requirements: 8.1, 8.2, 8.3, 5.1, 5.2, 5.3, 5.4, 6.1, 6.3, 8.4_

- [ ] 7.1 Write property test for command state filtering
  - **Property 22: Command State Filtering**
  - **Validates: Requirements 8.6**

- [ ] 7.2 Write property test for statistics accuracy
  - **Property 17: Statistics Accuracy**
  - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [ ] 7.3 Write property test for pause state enforcement
  - **Property 18: Pause State Enforcement**
  - **Validates: Requirements 6.2**

- [ ] 8. Implement callback query handling
  - Create callback handler for difficulty button presses
  - Implement callback validation against active reviews
  - Handle duplicate callback queries with idempotency
  - Process difficulty ratings and update SRS scheduling
  - Edit messages to remove keyboards and show selected difficulty
  - _Requirements: 3.1, 3.4, 3.6_

- [ ] 8.1 Write property test for callback validation
  - **Property 10: Callback Validation and Response**
  - **Validates: Requirements 3.1, 3.4**

- [ ] 8.2 Write property test for duplicate callback handling
  - **Property 12: Duplicate Callback Handling**
  - **Validates: Requirements 3.6**

- [ ] 9. Implement review scheduler
  - Create scheduler service that runs every 60 seconds
  - Implement due review selection with user preferences filtering
  - Add atomic review claiming to prevent race conditions
  - Handle timeout processing for overdue responses
  - Implement daily limit tracking and overflow handling
  - _Requirements: 2.1, 2.4, 2.6, 3.5, 4.2, 4.3, 4.4_

- [ ] 9.1 Write property test for atomic review claiming
  - **Property 4: Atomic Review Claiming**
  - **Validates: Requirements 2.1, 2.6**

- [ ] 9.2 Write property test for timeout handling
  - **Property 11: Timeout Handling**
  - **Validates: Requirements 3.5**

- [ ] 9.3 Write property test for limit overflow handling
  - **Property 15: Limit Overflow Handling**
  - **Validates: Requirements 4.4**

- [ ] 10. Implement pause/resume functionality
  - Add pause state checking in scheduler
  - Implement resume processing with backlog handling
  - Handle long pause scenarios (7+ days, 30+ days)
  - Add confirmation messages for state changes
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 10.1 Write property test for resume processing
  - **Property 19: Resume Processing**
  - **Validates: Requirements 6.3**

- [ ] 10.2 Write property test for long pause handling
  - **Property 20: Long Pause Handling**
  - **Validates: Requirements 6.4**

- [ ] 10.3 Write property test for extended pause reset
  - **Property 21: Extended Pause Reset**
  - **Validates: Requirements 6.6**

- [ ] 11. Implement bot controller and main application
  - Create main bot controller with polling setup
  - Wire all handlers and services together
  - Implement graceful shutdown handling
  - Add structured logging with correlation IDs
  - Create environment configuration management
  - _Requirements: 7.1, 7.2, 7.4, 10.1, 10.2, 10.3_

- [ ] 11.1 Write property test for default configuration
  - **Property 16: Default Configuration**
  - **Validates: Requirements 4.5**

- [ ] 11.2 Write property test for settings display
  - **Property 23: Settings Display Completeness**
  - **Validates: Requirements 8.4**

- [ ] 11.3 Write property test for unknown command handling
  - **Property 24: Unknown Command Handling**
  - **Validates: Requirements 8.5**

- [ ] 12. Add comprehensive error handling
  - Implement error recovery mechanisms for all failure scenarios
  - Add circuit breaker pattern for external service calls
  - Create cleanup jobs for inconsistent states
  - Add monitoring and alerting hooks
  - Implement graceful degradation strategies
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 12.1 Write integration tests for error scenarios
  - Test database connection failures and recovery
  - Test Telegram API failures and retries
  - Test malformed user input handling
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 13. Final checkpoint - Ensure all tests pass, ask the user if questions arise