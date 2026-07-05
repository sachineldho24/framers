# 07 — Build Phases

Phases are strictly ordered by dependency. Do not start a phase until the previous phase's verification condition is met. Complexity ratings are relative to this project's scope.

---

## Phase 0 — Environment Setup & Repo Scaffold

**Goal:** A working Next.js 14 App Router project with TypeScript strict mode, Tailwind, shadcn/ui initialised, and all environment variables documented. Nothing broken; `npm run dev` runs cleanly.

**Depends on:** Nothing — this is the first phase.

**Deliverables:**
- `package.json` with Next.js 14, TypeScript, Tailwind, `@supabase/ssr`, `@supabase/supabase-js`, Razorpay Node SDK configured
- `tsconfig.json` with `strict: true`, path aliases (`@/` → `src/`)
- `tailwind.config.ts` with the High-Octane Minimalist design tokens (colors: `action-red`, `neon-accent`, surface palette; fonts: Montserrat, Hanken Grotesk, Space Grotesk via `next/font`)
- `src/app/layout.tsx` with root font classes and global CSS baseline
- `src/middleware.ts` with route protection scaffolded (protected routes array — logic filled in Phase 1)
- `.env.local.example` listing all 10 environment variables from `plan/02-architecture.md` with placeholder values
- `src/lib/supabase/` — server client, browser client, and middleware client helper functions using `@supabase/ssr`
- shadcn/ui initialised with the project's custom theme (black primary, 0px radius)
- `src/components/` and `src/app/` directory structure matching `plan/05-component-tree.md`

**Complexity:** Low

**Verification:**
- `npm run dev` starts with zero TypeScript errors
- `npm run build` completes without errors
- Navigating to `http://localhost:3000` renders a blank page without a console error
- `tsc --noEmit` passes clean

---

## Phase 1 — Supabase Setup

**Goal:** Schema, storage, RLS, seed data, and auth all working in Supabase. The application can create users and enforce row-level security.

**Depends on:** Phase 0 complete.

**Deliverables:**
- Supabase project created; URL and anon key added to `.env.local`
- All tables created from `plan/03-supabase-schema.md`: `frames`, `canva_tokens`, `orders`
- All indexes created
- RLS enabled and all policies applied on all three tables
- `set_updated_at` trigger applied to `canva_tokens` and `orders`
- `design-exports` Storage bucket created (private) with Storage policies
- Seed data: at least 3 frame variants inserted into `frames` table with correct `width_px`/`height_px` values (see `plan/01-canva-api-reality.md` dimensions table)
- `src/middleware.ts` completed: protects `/checkout`, `/orders/*`, `/design/*`, `/admin/*`; redirects unauthenticated users to `/login?next=...`; redirects non-admins away from `/admin/*`
- Supabase Auth email confirmations disabled for development (re-enable before launch)
- Supabase client helpers verified: `createServerClient`, `createBrowserClient`, `createMiddlewareClient` all instantiate without error

**Complexity:** Medium

**Verification:**
- Sign up via Supabase Auth → user appears in `auth.users`
- A SELECT query on `frames` from the anon client returns the seed rows
- A SELECT query on `orders` from the anon client returns 0 rows (RLS blocks it — no session)
- A SELECT query on `orders` from a logged-in client returns only that user's rows
- Attempting to navigate to `/orders` without being logged in redirects to `/login`
- Attempting to navigate to `/admin` as a non-admin user redirects to `/`

---

## Phase 2 — Frame Selection Homepage (Static, No Canva)

**Goal:** A fully functional, visually correct homepage and frame detail page. No Canva integration yet — the "Design This Frame" button shows a placeholder or "coming soon" state.

**Depends on:** Phase 1 complete (frames seed data must exist to render the grid).

**Deliverables:**
- `app/page.tsx` — RSC, fetches frames from Supabase, renders `HeroSection` + `FrameGrid`
- `app/frames/[slug]/page.tsx` — RSC, fetches single frame, renders detail view
- All shared components from `plan/05-component-tree.md`: `Navbar`, `FrameCard`, `Footer`, `PriceDisplay`, `OrderStatusBadge`
- `app/login/page.tsx` — email/password auth form using Supabase Auth
- Tailwind styles applied matching the High-Octane Minimalist design system: all-caps Montserrat headlines, Hanken Grotesk body, 0px border radius, action-red CTAs, 2px solid black borders
- `app/orders/page.tsx` — empty state (will be populated in Phase 5)
- Responsive layout verified at 390px (iPhone 14) and 1280px (desktop)

**Complexity:** Medium

**Verification:**
- Homepage shows all seed frames with name, dimensions, price
- Clicking a frame card navigates to the correct `/frames/[slug]` page
- Login flow creates a session and redirects correctly
- "My Orders" in the navbar changes based on auth state
- No TypeScript errors; `npm run build` passes
- Visual check: no border radius on any interactive element; headlines in Montserrat all-caps

