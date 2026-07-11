# DESIGN.md — Control Center (mohamedtabari.com/admin)

> System of record for the Control Center's visual system (awesome-design-md method,
> per `Skills/website-design-build` stage 4). **Any pivot updates this file + the
> token CSS in the same change set.**
>
> Direction: **"Mission deck"** — a dark, blue-accented operations surface. Identity
> is deliberately cyber/futuristic (Med's call), executed with product-register
> discipline: earned familiarity, surface-ladder depth, scarce accent, state-driven
> motion. Calibrated against Linear (surface ladder, hairlines-not-shadows, negative
> display tracking, accent scarcity) and PostHog (weight-contrast hierarchy);
> conventions adapted, nothing copied.

## Color tokens

| Token | Value | Role |
|---|---|---|
| `--bg` | `#060b16` | Canvas (never pure black; faint blue cast) |
| `--surface-1` | `rgba(13,25,48,0.55)` | Cards / panels (glass over canvas) |
| `--surface-2` | `rgba(20,36,66,0.55)` | Hover / nested / featured |
| `--surface-solid` | `#0b1626` | Opaque surfaces (sticky headers, tooltips) |
| `--line` | `rgba(56,189,248,0.14)` | Hairline border (standard) |
| `--line-strong` | `rgba(56,189,248,0.32)` | Hairline (active/featured) |
| `--ink` | `#eaf2ff` | Primary text |
| `--muted` | `#8ba3c7` | Secondary text |
| `--faint` | `#5c7397` | Tertiary / axis labels |
| `--blue` | `#3b82f6` | THE accent: primary actions, series-1, focus |
| `--sky` | `#38bdf8` | Accent-bright: identity glow, active nav icon |
| `--good` / `--bad` / `--amber` | `#34d399` / `#fb7185` / `#fbbf24` | Status only — never decoration, never series colors |

**Chart palette (CVD-validated, dark band L 0.48–0.67, fixed order, never cycled):**
`#3b82f6 → #d97706 → #8b5cf6 → #059669 → #ec4899`. Sequential ramps = blue alpha
ramp only. Values/labels always wear ink/muted — never series color.

**Accent scarcity rule (Linear):** blue gradient fills appear ONLY on primary
action (ENTER, range-active, replay), the active nav item, and data marks. No
second chromatic accent for decoration.

## Depth (surface ladder — not shadow soup)

| Level | Recipe |
|---|---|
| 0 canvas | `--bg` + grid overlay |
| 1 card | `--surface-1` + 1px `--line` + **one** soft ambient shadow (`0 8px 24px rgba(0,0,0,0.25)`) |
| 2 raised/hover | `--surface-2` + `--line-strong` |
| 3 overlay | `--surface-solid` + `--line-strong` + `0 12px 32px rgba(0,0,0,0.45)` |
| Focus | 2px `--sky` outline, 2px offset (`:focus-visible` only) |

Glow (`box-shadow` in accent color) is reserved for: live pulse, active-nav icon,
brand dot, map markers. Never on static chrome.

## Typography

One family: **Inter** (product register: single well-tuned sans). **JetBrains Mono**
for data identity (visitor IDs, timestamps, session meta) only — never labels.

| Role | Spec |
|---|---|
| KPI numeral | 32px / 800 / tracking `-0.02em` / `tabular-nums` |
| Page title | 19px / 800 / `-0.01em` |
| Card eyebrow | 11px / 700 / caps / `+0.14em` / muted |
| Body / cells | 12.5–13px / 400–600 / tracking 0 |
| Micro (axis, hints) | 10–11px / faint |

Hierarchy leans on **weight contrast** (PostHog) more than size.

## Spacing & radii

4px base. Card padding 18px; grid gap 14px; content gutter 26px.
Radii: 6px chips · **9px controls** (buttons, inputs, pills) · 12px sessions ·
**15px cards** · pill 999px. No other values.

## Motion (emil tokens — state, not decoration)

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--t-fast: 120ms;  /* hover/color feedback */
--t-med: 200ms;   /* reveals, drawers */
```

- **Frequent controls do not animate** (nav switches, range pills = instant snap;
  color feedback ≤120ms only). Never animate keyboard-initiated actions.
- Press feedback: `:active { transform: scale(0.97) }` on buttons, 120ms.
- Entrance: content rise 240ms `--ease-out`, stagger ≤3 × 30ms, **page-switch only**
  (no orchestration on refresh). `ease-in` is banned.
- Named transition properties ONLY — `transition: all` is banned.
- Hover effects gated behind `@media (hover: hover)`.
- `prefers-reduced-motion: reduce` → entrances/pulses/halos off, count-up renders
  final value instantly; opacity-only where a transition must remain.
- One theatrical moment is licensed: the ACCESS GRANTED splash (rare = delight).

## Interaction states

Every control ships default / hover / **focus-visible** / active / disabled.
Clickable table rows are real keyboard targets (`tabIndex`, Enter/Space activate).
`Escape` closes the dossier. Semantic z-scale: `--z-raised:1 · --z-tooltip:3 ·
--z-nav:5 · --z-overlay:50`. No arbitrary z-index values.

## Data-viz rules (dataviz method)

Form by job (trend=line+area, share=donut ≤5 slices, magnitude=thin h-bars,
time-grid=heatmap single hue); 2px line marks, ≥8px hit targets, 2px gaps between
donut segments; hover layer mandatory (crosshair+tooltip on trend, per-mark title
elsewhere); legend for ≥2 series; ghost series = same hue dashed, not a new color.

---

## Skills-applied log (audit trail)

- **impeccable/product.md** → single family, weight-contrast hierarchy, complete
  state vocabulary, density permitted, no decorative motion, modals avoided
  (dossier is a page, not a modal).
- **impeccable SKILL.md** → contrast floors (≥4.5:1 body, ≥3:1 bold labels),
  semantic z-scale, `text-wrap: balance` n/a (no prose), reduced-motion mandatory.
- **emil-design-eng** → easing/duration tokens above, frequency framework
  (nav/range = no animation), `:active` scale, never `ease-in`/`transition: all`.
- **Linear DESIGN.md (calibration)** → surface ladder + hairlines over drop
  shadows, accent scarcity, negative tracking on display numerals, 8–9px control
  radius. Adapted to blue cyber identity; lavender/flat-black NOT copied.
- **PostHog DESIGN.md (calibration)** → weight-over-size hierarchy confirmation.
  Cream canvas rejected (brand is dark).
- **dataviz method** → palette computationally validated (CVD ΔE ≥ 12 adjacent,
  contrast ≥ 3:1 vs surface, lightness band pass) before adoption.

### Critique findings fixed in the same change set (2026-07-11)
1. `transition: all` ×3 (nav, ghost buttons, range pills) → named properties.
2. No `prefers-reduced-motion` path → full block added.
3. `:focus-visible` missing on nav/pills/rows/selects/links → focus ring token.
4. Clickable `<tr>` not keyboard-operable → tabIndex + Enter/Space + Escape.
5. Arbitrary z-indexes (1/3/5/50) → semantic scale tokens.
6. Shadow soup (44px+ blurs, glows on static chrome) → surface ladder.
7. Hover effects not gated on hover-capable devices → `@media (hover:hover)`.
8. Buttons lacked `:active` press feedback and `:disabled` styling → added.
9. Count-up animation ignored reduced-motion → instant render path.
10. Entrance stagger re-orchestrated too much chrome → ≤3 children, 240ms, page-switch only.
