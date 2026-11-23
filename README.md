# Logbook

A workout log for the phone. The log is one plain-text document that you type; the app shows suggestions as ghost text and the weights from your last two sessions, and never rewrites what you wrote.

Live: https://henry-dossantos.github.io/gym-logbook/

## Install on iPhone

1. Open the URL in Safari.
2. Tap Share, then Add to Home Screen.
3. Open Logbook from the Home Screen. Hold a finger on the empty page and tap Paste, or tap Paste in the bar at the bottom, to load a log you copied.

iOS gives the Home Screen app its own storage, separate from Safari, so paste your log after installing.

iOS draws its own dark fade under the status bar in Home Screen web apps (iOS 26.1 and later). Web apps cannot remove it. If the top looks wrong after an update, copy your log (bar, Copy all), remove the app from the Home Screen, add it again, and paste the log back: iOS only reads some settings when the app is added, and removing the app deletes its data.

The bar iOS shows above the keyboard (arrows and a checkmark) belongs to Safari; web apps cannot hide it. A native wrapper can (Capacitor: Keyboard.setAccessoryBarVisible).

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
- Space accepts while typing numbers, otherwise types a space.
- Typing anything else that does not match hides the suggestion. A space on an empty line dismisses the next-exercise suggestion.
- Suggestions never repeat an exercise already in today's entry, including a longer or shorter name of the same exercise (Chin ups and Weighted chin ups).
- Backspace on an empty line removes the suggestion without deleting anything. Enter then starts a new line. A line right after a blank line gets no next-exercise suggestion.

## Suggestions

- New entry: today's date.
- Day line: your past day types, ranked by what usually follows the previous entry's day type.
- Empty line in an entry: the next exercise from your last session of the same day type. Only in today's entry (or yesterday's before 4 am).
- Weights: last session's weight for that set. Set 1 goes up when the last two sessions used the same weight for at least the target reps (odd stack weights go to the next weight you have logged).
- The global rule (reps to hit, how much to add) lives under Settings (bar, last button), Progression. Individual exercises can have their own rule under Custom rules, and Merged names combines spellings into one exercise.

## Backup

The log lives only on the device, in IndexedDB. Use Copy all in the bar to keep a copy elsewhere. Copy day copies today's entry, or the latest one.

## Bar

The frosted bar at the bottom has six buttons: Dashboard, Copy day, Copy all, Paste, Lint and Settings. It hides while the keyboard is open. Copy and paste show a check mark when they finish.

## Lint

Lint in the bar lists lines the parser could not make sense of (dates out of order, a wrong year, sets with no exercise name, a missing dash, a bad number). Tap one to see a suggested fix. Press Enter or tap Fix to apply it and move to the next one, or Show in log to jump to the line. Nothing changes unless you confirm.

## Dashboard

Dashboard in the bar lists every exercise with a small trend line. Tap one for the full chart of top-set weight or reps per session; drag across the chart to read any session.

## Platform adapter

Storage, clipboard and haptics go through one interface, `Platform` in `src/platform/index.ts`. The web implementation is `src/platform/web.ts` (IndexedDB, Clipboard API, `navigator.vibrate`, service worker registration). To wrap the app natively, write another implementation of `Platform` and change the one line in `src/platform/index.ts` that selects it. The editor, parser and suggestion engine never touch these APIs.

- `start`: one-time setup.
- `load`, `save`: key-value store for JSON-serializable values (keys `text`, `settings`).
- `copy`: must run synchronously inside a user gesture.
- `paste`: reads text from the clipboard; must be called inside a tap; resolves with null if unavailable or declined.
- `haptic`: light tap, no-op where unsupported.

## Design

Black, white and grey only, IBM Plex Mono, Lucide icons. Frosted glass appears only on elements with the `glass` class (the bar, the sheets and the last-session strip). No gradients, shadows or glows.

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