---

## Phase 3 — Canva Connect API Integration

**Goal:** The full Canva flow works end to end: OAuth → design creation → editor redirect → return → export → preview. This is the highest-risk phase.

**Depends on:** Phase 1 (Supabase for token storage) + Phase 2 (frame pages where flow starts). Canva Developer Portal account and `CANVA_CLIENT_ID` / `CANVA_CLIENT_SECRET` must exist (see `plan/08-open-questions.md` Q-1).

**Deliverables:**
- `app/api/canva/callback/route.ts` — OAuth callback: PKCE verification, token exchange, token upsert, design creation, redirect to Canva editor
- `app/api/canva/create-design/route.ts` — creates design using stored token; returns `{ designId, editUrl }` or `{ requiresAuth: true, authUrl }` if no valid token
- `app/api/canva/export/route.ts` — creates export job, polling loop (server-side), downloads files, uploads to Supabase Storage, returns signed preview URL
- `app/design/[designId]/page.tsx` — `ExportController` CC with all states: idle, exporting, success, error (see `plan/05-component-tree.md`)
- Token refresh logic inside the API route layer (transparent to the user)
- `DesignCTASection` CC on the frame detail page wired up to trigger the flow
- PKCE utility: `generateCodeVerifier()`, `generateCodeChallenge(verifier)` in `src/lib/pkce.ts`
- Canva API client wrapper in `src/lib/canva.ts` (typed responses for designs + exports)
- Supabase Storage upload utility in `src/lib/storage.ts`

**Complexity:** High

**Verification:**
- A logged-in user can click "Design Your Frame" and be redirected to the Canva OAuth screen
- After authorising, the user is redirected to the Canva editor with a correctly-sized canvas (verify by checking canvas dimensions in Canva)
- Returning to the site and clicking "Export My Design" produces a preview image within 60 seconds
- The preview image is stored in Supabase Storage under `design-exports/{userId}/{designId}/preview.png`
- The print PDF is stored under `design-exports/{userId}/{designId}/print.pdf`
- Token refresh works: manually expire a token in the DB, retry the flow — it refreshes transparently

---

## Phase 4 — Checkout + Razorpay UPI Integration

**Goal:** A user can enter their delivery address, pay via UPI, and a verified order is created in Supabase.

**Depends on:** Phase 3 (export must complete and return `previewPath` + `printPath` before checkout is reachable).

**Deliverables:**
- `app/checkout/page.tsx` — CC with `DeliveryForm`, `OrderSummaryPanel`, `PaymentButton`
- `app/api/payments/create-order/route.ts` — creates Razorpay order, reads price from `frames` table (never trusts client price)
- `app/api/payments/webhook/route.ts` — verifies HMAC signature, creates order in Supabase (`ON CONFLICT DO NOTHING`)
- `app/api/payments/verify/route.ts` — verifies client signature, returns `{ orderId }`, handles retry logic for webhook race
- Razorpay Node SDK configured with `RAZORPAY_KEY_SECRET`
- Razorpay.js loaded client-side via `next/script` (from Razorpay CDN)
- Webhook endpoint registered in Razorpay Dashboard (test mode); `RAZORPAY_WEBHOOK_SECRET` set

**Complexity:** High

**Verification:**
- Using Razorpay test mode: complete a UPI payment with test credentials
- Order appears in `orders` table in Supabase immediately after webhook fires
- `razorpay_order_id` is unique — submitting the same payment twice does not create a duplicate order
- Intentionally send a webhook with an invalid signature → API returns 400, no order created
- User is redirected to `/orders/{orderId}/confirmation` with the correct order ID

---

## Phase 5 — Order Confirmation + User Order History

**Goal:** Users can see their past orders and track their current order status.

**Depends on:** Phase 4 (orders must exist in the database).

**Deliverables:**
- `app/orders/page.tsx` — RSC, fetches user's orders with frame names
- `app/orders/[orderId]/page.tsx` — RSC, full order detail with `OrderStatusStepper` and tracking panel
- `app/orders/[orderId]/confirmation/page.tsx` — RSC, post-payment success screen
- `OrderStatusBadge` component wired to real status values
- `OrderStatusStepper` component
- Signed URL generation for design preview on order detail page (server-side, via Supabase Storage)

**Complexity:** Low

**Verification:**
- After completing a test payment, the confirmation page shows the correct order ID
- `/orders` lists all test orders for the logged-in user
- `/orders/[orderId]` shows the design preview, delivery address, and current status
- Attempting to view another user's order ID returns a 404 (RLS prevents data leak)

---

## Phase 6 — Admin Dashboard

**Goal:** The admin can log in, see all orders, download design files, and update order status with tracking info.

**Depends on:** Phase 5 (orders and status pipeline complete).

