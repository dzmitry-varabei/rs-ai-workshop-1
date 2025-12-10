Я возьму **Supabase (Postgres)** и сразу заложу архитектуру с нормальной моделью данных и слоистой структурой, чтобы потом было легко добавлять произношения, примеры, новые типы упражнений и т.д.

Ниже:

1. Почему Supabase и как выглядит архитектура.
2. Модель данных, заточенная под расширяемость (в т.ч. произношение).
3. Как контролировать работу агентов по шагам и получать понятные PR.
4. Обновлённая структура репозитория.
5. Обновлённые черновики `AGENTS.md`, `docs/*.md`, `CONTRIBUTING.md` и PR‑темплейта.

Всё опирается на исходный воркшоп-план (web‑викторина + бот с интервальным повторением на основе 3000 слов) .

---

## 1. Хранилище и архитектура

### Почему Supabase

Нам нужно:

* общее хранилище для **web‑приложения** и **Telegram‑бота**;
* нормальные связи между сущностями: пользователь, слово, прогресс, повторения;
* возможность ✚1 таблица / ✚1 поле без переделки всего проекта;
* привычный SQL и миграции.

Supabase = Postgres + Auth + JS SDK. Это логично для «реальной» системы, а не демки: можно расти вширь, добавлять новые фичи, анализировать данные.

### Высокоуровневая архитектура

Слои:

* **Domain** (`packages/domain`)
  Чистые TS‑типы и функции:

  * `Word`, `Pronunciation`, `QuizSession`, `SrsItem`, `UserSettings`,
  * сервисы: `srsScheduler`, `quizProgress`, т.п.
* **Infrastructure** (`packages/infra-supabase`)
  Реализация интерфейсов репозиториев поверх Supabase:

  * `WordRepositorySupabase`,
  * `UserProgressRepositorySupabase`,
  * `SrsRepositorySupabase`, и т.п.
* **Apps**

  * `apps/web` — UI викторины (React/Vanilla),
  * `apps/telegram-bot` — бот (Telegraf/grammY).

UI и бот знают только про **интерфейсы доменного слоя**, а не про конкретный Supabase.
Добавляем произношение → меняем доменные типы + одну реализацию репозитория, UI просто начинает использовать новое поле.

---

## 2. Модель данных (Supabase) с прицелом на расширяемость

Схема в Postgres (условно `public`):

### 2.1. Пользователь

```sql
-- auth.users — встроенная таблица Supabase, используем её id

create table profiles (
  id uuid primary key references auth.users(id),
  created_at timestamptz default now(),
  telegram_chat_id text unique,
  timezone text,
  daily_word_limit int default 10
);
```

* web‑юзер создаётся через Supabase Auth (аноним или email).
* бот привязывается через `telegram_chat_id`.

### 2.2. Слова и произношения

```sql
create table words (
  id uuid primary key default gen_random_uuid(),
  text_en text not null,
  level text,                     -- A1/A2/B1 etc (по желанию)
  example_en text,
  example_ru text,
  tags text[] default '{}',       -- темы/категории
  extra jsonb default '{}'        -- запас под любые фичи
);

create table word_pronunciations (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references words(id) on delete cascade,
  locale text not null,           -- 'en-US', 'en-GB'
  ipa text,                       -- /bʊst/
  audio_url text,                 -- ссылка на аудио
  source text,                    -- 'forvo', 'tts', ...
  unique(word_id, locale)
);
```

**Расширяемость:**

* хочешь добавить вторую запись произношения на другой акцент → просто новая строка в `word_pronunciations`;
* хочешь хранить, например, синонимы или темы → добросить поле/JSON в `words` без изменения API.

### 2.3. Статус слова у пользователя (викторина)

```sql
create type word_status as enum ('unknown', 'learning', 'known');

create table user_word_state (
  user_id uuid references profiles(id),
  word_id uuid references words(id),
  status word_status not null,
  last_seen_at timestamptz not null default now(),
  seen_count int not null default 1,
  primary key (user_id, word_id)
);
```

* web‑викторина после свайпа пишет сюда `status` и обновляет `seen_count`, `last_seen_at`.
* это используется и для статистики (сколько известных/неизвестных), и как вход для бота (в SRS надо добавить `unknown`).

### 2.4. SRS (интервальные повторения для бота)

