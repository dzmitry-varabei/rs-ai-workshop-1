# Database Client

HTTP client library for interacting with the Database Service API.

## Purpose

This package provides a typed HTTP client that applications use to communicate with the Database Service. It abstracts away HTTP details and provides a clean interface.

## Installation

```bash
pnpm add @english-learning/database-client
```

## Usage

### Initialize the client

```typescript
import { DatabaseClient } from '@english-learning/database-client';

const dbClient = new DatabaseClient({
  baseUrl: process.env.DATABASE_SERVICE_URL || 'http://localhost:3001',
  timeout: 30000, // optional, default 30s
  headers: {      // optional custom headers
    'X-API-Key': 'your-api-key',
  },
});
```

### Get random words for quiz

```typescript
const words = await dbClient.getRandomWords(userId, 10);

words.forEach(word => {
  console.log(word.textEn, word.exampleEn);
});
```

### Mark word as known/unknown

```typescript
await dbClient.markWordKnown(userId, wordId);
await dbClient.markWordUnknown(userId, wordId);
```

### Get user statistics

```typescript
const stats = await dbClient.getUserStats(userId);

console.log(`Known: ${stats.known}`);
console.log(`Unknown: ${stats.unknown}`);
console.log(`Knowledge: ${stats.knowledgePercentage}%`);
```

### Get words due for review (SRS)

```typescript
const dueWords = await dbClient.getDueWords(userId, 5);

for (const item of dueWords) {
  console.log(`Review: ${item.word.textEn}`);
  console.log(`Next review: ${item.nextReviewAt}`);
}
```

### Record review result

```typescript
await dbClient.recordReview(userId, wordId, 'medium');
```

## Error Handling

The client throws errors for failed requests:

```typescript
try {
  const words = await dbClient.getRandomWords(userId, 10);
} catch (error) {
  console.error('Failed to fetch words:', error.message);
}
```

## Environment Variables

Set the Database Service URL:

```bash
DATABASE_SERVICE_URL=http://localhost:3001
```

## Benefits

- **Type safety** - Full TypeScript support with typed responses
- **Simple API** - Clean methods that hide HTTP complexity
- **Error handling** - Automatic error parsing and timeout handling
- **Testable** - Easy to mock for unit tests