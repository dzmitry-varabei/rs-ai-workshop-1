# Data Layer

This component provides all data access, storage, and persistence operations for the English Learning System.

## Architecture

The data layer is organized into several packages:

- **domain/** - Pure TypeScript types and business logic without infrastructure dependencies
- **service/** - HTTP API service providing REST endpoints for data operations
- **client/** - HTTP client library for consuming the Database Service API
- **implementations/** - Concrete repository implementations
  - **supabase/** - Supabase/Postgres implementation
  - **memory/** - In-memory implementation for testing and development

## Usage

Applications (web app and telegram bot) should use the `client` package to interact with the data layer:

```typescript
import { DatabaseClient } from '@english-learning/data-layer-client';

const client = new DatabaseClient({ baseUrl: process.env.DATABASE_SERVICE_URL });
const words = await client.getWords();
```

## Development

### Prerequisites

- Node.js 18+
- pnpm 8+
- Supabase account (for production) or use memory backend for development

### Environment Variables

Create a `.env` file in the service directory:

```bash
# Storage backend: 'supabase' or 'memory'
STORAGE_BACKEND=memory

# Required only if using Supabase backend
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Service configuration
PORT=3001
```

### Running the Database Service

```bash
# From repository root
pnpm dev:db

# Or directly from service directory
cd data-layer/service
pnpm dev
```

### Running Tests

```bash
# Run all data layer tests
pnpm --filter "@english-learning/data-layer-*" test

# Run specific package tests
pnpm --filter data-layer-domain test
pnpm --filter data-layer-service test
```

### Building

```bash
# Build all data layer packages
pnpm --filter "@english-learning/data-layer-*" build
```

## Package Structure

### Domain Package (`@english-learning/data-layer-domain`)

Contains pure TypeScript interfaces and business logic:

- **Types**: `Word`, `User`, `SrsItem`, etc.
- **Repository Interfaces**: `WordRepository`, `UserWordStateRepository`, `SrsRepository`
- **Business Logic**: SRS scheduling algorithms, validation functions

### Service Package (`@english-learning/data-layer-service`)

HTTP API service built with Fastify:

- **Endpoints**: RESTful API for all data operations
- **Validation**: Request/response validation with Zod
- **Repository Injection**: Uses repository implementations via dependency injection

### Client Package (`@english-learning/data-layer-client`)

HTTP client library for consuming the Database Service:

- **Typed Methods**: Fully typed methods matching API endpoints
- **Error Handling**: Proper error handling and response parsing
- **Configuration**: Configurable base URL and request options

### Implementation Packages

#### Supabase Implementation (`@english-learning/data-layer-implementations-supabase`)

Production-ready implementation using Supabase/Postgres:

- **Database Mapping**: Maps domain objects to/from database rows
- **Transactions**: Proper transaction handling for complex operations
- **Performance**: Optimized queries and indexing

#### Memory Implementation (`@english-learning/data-layer-implementations-memory`)

In-memory implementation for testing and development:

- **Fast**: No database setup required
- **Isolated**: Each instance is independent
- **Sample Data**: Includes sample words for development

## Component Board

Task management for the data layer component is handled in `.component-board/`:

- `todo/` - New tasks and feature requests
- `in-progress/` - Currently active tasks  
- `done/` - Completed tasks for reference

## Documentation

- See [API.md](./API.md) for complete API documentation
- See individual package READMEs for package-specific details
- See `docs/data-model.md` in repository root for database schema
