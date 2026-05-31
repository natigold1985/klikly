# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint check
npm run lint:fix     # Auto-fix lint errors
```

The app requires a `.env.local` file to run:
```
VITE_BASE44_APP_ID=<app_id>
VITE_BASE44_APP_BASE_URL=<backend_url>
```

## Architecture

**Klikly** is a Hebrew-language SaaS CRM for photographers, built on the [Base44](https://base44.com) platform. The frontend is React 18 + Vite + Tailwind CSS. All business logic and data persistence go through the Base44 SDK — there is no custom backend in this repo.

### Data layer

All data access goes through `src/api/base44Client.js`, which exports a single `base44` client. Entities are defined as JSON schemas in `base44/entities/*.jsonc`. CRUD operations follow this pattern:

```js
base44.entities.Lead.list('-created_date', 1000)
base44.entities.Lead.filter({ created_by: user.email }, '-created_date', 500)
base44.entities.Lead.create({ name, phone })
base44.entities.Lead.update(id, { status: 'closed_won' })
```

Auth is via `base44.auth.me()` / `base44.auth.logout()`. The `AuthContext` (`src/lib/AuthContext.jsx`) wraps the whole app and exposes `useAuth()`.

Server-side functions are invoked with `base44.functions.invoke('functionName', payload)`.

### State management

All remote data fetching uses **TanStack Query** (`@tanstack/react-query`). The shared `QueryClient` is in `src/lib/query-client.js` (`refetchOnWindowFocus: false`, `retry: 1`). Query keys consistently include `user.email` and role so admin vs. non-admin users get separate cache entries.

### Routing

Page routing is defined in `src/pages.config.js` (auto-generated — do not edit the `PAGES` object manually; add new pages by creating files in `src/pages/`). Additional routes not covered by `pages.config.js` are registered directly in `src/App.jsx`. Public routes (no auth) include `/gallery/:folderId`, `/g/:token`, `/quote/view`, and `/contact`.

### Role system

Three roles exist: `admin`, `user`, `client`.
- **admin**: full access; hardcoded override for `natigold04@gmail.com`
- **user**: photographer; sees their own leads/projects only
- **client**: redirected to `/FileStorage` on login; blocked from admin pages with a logged security incident

Role is sourced from the `TeamMember` entity and synced to `User.role` on login (triggers a page reload if changed). Check `isAdmin` / `isClient` at the top of pages/layout before rendering admin-only UI.

### Layout

`src/Layout.jsx` renders a black sidebar on desktop and a bottom nav bar + hamburger drawer on mobile. The layout is fully RTL (`dir="rtl"`). Pages in `noLayoutPages` (`DownloadPage`, `QuoteView`) render without any nav wrapper.

### Lead status

Lead statuses have two representations — English enum values stored in the DB (`new`, `in_progress`, `follow_up`, `quote_sent`, `closed_won`, `closed_lost`) and Hebrew display labels. Always use `normalizeLeadStatus(status)` from `src/utils/leadDisplay.js` when comparing or displaying statuses. Never hardcode the Hebrew strings in comparisons.

### Key entities

| Entity | Purpose |
|---|---|
| `Lead` | CRM leads with auto-followup, pipeline, and filtering |
| `Project` | Photography projects with payment tracking |
| `Quote` / `QuoteItem` / `QuoteTemplate` | Pricing and proposals |
| `DeliveryLink` | Magic gallery links sent to clients; tracks views and downloads |
| `TeamMember` | Controls who can access the app (closed system) |
| `PhotographerSettings` | Per-account settings fetched once at layout level |
| `Task` | Internal task board |
| `SubVendor` / `VendorAssignment` | Sub-contractor management |

### UI components

All UI primitives are in `src/components/ui/` (shadcn/ui pattern with Radix UI). Feature components are organized by domain under `src/components/` (e.g. `leads/`, `storage/`, `quotes/`). Use the existing primitives — do not add new component libraries.

### Integrations

Google Drive, Gmail, and Google Sheets are configured as Base44 connectors in `base44/connectors/`. They are invoked via `base44.functions.invoke()` or through Base44 automations, not directly from frontend code.

### Style conventions

- All user-facing text is Hebrew; keep it RTL-compatible (`dir="rtl"` on containers)
- Brand colors: gold `#FFD700` / `#D4AF37` / `#C5A028`, sidebar background `#000000`
- Tailwind only — no inline styles except `dir` and CSS custom properties like `env(safe-area-inset-bottom)`
- `createPageUrl(pageName)` from `src/utils/index.ts` for all internal navigation links
