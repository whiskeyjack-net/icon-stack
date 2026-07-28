# Whiskeyjack App Rules

Conventions for a React app built on the Whiskeyjack design system. Generalized
from the design system's internal rules; these point at the published packages,
not any monorepo path.

## Components & tokens

- **Design-system first**: reach for a DS component or hook before writing an
  app-local one. Import from `@whiskeyjack-net/design-system`. App-local UI is
  justified only when genuinely app-specific.
- **Tokens via CSS variables**: `var(--color-warm-500)`, never hardcoded color
  values. The Tailwind preset (`@whiskeyjack-net/design-system/tailwind-preset`)
  exposes the token color scales, fonts, radius/shadow, and the `wide`/`xlwide`
  layout-gate variants.
- **Icons: Phosphor only** (`@phosphor-icons/react`). The DS bundles no icon
  library – pass icon nodes into components (e.g. `renderIcon`, `icon` props).
- **Icon-only controls** need both `aria-label` and `title`.

## The app shell

Use the DS shell components rather than hand-rolling the frame:

- `AppShell` – root column (`scroll="shell"` fixed height, or `"document"`).
- `AppHeader` – frosted desktop header (`floating`/`sticky`; `chrome` +
  `rowClassName` slots carry Tauri window controls).
- `HeaderNav` – the nav pills (`items` + `linkComponent`).
- `AppMain` – the scroll region (forwards its ref for `useRouteFocus`).
- `MobileBottomNav` – the mobile bottom bar.

Theme with `useTheme` (uncontrolled `storageKey`, or controlled `mode` from a
store). Never hand-roll `matchMedia`/`dark`-class toggling.

## i18n

- All user-facing strings are translation keys via `useTranslation()` – never
  hardcode display text, including `aria-label`/`alt`/`title`.
- Configure once through `createI18n(locales)` from `@whiskeyjack-net/i18n`
  (`src/i18n/index.ts`); it handles language detection, the `en` fallback, and
  `<html lang>`/`dir` (RTL) updates.
- When you add a key, add it to **every** locale file.

## Tauri (desktop/mobile)

- The `@whiskeyjack-net/tauri` shell (window controls, `useSystemAccent`,
  guards) is inert off Tauri, so it's safe in a plain web build.
- Desktop-only behavior must gate on `isDesktopTauri()`, not merely `isTauri()`
  (mobile Tauri also sets `__TAURI_INTERNALS__`).

### Cold-launch theme flash

A theme-correct app can still show the wrong colour for a large part of its cold
launch. The launch is a **chain of surfaces**, each painting until the next is
ready, and each with a different owner:

| # | Surface | Owner | Colour source |
|---|---------|-------|---------------|
| 1 | System splash / `LaunchScreen` | OS, before the process exists | theme resource |
| 2 | Native window background | app `onCreate` / Rust setup | persisted mirror |
| 3 | **Webview's OWN background** | webview, until the page first paints | webview default – **white** |
| 4 | Page background | CSS `body` rule | design tokens |

Link 3 is the one that bites, and it lasts until the render-blocking stylesheet
loads (measured at ~1.5 s on an Android cold start). This template ships the
web-side fix already wired, and it is worth understanding before you touch it:

- **`index.html`'s pre-paint script** sets `documentElement.style.backgroundColor`
  before any stylesheet. Adding the `dark` class alone does nothing – a class is
  inert without CSS, which is precisely the gap.
- **`useTheme`'s `launchMirrorKey`** writes the RESOLVED appearance for that
  script to read next launch. The plain `storageKey` holds the *preference*,
  which can be `'system'`; the script needs the answer, not the question.
- **`useTheme`'s `paintRoot: !isLinuxDesktop()`.** The root's background
  propagates to the **canvas** – that is what makes the paint reach the launch
  frame, and equally what makes it override a transparent `body`. A Tauri Linux
  window is undecorated + `transparent` with CSS-rounded corners, so an opaque
  root fills the corners and squares the window off. `paintRoot: false` *clears*
  the property rather than skipping it, so it also undoes the pre-paint script,
  which runs before the app can tell which platform it is on.
- **The hexes in `index.html` are a hand-kept mirror of the background tokens** –
  that script runs before any stylesheet, so it is the one place that cannot
  read them. Sweep it whenever a background token moves. An installed PWA's
  manifest `background_color` is a second such mirror, with no dark variant in
  the spec, so it is only ever right for one theme.
- **Measure before theorising here.** Record the screen and sample one averaged
  pixel per frame (`ffmpeg -vf "fps=60,crop=…,scale=1:1" -f rawvideo`) rather
  than reasoning about which surface is showing. That method costs minutes and
  repeatedly contradicts plausible hypotheses.

## RTL

Directional layout uses Tailwind **logical** utilities (`ps`/`pe`, `ms`/`me`,
`start`/`end`), never physical `pl`/`pr`/`left`/`right`. The DS handles the
JS-driven mirroring (swipe direction, fade edges) via its `isRTL` helper.
