# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

Build in progress. Planning is complete (`/plan/00`–`09`). Phases 0–4 are built and the app compiles clean (`npm run build`). Track build progress against `plan/07-build-phases.md`. See **Build Progress & Pending Tasks** below for what's done and what's left.

## Build Progress & Pending Tasks

### Done (built + builds clean)
- **Phase 0** — scaffold (Next 16/React 19/Tailwind v4, design tokens, Supabase clients, proxy auth guard).
- **Phase 1** — Supabase schema/RLS/storage/seed as SQL migrations + middleware route guards. (Code done; migrations must be run against the live DB — see below.)
- **Phase 2** — storefront: homepage, frame detail, login/signup, privacy/terms.
- **Phase 3** — Canva Connect API: OAuth (PKCE), create-design, export (poll + Storage upload), `/design/[designId]` export screen, token refresh.
- **Phase 3.5** — Canva **Return Navigation** (`/api/canva/return`, JWT-verified).
- **Phase 4** — checkout + Razorpay (create-order/verify/webhook, pending-order pattern) + `/orders/[orderId]/confirmation`.
- **Design-method** screen with **Upload Finished Art** path (Canva-independent — works today).
- **Phase 7 (partial)** — design applied to: homepage, product detail, design-method, checkout, confirmation.
- **Frame preview / virtual try-on** (`plan/10`) — BUILT. `src/components/FramePreview.tsx` is a **native HTML5 Canvas 2D** component (NOT Konva — `react-konva` is fragile on React 19/Next 16/Turbopack; native canvas gives the same drag/zoom + `toDataURL` composite with zero deps). Layered molding + image (drag/pan + wheel-zoom) + finish overlay (`gloss`/`glass` gradients); `editable` + read-only modes; `capture()` imperative handle returns `{dataUrl, crop}`. Real `frame_styles` + `finishes` tables (price modifiers) + `design_sessions` (carries size/style/finish + crop through steps and the Canva redirect) via migration `0006`. **Mat board still DEFERRED.**
- **Designer flow** (`plan/11`) — BUILT. Framebridge-modelled stepped builder, brutalist-skinned per plan/11 §4 token map. Routes: `/design/start` (StartChooser: Upload vs Canva) → `/design/[sessionId]/{upload,size,frame,review}`. Split-screen, live `<FramePreview>`, **user's photo composited into every frame-style thumbnail**, DPI badge + max-print disclosure on Size, colour filter + finish sub-control on Frame, itemised price + final-framed-size on Review. Client working state in `src/lib/designer-state.ts` (sessionStorage) + durable `design_sessions` row; `src/lib/useDesignerImage.ts` recovers the preview image (objectURL, else signed URL) after refresh. Product CTA now routes to `/design/start?frameId=`. The old material selector in `ProductDetail.tsx` is REMOVED (style/finish now chosen in the flow). Canva path: size→frame→`create-design` (carries `sessionId` via `correlation_state`/OAuth cookie)→editor→`/api/canva/return` lands on `/design/[sessionId]/review`.
- **Pricing** — `create-order` computes `frame.price + frame_style.price_modifier + finish.price_modifier` server-side and persists `frame_style_id`/`finish_id`/`design_session_id`/`mockup_path` on the order. Checkout handoff (`src/lib/checkout.ts`) extended with these fields.

### Pending (not built yet)
- **Phase 5** — `/orders` history list + `/orders/[orderId]` detail w/ status stepper + tracking. (The "View Order" button already links to `/orders/[orderId]` — currently 404s.) Data layer exists: `getOrdersForUser` / `getOrderForUser` in `src/lib/data/orders.ts`.
- **Phase 6** — admin dashboard: `/admin` order list, `/admin/orders/[orderId]` detail, `PATCH /api/admin/orders/[orderId]` (status + tracking), download print-file route. Enforce admin via `isAdmin()` / `is_admin()`.
- **Phase 7 (remaining)** — apply the brutalist design to the still-old pages: `/login`, `/orders*`, plus `Navbar`/`Footer` (homepage uses `MobileTopBar`/`BottomNav`; other pages still use the older generic `Navbar`/`Footer` — visual inconsistency).
- **Phase 8** — error/edge-case hardening, loading states, `error.tsx`/`not-found.tsx` boundaries.
- **Phase 9** — pre-launch checklist (RLS audit, live Razorpay/Canva, domain, privacy/terms finalised).