```sql
create type srs_difficulty as enum ('hard', 'normal', 'good', 'easy');

create table srs_items (
  user_id uuid references profiles(id),
  word_id uuid references words(id),
  next_review_at timestamptz not null,
  last_review_at timestamptz,
  interval_minutes int not null,
  difficulty_last srs_difficulty,
  review_count int not null default 0,
  active boolean not null default true,
  primary key (user_id, word_id)
);
```

* Интервалы задаём в минутах (10 мин, 1 день, 3 дня, 7 дней), как в изначальном описании .
* Логика перерасчёта — в чистой функции доменного слоя (см. `docs/spaced-repetition.md` ниже).

### 2.5. (Опционально) Логи сессий викторины

Если хочется красиво формировать PDF «за конкретный прогон», можно добавить:

```sql
create table quiz_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  started_at timestamptz default now(),
  finished_at timestamptz,
  total_words int,
  known_count int,
  unknown_count int
);

create table quiz_answers (
  id uuid primary key default gen_random_uuid(),
  quiz_run_id uuid references quiz_runs(id) on delete cascade,
  word_id uuid references words(id),
  known boolean not null,
  position int,
  created_at timestamptz default now()
);
```

Но это можно оставить как «v2» — в домене заранее предусмотреть `QuizSession`, а таблицы добавить миграцией, когда дойдёте.

---

## 3. Как сделать код расширяемым при изменениях домена

### 3.1. Отдельный доменный слой

В `packages/domain`:

```ts
// word.ts
export type WordId = string & { __brand: 'WordId' };

export interface Pronunciation {
  locale: string;
  ipa?: string;
  audioUrl?: string;
}

export interface Word {
  id: WordId;
  text: string;
  level?: string;
  exampleEn?: string;
  exampleRu?: string;
  tags: string[];
  pronunciations: Pronunciation[]; // <- добавили и всё
}
```

Интерфейсы репозиториев:

```ts
export interface WordRepository {
  getRandomBatch(userId: UserId, limit: number): Promise<Word[]>;
  getByIds(ids: WordId[]): Promise<Word[]>;
}

export interface UserWordStateRepository {
  markKnown(userId: UserId, wordId: WordId): Promise<void>;
  markUnknown(userId: UserId, wordId: WordId): Promise<void>;
  getStats(userId: UserId): Promise<UserWordStats>;
}
```

В `packages/infra-supabase` — **единственное место**, где мы мапим БД → доменные типы:

```ts
export class SupabaseWordRepository implements WordRepository {
  async getRandomBatch(userId: UserId, limit: number): Promise<Word[]> {
    // запрос в words + left join pronunciations
    // маппинг в Word[]
  }
}
```

Теперь:

* добавили поле в БД (например, `example_audio_url`) → поправили маппинг + доменный тип → UI видит новые данные, но структура приложения не рушится;
* Telegram‑бот вообще не знает о Supabase, он работает с `WordRepository` и `SrsScheduler`.

---

## 4. Как контролировать работу агентов по шагам

Тут два уровня: **процесс** и **артефакты в репо**.

### 4.1. Процесс, который ты задаёшь

В AGENTS.md и CONTRIBUTING.md можно прописать:

1. **Маленькие PR:**

   * целевой размер: *до 300–400 строк diff*, не больше 1–2 логических изменений;
   * если нужно сделать больше — разбей задачу на чек‑лист в issue и делай по PR на пункт.

2. **Всегда сначала план → потом код:**

   * агент обязан перед началом работы оставить комментарий в issue/PR:

     > Plan:
     >
     > 1. Update data model (new `word_pronunciations` table, domain types).
     > 2. Implement repository mapping.
     > 3. Expose pronunciation in web UI.
     > 4. Add tests.

3. **PR‑шаблон с объяснениями:**

   * в PR обязательно секции:

     * `What`,
     * `Why`,
     * `How` (краткое описание ключевой логики),
     * `Risks & Trade-offs`.

4. **Требование к тестам:**

   * любая бизнес‑логика (особенно SRS) — с юнит‑тестами;
   * в PR есть чекбокс `- [x] Added/updated tests`.

5. **Комментарии в коде:**

   * на нетривиальных местах агент пишет `// NOTE: ...` (не «что делает», а «почему так»).

