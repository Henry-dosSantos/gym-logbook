# Logbook

A workout log for the phone. The log is one plain-text document that you type; the app shows suggestions as ghost text and the weights from your last two sessions, and never rewrites what you wrote.

Live: https://henry-dossantos.github.io/gym-logbook/

## Install on iPhone

1. Open the URL in Safari.
2. Tap Share, then Add to Home Screen.
3. Open Logbook from the Home Screen.

iOS gives the Home Screen app its own storage, separate from Safari. Import your log after installing: menu, Import, paste, Replace.

## Log format

```
11/21
Push
Optional note line
Bench-290-3/270-5/245-9/
Incline db-100-6/
Superset:
    Tricep pushdowns-175-6/175-6/
    Db lat raises-35-10/35-9/
```

A date line starts an entry, the next line is the day type, then one exercise per line as `name-weight-reps/weight-reps/`. A weight ending in `s` is a dumbbell pair (`60s`). `max` in the weight slot is suggested again as `max` and never incremented. `3x6-8` is shorthand with no weights. Anything else is a free note. Parentheticals are ignored when parsing and kept in the text.

## Keys

- Enter accepts the ghost text, otherwise inserts a new line.
- Space accepts the ghost text while typing numbers, otherwise types a space.
- The bar has `-`, `/`, Accept and a new line button. New line never accepts.

## Suggestions

- New entry: today's date.
- Day line: your past day types, ranked by what usually follows the previous entry's day type.
- Empty line in an entry: the next exercise from your last session of the same day type.
- Weights: last session's weight for that set. Set 1 goes up when the last two sessions used the same weight and both hit the target reps.
- Target reps, increments and aliases are editable under menu, Settings.

## Backup

The log lives only on the device, in IndexedDB. Use menu, Copy all or Export to keep a copy elsewhere. Export shares the log as a .txt file and the settings as a second .json file.

## Lint

Menu, Lint lists lines the parser could not make sense of (dates out of order, a wrong year, sets with no exercise name, a missing dash, a bad number). Tap one to jump to it. Nothing is ever fixed automatically.

## Development

```
npm run dev
npm test
npm run e2e
npm run build
```

Tests that need `tests/fixtures/gym-2026.txt` skip when that private file is absent.

## Privacy

No backend, no accounts, no analytics. After the first load the app makes no network requests and works offline.