### Pending user/ops actions (block live testing, not code)
- **Run migrations in Supabase SQL editor:** `0001`, `0002`, `seed`, then `0003`, `0004`, `0005`, then `0006` (frame_styles + finishes + design_sessions + order columns + seeds the starter styles/finishes). The designer flow needs `0006` run before it works end-to-end.
- **Canva:** fill `CANVA_CLIENT_ID`/`SECRET`; set Authorized redirect = `…/api/canva/callback` and Return URL = `…/api/canva/return`; submit for public review (weeks-long launch blocker, Q-1).
- **Razorpay:** fill test keys + `RAZORPAY_WEBHOOK_SECRET`; register webhook → `/api/payments/webhook` (events `payment.captured`, `order.paid`). Local webhooks need a tunnel (ngrok); the verify path works without it.
- **Admin account:** set `app_metadata.role='admin'` via SQL for the admin user (needed to test Phase 6).
- **Dev gotcha:** always use `http://127.0.0.1:3000` (the layout auto-redirects from `localhost`) — Canva OAuth cookies are host-scoped to `127.0.0.1`. Run only ONE dev server (orphaned servers on Windows corrupt the shared `.next` cache → spurious 404s).

### Resolved FLAG (verified against live Canva export API, 2026-06-16)
- `src/lib/canva.ts` export format — **code was correct; the bundled `docs/canva-connect-api-docs.md` §10 was outdated.** Live [Create design export job](https://www.canva.dev/docs/connect/api-reference/exports/create-design-export-job/) confirms: format `type` is lowercase `"pdf"` (not `"PDF_PRINT"`), and download URLs are at `job.urls` (not `job.result.urls`) — both match the code.
- **Fixed — `export_quality: "pro"` plan-gating.** Enum is `"regular"` (default) | `"pro"`; `"pro"` is print-quality but fails for Free-plan customers (the normal case), returning `job.error.code = "license_required"` / `"approval_required"`. `exportAndWait` now requests `"pro"` first and **transparently retries once at `"regular"`** on those error codes (`canva.ts`: `runExportJob` + `CanvaLicenseError`), so Free customers still get a PDF. The export `size` field (`"a4"` etc.) is Canva-Docs-only — do NOT add it; A4 dimensions come from design creation, not export.

## Commands

- `npm run dev` — local dev server (http://localhost:3000)
- `npm run build` — production build (also runs full TS typecheck)
- `npm run typecheck` — `tsc --noEmit`, strict mode
- `npm run lint` — ESLint

## Installed Stack (actual versions)

Latest stack was chosen over the plan's original "Next 14 / Tailwind v3" assumption:

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript 5** (strict)
- **Tailwind CSS v4** — config lives in `src/app/globals.css` via `@theme`, NOT a `tailwind.config.ts`. Design tokens (action-red, neon-accent, fonts) are CSS custom properties there.
- **Next 16 `proxy` convention** — root middleware is `src/proxy.ts` exporting a default `proxy` function (the old `middleware.ts` convention is deprecated). The actual auth/guard logic is in `src/lib/supabase/middleware.ts`.
- `@supabase/ssr` + `@supabase/supabase-js` · `razorpay` (Node SDK)

## Key Conventions

- Supabase clients: `src/lib/supabase/client.ts` (browser CC), `server.ts` (RSC/route handlers + `createServiceClient` for RLS-bypass), `middleware.ts` (session refresh in proxy).
- Env access is centralised in `src/lib/env.ts` — `publicEnv` (browser-safe) and `serverEnv` (lazy server-only getters that throw if missing). All keys documented in `.env.local.example`.
- DB row types are hand-maintained in `src/lib/supabase/types.ts` (mirrors `plan/03-supabase-schema.md`). **Row types must be `type` aliases, never `interface`** — interfaces lack an implicit index signature and fail supabase-js's `GenericTable` constraint, making every `.insert()/.upsert()` argument collapse to `never[]`. The `Database` type also needs `__InternalSupabase: { PostgrestVersion }` and `{ [_ in never]: never }` (not `Record<string,never>`) for the empty Views/Functions/Enums/CompositeTypes maps.
- Brutalist design enforces 0px radius globally via a `* { border-radius: 0 !important }` rule in `globals.css`.

## What This Project Is

A print-on-demand web platform for the Indian market (brand: PosterX / Framers). Users select a physical frame size, design it via Canva (OAuth redirect flow), then checkout with UPI. There is also an admin dashboard for order and delivery management.

Target audience: Indian automotive enthusiasts (Kerala-first). Mobile-first. UPI-first.

## Decided Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript (strict mode) |
| Database / Auth | Supabase |
| Styling | Tailwind CSS + shadcn/ui |
| Payments | Razorpay (UPI) |
| Design integration | Canva Connect API v1 |

## Repository Layout

```
/design/          — Design mockups (PNG) + design system spec. Do NOT open PNGs until Phase 7 of the build.
/design/high_octane_minimalist/DESIGN.md  — Full design system: colors, typography, spacing, component rules
/docs/PosterX.txt — Business context, prior research, Canva API analysis, Instagram data
/posterx_posters/ — 24 product poster images (JPGs) for the catalog
/plan/            — Will contain 10 planning documents (created during planning session)
```

## Design System (from `design/high_octane_minimalist/DESIGN.md`)

- **Aesthetic:** Brutalist Minimalism — no shadows, no gradients, no border radius (0px everywhere)
- **Colors:** Black/white base · `action-red: #FF0000` · `neon-accent: #CCFF00`
- **Fonts:** Montserrat (headlines, 900/800 weight, all-caps) · Hanken Grotesk (body) · Space Grotesk (labels/metadata)
- **Spacing:** 8px base unit · 20px mobile margin
- **Depth:** Bold 2–3px solid black borders only — never box-shadow or blur
- **Grid:** 4-column mobile, 12-column desktop

## Canva Integration Reality

The Canva Connect API **cannot embed the editor in an iframe**. The flow is always a redirect:

1. App calls `POST /rest/v1/designs` to create a design with preset dimensions
2. App redirects the user to `https://www.canva.com/design/{designId}/edit`
3. User designs in Canva, then returns to the app
4. App calls `POST /rest/v1/exports` to export the design, then polls `GET /rest/v1/exports/{exportId}`

Public integrations require Canva review/approval before non-developer users can authenticate. This is a launch blocker — see `plan/08-open-questions.md` once it exists.

**Return navigation** brings the user back after designing: the editor URL carries `correlation_state` (the frame id); Canva's "Return to Framers" button hits `GET /api/canva/return?correlation_jwt=...`; that route verifies the JWT (jose, against `CANVA_JWKS_URL`, audience = client id, `type === "rti"`), then redirects to `/design/{designId}?frameId=...` where the export runs. Requires the **Return URL** to be set in the Developer Portal (`/api/canva/return`). The OAuth callback now sends the user to the Canva editor (not `/design`) so they design first.

## Known Design/Model Gaps (flagged, not yet resolved)

- **Material selector** (`ProductDetail.tsx`: Matte/Glossy/Premium) is **visual-only** — the `frames` schema has no material column or per-material pricing. Selecting a material does not persist or change price. **Resolution planned in `plan/10-frame-preview-visualizer.md`** (real `frame_styles` + `finishes` tables with price modifiers, persisted on the order). Mat board deferred — see Pending above.
- **Design method** screen (`/frames/[slug]/design-method`) is BUILT with two paths: "Design in Canva" (needs CANVA_CLIENT_ID/SECRET — returns a clear 503 when unconfigured) and "Upload Finished Art" (Canva-independent — uploads JPG/PNG/PDF straight from browser to Supabase Storage). The product CTA ("Choose Design Method") routes here.
- **Upload path schema**: migrations 0003 (orders: `design_source` column, nullable `canva_design_id`/`design_preview_path`) and 0004 (storage INSERT policy for `{userId}/uploads/*`) MUST be run in Supabase before uploads work. Both checkout paths hand off via `sessionStorage["framers_checkout"]` carrying `{designSource, frameId, printPath, previewPath, designId}`.

## Key Business Rules

- Admin role is determined by `app_metadata.role = 'admin'` in Supabase Auth (NOT `user_metadata`, which users can edit themselves — security fix vs. the original plan). Set it via SQL with the service role: `UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb WHERE email = '...'`. Check it only via `isAdmin()` in `src/lib/auth.ts` or `public.is_admin()` in SQL/RLS.
- All prices in INR (paise for Razorpay)
- Razorpay webhook signature must be verified server-side before creating any order record
- **Checkout/payment flow (Phase 4, built):** pending-order pattern. `POST /api/payments/create-order` reads the price from the DB (never trusts the client), creates a Razorpay order + a `payment_status='created'` order row, returns `{keyId, razorpayOrderId, amountPaise, orderId}`. Browser opens Razorpay Checkout (`src/lib/razorpay-client.ts`). On success → `POST /api/payments/verify` (HMAC of `order_id|payment_id`) flips the row to `paid`; the webhook (`/api/payments/webhook`, HMAC of raw body) does the same independently — both idempotent, webhook is source of truth. Requires migration `0005_pending_orders.sql` (nullable `razorpay_payment_id`, `payment_status` default `created` + states created/paid/failed/refunded) and `RAZORPAY_WEBHOOK_SECRET`. Register the webhook URL in the Razorpay dashboard pointing at `/api/payments/webhook` (events: `payment.captured`, `order.paid`).
- Canva OAuth tokens per user are stored in a `canva_tokens` table; refresh logic must handle expiry

## Planning Session Convention

During the planning phase, all output goes into `/plan/` as markdown files. No application code, no package installs, no files outside `/plan/` (except this CLAUDE.md). The 10 planned documents are numbered `00` through `09`.
