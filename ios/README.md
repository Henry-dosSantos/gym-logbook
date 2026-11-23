# Dossier for iOS (native, SwiftUI)

The start of the native App Store version of Dossier. The web app in `src/` stays the live version until this ships.

> **Status: unbuilt and untested.** This was written on a Windows PC with no Swift toolchain, so none of the Swift
> here has been compiled, and none of the tests have run. Expect a round of compile fixes on the Mac. The first job
> there is `swift test` in `ios/DossierCore` (see below) until it passes.

## What is here

```
ios/
  DossierCore/                Swift package, no UIKit
    Package.swift
    Sources/DossierCore/      the port of src/core
    Sources/DossierStore/     saving the log as a file, byte for byte
    Tests/DossierCoreTests/   the port of tests/unit
    Tests/DossierStoreTests/  the storage round trip
  Dossier/                    the SwiftUI app
    project.yml               XcodeGen spec (generates Dossier.xcodeproj, which is not committed)
    Sources/                  app entry, editor screen, model, intro, theme
    Resources/                AppIcon (1024 px), PrivacyInfo.xcprivacy
  scripts/make_icon.py        renders the 1024 px icon from design/dossier-mark
```

### DossierCore: the port of `src/core`

Same behaviour as the TypeScript, function for function, so the two apps suggest and flag the same things.

| TypeScript              | Swift                                        |
| ----------------------- | -------------------------------------------- |
| `types.ts`              | `Types.swift`                                |
| `parse.ts`              | `Parse.swift`                                |
| `history.ts`            | `History.swift`                              |
| `suggest.ts`            | `Suggest.swift`                              |
| `fix.ts`                | `Fix.swift`                                  |
| `settings.ts`           | `SettingsRules.swift` (`DEFAULT_SETTINGS` is `defaultSettings`) |
| `stats.ts`              | `Stats.swift`                                |
| `onerm.ts`              | `OneRM.swift` (Wathan formula)               |
| `chart.ts`              | `Chart.swift`                                |
| `dossier-mark.ts`       | `DossierMark.swift` (intro numbers unchanged) |
| (none)                  | `JS.swift`: JavaScript string and regex semantics |

How it keeps the TypeScript's behaviour:

- **Offsets are UTF-16 code units**, as in JavaScript. `Line.from`/`to` and the cursor passed to `suggest` are
  UTF-16 offsets, which is also what `UITextView.selectedRange` gives, so the cursor goes straight in.
- **`Line` and `Entry` are classes**, because the parser shares them by reference (an entry's `dayLine` is the
  same object as the line in `doc.lines`; `suggest` compares lines by identity).
- **Regular expressions** use `NSRegularExpression` through a small `Re` wrapper with "\n" as the only line
  separator, so `$` means the end of the line as in JavaScript. Patterns spell digits `[0-9]`, since ICU's `\d`
  also matches non-ASCII digits.
- **Maps keep insertion order** where the TypeScript relied on it (`spellingIndex`'s `latest` becomes `latest`
  plus `order`), and sorts are stable like `Array.prototype.sort`.
- **Settings** encode to the same JSON as the web app's, so an export from one reads in the other.
- **Dates**: `suggest` and `todayText` take a `Calendar` (local time by default) where the TypeScript read local
  time off a `Date`.

Known differences, all at the edges: ICU's `\s` lacks `\v` and U+FEFF (JavaScript's has them); `\b` uses Unicode
word characters; Swift's `==` on strings treats canonically equivalent Unicode as equal; exercise names with equal
session counts sort with `compare(locale: en)` instead of `localeCompare`.

### Tests

