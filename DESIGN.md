---
name: SonarDiff
description: B2B website change monitoring dashboard for startups and mid-size businesses tracking competitor moves.
colors:
  accent-cyan: "#06B6D4"
  accent-cyan-deep: "#0891B2"
  accent-wash: "#06B6D426"
  accent-wash-strong: "#06B6D438"
  status-positive: "#10B981"
  status-negative: "#EF4444"
  status-warning: "#F59E0B"
  ink-primary: "#F1F5F9"
  ink-secondary: "#CBD5E1"
  ink-tertiary: "#94A3B8"
  ink-quaternary: "#64748B"
  surface-chrome: "#05070A"
  surface-base: "#07090C"
  surface-card: "#0F172A"
  surface-elevated: "#162030"
  surface-highlight: "#FFFFFF0A"
  border-ghost: "#FFFFFF14"
  border-ghost-soft: "#FFFFFF0D"
typography:
  display:
    fontFamily: "Geist, Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(36px, 4vw, 52px)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Geist, Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.028em"
  title:
    fontFamily: "Geist, Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.18
    letterSpacing: "-0.022em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.12em"
  mono:
    fontFamily: "Geist Mono, JetBrains Mono, SFMono-Regular, ui-monospace, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "6px"
  base: "10px"
  md: "14px"
  lg: "20px"
  xl: "28px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  3xl: "64px"
components:
  button-accent:
    backgroundColor: "{colors.accent-cyan}"
    textColor: "#042F36"
    rounded: "{rounded.base}"
    padding: "0 18px"
    height: "38px"
  button-accent-hover:
    backgroundColor: "#22D3EE"
  button-primary:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.base}"
    padding: "0 18px"
    height: "38px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.base}"
    padding: "0 18px"
    height: "38px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-highlight}"
  card:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.md}"
    padding: "24px"
  filter-pill:
    backgroundColor: "transparent"
    textColor: "{colors.ink-tertiary}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "30px"
  filter-pill-active:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent-cyan}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "30px"
  input-default:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.base}"
    padding: "0 12px"
    height: "40px"
  nav-item-active:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent-cyan}"
    rounded: "{rounded.base}"
    padding: "0 12px"
    height: "36px"
---

# Design System: SonarDiff

## 1. Overview

**Creative North Star: "The Signal Room"**

The room is dark. Not because darkness looks good, but because that is when people use this tool. A startup founder at 9pm glancing at a monitor dashboard to check if the alert that came in means a competitor dropped a price or just swapped a banner. The surfaces are dark because the data must be the brightest thing in the room.

This is a dark-first, Committed-color system. Previous versions were Restrained. This version commits: deep surfaces, Electric Cyan carrying 20-30% visual weight across active states, the accent doing real work instead of sitting in corners. The commitment is not decorative. It is earned by what the product does: when a monitor fires, the cyan signal should read like a signal, not a decoration.

The motion language is the system's identity. One entrance grammar, applied everywhere: a clip-path sweep from left to right, 350ms at ease-out-expo, with list items staggering 60ms apart. This is not a subtle micro-interaction. It is the thing you notice when you first open a page and every row of monitors uncloaks left-to-right. It is the one repeated gesture that says "this is SonarDiff" before you read a word.

This system rejects all four failure modes from PRODUCT.md: the SaaS-cream card grid (gone, replaced by a dark three-layer surface stack), the neon hacker aesthetic (rejected; the cyan is functional, not decorative, and the glow is used once), enterprise navigation sprawl (everything in two clicks), and consumer-app playfulness (no emoji, no bounce, no spring physics).

**Key Characteristics:**
- Dark-first: three-layer surface stack (`#05070A` chrome / `#07090C` base / `#0F172A` card). Light mode is a toggle, not the designed default.
- Committed color: Electric Cyan at 20-30% visual presence on any screen. Active states have cyan fill, not just cyan text.
- Motion as identity: clip-path sweep is the one entrance grammar. No other entrance animation exists.
- Geist Mono reserved for all technical values: URLs, percentages, counts, timestamps.
- Elevation via surface stepping (darker → lighter), not shadows.

## 2. Colors: The Dark Committed Palette

Three dark layers, one signal color, three semantic states. The surfaces get out of the way so the data can speak.

