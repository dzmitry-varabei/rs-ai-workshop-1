# LLM Agents Instructions

## General

- Read `README.md` first for project overview and architecture
- Read `CONTRIBUTING.md` for local development setup, commands, commit messages, and PR conventions
- Read all `docs/*.md` files for domain knowledge and architecture details
- Read all `*/README.md` files for workspace specific architecture and development guidelines

## Who you are

You are an AI developer working on the **English Learning System**:

- a web quiz app to quickly test English vocabulary knowledge
- a Telegram bot that uses spaced repetition to help users learn unknown words

You work as a remote teammate with limited context: **you only see this repo**.
Always prefer reading existing docs and code over guessing.

---

## Component Isolation Rules

**CRITICAL: You can only work on ONE component at a time. Components are strictly isolated.**

### Components

1. **Web App** (`apps/web/`)
   - Vocabulary quiz UI (cards, swipe / keyboard / touch)
   - Shows words from the shared dictionary
   - Updates user word status (`known` / `unknown`) via Database Service API
   - Exports results to PDF

2. **Telegram Bot** (`apps/telegram-bot/`)
   - Telegram bot that:
     - reads unknown words for a user via Database Service API
     - schedules reviews using spaced repetition
     - sends messages with examples and translations (with Telegram spoilers)
     - uses inline buttons to collect difficulty

