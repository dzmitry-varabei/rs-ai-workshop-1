# Telegram Bot

The Telegram bot helps users learn unknown words using spaced repetition.

## Linking accounts

We need to link a web user (Supabase `auth.users`) with a Telegram chat.

Basic flow:

1. User clicks "Connect Telegram bot" in the web app.
2. Backend generates a short code and stores it with `user_id`.
3. User opens the bot and sends the code (or uses a deep link).
4. Bot finds the code, reads `user_id`, and stores `telegram_chat_id` in `profiles`.

After linking, the bot can fetch the user's unknown words and SRS items.

## SRS workflow

1. Bot periodically queries SRS items where `next_review_at <= now` for the given user.
2. For each item, the bot loads the corresponding `word` and (optionally) `pronunciation` and examples.
3. Bot sends a message:

   ```text
   I'd like some coffee. I need the **boost**.

   ||Я бы выпил кофе. Мне нужен заряд бодрости.||  (spoiler)
   ```

with inline buttons:

* 😰 Hard
* 🤔 Normal
* 👍 Good
* 😎 Easy

4. When the user presses a button, the bot:
- calls the SRS scheduler to compute the next interval and `next_review_at`;
- updates the corresponding `srs_items` row.

Message format with spoilers and inline buttons follows the original workshop specification.

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

