# In-Memory Infrastructure

In-memory implementations of domain repositories for testing and development.

## Purpose

This package provides in-memory storage implementations that:

- **Enable fast testing** - No external dependencies or setup required
- **Support development** - Quick iteration without database setup
- **Facilitate CI/CD** - Tests run without external services
- **Allow experimentation** - Easy to modify and test new features

## Usage

### Basic Usage

```typescript
import {
  MemoryWordRepository,
  MemoryUserWordStateRepository,
  MemorySrsRepository
} from '@english-learning/infra-memory';

// Initialize with sample data
const wordRepo = new MemoryWordRepository([
  {
    id: 'word-1',
    text: 'hello',
    level: 'A1',
    exampleEn: 'Hello world',
    exampleRu: 'Привет мир',
    tags: ['greeting'],
    pronunciations: [],
  },
]);

const userProgressRepo = new MemoryUserWordStateRepository();
const srsRepo = new MemorySrsRepository();
```

### Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryWordRepository } from '@english-learning/infra-memory';

describe('My Service', () => {
  let wordRepo: MemoryWordRepository;

  beforeEach(() => {
    wordRepo = new MemoryWordRepository([/* test data */]);
  });

  it('should work with in-memory data', async () => {
    const words = await wordRepo.getRandomBatch('user-1', 5);
    expect(words).toHaveLength(5);
  });
});
```

### Database Service Integration

The Database Service automatically uses in-memory repositories when configured:

```bash
# .env
STORAGE_BACKEND=memory
```

This is perfect for:
- **Local development** - No Supabase setup required
- **Unit testing** - Fast, isolated tests
- **CI/CD pipelines** - No external dependencies

## Features

### MemoryWordRepository

- Store words in memory with full search capabilities
- Add/remove words dynamically for testing
- Deterministic random selection for reproducible tests

### MemoryUserWordStateRepository

- Track user progress per word
- Calculate statistics in real-time
- Reset progress for testing scenarios

### MemorySrsRepository

- Full SRS functionality with scheduling
- Due item calculation
- Review tracking and statistics

## Testing Utilities

Each repository includes additional methods for testing:

```typescript
// Clear all data
wordRepo.clear();

// Add test data
wordRepo.addWord(testWord);

// Get all data for assertions
const allWords = wordRepo.getAllWords();
const userStates = userProgressRepo.getUserStates(userId);
const srsItems = srsRepo.getUserItems(userId);
```

## Performance

In-memory repositories are optimized for:
- **Fast operations** - All data in memory
- **Small datasets** - Perfect for testing and development
- **Predictable behavior** - No network latency or external failures

## Limitations

- **Data persistence** - Data is lost when process restarts
- **Memory usage** - All data stored in RAM
- **Single instance** - No sharing between processes
- **Limited scale** - Not suitable for production workloads

## When to Use

**✅ Good for:**
- Unit testing
- Local development
- CI/CD pipelines
- Prototyping
- Integration testing

**❌ Not for:**
- Production environments
- Large datasets
- Multi-user scenarios
- Data persistence requirements