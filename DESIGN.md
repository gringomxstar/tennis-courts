# Design System

Source of truth: the Claude Design prototype "TC Marly App" (project `f088e355-15d8-4220-a2bb-69bdedec26a1`, `TC Marly App.dc.html`). The app reproduces it 1:1. Only invisible accessibility fixes are allowed: real buttons and links, aria, tabular numerals, focus rings, reduced motion. Change the prototype first, then the code.

## Tokens (`src/app/globals.css`)
Values are the prototype's theme object `t`, for light and `.dark`.
- **Surfaces**: `bg-background` (t.bg), `bg-card`, `bg-inset` (wells, segmented tracks, disabled slots), `bg-acc` (avatars, busy cells), `bg-sheet`, `bg-glass` (tab bar and footers with a 24px backdrop blur).
- **Text**: `text-foreground`, `text-muted-foreground`, `text-clay-text` (links and secondary actions).
- **Brand**: `bg-clay` `#e25b36`, used for active tabs, selected days, "deins" slots and primary actions.
- **Surface colours** come from `courtColor()` in `src/lib/courts.ts`: Sand = clay, Allwetter = `#64748b`, Padel = `#2563eb`. They tint the next-game card, the Reservieren header and the dots (which court). The primary action button is always the club brand colour (`bg-clay`), never the surface colour, so the action reads as one consistent colour per club.
- **Other tokens**: `bg-seg-on` / `text-seg-on-fg` / `text-seg-off-fg` (segmented controls), `bg-track-off` (switch off), `bg-free-tint` and `border-free-border` (free slots), `bg-paid-bg` / `text-paid-fg`, `shadow-elevation`.
- **Fills behind white text** use `bg-clay`, which maps to `--clay-fill` (brand at 86% towards black, at least 4.5:1 for the default clay and the club teal). `--tennis-clay` stays the raw brand for dots, rings and shadows. `--surface-clay` is `#c9482a` (was `#e25b36`) so the white text on court cards reaches 4.5:1; a deliberate deviation from the prototype (2026-09-29, contrast).
- **Reserve page**: from `lg` (1024px) two columns with the total/pay card in the left column; below that one column with a fixed bottom bar (safe-area aware). Tap targets are at least 44px. Verified at 360, 390, 430, 768, 1024, 1180, 1440, 1920, light and dark.
- **Motion**: `ease-spring` `cubic-bezier(.34,1.56,.64,1)` for controls and tabs, `ease-sheet` for the bottom sheet. Both overshoot on purpose, as in the prototype.
- **Type**: system SF stack with tabular numerals everywhere. Sizes, radii and tracking are the prototype's literal px values, written as arbitrary Tailwind values.

## Primitives (`src/components/app/`)
- `tab-bar.tsx`: floating glass pill; the active tab expands its label. It becomes a sidebar from `lg`. Tabs are routes, and `/c/<slug>/admin/*` switches to the admin tab set.
- `sheet.tsx`: bottom sheet on Radix Dialog. Mount and unmount use tw-animate enter/exit, never `forceMount`, because Radix's inline `pointer-events:auto` on the overlay would block the page.
- `segmented.tsx`, `switch.tsx` (`SwitchKnob` inside a `<button aria-pressed>`), `avatar.tsx` (Avatar, Dot, Chevron, Spinner).
- `booking-sheet.tsx`: the two-tap booking flow, used by Start and Kalender.
- `use-now.ts`: client clock. All local-time slot logic runs on the client from ISO data (`src/lib/club-data.ts`), so server and client never disagree about the current time.

## Rules
- Prices come only from `computeBookingCost()` in `src/lib/pricing.ts`, shared by the server action and the client preview. `npx tsx scripts/check-pricing.ts` checks it.
- Toasts use sonner (`toast("…")`), shown as an inverted pill at the top. Never use `alert`/`confirm`.
- Icons are the prototype's inline SVG paths. No emoji in the UI.
- Pages outside the prototype (`/` landing, `/login`, `/register`, `/admin`, `/invoice`, `/membership/success`, club settings) are built in the same language: no shadcn Card/Badge/Button, no lucide tiles, no gradients.
- Desktop (`lg`): a 256px sidebar and main up to 1280px. Views reflow into grids; sheets become centered dialogs. Mobile classes stay the prototype's exact values.
- PWA: `app/manifest.ts` (standalone), `icon.svg`, `apple-icon.tsx`, and safe-area insets on the tab bar and landing.
- **Deliberate deviations from the prototype (2026-09-29, owner request "für schlechte Augen"):** the Kalender is larger than the prototype.
  - Toggle "Liste / Raster" (was "Plätze / Woche").
  - Raster: exactly 2 courts per phone screen (`w-[calc((min(100vw,640px)-56px)/2)]`, swipe for more), 62px rows, 16px slot text, 18/14px court header, 15px hour labels; desktop columns `min-w-[200px]`.
  - Liste: 58px / 18px slot buttons, larger day buttons and chips.
  - Free slots show no text (tint only; "frei" stays in the aria-label). Taken slots show "Max M. / Anna B." to club members only, "Belegt" to everyone else.
- Anonymous tab bar: Start · Kalender · Abos · Anmelden.
- `/abos` replaces `/membership` (which now redirects).
