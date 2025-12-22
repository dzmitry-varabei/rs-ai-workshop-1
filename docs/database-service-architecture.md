# Database Service Architecture

This document describes the new database service architecture that provides better team isolation and controlled database access.

## Problem

The original architecture had several issues:

- **Tight coupling** - Apps directly accessed database repositories
- **Forgotten migrations** - Database changes were not properly tracked
- **Large context** - Developers needed to understand the entire system
- **No team boundaries** - Everyone worked in the same codebase

## Solution

We introduced a **Database Service Layer** that acts as a controlled gateway to the database:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web App       │    │  Telegram Bot   │    │   Other Apps    │
│                 │    │                 │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │              HTTP API Calls                 │
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Database Service │
                    │                 │
                    │ ┌─────────────┐ │
                    │ │   Routes    │ │
                    │ └─────────────┘ │
                    │ ┌─────────────┐ │
                    │ │  Services   │ │
                    │ └─────────────┘ │
                    │ ┌─────────────┐ │
                    │ │Repositories │ │
                    │ └─────────────┘ │
                    └─────────┬───────┘
                              │
                    ┌─────────────────┐
                    │    Supabase     │
                    │   (Postgres)    │
                    └─────────────────┘
```

## Components

### Database Service (`packages/database-service`)

HTTP API server that provides controlled access to the database:

- **Routes** - HTTP endpoints with validation
- **Services** - Business logic layer
- **Repositories** - Data access (existing `infra-supabase`)

### Database Client (`packages/database-client`)

HTTP client library that apps use to communicate with the Database Service:

- **Type-safe API** - Typed methods for all operations
- **Error handling** - Automatic error parsing and timeouts
- **Simple interface** - Hides HTTP complexity

## Team Boundaries

### Database Team

**Owns**: `packages/database-service`, `packages/infra-supabase`, `supabase/`

**Responsibilities**:
- Database schema and migrations
- API endpoint implementation
- Performance optimization
- Data consistency

### Application Teams (Web, Bot)

**Owns**: `apps/web`, `apps/telegram-bot`

**Responsibilities**:
- User interface and experience
- Application-specific logic
- Integration with Database Service API

**Cannot**:
- Directly access database
- Create migrations
- Modify repository implementations

## Development Workflow

### For Database Changes

1. **App team creates ticket**:
   ```
   Title: Add user preferences API
   
   Description:
   We need to store user timezone and daily word limit.
   
   Required API:
   - GET /api/user-preferences?userId={uuid}
   - POST /api/user-preferences (body: {userId, timezone, dailyWordLimit})
   ```

2. **Database team implements**:
   - Create Supabase migration
   - Update repository implementation
   - Add API endpoints
   - Update documentation
   - Version the changes

3. **App teams integrate**:
   - Update to new database-client version
   - Use new API methods

### For App Development

App teams work independently using the Database Client:

```typescript
// Web app example
import { DatabaseClient } from '@english-learning/database-client';

const dbClient = new DatabaseClient({
  baseUrl: process.env.DATABASE_SERVICE_URL,
});

// Get words for quiz
const words = await dbClient.getRandomWords(userId, 10);

// Mark word as known
await dbClient.markWordKnown(userId, wordId);
```

## Benefits

### Team Isolation

- **Smaller context** - Teams only need to understand their domain
- **Independent development** - Teams can work in parallel
- **Clear ownership** - Each team owns specific components

### Controlled Database Access

- **Migration tracking** - All database changes go through proper process
- **API versioning** - Changes are documented and versioned
- **Performance monitoring** - Database team can optimize queries

### Better Testing

- **Mockable client** - Easy to mock Database Client for unit tests
- **Integration tests** - Database Service can be tested independently
- **Contract testing** - API contracts ensure compatibility

## Migration Guide

### Before (Direct Repository Access)

```typescript
// apps/web/src/services/QuizService.ts
import { SupabaseWordRepository } from '@english-learning/infra-supabase';

export class QuizService {
  constructor(private wordRepo: SupabaseWordRepository) {}
  
  async getWords(userId: string) {
    return this.wordRepo.getRandomBatch(userId, 10);
  }
}
```

### After (HTTP API)

```typescript
// apps/web/src/services/QuizService.ts
import { DatabaseClient } from '@english-learning/database-client';

export class QuizService {
  constructor(private dbClient: DatabaseClient) {}
  
  async getWords(userId: string) {
    return this.dbClient.getRandomWords(userId, 10);
  }
}
```

## Environment Setup

### Database Service

```bash
# packages/database-service/.env
PORT=3001
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
```

### Applications

```bash
# apps/web/.env
DATABASE_SERVICE_URL=http://localhost:3001

# apps/telegram-bot/.env  
DATABASE_SERVICE_URL=http://localhost:3001
```

## Development Commands

```bash
# Start database service
pnpm dev:db

# Start web app (uses database service)
pnpm dev:web

# Start telegram bot (uses database service)
pnpm dev:bot
```

This architecture provides better separation of concerns, clearer team boundaries, and more controlled database access while maintaining the same functionality.