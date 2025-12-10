# Contributing

## Getting started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Configure Supabase:

   * create a Supabase project,
   * run migrations from `supabase/migrations`,
   * set environment variables (`SUPABASE_URL`, `SUPABASE_KEY`, etc.).

3. Run the web app:

   ```bash
   pnpm dev:web
   ```

4. Run the Telegram bot:

   ```bash
   pnpm dev:bot
   ```

## Code style

* TypeScript only.
* Keep business logic in `packages/domain`.
* Keep data access logic in `packages/infra-supabase`.
* Use ESLint + Prettier (configured in the repo).

Before pushing:

```bash
pnpm check
```

## Working with issues

1. Pick an issue and read the linked docs in `docs/`.
2. Leave a short **plan** as a comment.
3. Implement one or two steps from the plan in a **small PR**.
4. Make sure:

   * tests pass,
   * the PR template is fully filled.

## Pull requests

* Use the existing PR template.
* Keep PRs small and focused (ideally ≤ 300–400 lines changed).
* Describe:

  * **What** you changed,
  * **Why** you changed it,
  * **How** you implemented it (short summary of the approach).

If you are an AI agent, please also follow `AGENTS.md`.