6. **Лейблы и шаги:**

   * `ai:wip` — агент работает над задачей;
   * `ai:ready-for-review` — можно ревьюить;
   * `ai:needs-clarification` — если агент сомневается, он обязан задать вопрос.

### 4.2. Артефакты: что добавить в репо

* `AGENTS.md` — инструкция для агентов, куда смотреть, как работать (ниже дам черновик).
* `.github/pull_request_template.md` — заставляет агента объяснять код.
* `docs/decisions/` — папка для мини‑ADR:

  * `docs/decisions/0001-use-supabase.md` — объяснение, почему именно Supabase;
  * по желанию можно просить агента добавлять ADR на крупные архитектурные изменения.
* GitHub Action (опционально) — чтобы:

  * ругаться, если PR > N строк;
  * проверять, что заполнен PR‑темплейт.

Так ты всегда видишь:

* **какой этап** сейчас делается (по чек‑листу и лейблам);
* **почему** код именно такой (ADR + секция `Why` в PR).

---

## 5. Обновлённая структура репозитория

```txt
.
├── apps/
│   ├── web/                 # Веб‑викторина
│   └── telegram-bot/        # Telegram-бот с SRS
├── packages/
│   ├── domain/              # Чистые доменные типы/сервисы
│   └── infra-supabase/      # Репозитории поверх Supabase
├── docs/
│   ├── overview.md
│   ├── web-app.md
│   ├── telegram-bot.md
│   ├── spaced-repetition.md
│   ├── data-model.md
│   └── decisions/
│       └── 0001-use-supabase.md (опционально)
├── supabase/                # схема БД и миграции
│   ├── migrations/
│   └── seed/
├── .github/
│   ├── workflows/
│   └── pull_request_template.md
├── AGENTS.md
├── CONTRIBUTING.md
├── package.json
└── pnpm-workspace.yaml
```

---

## 6. Черновики MD‑файлов (уже с Supabase и контролем агентов)

Ниже — готовые черновики, которые можно почти как есть класть в репо.

---

### `AGENTS.md`

```md
# AGENTS.md

## Who you are

You are an AI developer working on the **English Learning System**:

- a web quiz app to quickly test English vocabulary knowledge;
- a Telegram bot that uses spaced repetition to help users learn unknown words.

You work as a remote teammate with limited context: **you only see this repo**.
Always prefer reading existing docs and code over guessing.

---

## Repository map

- `apps/web`
  - Vocabulary quiz UI (cards, swipe / keyboard / touch).
  - Shows words from the shared dictionary.
  - Updates user word status (`known` / `unknown`) in the database.
  - Exports results to PDF.
- `apps/telegram-bot`
  - Telegram bot that:
    - reads unknown words for a user;
    - schedules reviews using spaced repetition;
    - sends messages with examples and translations (with Telegram spoilers);
    - uses inline buttons to collect difficulty.
- `packages/domain`
  - Pure TypeScript types and business logic:
    - word model, pronunciations, quiz stats, SRS scheduler, etc.
- `packages/infra-supabase`
  - Implementations of domain repositories using Supabase (Postgres).
- `docs/`
  - `overview.md` — high-level architecture and use cases.
  - `web-app.md` — quiz behaviour and UI details.
  - `telegram-bot.md` — bot flows and message formats.
  - `spaced-repetition.md` — SRS algorithm.
  - `data-model.md` — database schema and relations.
- `supabase/`
  - Database migrations and seed data.

Start with `docs/overview.md`, then read the doc that matches the area you’re touching.

---

## Tech stack

- Language: **TypeScript** only.
- Package manager: **pnpm**.
- Storage & backend: **Supabase (Postgres + Auth)**.
- Web: React + Vite (or similar).
- Bot: Node.js + Telegraf/grammY, talking to Supabase.
- Linting: ESLint + Prettier.
- Tests: Vitest/Jest.

### Common scripts

From the repo root:

- `pnpm dev:web` — start web app dev server.
- `pnpm dev:bot` — start Telegram bot in dev mode.
- `pnpm lint` — lint all packages.
- `pnpm typecheck` — run TypeScript checks.
- `pnpm test` — run unit tests.
- `pnpm check` — run `lint`, `typecheck`, and `test`.

Always run `pnpm check` before finishing your work.

---

## How to work on issues (step-by-step control)

When you get an issue:

1. **Understand the domain**
   - Read `docs/overview.md`.
   - Read the specific doc: `web-app.md`, `telegram-bot.md`, `spaced-repetition.md`, or `data-model.md`.

2. **Post a short plan before coding**
   - Add a comment to the issue or PR:

     > Plan:
     > 1. Update domain types for X.
     > 2. Update Supabase repository implementation.
     > 3. Update web/bot to use the new field.
     > 4. Add tests and docs.

3. **Work in small steps**
   - Aim for PRs with **≤ 300–400 lines changed**.
   - Each PR should address **1–2 logical steps** from the issue.
   - If the issue is too big, suggest splitting it.

4. **Keep changes localized**
   - Prefer changing `packages/domain` and `packages/infra-supabase` instead of duplicating logic in apps.
   - For database changes:
     - add/modify migration in `supabase/migrations`;
     - update `docs/data-model.md`;
     - update mapping code in `packages/infra-supabase`.

5. **Explain non-obvious decisions**
   - Use comments like `// NOTE: why this approach is chosen`.
   - In the PR description, fill in the `Why` and `How` sections.

