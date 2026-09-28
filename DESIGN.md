# Design System

Living reference for the token system, primitives, and conventions this app actually uses.
Written from the shipped code, not from intent — if something here is stale, the code is
wrong or this file is; fix whichever is cheaper and update the other.

## Tokens (`src/app/globals.css`)

Tailwind 4 CSS-first `@theme` config. No `tailwind.config.js`.

- **Brand**: `bg-clay` / `text-clay` / `border-clay` (`#e25b36`, terracotta) is the primary
  accent. `bg-clay-hover` / `text-clay-hover` for hover states. `bg-floodlight` /
  `text-floodlight` (amber) is the secondary accent, used for lighting/floodlight-specific UI.
- **Surfaces**: `bg-background`, `bg-card`, `bg-popover`, `bg-secondary`, `bg-muted`,
  `bg-accent` — all defined once in `:root`/`.dark` and consumed via these classes, never as
  raw hex. Dark mode resolves to the app's real navy scale (`#0b0f17` background, `#141a26`
  card/popover surface, `#101522` muted/inset, `#18202f` secondary, `#1c2536` accent/hover) —
  this *is* the intended dark theme, not a placeholder; don't "fix" it back to generic gray.
- **Text**: `text-foreground` / `text-muted-foreground` for default/secondary text.
- **Borders**: `border-border` everywhere instead of `border-slate-*` + a `dark:` pair.
- **Radius**: `--radius: 0.625rem` is the one base; `rounded-sm` through `rounded-4xl` are all
  derived multiples of it (`src/app/globals.css` `@theme inline` block). Don't hardcode a
  `rounded-[Npx]` value — pick the closest scale step.

**Rule**: if you're about to write `dark:bg-[#...]` or `text-slate-500 dark:text-slate-400`,
a token already exists for what you mean — use it. `src/components/ui/button.tsx` is the
reference implementation of "fully migrated."

## Icons

`lucide-react` exclusively. No emoji in UI copy — they don't scale, don't theme, and mix
inconsistently with a real icon set. One exception: the brand logomark is a small `bg-clay`
rounded square containing a literal 🎾, used identically in `navbar.tsx`, `login/page.tsx`,
`register/page.tsx`, and `c/[clubSlug]/page.tsx`'s nav rail. That's a wordmark, not UI icon
usage — leave it, and don't add new emoji-as-icon anywhere else.

## Modals: `src/components/ui/dialog.tsx`

Thin wrapper over `radix-ui`'s `Dialog` (installed via `npx shadcn add dialog`, see
`components.json`). Gives focus-trap, ESC-to-close, click-outside-close, and proper ARIA for
free. `booking-modal.tsx`, `booking-details-modal.tsx`, and `cancel-booking-button.tsx` all
use it — pattern is "wrap, don't rewrite": swap only the outer overlay/positioning shell for
`Dialog`/`DialogContent`, keep all internal layout/state/logic as plain children.
`showCloseButton={false}` + a custom `DialogClose`-wrapped button is used where the existing
header already has its own close-button styling to preserve.

Any new modal in this app should be built on this primitive, not a hand-rolled
`fixed inset-0` div — that pattern (no focus trap, no ESC handling) is exactly what these
three files replaced.

## Toasts: `src/components/ui/sonner.tsx`

`sonner`, installed via `npx shadcn add sonner`. Note: the generated component defaults to
reading theme from `next-themes` — this app doesn't use `next-themes` (it manages `.dark` via
its own inline script + `theme-toggle.tsx`), so that dependency was removed and the toaster's
colors are wired directly to the CSS tokens above (`--normal-bg: var(--popover)` etc.), which
already flip correctly with the `.dark` class. Use `toast.error(...)` / `toast.success(...)`
from `"sonner"` for async/API feedback — never `alert()` or `confirm()`.

## What's intentionally NOT unified

Categorical/semantic color-coding is not part of the clay/navy brand system and shouldn't be
migrated onto it: role badges (purple/amber/emerald), booking-type badges (cyan/indigo/
emerald), court-surface indicators (HARD/PADEL colors) in `court-grid.tsx`/`court-calendar.tsx`
are deliberate multi-accent coding per `bauplan.md`, not leftover hardcoded hex.