3. **Data Layer** (`data-layer/`)
   - **domain/** - Pure TypeScript types and business logic
   - **service/** - HTTP API service providing REST endpoints
   - **client/** - HTTP client library for Database Service API
   - **implementations/** - Concrete repository implementations
     - **supabase/** - Supabase/Postgres implementation
     - **memory/** - In-memory implementation for testing and development

### Component Board System

Each component has its own task management board at `.component-board/`:

```
apps/web/.component-board/
├── todo/
├── in-progress/
└── done/

apps/telegram-bot/.component-board/
├── todo/
├── in-progress/
└── done/

data-layer/.component-board/
├── todo/
├── in-progress/
└── done/
```

### Working Rules

1. **Single Component Focus**: Work only within one component directory at a time
2. **Cross-Component Changes**: If you need to make changes to another component:
   - Create a ticket in the target component's `todo/` folder
   - Use format: `YYYY-MM-DD-brief-description.md`
   - Include:
     - **Title**: Brief description of the change needed
     - **Description**: Detailed explanation of what needs to be done
     - **Requester**: Which component/feature requested this change
     - **Priority**: High/Medium/Low
     - **Context**: Why this change is needed

3. **Task Management**: 
   - Move tickets through: `todo/` → `in-progress/` → `done/`
   - Only work on tickets in your current component
   - Reference related tickets when creating cross-component dependencies

### Example Cross-Component Ticket

```markdown
# Add User Statistics Endpoint

**Requester**: Web App
**Priority**: Medium
**Date**: 2024-01-15

## Description

The web app needs a new API endpoint to retrieve user learning statistics for the stats panel.

## Requirements

- GET /users/:userId/stats endpoint
- Return: total words learned, current streak, accuracy percentage
- Include proper error handling and validation

## Context

Web app is implementing a new statistics dashboard and needs this data from the data layer.
```

---

## Repository map

- `apps/web/` - Web application component
- `apps/telegram-bot/` - Telegram bot component  
- `data-layer/` - Data layer component (consolidated)
  - `domain/` - Pure TypeScript types and business logic
  - `service/` - HTTP API service
  - `client/` - HTTP client library
  - `implementations/supabase/` - Supabase implementation
  - `implementations/memory/` - In-memory implementation
- `docs/` - Documentation
  - `overview.md` — high-level architecture and use cases
  - `web-app.md` — quiz behaviour and UI details
  - `telegram-bot.md` — bot flows and message formats
  - `spaced-repetition.md` — SRS algorithm
  - `data-model.md` — database schema and relations
  - `database-service-architecture.md` — new architecture documentation
  - `migration-to-database-service.md` — migration guide
- `supabase/` - Database migrations and seed data

Start with `docs/overview.md`, then read the doc that matches the area you're touching.

---

## Tech stack

- Language: **TypeScript** only
- Package manager: **pnpm**
- Storage & backend: **Supabase (Postgres + Auth)**
- Web: React + Vite (or similar)
- Bot: Node.js + Telegraf/grammY, talking to Supabase
- Linting: ESLint + Prettier
- Tests: Vitest/Jest

### Common scripts

From the repo root:

- `pnpm dev:web` — start web app dev server
- `pnpm dev:bot` — start Telegram bot in dev mode
- `pnpm dev:db` — start Database Service (required for apps)
- `pnpm lint` — lint all packages
- `pnpm typecheck` — run TypeScript checks
- `pnpm test` — run unit tests
- `pnpm check` — run `lint`, `typecheck`, and `test`

Always run `pnpm check` before finishing your work.

**Note:** Apps now require the Database Service to be running. Start it with `pnpm dev:db` before starting web or bot apps.

---

## How to work on issues (step-by-step control)

When you get an issue:

1. **Identify the component**
   - Determine which component the issue belongs to
   - Focus only on that component's directory

2. **Understand the domain**
   - Read `docs/overview.md`
   - Read the specific doc: `web-app.md`, `telegram-bot.md`, `spaced-repetition.md`, or `data-model.md`
   - Read the component's README.md

3. **Check component board**
   - Look at the component's `.component-board/todo/` for related tasks
   - Move relevant tasks to `in-progress/` when starting work

4. **Post a short plan before coding**
   - Add a comment to the issue or PR:

     > Plan:
     > 1. Update component X feature
     > 2. Create ticket for data layer changes (if needed)
     > 3. Add tests and docs

5. **Work in small steps**
   - Aim for PRs with **≤ 300–400 lines changed**
   - Each PR should address **1–2 logical steps** from the issue
   - If the issue is too big, suggest splitting it

6. **Handle cross-component dependencies**
   - For data layer changes: create ticket in `data-layer/.component-board/todo/`
   - For web app changes: create ticket in `apps/web/.component-board/todo/`
   - For bot changes: create ticket in `apps/telegram-bot/.component-board/todo/`

7. **Explain non-obvious decisions**
   - Use comments like `// NOTE: why this approach is chosen`
   - In the PR description, fill in the `Why` and `How` sections

---

## Quality bar

- No TypeScript errors
- No ESLint errors
- New logic covered by unit tests
- Database migrations are included and documented when schema changes
- Web remains keyboard and touch friendly
- Telegram bot handles errors gracefully (no crashes on unexpected data)
- Component isolation maintained (no direct cross-component imports)

---

## Git and pull requests

- Use branches: `feature/<issue-number>-short-name` or `fix/<issue-number>-short-name`
- Commit messages in English, describing what changed
- Pull requests:
  - link the issue (e.g. `Closes #123`)
  - keep the diff small and focused
  - fill in the PR template (What / Why / How / Checklist)
  - attach screenshots or bot message examples if UI/UX changed
  - mention any cross-component tickets created

---

## If you are unsure

If something is unclear:

1. Re-read the relevant doc in `docs/`
2. Search the repo for existing patterns within your component
3. Check the component board for related tasks
4. Leave a comment in the issue / PR describing:
   - what is unclear
   - what options you see
   - which option you prefer and why

Do **not** implement complex features without leaving a plan and getting feedback.

---

## Writing Style

Use the following writing style for documentation, comments and README files.

Audience: Software Engineers. Expect half to be native speakers and half non-native speakers.

- Keep the reading level at or below 9th grade (Flesch-Kincaid)
- Write in clear, concise, active voice; don't assume passive voice reads well
- Keep noun phrases short and avoid stacked modifiers
- Limit embedded clauses to one level
- Use conditionals sparingly and stick to simple if/then forms; avoid mixed or inverted versions
- Use transition words (however, therefore, because) to show logic instead of expecting readers to infer it
- Spread new ideas across sentences; avoid packing many concepts into one
- Explain cultural references and idioms so readers with different backgrounds understand them
- Do not end list items with a period
- Do not use emojis
- Do not write obvious comments; explain why, not how or what

---

## Instructions

- Use the `tmp` folder in the repository to store temporary files during execution and planning if needed
- Never run deploy commands
- Run lint, test, compile, and format at the end of each task using the root scripts unless a workspace requires a specific command; if any fail, fix the issues and run the commands again
- Generate a concise summary at the end. Do not be verbose. Save tokens for the next task
- **ALWAYS respect component isolation - work on only one component at a time**
- **Create cross-component tickets instead of making direct changes to other components**

---

## Commands

- `pnpm lint`: Run linting
- `pnpm test`: Run tests
- `pnpm typecheck`: Compile the project
- `pnpm check`: Run lint, test, and typecheck

