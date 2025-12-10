# @english-learning/domain

Domain types and business logic for English Learning System.

This package contains:
- Pure TypeScript types (no runtime dependencies)
- Business logic functions
- Domain models (Word, User, etc.)

## Usage

```typescript
import { Word, WordId, UserId } from '@english-learning/domain';
```

## Principles

- **No infrastructure dependencies**: This package doesn't know about Supabase, databases, etc.
- **Pure types and functions**: All code should be testable without mocks
- **Branded types**: Use branded types (UserId, WordId) for type safety

