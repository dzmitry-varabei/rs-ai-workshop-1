# Web Quiz App

The web app is a Tinder-like quiz for English words. It helps the user quickly estimate how many of the 3000 most frequent words they know.

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

