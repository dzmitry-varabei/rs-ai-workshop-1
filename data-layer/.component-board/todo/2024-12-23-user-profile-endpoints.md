# Add User Profile Management Endpoints

**Requester**: Telegram Bot
**Priority**: High
**Date**: 2024-12-23

## Description

The Telegram bot needs user profile management endpoints to handle user settings, delivery windows, pause states, and daily limits.

## Requirements

- GET /users/:userId/profile endpoint
  - Return user profile with timezone, daily_word_limit, preferred_window_start, preferred_window_end, paused
- PUT /users/:userId/profile endpoint  
  - Update user profile settings
- GET /users/:userId/profile/delivery-window endpoint
  - Check if current time is within user's delivery window
- GET /users/:userId/profile/daily-limit endpoint
  - Check if user has reached daily review limit

## Context

Telegram bot currently uses direct Supabase access for user profile management. These endpoints are needed to complete the migration to Database Service architecture.

## API Design

```typescript
// GET /users/:userId/profile
interface UserProfileResponse {
  id: string;
  telegramChatId?: string;
  timezone: string;
  dailyWordLimit: number;
  preferredWindowStart: string; // HH:MM format
  preferredWindowEnd: string;   // HH:MM format
  paused: boolean;
}

// PUT /users/:userId/profile
interface UpdateProfileRequest {
  timezone?: string;
  dailyWordLimit?: number;
  preferredWindowStart?: string;
  preferredWindowEnd?: string;
  paused?: boolean;
}

// GET /users/:userId/profile/delivery-window?currentTime=ISO8601
interface DeliveryWindowResponse {
  withinWindow: boolean;
  windowStart: string;
  windowEnd: string;
  userTimezone: string;
}

// GET /users/:userId/profile/daily-limit?date=YYYY-MM-DD
interface DailyLimitResponse {
  hasReachedLimit: boolean;
  reviewsToday: number;
  dailyLimit: number;
}
```