---

## Quality bar

- No TypeScript errors.
- No ESLint errors.
- New logic covered by unit tests.
- Database migrations are included and documented when schema changes.
- Web remains keyboard and touch friendly.
- Telegram bot handles errors gracefully (no crashes on unexpected data).

---

## Git and pull requests

- Use branches: `feature/<issue-number>-short-name` or `fix/<issue-number>-short-name`.
- Commit messages in English, describing what changed.
- Pull requests:
  - link the issue (e.g. `Closes #123`);
  - keep the diff small and focused;
  - fill in the PR template (What / Why / How / Checklist);
  - attach screenshots or bot message examples if UI/UX changed.

---

## If you are unsure

If something is unclear:

1. Re-read the relevant doc in `docs/`.
2. Search the repo for existing patterns.
3. Leave a comment in the issue / PR describing:
   - what is unclear,
   - what options you see,
   - which option you prefer and why.

Do **not** implement complex features without leaving a plan and getting feedback.
```

---

### `docs/overview.md`

```md
# Overview

We are building an ecosystem for learning English vocabulary:

1. A **web quiz app** that shows words from a 3000‑word frequency list and lets the user mark whether they know each word.
2. A **Telegram bot** that uses spaced repetition (SRS) to help the user learn unknown words over time.

Originally the prototype used `localStorage` and sqlite as storage; in this repository we use **Supabase (Postgres)** as the shared backend for both the web app and the bot. :contentReference[oaicite:2]{index=2}

## High-level flow

1. User opens the web quiz.
2. The app shows words one by one (card UI, swipe/keyboard/touch).
3. For each word the user marks:
   - "know" → status `known`,
   - "don't know" → status `unknown`.
4. The app stores the word status in Supabase.
5. Unknown words are used to create/update SRS items for the Telegram bot.
6. The user links their Telegram account with the web account.
7. The bot sends review messages with examples and translations.
8. The user rates difficulty (4 levels), which adjusts future intervals.

## Main components

- `apps/web` — quiz UI, stats, PDF export.
- `apps/telegram-bot` — SRS bot.
- `packages/domain` — shared business logic.
- `packages/infra-supabase` — data access layer.
- `supabase` — database schema and migrations.

See also:

- `docs/web-app.md` — details of the quiz and stats.
- `docs/telegram-bot.md` — bot flows and message formats.
- `docs/spaced-repetition.md` — SRS algorithm.
- `docs/data-model.md` — tables and relations.
```

---

### `docs/web-app.md`

```md
# Web Quiz App

The web app is a Tinder-like quiz for English words. It helps the user quickly estimate how many of the 3000 most frequent words they know. :contentReference[oaicite:3]{index=3}

## UI behaviour

- The app shows one **card** at a time:
  - front: English word (and optionally pronunciation / IPA later);
  - subtle hint about controls.
- Controls:
  - mouse: drag card left/right;
  - keyboard: left/right arrows;
  - touch: swipe left/right.
- Actions:
  - right → "I know this word";
  - left → "I don't know this word".
- Animations:
  - smooth slide off screen and next card appearing.

## Data source