**Deliverables:**
- `app/admin/page.tsx` — RSC, fetches all orders joined with frame names; `AdminStatusTabs` CC for filtering
- `app/admin/orders/[orderId]/page.tsx` — RSC + `OrderUpdateForm` CC
- `app/api/admin/orders/[orderId]/route.ts` — PATCH handler for status + tracking update
- `app/api/admin/orders/[orderId]/download/route.ts` — generates signed URL for print PDF
- Admin user created in Supabase: manually set `user_metadata.role = 'admin'` via Supabase Dashboard
- Middleware blocks non-admin access to all `/admin/*` routes

**Complexity:** Medium

**Verification:**
- Admin logs in and sees all test orders from Phase 4/5
- Admin updates an order to "Shipped" with a tracking number → status saved in DB
- Customer's `/orders/[orderId]` page now shows the tracking number
- Non-admin user navigating to `/admin` is redirected to `/`
- "Download Print File" button opens the correct PDF

---

## Phase 7 — Mobile-First UI Polish

**Goal:** The visual design matches the `/design/` mockups. All pages are polished and production-ready at 390px and 1280px.

**Depends on:** Phase 6 (all features complete before polishing).

**Deliverables:**
- Open and reference all 4 design mockup PNGs in `/design/posterx_*/screen.png`
- Apply pixel-accurate spacing, typography, and colour from `DESIGN.md` to all pages
- Product images: integrate `posterx_posters/` JPGs as sample images on frame detail pages
- Loading skeletons on all async-heavy components (export progress, design preview)
- All interactive states: hover (border colour change), active, focus-visible (keyboard nav)
- `FrameImageCarousel` on frame detail page — touch-swipeable on mobile
- Vercel OG image for social sharing meta tags

**Complexity:** Medium

**Verification:**
- Visual comparison against each mockup PNG — no obvious deviations
- All pages pass Chrome DevTools mobile emulation at 390px with no horizontal scroll
- All buttons and links have visible focus rings for accessibility
- Lighthouse mobile score ≥ 80 on Performance, 100 on Accessibility

---

## Phase 8 — Error Handling, Edge Cases, Loading States

**Goal:** Every failure point from `plan/06-user-flows.md` has a graceful UI treatment. No blank screens, no unhandled promise rejections.

**Depends on:** Phase 7 (UI must be styled before error states are designed in).

**Deliverables:**
- `app/error.tsx` and `app/not-found.tsx` global error boundaries
- Per-page error.tsx for `/admin` and `/orders`
- All API routes return structured error JSON: `{ error: { code: string, message: string } }`
- Canva export timeout handled (Flow 5 in `plan/06-user-flows.md`)
- Webhook race condition retry logic in verify route (Flow 1, step 43)
- Token refresh failure → re-auth flow (Flow 2, step 6)
- Razorpay modal close without payment → no error state, user stays on checkout
- Empty state components on `/orders` and `/admin`
- `console.error` replaced with structured server logging (simple `console.error` with context object is acceptable for v1)

**Complexity:** Medium

**Verification:**
- Manually trigger each [FAILURE POINT] from `plan/06-user-flows.md` — confirm the recovery path works
- Kill Supabase connection mid-checkout — page shows error, does not crash
- Submit the webhook with a valid but already-used `razorpay_order_id` — no duplicate order created

---

## Phase 9 — Pre-Launch Checklist

**Goal:** The app is ready for real users and real money. All environment variables, security settings, and third-party accounts are production-ready.

**Depends on:** Phase 8 complete.

**Deliverables & Checks:**

| Item | Check |
|---|---|
| Environment variables | All 10 vars set in Vercel production environment. No `.env.local` values hardcoded anywhere. |
| Supabase RLS audit | Run `SELECT * FROM pg_policies` and verify every table has RLS enabled and no overly permissive policies |
| Supabase Auth | Email confirmation re-enabled for production |
| Razorpay | Switch from test mode to live mode; live `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` set; webhook URL updated to production domain |
| Canva API | Integration submitted for public review (even if still pending); dev-mode allowlist includes at least the business owner's Canva account for real testing |
| Custom domain | Domain DNS pointed to Vercel; SSL active; `NEXT_PUBLIC_APP_URL` and Canva `redirect_uri` updated to production domain |
| Canva redirect URI | Production callback URL registered in Canva Developer Portal |
| Privacy policy & Terms | Simple pages at `/privacy` and `/terms` required by Canva for public integration review |
| Payment receipt test | End-to-end test with a real ₹1 payment in live Razorpay mode (refund immediately) |
| Admin account | Production admin user created with `role = 'admin'` in Supabase |
| CLAUDE.md | Updated to reflect actual project structure after build |

**Complexity:** Low (checklist, not code)

**Verification:**
- Complete a live end-to-end order: real UPI payment, order appears in Supabase, admin can download print file
- Canva public integration review submitted (confirmation email received)
- No secrets visible in browser devtools (network tab, source maps)
