# Web Quiz App

Tinder-like quiz application for testing English vocabulary knowledge.

## Features

- Card-based UI with swipe/keyboard/touch controls
- Progress tracking and statistics
- Supabase integration for persistence
- PDF export functionality
- Reset and resume quiz

## Development

```bash
# Install dependencies (from repo root)
pnpm install

# Start dev server
pnpm dev:web

# Build for production
pnpm build

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Tech Stack

- React 18
- Vite
- TypeScript
- Supabase (Auth + Database)
- Domain and infra packages from monorepo

