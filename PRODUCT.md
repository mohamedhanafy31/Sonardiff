# Product

## Register

product

## Users

Startup founders and mid-level business operators who need to track competitor websites: product pages, pricing, job listings, blogs, and news. They check the dashboard after getting an alert, not before. Their session is short, purposeful, and action-oriented. They are not power users by default; they are busy people who need a tool that gets out of the way and just works.

Secondary market: MENA/Arabic-speaking businesses. RTL layout and Arabic locale support are a standing requirement, not an afterthought.

Plans:
- Free: 5 monitors, 24h check interval, 150 checks/month
- Pro: 50 monitors, 1h check interval, 36,000 checks/month. CSS selector targeting (DOM picker) and hourly checks are Pro-only.

## Product Purpose

SonarDiff monitors any URL on a schedule, diffs the visible text content against a stored baseline, and sends an alert when something meaningful changes. The core differentiator is deterministic, noise-free diffing: threshold-gated semantic comparison rather than pixel diff or AI guessing. A visual DOM picker lets Pro users target a specific CSS selector instead of monitoring the whole page. Transparent quota billing shows exact check costs before the user saves a monitor.

Success looks like: a founder gets an alert that a competitor dropped their price, clicks through, sees the before/after diff, and acts on it — all in under two minutes.

## Brand Personality

Reliable, Sharp, Calm

Not a flashy intelligence tool. Not an enterprise platform with a hundred features. A precise instrument that does one thing well and never panics. The voice is direct and informative. No exclamation points in system copy. No "Amazing!" confirmations.

## Anti-references

- **Typical SaaS-cream dashboard.** White background, rounded card grids, pastel badges, stock illustration hero, the same layout as every B2B tool from 2019. SonarDiff should be immediately distinguishable.
- **Neon dark mode / hacker aesthetic.** Heavy glow effects, matrix green, terminal cosplay. The cyan accent is used sparingly for function, not as decoration.
- **Enterprise bloat.** Dense tables with every possible column, five-level navigation hierarchies, modal layered on modal. Everything must be reachable in two clicks.
- **Overly playful / consumer app.** Emoji as UI elements, bouncy animations, Duolingo energy. Wrong register for a B2B monitoring tool used by people making business decisions.

## Design Principles

1. **Signal over surface.** The product's value is filtering noise. The UI must model that: show what changed, where, and when. Suppress everything else. A page with one alert in it should feel decisive, not empty.

2. **Calm at high stakes.** An alert means something changed. The UI should not amplify anxiety. Destructive changes and clean states should both read clearly without alarm-bell visual language.

3. **Transparent by default.** Quota consumption, schedule costs, diff thresholds — all shown upfront, not buried in settings. Users should never be surprised by a bill or a missed alert.

4. **Precision over coverage.** Like the CSS selector targeting, the interface picks the right element rather than the safe one. Fewer, better controls beat exhaustive option surfaces.

5. **Expert without effort.** Playwright scraping, stealth rendering, and tiered fetcher logic all happen invisibly. The surface stays simple. Complexity is earned by the system so the user doesn't have to earn it themselves.

## Accessibility & Inclusion

- WCAG 2.1 AA minimum for all dashboard surfaces.
- RTL layout support for Arabic (Cairo font loaded, `dir="rtl"` at locale level).
- Reduced-motion: all ambient animations gated behind `prefers-reduced-motion`.
- Color meaning never used alone: status indicators pair color with icon or label.