- Words are loaded from the shared dictionary in Supabase (`words` table).
- Optional fields (examples, pronunciations, tags) may or may not be present.
- The app should handle missing optional data gracefully.

## Progress and stats

The app shows:

- progress bar: `current index / total words`,
- counters:
  - total seen words,
  - known words,
  - unknown words,
  - knowledge percentage.

Progress is computed from `user_word_state` for the current user.

## Persistence (Supabase)

Instead of storing results in `localStorage`, the app:

- authenticates the user via Supabase (anonymous auth is enough);
- writes status for each word:

  - known → `status = 'known'`,
  - unknown → `status = 'unknown'`,

  by upserting rows in `user_word_state`.
- optionally creates/updates SRS items for unknown words.

## PDF export

The app supports exporting results as a PDF:

- list of known words,
- list of unknown words,
- date/time of the test,
- optional summary stats.

Implementation detail:

- PDF is generated on the client using a JS library.
- Data for export comes from Supabase (fresh query), not from local state.

## Reset and resume

- **Reset progress** button:
  - shows a confirmation modal;
  - removes all `user_word_state` records for the current user (or marks them as reset).
- **Resume**:
  - when the user returns, the app:
    - fetches `user_word_state`,
    - starts the quiz from the first not-yet-seen word.
```

---

### `docs/telegram-bot.md`

````md
# Telegram Bot

The Telegram bot helps users learn unknown words using spaced repetition.

## Linking accounts

We need to link a web user (Supabase `auth.users`) with a Telegram chat.

Basic flow:

1. User clicks "Connect Telegram bot" in the web app.
2. Backend generates a short code and stores it with `user_id`.
3. User opens the bot and sends the code (or uses a deep link).
4. Bot finds the code, reads `user_id`, and stores `telegram_chat_id` in `profiles`.

After linking, the bot can fetch the user’s unknown words and SRS items.

## SRS workflow

1. Bot periodically queries SRS items where `next_review_at <= now` for the given user.
2. For each item, the bot loads the corresponding `word` and (optionally) `pronunciation` and examples.
3. Bot sends a message:

   ```text
   I'd like some coffee. I need the **boost**.

   ||Я бы выпил кофе. Мне нужен заряд бодрости.||  (spoiler)
````

with inline buttons:

* 😰 Hard
* 🤔 Normal
* 👍 Good
* 😎 Easy

```

4. When the user presses a button, the bot:
- calls the SRS scheduler to compute the next interval and `next_review_at`;
- updates the corresponding `srs_items` row.

Message format with spoilers and inline buttons follows the original workshop specification. :contentReference[oaicite:4]{index=4}

## Scheduling and settings

User settings (in `profiles` or a separate settings table) may include:

- `timezone`,
- preferred delivery window (e.g. 09:00–21:00),
- `daily_word_limit`.

The bot should respect these settings when selecting which items to send.

If the user does not answer a message before the next run:

- the word is rescheduled (e.g. `next_review_at` moves into the future by a small amount),
- the old message may be deleted or left as is (configurable).

## Additional features (optional)

- Pause/resume learning for a user.
- Stats command (`/stats`) showing:
- total items,
- items due today,
- success rate.
- Commands for managing vocabulary:
- add/remove words manually,
- list active words.
```

---

### `docs/spaced-repetition.md`

````md
# Spaced Repetition (SRS) Algorithm

The bot uses a simple 4-level difficulty SRS algorithm inspired by Anki. :contentReference[oaicite:5]{index=5}

## Difficulty levels and base intervals

For each review, the user picks one of 4 options:

- 😰 Hard    → repeat after 10 minutes
- 🤔 Normal  → repeat after 1 day
- 👍 Good    → repeat after 3 days
- 😎 Easy    → repeat after 7 days

Internally we store intervals in minutes:

- Hard: `10`
- Normal: `1 * 24 * 60`
- Good: `3 * 24 * 60`
- Easy: `7 * 24 * 60`

## Data model

(See `docs/data-model.md` for table details.)

Relevant fields in `srs_items`:

- `user_id`, `word_id`
- `next_review_at` — when the item is due next
- `last_review_at` — when it was reviewed last time
- `interval_minutes` — current interval
- `difficulty_last` — last chosen difficulty
- `review_count` — how many times the user has reviewed this word

## Scheduling rules

