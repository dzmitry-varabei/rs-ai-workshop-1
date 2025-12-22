# Migration to Database Service Architecture

This guide explains how to migrate from direct repository access to the new Database Service architecture.

## Overview

We are moving from this architecture:

```
Apps → Domain Repositories → Supabase
```

To this architecture:

```
Apps → Database Client → Database Service → Domain Repositories → Supabase
```

## Benefits

- **Team isolation** - Database team owns the service, app teams consume the API
- **Controlled migrations** - All database changes go through the Database Service
- **Better testing** - Easy to mock the Database Client
- **API versioning** - Changes are documented and versioned

## Migration Steps

### 1. Update Dependencies

**Before:**
```json
{
  "dependencies": {
    "@english-learning/domain": "workspace:*",
    "@english-learning/infra-supabase": "workspace:*"
  }
}
```

**After:**
```json
{
  "dependencies": {
    "@english-learning/database-client": "workspace:*"
  }
}
```

### 2. Replace Repository Imports

**Before:**
```typescript
import { 
  SupabaseWordRepository,
  SupabaseUserWordStateRepository,
  SupabaseSrsRepository,
  createSupabaseClient 
} from '@english-learning/infra-supabase';
```

**After:**
```typescript
import { DatabaseClient } from '@english-learning/database-client';
```

### 3. Update Service Initialization

**Before:**
```typescript
const supabase = createSupabaseClient(url, key);
const wordRepo = new SupabaseWordRepository(supabase);
const userProgressRepo = new SupabaseUserWordStateRepository(supabase);
const srsRepo = new SupabaseSrsRepository(supabase);
```

**After:**
```typescript
const dbClient = new DatabaseClient({
  baseUrl: process.env.DATABASE_SERVICE_URL || 'http://localhost:3001',
});
```

### 4. Update Method Calls

#### Words

**Before:**
```typescript
const words = await wordRepo.getRandomBatch(userId, 10);
const word = await wordRepo.getByIds([wordId]);
const count = await wordRepo.getTotalCount();
```

**After:**
```typescript
const words = await dbClient.getRandomWords(userId, 10);
const word = await dbClient.getWordById(wordId);
const count = await dbClient.getTotalWordCount();
```

#### User Progress

**Before:**
```typescript
await userProgressRepo.markKnown(userId, wordId);
await userProgressRepo.markUnknown(userId, wordId);
const stats = await userProgressRepo.getStats(userId);
const status = await userProgressRepo.getStatus(userId, wordId);
```

**After:**
```typescript
await dbClient.markWordKnown(userId, wordId);
await dbClient.markWordUnknown(userId, wordId);
const stats = await dbClient.getUserStats(userId);
const status = await dbClient.getWordStatus(userId, wordId);
```

#### SRS

**Before:**
```typescript
const dueItems = await srsRepo.getDueItems(userId, new Date(), 5);
await srsRepo.updateAfterReview(userId, wordId, scheduleResult, difficulty, new Date());
const stats = await srsRepo.getStats(userId);
```

**After:**
```typescript
const dueItems = await dbClient.getDueWords(userId, 5);
await dbClient.recordReview(userId, wordId, 'medium');
const stats = await dbClient.getSrsStats(userId);
```

### 5. Update Environment Variables

Add to your app's `.env` file:

```bash
DATABASE_SERVICE_URL=http://localhost:3001
```

### 6. Update Error Handling

**Before:**
```typescript
try {
  const words = await wordRepo.getRandomBatch(userId, 10);
} catch (error) {
  // Handle Supabase errors
}
```

**After:**
```typescript
try {
  const words = await dbClient.getRandomWords(userId, 10);
} catch (error) {
  // Handle HTTP API errors
  console.error('Database service error:', error.message);
}
```

## Data Model Changes

### Word Object

The API uses slightly different field names:

**Domain (internal):**
```typescript
interface Word {
  id: string;
  text: string;        // ← Note: 'text'
  level?: string;
  exampleEn?: string;
  exampleRu?: string;
  tags: string[];
  pronunciations: Pronunciation[];
}
```

**API Response:**
```typescript
interface WordResponse {
  id: string;
  textEn: string;      // ← Note: 'textEn'
  level?: string;
  exampleEn?: string;
  exampleRu?: string;
  tags: string[];
  pronunciations: Array<{
    locale: string;
    ipa?: string;
    audioUrl?: string;
  }>;
}
```

### SRS Difficulty Mapping

The API uses different difficulty levels:

**API:** `'easy' | 'medium' | 'hard' | 'very_hard'`
**Domain:** `'easy' | 'good' | 'normal' | 'hard'`

The Database Service handles this mapping automatically.

## Testing

### Unit Tests

**Before:**
```typescript
const mockRepo = {
  getRandomBatch: vi.fn().mockResolvedValue([mockWord]),
};
```

**After:**
```typescript
const mockDbClient = {
  getRandomWords: vi.fn().mockResolvedValue([mockWordResponse]),
};
```

### Integration Tests

Start the Database Service before running integration tests:

```bash
# Terminal 1: Start database service
pnpm dev:db

# Terminal 2: Run integration tests
pnpm test:integration
```

## Development Workflow

### Starting Services

```bash
# Start database service (required for apps)
pnpm dev:db

# Start web app
pnpm dev:web

# Start telegram bot
pnpm dev:bot
```

### Making Database Changes

1. **Create ticket** describing needed API changes
2. **Database team** implements:
   - Database migration
   - Repository updates
   - API endpoint changes
   - Documentation updates
3. **App teams** update to use new API

## Rollback Plan

If issues arise, you can temporarily rollback by:

1. Reverting dependency changes
2. Restoring direct repository access
3. Keeping the Database Service for future migration

The Database Service is additive - it doesn't break existing functionality.

## Common Issues

### Connection Errors

**Error:** `Failed to fetch from database service`
**Solution:** Ensure Database Service is running on correct port

### Type Errors

**Error:** `Property 'textEn' does not exist`
**Solution:** Update code to use API response types instead of domain types

### Environment Variables

**Error:** `DATABASE_SERVICE_URL is not defined`
**Solution:** Add environment variable to your app's `.env` file

## Next Steps

After migration:

1. Remove unused repository dependencies
2. Update CI/CD to start Database Service
3. Add monitoring for Database Service
4. Consider adding API authentication