# Add Global Due Reviews Endpoint

**Requester**: Telegram Bot
**Priority**: Medium
**Date**: 2024-12-23

## Description

The Telegram bot scheduler needs an endpoint to get due reviews across all users for efficient batch processing.

## Requirements

- GET /srs/due-reviews endpoint
  - Get due reviews for all eligible users
  - Filter by delivery windows, pause states, and daily limits
  - Support pagination and limiting

## Context

The Telegram bot scheduler runs every 60 seconds and needs to efficiently find all users who have reviews due and are eligible to receive them (not paused, within delivery window, under daily limit).

## API Design

```typescript
// GET /srs/due-reviews?limit=10&offset=0
interface GlobalDueReviewsResponse {
  reviews: Array<{
    userId: string;
    wordId: string;
    nextReviewAt: string;
    intervalMinutes: number;
    reviewCount: number;
    user: {
      telegramChatId: string;
      timezone: string;
      preferredWindowStart: string;
      preferredWindowEnd: string;
    };
    word: WordResponse;
  }>;
  total: number;
  hasMore: boolean;
}
```

## Implementation Notes

This endpoint should:
1. Join srs_items with profiles and words tables
2. Filter for due items (next_review_at <= now)
3. Filter for eligible users (not paused, within delivery window, under daily limit)
4. Return paginated results with user and word data