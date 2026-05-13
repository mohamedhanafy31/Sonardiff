@AGENTS.md

# Frontend — Claude Code Guide

Next.js 15 dashboard using the App Router.
Port: **3000**. Language: TypeScript + Tailwind CSS.

---

## Commands

```bash
pnpm run dev      # dev server with HMR
pnpm run build    # production build
pnpm run start    # serve production build
pnpm exec tsc --noEmit  # type-check
```

Always verify `pnpm run build` succeeds before reporting a task done.
Never claim a UI task is complete without opening the feature in a browser.

---

## Route map

```
app/
├── page.tsx                       → redirects to /dashboard or /login
├── (auth)/
│   ├── login/page.tsx             Login form (email + password)
│   └── register/page.tsx          Register form
└── (dashboard)/
    ├── layout.tsx                 Sidebar + topbar shell; guards auth
    ├── dashboard/page.tsx         Overview stats
    ├── monitors/
    │   ├── page.tsx               Monitor list
    │   ├── new/page.tsx           Create monitor (multi-step form)
    │   ├── [id]/page.tsx          Monitor detail + snapshot history
    │   ├── [id]/edit/page.tsx     Edit monitor
    │   └── [id]/diffs/[diffId]/page.tsx  Diff viewer
    ├── alerts/page.tsx            Alert log
    ├── history/page.tsx           Global change history
    ├── dom-picker/preview/page.tsx  CSS selector tester (Pro)
    ├── billing/page.tsx           Plan + usage
    ├── schedules/page.tsx         Check schedule overview
    ├── settings/page.tsx          Account settings
    └── team/page.tsx              Team management (placeholder)
```

---

## Key components

### `src/components/monitors/DomPickerModal.tsx`
Visual element picker modal. Opens over the "create monitor" form.

**How it works:**
1. `POST /api/dom-picker/screenshot` → receives JPEG base64 + element bounding boxes.
2. Renders the screenshot as an `<img>`. Hover hit-tests boxes client-side.
3. Click → `POST /api/dom-picker/resolve` → returns selector + ancestors/children.
4. Bottom bar: Wider/Narrower/sibling navigation + Apply.

**State notes:**
- Body scroll is locked (`document.body.style.overflow = 'hidden'`) while open.
- `refreshKey` bump forces re-fetch (used by Refresh button).
- `handleScroll` clears stale hover highlight when the image scrolls under the cursor.
- Overlay label renders below the element when `topPct < 2%` to avoid clipping.

**Coordinate math:** `toNative(clientX, clientY)` converts viewport mouse coords →
native page coords using `getBoundingClientRect()` scale factors. This is correct even
when the inner `overflow-y-auto` container is scrolled.

### `src/components/monitors/CssSelectorHelpAnimation.tsx`
Animated explainer shown on the "CSS selector" field. No backend dependency.

### `src/components/monitors/DiscoveryStep.tsx`
Site-discovery / sitemap crawl step in the "create monitor" multi-step form.

### `src/lib/api.ts`
Axios instance pre-configured with `baseURL = /api` (proxied to backend via
`src/proxy.ts`) and `withCredentials: true` for session cookie.

### `src/lib/store.ts`
Zustand store. Holds `user: User | null` and `setUser`. Populated on app load via
`GET /api/auth/me`. Used everywhere auth state is needed.

---

## Design system

Tailwind + CSS custom properties in `src/app/globals.css`.

| CSS var | Meaning |
|---|---|
| `--bg` | Page background (`#09090B`) |
| `--bg-card` | Card / panel surface |
| `--bg-muted` | Subtle hover / inactive backgrounds |
| `--foreground` | Primary text |
| `--ink-2`, `--ink-3`, `--ink-4` | Secondary / tertiary / disabled text |
| `--accent` | Electric Cyan `#06B6D4` — primary CTA colour |
| `--line` | Border colour |
| `--red`, `--red-ink`, `--red-bg` | Danger state |

**Utility classes:**
- `btn accent` — filled cyan button
- `btn primary` — alias for accent in some contexts
- `font-display` — heading weight/tracking preset

Do not hard-code hex values in component files. Always use CSS vars or Tailwind tokens.

---

## Auth guard

`(dashboard)/layout.tsx` calls `GET /api/auth/me` on mount. If the response is 401,
it redirects to `/login`. Components inside the dashboard group can safely assume
`user` is non-null in the Zustand store.

---

## Pro gate

`user?.plan !== 'pro'` is the client-side check. Backend enforces it independently.
Show a `bg-amber-50` warning banner for free users on Pro-only pages (see
`dom-picker/preview/page.tsx` for the pattern).

---

## API proxy

`src/proxy.ts` re-exports Next.js rewrites: `/api/*` → `http://localhost:3001/api/*`.
This means all `api.post('/dom-picker/...')` calls go to the Express backend.
In production (Docker), the backend is at `http://backend:3001`.

---

## Rules

- Read `node_modules/next/dist/docs/` before using a Next.js API you're unsure about.
  This version has breaking changes from what training data contains.
- All new pages inside `(dashboard)/` must be `'use client'` or wrapped in a
  client boundary — the layout uses client-side auth state.
- Do not use `<a>` for internal navigation — use Next.js `<Link>`.
- Do not add `console.log` in production paths.
- DOM picker modal is Pro-only — do not remove the plan check.
