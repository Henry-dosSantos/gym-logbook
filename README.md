# Logbook

A workout log for the phone. The log is one plain-text document that you type; the app shows suggestions as ghost text and the weights from your last two sessions, and never rewrites what you wrote.

Live: https://henry-dossantos.github.io/gym-logbook/

## Install on iPhone

1. Open the URL in Safari.
2. Tap Share, then Add to Home Screen.
3. Open Logbook from the Home Screen. Hold a finger on the empty page and tap Paste, or tap Paste in the bar at the bottom, to load a log you copied.

iOS gives the Home Screen app its own storage, separate from Safari, so paste your log after installing.

The log scrolls behind the status bar and the Dynamic Island, so text shows to the left and right of it. iOS may still draw its own dark fade there (iOS 26.1 and later); web apps cannot remove it. If the top is still black after an update, copy your log (bar, Copy all), remove the app from the Home Screen, add it again, and paste the log back: iOS reads the status bar setting only when the app is added, and removing the app deletes its data.

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
- Day line: whichever of Push, Pull and Legs you did longest ago, shown as soon as the line is empty (after Push, Pull, Legs it suggests Push; after Push, Pull, Legs, Push it suggests Pull). An entry counts as one of the three if its day line contains the word (Heavy push, Pull at 11:35), or, when it has no day line, if one of its lines starts with it (Legs-405-2/). Typing narrows it: P picks whichever of Push and Pull is older. Other day types are suggested from your history once you type their first letters.
- Empty line in an entry: the next exercise from your last session of the same day type. Only in today's entry (or yesterday's before 4 am).
- Weights: last session's weight for that set. Set 1 goes up when the last two sessions used the same weight for at least the target reps (odd stack weights go to the next weight you have logged).
- The global rule (reps to hit, how much to add) lives under Settings (bar, last button), Progression. Individual exercises can have their own rule under Custom rules; Reset to default on an exercise removes its rule, and Reset all to default (with a confirm) removes every one. Merged names combines spellings into one exercise.

## Tapping the page

A tap on empty space in the log, or holding a finger there for Paste and Copy, sends a faint ripple out from your finger.

## Backup

The log lives only on the device, in IndexedDB. Use Copy all in the bar to keep a copy elsewhere. Copy day copies today's entry, or the latest one.

## Bar

The frosted bar at the bottom has six buttons: Dashboard, Copy day, Copy all, Paste, Lint and Settings. It hides while the keyboard is open. Copy and paste show a check mark when they finish.

Dashboard and Settings open a sheet that rises to half the screen. Pull it up by the handle (or anywhere on it while it is at half height) to make it full screen; pull it down to go back to half or close it. Tapping a text field makes it full screen.

## Lint

Lint in the bar opens a panel on the bottom half of the screen and leaves the log visible above it. It lists lines the parser could not make sense of (dates out of order, a wrong year, sets with no exercise name, a missing dash, a bad number). The log jumps to the flag you are on and highlights the line, so you can see it in context. Fix applies the suggested change and moves to the next flag (Enter does the same on a hardware keyboard); the arrows step through the flags; Edit closes the panel with the cursor at the end of that line. Tapping the log, the close button, or pulling the panel down closes it. Nothing changes unless you confirm.

## Dashboard

Dashboard in the bar lists every exercise with a small trend line and its latest set 1 as weight × reps. Tap one for two stacked charts per session, set 1 weight on top and set 1 reps under it; drag across either to read any session. Sessions at `max` or without a weight leave a gap in the weight chart.

The toggle at the top switches the list and every exercise between Weight × reps and 1RM. 1RM is an estimated one-rep max from the best set of each session, using the Wathan equation, shown under the toggle in 1RM mode (`1RM = 100w / (48.8 + 53.8e^(-0.075r))`), which LeSuer et al. (1997) found closest to measured maxes along with Mayhew. Sets at `max` or without a weight have no estimate, and for weighted-only exercises like weighted pull ups the estimate leaves out body weight. Estimates are less reliable above 10 reps.

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