Every case in `tests/unit` that tests `src/core` is ported with the same expectations:
`parse`, `suggest`, `fix`, `related`, `checkpoint3` (`todayText`, `exerciseList`), `fixture`, `settings`, `stats`,
`chart`, `dossier-mark`. Not ported: `effectiveTopInset` (tests the web's `src/viewport.ts`),
`platform-boundary` (a web lint rule), and the CodeMirror half of `roundtrip` (the storage half is
`DossierStoreTests`).

The fixture tests read `tests/fixtures/gym-2026.txt` from the repo (Henry's private log, gitignored) and **skip when
it is absent**. Set `DOSSIER_FIXTURE=/path/to/file` to read it from elsewhere. Never copy it into `ios/`.

### The app skeleton (`ios/Dossier`)

Small on purpose. What it does:

- **Editor**: the whole log in a `UITextView`, IBM Plex Mono 17 pt with 1.5 line height, white on black. Autocorrect,
  smart quotes, smart dashes, spell check and inline prediction are all off, so iOS never changes what is typed.
- **Suggestions**: on every edit and cursor move it parses the text and calls `suggest`. Enter accepts the ghost
  (else breaks the line), Space accepts ghosts marked `space`, Backspace on an empty line hides the ghost: the same
  keys as the web editor. Accepting inserts the text as if typed, so Undo removes it.
- **Storage**: `Application Support/Dossier/text.txt` (UTF-8, atomic writes), saved 0.4 s after the last edit and
  whenever the app leaves the foreground. Settings come from `settings.json` beside it, else the defaults.
- **Intro**: the D's halves glide in and lock, driven by `introAt`, then fade over 0.24 s with
  `cubic-bezier(0.32, 0.72, 0, 1)`. Under Reduce Motion the finished mark shows for 0.4 s. It never blocks taps.

What is stubbed or missing (each is a TODO for the Mac):

- **Inline ghost text.** For now the ghost shows in a bar above the keyboard (tap to accept), with the strip of the
  last two sessions under it. See "Needs the Mac" for the inline version.
- No lint panel (the core's `doc.flags` and `suggestFix` are ready), no stats or dashboard screen (`dashboardItems`,
  `exerciseSeries`, `chartGeometry` are ready), no settings sheet, no export or share.
- No haptics, no keyboard accessory bar, no "accepted" highlight.
- IBM Plex Mono is not bundled yet: it falls back to the system monospaced font. Add `IBMPlexMono-Regular.ttf` and
  `IBMPlexMono-SemiBold.ttf` (from github.com/IBM/plex, SIL Open Font License) to `Dossier/Resources/`; any
  `.ttf` there is registered at launch. Credit the licence in the app's acknowledgements.
- First launch starts with an empty log. To move the log over, copy it from the web app and paste it in.

## On the Mac

1. Install Xcode (from the App Store) and XcodeGen: `brew install xcodegen`.
2. Build and test the core first:
   ```
   cd ios/DossierCore
   swift test
   ```
   Or open `ios/DossierCore/Package.swift` in Xcode and press Cmd-U. Fix compile errors until every test passes
   (the fixture tests too, with `tests/fixtures/gym-2026.txt` in place).
3. Generate and open the app project:
   ```
   cd ios/Dossier
   xcodegen generate
   open Dossier.xcodeproj
   ```
   Run it on an iPhone 15/16 simulator, then on Henry's iPhone (needs signing, below).

### Needs the Mac

- **Xcode, the simulator, and a device run.** Nothing above has been compiled.
- **Signing**: set `DEVELOPMENT_TEAM` and a real bundle id in `project.yml` (the current one is a placeholder).
- **Inline ghost text with TextKit 2.** Draw the ghost after the caret without putting it in the text storage
  (for example a custom `NSTextLayoutFragment`, or a label positioned at `caretRect(for:)`). Do not insert
  placeholder text into the document: on the web, a widget in the text broke native long-press Paste, which is why
  the web ghost is a CSS `::after`. Check long-press Paste on a device after this change.
- **Keyboard accessory bar** (`inputAccessoryView`) for the suggestion bar and the lint and stats buttons, and its
  frosted glass look (`.ultraThinMaterial` is the closest native match to the web's `.glass`).
- **Haptics** (`UIImpactFeedbackGenerator`) on accepting a ghost; iOS Safari never allowed these on the web.
- **Speed**: the parser runs on every keystroke on the main thread. Profile with the full log in Instruments; if
  typing lags, parse off the main thread or reparse only the edited entry.
- **Real iOS behaviour** that the simulator does not prove: keyboard Enter, long-press Paste, safe areas and the
  Dynamic Island, Home Screen launch, offline use.

## App Store checklist

- [ ] Join the **Apple Developer Program** (USD 99 a year, as an individual).
- [ ] Choose the **bundle id** (a reverse domain Henry controls, e.g. `com.<domain>.dossier`), put it in
      `project.yml`, and register the App ID in the developer portal.
- [ ] Set `DEVELOPMENT_TEAM` in `project.yml`; use automatic signing.
- [ ] In App Store Connect, create the app with the name **"Dossier"**. If that name is taken, use the fallback
      **"Dossier: Gym Log"**; the home-screen name stays "Dossier" (`CFBundleDisplayName`). Category: Health &
      Fitness.
- [ ] **Icon**: `Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png` is already rendered from
      `design/dossier-mark` (white D on black, opaque, same layout as the web icons). Rerun
      `python ios/scripts/make_icon.py` if the mark changes. Xcode makes the smaller sizes.
- [ ] **Privacy**: `Resources/PrivacyInfo.xcprivacy` declares no tracking, no tracking domains, no collected data
      and no required-reason APIs. If code later uses `UserDefaults`, file timestamps or similar, add the
      required-reason entry. In App Store Connect, answer the App Privacy questions as "Data Not Collected".
- [ ] **Privacy policy URL**: required even when nothing is collected. A one-paragraph page ("Dossier stores your
      log only on your device; nothing is sent anywhere") on GitHub Pages is enough.
- [ ] **Export compliance**: `ITSAppUsesNonExemptEncryption = NO` is already set (the app uses no encryption of
      its own).
- [ ] Screenshots for the iPhone sizes App Store Connect asks for (currently the 6.9-inch display), description,
      keywords, support URL, age rating questionnaire.
- [ ] Upload a build, test it through **TestFlight** on Henry's iPhone, then submit for review.
- [ ] Before review, port the lint panel and stats screen: a bare text editor risks rejection under guideline 4.2
      (minimum functionality).