Initial creation:

- When a word becomes `unknown` in the quiz, we either:
  - create a new SRS item with:
    - `interval_minutes = 10`,
    - `next_review_at = now() + interval_minutes`,
  - or reuse existing item if it already exists.

Review update (simplified):

```ts
function scheduleNextReview({
  now,
  previousIntervalMinutes,
  previousReviewCount,
  difficulty,
}: {
  now: Date;
  previousIntervalMinutes: number;
  previousReviewCount: number;
  difficulty: 'hard' | 'normal' | 'good' | 'easy';
}): {
  nextIntervalMinutes: number;
  nextReviewAt: Date;
} {
  const base = {
    hard: 10,
    normal: 1 * 24 * 60,
    good: 3 * 24 * 60,
    easy: 7 * 24 * 60,
  }[difficulty];

  // Simple rule: multiply base by a factor that grows with review_count.
  const factor = Math.max(1, previousReviewCount);
  const nextIntervalMinutes = base * factor;

  return {
    nextIntervalMinutes,
    nextReviewAt: addMinutes(now, nextIntervalMinutes),
  };
}
````

This logic lives in `packages/domain/srs.ts` and is tested with unit tests.

## Extensibility

To change or extend the algorithm:

* Update the domain function in `packages/domain/srs.ts`.
* Update tests to reflect the new behaviour.
* No changes are required in the Telegram bot except for using new fields if needed.

Examples of possible extensions:

* Different schedules per user level (A1 vs B2).
* Extra difficulty options.
* Tag-based priorities (e.g. focus on business vocabulary).

````

---

### `docs/data-model.md`

```md
# Data Model

This document describes the main tables in the Supabase (Postgres) database.

## Users

- `auth.users` — managed by Supabase Auth.
- `profiles`
  - `id` (uuid, PK, references `auth.users.id`)
  - `created_at` (timestamptz)
  - `telegram_chat_id` (text, unique, nullable)
  - `timezone` (text)
  - `daily_word_limit` (int)

## Words

- `words`
  - `id` (uuid, PK)
  - `text_en` (text)
  - `level` (text, optional)
  - `example_en` (text, optional)
  - `example_ru` (text, optional)
  - `tags` (text[])
  - `extra` (jsonb) — reserved for future properties

- `word_pronunciations`
  - `id` (uuid, PK)
  - `word_id` (uuid, FK → `words.id`)
  - `locale` (text)
  - `ipa` (text, optional)
  - `audio_url` (text, optional)
  - `source` (text, optional)

## User word state (quiz)

- `user_word_state`
  - `user_id` (uuid, FK → `profiles.id`)
  - `word_id` (uuid, FK → `words.id`)
  - `status` (`word_status` enum: `unknown`, `learning`, `known`)
  - `last_seen_at` (timestamptz)
  - `seen_count` (int)

PK: (`user_id`, `word_id`).

## Spaced repetition

- `srs_items`
  - `user_id` (uuid, FK → `profiles.id`)
  - `word_id` (uuid, FK → `words.id`)
  - `next_review_at` (timestamptz)
  - `last_review_at` (timestamptz, nullable)
  - `interval_minutes` (int)
  - `difficulty_last` (`srs_difficulty` enum)
  - `review_count` (int)
  - `active` (boolean)

PK: (`user_id`, `word_id`).

## Optional: quiz sessions

If needed, we can add:

- `quiz_runs`
- `quiz_answers`

See comments in `docs/overview.md` for how they would be used.
````

---

### `CONTRIBUTING.md`

````md
# Contributing

## Getting started

1. Install dependencies:

   ```bash
   pnpm install
````

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

````

---

### `.github/pull_request_template.md`

```md
## What

<!-- Short summary of the change. -->

## Why

<!-- Why is this change needed? Reference the issue and explain the reasoning. -->

## How

<!-- High-level explanation of the approach, important design decisions, and trade-offs. -->

## Screenshots / Bot messages (if applicable)

<!-- Add screenshots or example bot messages to illustrate the change. -->

## Checklist

- [ ] I ran `pnpm check` (lint, typecheck, tests).
- [ ] I updated or added tests for the new behaviour.
- [ ] I updated relevant docs (`docs/*.md`), if needed.
- [ ] Changes are reasonably small and focused.
````

---