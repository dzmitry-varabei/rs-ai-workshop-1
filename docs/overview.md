# Overview

We are building an ecosystem for learning English vocabulary:

1. A **web quiz app** that shows words from a 3000‑word frequency list and lets the user mark whether they know each word.
2. A **Telegram bot** that uses spaced repetition (SRS) to help the user learn unknown words over time.

Originally the prototype used `localStorage` and sqlite as storage; in this repository we use **Supabase (Postgres)** as the shared backend for both the web app and the bot.

## High-level flow

1. User opens the web quiz.
2. The app shows words one by one (card UI, swipe/keyboard/touch).
3. For each word the user marks:
   - "know" → status `known`,
   - "don't know" → status `unknown`.
4. The app stores the word status via Database Service API.
5. Unknown words are used to create/update SRS items for the Telegram bot.
6. The user links their Telegram account with the web account.
7. The bot sends review messages with examples and translations.
8. The user rates difficulty (4 levels), which adjusts future intervals.

## Architecture

The system uses **Database Service Layer architecture** for team isolation:

```
Apps (web/bot) → Database Client → Database Service → Repositories → Supabase
```

This provides:
- **Team boundaries** — Database/Web/Bot teams work independently
- **Controlled database access** — All changes go through Database Service
- **Better testing** — Easy to mock Database Client
- **Smaller context** — Teams only need to understand their domain

## Main components

- `apps/web` — quiz UI, stats, PDF export.
- `apps/telegram-bot` — SRS bot.
- `packages/domain` — shared business logic.
- `packages/database-service` — HTTP API for database operations.
- `packages/database-client` — HTTP client library for apps.
- `packages/infra-supabase` — data access layer (used by Database Service).
- `supabase` — database schema and migrations.

See also:

- `docs/database-service-architecture.md` — new Database Service Layer architecture.
- `docs/migration-to-database-service.md` — migration guide from direct repository access.
- `docs/web-app.md` — details of the quiz and stats.
- `docs/telegram-bot.md` — bot flows and message formats.
- `docs/spaced-repetition.md` — SRS algorithm.
- `docs/data-model.md` — tables and relations.

