# SonarDiff Frontend

Next.js dashboard for the SonarDiff website change monitoring platform.

## Stack

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS
- **UI components:** shadcn/ui (Radix primitives)
- **Forms:** React Hook Form + Zod
- **State:** Zustand
- **HTTP:** Axios
- **Theming:** next-themes (light / dark / system)
- **Icons:** Lucide React

## Setup

```bash
pnpm install
cp .env.local.example .env.local   # or set NEXT_PUBLIC_API_URL manually
pnpm run dev   # http://localhost:3000
```

## Environment variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (default: `http://localhost:3001/api`) |

## Scripts

| Command | What it does |
|---|---|
| `pnpm run dev` | Dev server on `:3000` |
| `pnpm run build` | Production build |
| `pnpm run start` | Serve production build |
| `pnpm run lint` | ESLint |

## App structure

```
src/
├── app/
│   ├── layout.tsx            Root layout (font vars, ThemeProvider)
│   ├── page.tsx              Public landing / redirect
│   ├── not-found.tsx         404 page
│   ├── (auth)/               Auth route group (no sidebar)
│   │   ├── login/page.tsx    Login form
│   │   └── register/page.tsx Registration form
│   └── (dashboard)/          Protected route group (sidebar layout)
│       ├── layout.tsx        Sidebar + header shell
│       ├── dashboard/        Overview stats
│       ├── monitors/         Monitor list, create, detail, edit
│       ├── alerts/           Alert history
│       ├── history/          Snapshot / diff history
│       ├── schedules/        Check schedule viewer
│       ├── billing/          Plan + quota display
│       ├── settings/         Account settings
│       └── team/             Team management (Pro)
├── components/
│   ├── ThemeProvider.tsx     next-themes wrapper
│   ├── ThemeToggle.tsx       Light/dark toggle button
│   ├── Logo.tsx              SonarDiff [+-] logo
│   ├── dashboard/            Dashboard-specific components
│   └── monitors/             Monitor-specific components
└── lib/
    ├── api.ts                Axios instance pointing to backend API
    ├── store.ts              Zustand auth + user store
    └── utils.ts              cn() and other utilities
```

## Auth flow

Session cookie is set by the backend on login. The frontend reads `/api/auth/me` on load to hydrate the Zustand store. Protected routes redirect to `/login` if the store has no user.

## Design tokens

| Token | Value |
|---|---|
| Background | `#09090B` |
| Accent (cyan) | `#06B6D4` |
| Success (green) | `#10B981` |
| Danger (red) | `#EF4444` |
| Fonts | Inter (UI) · Geist (headings) · Geist Mono (code) |
