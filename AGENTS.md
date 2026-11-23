# Agent notes

Commands: `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`, `npm run e2e`.

- `tests/fixtures/gym-2026.txt` is private and gitignored. Never commit or modify it.
- Use LF line endings.
- Modules in `src/core` are pure: no DOM, no browser globals.
- Use only the design tokens listed in `src/styles.css`.
- Browser storage, clipboard, share and haptics calls live only in `src/platform/web.ts`; everything else goes through `platform` (enforced by tests/unit/platform-boundary.test.ts).