### Primary
- **Electric Cyan** (#06B6D4 / `oklch(73.4% 0.134 213.7)`): The signal. Used on active nav items, primary CTAs, live status indicators, focus rings, selected filter pills, active row highlights, and any interactive element in its confirmed state. At 20-30% visual presence: more committed than restrained, less than drenched. When it appears, something is active, selected, or requires action.
- **Cyan Deep** (#0891B2): Hover state for accent elements and active link text. Never a standalone color.

### Tertiary
- **Positive Green** (#10B981): Added text in diffs, live/active monitor status, success states. Background: `rgba(16,185,129,0.10)` on dark surfaces.
- **Alert Red** (#EF4444): Removed text in diffs, errors, destructive confirmations. Background: `rgba(239,68,68,0.10)` on dark surfaces.
- **Caution Amber** (#F59E0B): Paused monitors, quota warnings. Background: `rgba(245,158,11,0.10)`.

### Neutral
- **Surface Chrome** (#05070A): The deepest layer. Sidebar and topbar background. One step below the content base. The fixed boundary of the layout.
- **Surface Base** (#07090C): The content layer. Everything renders on this. The ambient background of every page.
- **Surface Card** (#0F172A): Cards, table rows, input backgrounds, panels. Deep navy. What most content sits on.
- **Surface Elevated** (#162030): Dropdowns, popovers, tooltips. One step above card; the highest dark layer.
- **Surface Highlight** (rgba(255,255,255,0.04) / `#FFFFFF0A`): Row hover state on monitor/alert lists. The smallest visible step above Surface Base.
- **Ink Primary** (#F1F5F9): Main text. Headings, labels, table values. Off-white; never pure white.
- **Ink Secondary** (#CBD5E1): Supporting text, column headers, button text on ghost buttons.
- **Ink Tertiary** (#94A3B8): Deemphasized text, timestamps, counts, metadata.
- **Ink Quaternary** (#64748B): Placeholder text, disabled states, hints.
- **Ghost Border** (rgba(255,255,255,0.08) / `#FFFFFF14`): Card outlines, dividers, input strokes. The only border on dark surfaces.
- **Ghost Border Soft** (rgba(255,255,255,0.05) / `#FFFFFF0D`): Softer dividers inside cards, table row separators.
- **Accent Wash** (rgba(6,182,212,0.15) / `#06B6D426`): Active nav item fill, selected pill background. The committed step.
- **Accent Wash Strong** (rgba(6,182,212,0.22) / `#06B6D438`): Hover on accent-wash elements. One step brighter.

**The Committed Voice Rule.** Electric Cyan is no longer rationed at ≤10%. In this Committed system, the active state of any interactive element uses the accent fill. Nav items, filter pills, selected rows: all show the cyan wash background when active. What doesn't change: semantic colors (green/red/amber) are still state-only. Cyan is still the only accent. "Committed" means the one voice speaks clearly, not that all voices speak.

**The Dark Stack Rule.** The three surfaces always stack in order: Chrome (#05070A) → Base (#07090C) → Card (#0F172A). Never invert. Never use Card as a page background. Chrome is the frame; Base is the page; Card is the content unit.

**The Semantic-Only Rule.** Green, Red, and Amber communicate state, not decoration. A green button is a violation. An amber heading is a violation. These three colors are reserved for "what changed" (diff), "what failed" (error), and "what is paused/warned" (caution). Nothing else.

## 3. Typography

**Display / Headline font:** Geist (fallback: Inter, -apple-system)
**Body font:** Inter (fallback: -apple-system, system-ui)
**Mono font:** Geist Mono (fallback: JetBrains Mono, SFMono-Regular, ui-monospace)

On dark surfaces, Geist's tight negative tracking and high weight contrast read sharply at small sizes. Inter's humanist neutrality disappears into body content. Geist Mono in Ink Tertiary (#94A3B8) on Surface Base reads as a data readout, not body text; the mono font plus the dimmer ink color are the signal that "this is a measurement."

### Hierarchy
- **Display** (600, clamp(36px, 4vw, 52px), -0.035em, 1.04): Auth heroes. One per page. Ink Primary on Surface Base.
- **Headline** (600, 28px, -0.028em, 1.08): Page titles. One per screen. Always the visual anchor.
- **Title** (600, 15px, -0.022em, 1.18): Section headers, card headings, panel titles. Multiple per screen. Ink Primary.
- **Body** (400, 14.5px, normal, 1.6): Descriptions, change summaries, metadata prose. Ink Secondary on dark. Max 65ch.
- **Label** (500, 12.5px, 0.12em uppercase): Eyebrow labels only. Ink Tertiary. One per section maximum. Always paired with the 16px horizontal leader line.
- **Mono** (400, 12px, normal, 1.5): URLs, percentages, check counts, timestamps, CSS selectors, diff metadata. Ink Tertiary. Never Ink Primary.

### Named Rules
**The Mono Gatekeeping Rule.** Geist Mono is for data, not for personality. A section heading in Geist Mono is a violation. Emphasis is weight or scale, not font family.

**The Dark Contrast Rule.** On dark surfaces, body text must be Ink Primary (#F1F5F9) or Ink Secondary (#CBD5E1). Ink Tertiary (#94A3B8) is for supporting data only. Never put prose in Ink Quaternary (#64748B) on dark surfaces: it fails WCAG AA at typical body sizes.

## 4. Elevation

Dark systems elevate by getting lighter, not by casting shadows. A surface that needs to feel above the page gets a lighter background, not a box-shadow. Shadows are reserved for popover chrome and the accent glow.

### Surface Stack (Elevation in Dark)
- **L0 — Chrome** (#05070A): The lowest visible surface. Sidebar, topbar, fixed chrome. Nothing sits below this in the UI.
- **L1 — Base** (#07090C): The page background. Content renders here.
- **L2 — Card** (#0F172A): Cards, table rows on hover, input fields, side panels. The primary content unit.
- **L3 — Elevated** (#162030): Dropdowns, popovers, command palette, floating tooltips. Always appears above cards.
- **Highlight** (#FFFFFF0A): Row hover state. A whisper above L1. Not a surface; a state.

### Shadows (Used Sparingly)
- **Popover Shadow** (`0 8px 32px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4)`): Dropdowns and popovers only. Heavy shadow on dark surfaces because the L3/L1 delta is small.
- **Accent Glow** (`0 0 0 1px rgba(6, 182, 212, 0.4), 0 0 24px rgba(6, 182, 212, 0.2)`): The CTA accent button at rest and focused primary inputs. The only glow in the system.
- **Frame Shadow** (`0 24px 80px rgba(0, 0, 0, 0.7)`): Browser preview frame. Used once per major section.

### Named Rules
**The Lighter-Up Rule.** Elevation goes toward lighter surfaces, never toward shadows. A component that needs to float above the page gets Surface Elevated (#162030), not a box-shadow. The only exceptions are popovers (which need the shadow to separate from an already-dark L2), the accent glow (the system's one glow), and the frame shadow.

**The One-Glow Rule.** Accent Glow is the only glow in the system. No second glow on any element.

## 5. Components

### Buttons

On dark surfaces, the button hierarchy reads differently. The accent button is the most visible element on the page (cyan on dark). The primary button recedes. The ghost button nearly disappears.

- **Shape:** 10px radius (base) standard; 12px large; 8px small.
- **Heights:** 38px standard, 46px large, 32px small.
- **Accent (primary CTA):** #06B6D4 fill, #042F36 text. Accent Glow at rest. Hover: #22D3EE, translateY(-1px). The single most visible interactive element on any page. Use once per primary action zone.
- **Primary (elevated fill):** Surface Elevated (#162030) fill, Ink Primary text. Ghost Border stroke. Hover: Surface Highlight overlay, translateY(-1px). For confirm/save actions where cyan would be too loud.
- **Ghost (stroke):** Ghost Border stroke, transparent fill, Ink Secondary text. Hover: Surface Highlight fill. For cancel, secondary, tertiary actions.
- **Link:** No background, no border. Accent Cyan text. Hover: Cyan Deep. Inline text actions only.
- **Transitions:** transform 0.12s cubic-bezier(0.19, 1, 0.22, 1), color/background/border 0.15s ease.

### Status Pills

Read-only state indicators. Never interactive. Never navigation.

- **Live:** `rgba(16,185,129,0.12)` background, `rgba(16,185,129,0.30)` border, #34D399 ink (brighter green for dark). 6px green dot with `box-shadow: 0 0 0 3px rgba(16,185,129,0.18)`.
- **Paused:** Surface Highlight background, Ghost Border stroke, Ink Quaternary text. Muted dot.
- **Error:** `rgba(239,68,68,0.12)` background, `rgba(239,68,68,0.30)` border, #F87171 ink.
- **Pending:** Surface Highlight, Ghost Border, Ink Quaternary. Pulsing dot (ambient, no sweep).

### Monitor / Alert List Rows

The primary content unit. Not cards. Dense rows with the clip-path sweep on mount.

- **Background at rest:** transparent (sits on Surface Base).
- **Background on hover:** Surface Highlight (#FFFFFF0A). No border change on hover.
- **Anatomy:** status dot (6px) + name (Inter 500, Ink Primary) + URL (Geist Mono 12px, Ink Tertiary) + interval badge (pill) + timestamp (Geist Mono, Ink Quaternary) + change % (colored) + action buttons (appear on hover only).
- **Row divider:** 1px Ghost Border Soft between rows.
- **Entrance:** clip-path sweep, 60ms stagger per row. Each row sweeps left-to-right once on mount.

### Cards / Panels

Used for summary widgets, settings sections, and contained data panels. Not for monitor lists.

- **Background:** Surface Card (#0F172A).
- **Border:** 1px Ghost Border (#FFFFFF14).
- **Radius:** 14px (rounded.md).
- **Padding:** 24px standard, 20px compact (inner sections, table headers).
- **Shadow:** none at rest. Popover Shadow when floating.
- **Header band:** if the card has a title row, separate it with a 1px Ghost Border Soft bottom. Title in Title scale (600, 15px). Action in top-right.

**The No-Nesting Rule.** Cards may not contain other cards. A bordered inner section uses a Ghost Border divider, not a nested card with its own radius.

### Inputs / Text Fields

- **Background:** Surface Card (#0F172A). Inputs sit one layer above the page.
- **Border:** 1px Ghost Border. No fill change on hover.
- **Focus:** border shifts to accent-cyan (#06B6D4), `box-shadow: 0 0 0 3px rgba(6,182,212,0.15)`. Not the full Accent Glow: that belongs to CTA buttons only.
- **Height:** 40px standard.
- **URL / selector / regex inputs:** Geist Mono 13px, Ink Secondary placeholder in Ink Quaternary.
- **Error:** border-red, `rgba(239,68,68,0.15)` ring. Red ink message below.
- **Disabled:** Surface Base background (one step down), Ink Quaternary text.

### Navigation (Sidebar)

- **Background:** Surface Chrome (#05070A). One layer below the content.
- **Width:** 64px collapsed (icons only), 220px expanded.
- **Item:** 36px height, 12px horizontal padding, 8px border-radius. Icon (16px) + label (Inter 500, 13.5px) at 10px gap.
- **Default:** Ink Tertiary icon and text. Transparent background.
- **Hover:** Surface Highlight (#FFFFFF0A) fill. Ink Secondary text.
- **Active:** Accent Wash (#06B6D426) fill. Electric Cyan icon and text. The committed step: the fill, not just the color.
- **Section dividers:** 1px Ghost Border Soft. Label: 10px uppercase 0.10em tracking, Ink Quaternary.
- **No left-stripe borders.** Active state is the tinted fill, not a border-left stripe.
- **Entrance on first render:** clip-path sweep on sidebar items, 60ms stagger. Once per session.

### Filter Pills

- **Default:** Ghost Border stroke, transparent background, Ink Tertiary text, 30px height, 12px h-padding, pill radius.
- **Hover:** Ghost Border stroke, Surface Highlight background.
- **Active:** Accent Wash background (#06B6D426), Electric Cyan text (#06B6D4), `rgba(6,182,212,0.25)` border. The committed look.
- **Transition:** background 0.12s ease, color 0.12s ease, border-color 0.12s ease.

### Diff Highlight (Signature Component)

The most important display element. Inline tinted spans for before/after comparison.

- **Added:** `background: rgba(16,185,129,0.14)`, color #34D399 (brighter for dark), 4px radius, 1px 6px padding.
- **Removed:** `background: rgba(239,68,68,0.14)`, color #F87171, `text-decoration: line-through 1.5px`, 4px radius, 1px 6px padding.
- No border stripes. No block annotation boxes. The background tint is the full annotation.

### Motion: Clip-Path Sweep (Signature Entrance)

The system's identity motion. One grammar applied to all entering content.

```css
@keyframes sd-sweep-in {
  from {
    clip-path: inset(0 100% 0 0);
    opacity: 0;
  }
  to {
    clip-path: inset(0 0% 0 0);
    opacity: 1;
  }
}

.sd-sweep {
  animation: sd-sweep-in 350ms cubic-bezier(0.19, 1, 0.22, 1) both;
}

@media (prefers-reduced-motion: reduce) {
  .sd-sweep {
    animation: none;
    opacity: 1;
    clip-path: none;
  }
}
```

Applied to: monitor rows on page mount, alert rows on page mount, page section headers on route change. Stagger: 60ms per item (`animation-delay: calc(var(--index) * 60ms)`).

**Not applied to:** sidebar chrome, topbar, page shell, persistent UI, modals, tooltips, or any element that is already visible before a route change.

**Secondary motion:** live-dot ambient pulse (2s ease-in-out, infinite loops, Positive Green dot only), page header blur-opacity reveal on route change (400ms, `filter: blur(4px) → blur(0)` + opacity 0→1), button hover lift (120ms translateY(-1px)).

## 6. Do's and Don'ts

### Do:
- **Do** use the clip-path sweep as the only entrance animation. One grammar, everywhere it applies. Stagger at 60ms per row.
- **Do** gate the sweep — and all ambient motion — behind `prefers-reduced-motion: reduce`. The motion is identity, not requirement.
- **Do** use Electric Cyan for all active/selected states: nav items, filter pills, selected rows, focus rings, primary CTAs. At 20-30% presence: committed, not restrained.
- **Do** use Geist Mono for every technical value: URLs, percentages, counts, timestamps, selectors. Ink Tertiary on dark surfaces.
- **Do** use the three-layer dark stack in order: Chrome → Base → Card → Elevated. Never invert the order.
- **Do** pair every color-based status indicator with a label or icon. On dark surfaces, color contrast alone is insufficient.
- **Do** keep button hover states minimal: translateY(-1px), 120ms, ease-out-expo. Not theatrical.
- **Do** write system copy in a direct, calm voice with no exclamation points. "Monitor paused." not "Monitor paused!"
- **Do** support RTL layout and the Cairo font for Arabic locale.
- **Do** show action buttons on monitor rows only on hover. Persistent action icons create visual noise across a list.

### Don't:
- **Don't** use any entrance animation other than the clip-path sweep. No fade-up, no scale-in, no blur-reveal as a list entrance. The sweep is the grammar; a second grammar is noise.
- **Don't** apply the sweep to persistent chrome (sidebar, topbar, page shell, fixed headers). Only content that arrives on the page sweeps in.
- **Don't** use bouncy, elastic, or spring-physics easing. ease-out-expo only. Motion stops decisively, not playfully.
- **Don't** recreate the SaaS-cream dashboard pattern: white backgrounds, pastel card grids, stock illustration heroes. The dark three-layer stack is the answer.
- **Don't** use neon effects, heavy glow on non-CTA elements, matrix-green, or terminal cosplay. The One-Glow Rule applies: one glow, on the accent CTA and focused inputs.
- **Don't** build five-level navigation hierarchies or stack modals. Two clicks maximum.
- **Don't** use emoji as UI elements or add consumer-app playfulness.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe. Rewrite with fill, full border, or nothing.
- **Don't** use gradient text (`background-clip: text` + gradient). Single solid color.
- **Don't** use the hero-metric template (big number, small label, gradient accent) anywhere inside the dashboard shell.
- **Don't** use Green, Red, or Amber for anything except diff text, error states, and monitor status. A green button is a violation.
- **Don't** nest cards inside cards. A bordered inner section gets a Ghost Border divider, not a nested card.
- **Don't** apply shadows to cards or rows at rest. Elevation is surface stepping. Shadows are for popovers and the frame.
