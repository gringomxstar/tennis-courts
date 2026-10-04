# Design System

Source of truth: Design v3, approved 2026-09-30. The prototype is `docs/design/entwurf-v3.html`; the screen-by-screen spec is `docs/design/README.md`. The app takes its values 1:1; any deviation needs a reason in the PR. Priority from the approval: clear first, as few taps as necessary, primary action visible without scrolling, actions always carry text, no box inside a box.

## Tokens (`src/app/globals.css`)
- **Brand**: `--tennis-clay` is the club colour (default `#147a68`, from `settingsJson.brandColor`). `--brand`, `--brand-deep` (75% towards black), `--brand-dark` (55%), `--brand-soft` (17% on white), `--brand-tint` (8% on white) are derived with `color-mix`. Active nav, primary buttons and "mine" use `brand-deep`.
- **Surfaces**: `--bg` `#e9efec`, `--card` white, `--inset`/`--acc` for wells and busy cells, `--glass` for the floating bar. Text: `--ink`, `--ink-2`, `--ink-3`; lines `--line`.
- **Courts**: `--sand` `#e0653a`, `--hard` (Allwetter) `#4c6b8a`, `--padel` `#3a7bd5`; helper `courtColor()` in `src/lib/courts.ts`. They tint dots, headers and cards, never the primary button.
- **Booking types**: own `--me` (brand), member `--mem` `#38b58a`, guest `--guest` `#f0a33a`, training/Kurs `--coach` `#7c5cff`, blocked `--block` with `--stripes`. Status pairs: `--ok`/`--ok-bg`, `--warn`/`--warn-bg`, `--bad`/`--bad-bg`.
- **Other**: `--navy` and `--go` for the mobile hero, `--floodlight`, shadows `--sh` and `--sh-lg`, easings `--ease-spring`, `--ease-sheet`, `--ease-push`. The shadcn variables (`--primary`, `--border`, …) are aliases onto these tokens.
- **Dark mode** (`.dark`): same tokens inverted (`--bg` `#101413`, `--card` `#182120`); `--brand-deep` lightens instead of darkens, soft/tint mix into the card colour, status backgrounds become 20% alpha.
- **Type**: Outfit via `next/font` (`--font-outfit`), 400–800, tabular numerals everywhere.
- **Radii**: cards 24px, inner elements 12–16px, buttons, chips and pills 999px.
- **Contrast**: fills behind white text must reach 4.5:1 (`brand-deep`, not `brand`).

## Shell (`src/components/app/tab-bar.tsx`)
Breakpoints are container queries on the app wrapper, not viewport queries.
- **< 640px**: no rail. 16px side padding, floating dark pill at the bottom (active item green), safe-area aware.
- **≥ 640px**: 72px white icon rail on the left, pill navigation on top (Start · Kalender · Buchungen · Profil; in the admin area Heute · Mitglieder · Sperren · Statistik · Einstellungen), bell and avatar. Member search appears from 1100px. Padding 16px, card gap 16px.
- **< 1100px**: side panels (form, detail) become a sheet or dialog; 3-column grids become 2.
- Sheets are bottom sheets on phones and centred dialogs from 640px.
- Menu by role: Start · Kalender · Buchungen · Profil for everyone logged in, plus Verwaltung for club admins. Guests see Start · Kalender · Abos · Anmelden.

## Primitives (`src/components/app/`)
- `sheet.tsx`: Radix Dialog. Mount and unmount use tw-animate enter/exit, never `forceMount` (its inline `pointer-events:auto` on the overlay blocks the page).
- `segmented.tsx`, `switch.tsx`, `avatar.tsx` (Avatar, Dot, Chevron, Spinner).
- `booking-sheet.tsx`: two-tap booking flow used by Start and Kalender; `booking-detail-sheet.tsx` for an existing booking.
- `use-now.ts`: client clock. Slot logic runs on the client from ISO data (`src/lib/club-data.ts`), so server and client never disagree about "now".
- Views: `home-view`, `calendar-view`, `bookings-view`, `profile-view`, `abos-view`, `reserve-view`, `admin-today`, `admin-members`, `admin-blocks`, `coach-block-form`.

## Rules
- Prices come only from `computeBookingCost()` in `src/lib/pricing.ts`, shared by the server action and the client preview. `npx tsx scripts/check-pricing.ts` checks it.
- Toasts use sonner, never `alert`/`confirm`. Icons are inline SVG, no emoji in the UI.
- Pages outside the prototype (landing, login, register, invoice, settings) follow the same language: no shadcn Card/Badge/Button, no gradients.
- Tap targets at least 44px; real buttons and links, aria labels, focus rings, reduced motion.
- Empty and error states appear where they matter (no Abo, wrong password, bookings affected by a block).
- Free slots show no text, only a tint ("frei" stays in the aria-label). Taken slots show names to club members and "Belegt" to everyone else.
- Kalender: Liste / Raster toggle on phones, one row per court with hour chips, starting at the current hour. Raster shows exactly 2 courts per phone screen. Desktop has a Tag/Woche toggle; trainers and admins browse 61 days.
- Multi-select tiles ("Mehrere") book as a Kurs. A Kurs has no DB column; its identity is `Booking.idempotencyKey = kurs:<id>:<n>[:<hex>]`, its title is the Kursname, its colour one of 7 swatches.
- Sperren: reasons include Wintersperre ("Ganze Tage" = one 00:00–00:00 block per court, up to 366 days); the planned list groups blocks.
- No auto-renew for Abos: always a one-off payment, reminder mail before 31 March.
- PWA: `app/manifest.ts` (standalone), per-club icon, safe-area insets.
- Sales page `/fuer-clubs`: own look on purpose (Archivo display, clay accent, photo overlays), scoped under `.fc` in `src/app/fuer-clubs/fuer-clubs.css` so nothing leaks into the app. Screenshots in `src/assets/fuer-clubs/` come from `scripts/screens.ts` (guest views); copy stays plain and names no club.
