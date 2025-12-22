# @english-learning/infra-supabase

Infrastructure layer implementing domain repositories using Supabase (Postgres).

This package:
- Implements domain repository interfaces
- Maps between Supabase tables and domain types
- Handles database queries and mutations
- Provides Supabase client utilities

## Usage

```typescript
import { createSupabaseClient } from '@english-learning/infra-supabase';

const client = createSupabaseClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);
```

## Principles

- **Implements domain interfaces**: All repositories implement interfaces from `@english-learning/domain`
- **Type-safe mapping**: Maps database rows to domain types with proper validation
- **Error handling**: Gracefully handles database errors and edge cases
- **Testable**: Can be tested with mocked Supabase client

