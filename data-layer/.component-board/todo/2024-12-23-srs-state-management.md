# Add SRS State Management Endpoints

**Requester**: Telegram Bot
**Priority**: High
**Date**: 2024-12-23

## Description

The Telegram bot needs SRS state management endpoints for atomic review claiming, message tracking, timeout processing, and delivery state management.

## Requirements

- POST /srs/claim-reviews endpoint
  - Atomically claim due reviews to prevent race conditions
- PUT /srs/items/:userId/:wordId/mark-sent endpoint
  - Mark review as sent with message ID
- PUT /srs/items/:userId/:wordId/reset-to-due endpoint
  - Reset review to due state if sending failed
- POST /srs/process-timeouts endpoint
  - Process reviews that have timed out (no response after 24h)
- GET /srs/processing-stats endpoint
  - Get statistics about review processing

## Context

Telegram bot uses sophisticated state management for review delivery to prevent race conditions and handle failures. These endpoints are needed to maintain the same reliability in the Database Service architecture.

## API Design

```typescript
// POST /srs/claim-reviews
interface ClaimReviewsRequest {
  limit?: number;
}
interface ClaimReviewsResponse {
  claimedReviews: Array<{
    userId: string;
    wordId: string;
    word: WordResponse;
  }>;
}

// PUT /srs/items/:userId/:wordId/mark-sent
interface MarkSentRequest {
  messageId: string;
  sentAt: string; // ISO date
}

// POST /srs/process-timeouts
interface ProcessTimeoutsRequest {
  timeoutMinutes?: number; // default 1440 (24h)
}
interface ProcessTimeoutsResponse {
  processedCount: number;
}

// GET /srs/processing-stats
interface ProcessingStatsResponse {
  awaitingResponse: number;
  overdue: number;
  processedToday: number;
}
```