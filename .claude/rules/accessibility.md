# Accessibility Rules

Target: **WCAG 2.1 AA**. Accessibility is **system-first** – the design system
provides the primitives (focus rings, focus trapping, reduced-motion, touch
targets, live regions, labeled controls) and your app inherits them. Reach for a
DS primitive before an app-local fix.

## Standards (every interactive surface)

### Keyboard
- Every interactive element is reachable and operable by keyboard; logical tab
  order; no keyboard traps.
- Overlays (drawers, menus) close on **Escape** and return focus to their
  trigger (the DS `BottomDrawer` / `useFocusTrap` handle this).
- Composite widgets support arrow keys (the DS `TabBar`, `ToggleGroup`,
  `SidebarTabs` already do).

### Focus
- Every interactive element has a **visible focus indicator** (`:focus-visible`).
  Tailwind's preflight removes the UA outline, so use the DS focus-ring utility
  (`wj-focus-ring`) – never rely on the default.
- The focus ring uses a **neutral, high-contrast** color, NOT the accent.
- Modals/menus **trap focus** and **restore** it on close (DS `useFocusTrap`);
  for multi-field form drawers use `initialFocus="container"` so opening one
  doesn't pop the mobile keyboard.
- Move focus to `<main>` on route change (DS `useRouteFocus`).

### Name, role, value (ARIA)
- Icon-only controls have BOTH `aria-label` and `title`.
- Form inputs are programmatically labeled (`<label htmlFor>` or `aria-label` –
  placeholder is not a label); errors surface in a live region (DS `announce`).

### Perceivable / operable
- Text contrast ≥4.5:1 (≥3:1 for large text); UI boundary ≥3:1. Use the
  semantic tokens; don't hand-pick low-contrast greys.
- Never convey meaning by color alone – pair with text, icon, or shape.
- Images have `alt` (decorative: `alt=""`); graphic canvas/SVG get
  `role="img"` + `aria-label` or are `aria-hidden` with a text alternative.
- Touch targets ≥44×44 CSS px (DS `.touch-target`); avoid `size="sm"` for touch.
- All motion respects `prefers-reduced-motion` (DS reduced-motion stylesheet +
  `useReducedMotion()` to gate JS-driven motion).

### i18n
- All accessibility strings (`aria-label`, `alt`, `title`) are translation keys
  present in every locale the app ships.
