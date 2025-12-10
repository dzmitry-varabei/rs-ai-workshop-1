# Spaced Repetition (SRS) Algorithm

The bot uses a simple 4-level difficulty SRS algorithm inspired by Anki.

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
```

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

