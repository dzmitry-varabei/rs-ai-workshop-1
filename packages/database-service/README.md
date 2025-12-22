# Database Service

HTTP API service that provides database operations for the English Learning System.

## Purpose

This service acts as a database abstraction layer, providing:

- **Clean API contracts** - Well-defined HTTP endpoints with validation
- **Team isolation** - Database team owns this service, app teams consume the API
- **Migration control** - All database changes go through this service
- **Business logic encapsulation** - Domain logic stays in one place

## Architecture

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

## API Endpoints

### Words API (`/api/words`)

- `GET /random?userId={uuid}&limit={number}` - Get random words for quiz
- `GET /{id}` - Get word by ID
- `GET /count` - Get total word count

### User Progress API (`/api/user-progress`)

- `POST /mark-known` - Mark word as known
- `POST /mark-unknown` - Mark word as unknown  
- `GET /stats?userId={uuid}` - Get user statistics
- `GET /word-status?userId={uuid}&wordId={uuid}` - Get word status
- `POST /reset` - Reset user progress

### SRS API (`/api/srs`)

- `GET /due-words?userId={uuid}&limit={number}` - Get words due for review
- `POST /record-review` - Record review result
- `GET /stats?userId={uuid}` - Get SRS statistics
- `POST /create-item` - Create SRS item for word
- `POST /deactivate-item` - Deactivate SRS item

## Development

### Start the service

```bash
cd packages/database-service
pnpm dev
```

The service runs on `http://localhost:3001` by default.

### Environment Variables

- `PORT` - Server port (default: 3001)
- `HOST` - Server host (default: 127.0.0.1)
- `LOG_LEVEL` - Log level (default: info)
- Supabase environment variables (see infra-supabase package)

### Testing

```bash
pnpm test
```

## Usage by Client Apps

Client applications should use HTTP clients to call this service instead of directly accessing repositories.

### Example: Web App

```typescript
// Instead of:
// const wordRepo = new SupabaseWordRepository(supabase);
// const words = await wordRepo.getRandomBatch(userId, 10);

// Use HTTP API:
const response = await fetch(`${DATABASE_SERVICE_URL}/api/words/random?userId=${userId}&limit=10`);
const words = await response.json();
```

### Example: Telegram Bot

```typescript
// Instead of:
// const srsRepo = new SupabaseSrsRepository(supabase);
// const dueItems = await srsRepo.getDueItems(userId, new Date(), 5);

// Use HTTP API:
const response = await fetch(`${DATABASE_SERVICE_URL}/api/srs/due-words?userId=${userId}&limit=5`);
const dueItems = await response.json();
```

## Migration Process

When apps need database changes:

1. **Create ticket** - App team creates issue describing needed API changes
2. **Database team implements**:
   - Add/modify Supabase migration
   - Update repository implementations
   - Add/modify API endpoints
   - Update API documentation
   - Version the changes
3. **App teams update** - Use new API endpoints

This ensures database changes are controlled and documented.