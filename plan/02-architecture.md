# 02 — System Architecture

## Tech Stack

| Technology | Version | Purpose | Why Over Alternatives |
|---|---|---|---|
| Next.js | 14+ | Full-stack framework — UI + API routes | App Router enables RSC, streaming, and co-located API routes; eliminates need for separate backend |
| TypeScript | 5+ (strict) | Type safety across the entire codebase | Mandatory constraint; catches Supabase row-type mismatches at compile time |
| Supabase | Latest JS client v2 | PostgreSQL database, Auth, Storage, RLS | Hosted Postgres + row-level security + built-in Auth removes need for separate auth server; free tier sufficient for launch |
| `@supabase/ssr` | Latest | Server-side Supabase client for App Router | Official SSR package; handles cookie-based session refresh in Next.js middleware |
| Tailwind CSS | 3+ | Utility-first styling | Co-located styles; no CSS file switching; pairs well with shadcn/ui |
| shadcn/ui | Latest | Accessible, unstyled base components | Components are copy-pasted (owned code), not a dependency; fully customisable for the brutalist design system |
| Razorpay | Node SDK + JS SDK | UPI payment processing | Only major Indian payment gateway with robust UPI + webhooks at zero monthly fee |
| Canva Connect API | v1 | Design creation and export | Only officially supported REST path for creating Canva designs programmatically |

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Browser                           │
│  (React Client Components — Tailwind + shadcn/ui)               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Next.js 14 App Router                           │
│                                                                  │
│  ┌───────────────────┐    ┌──────────────────────────────────┐  │
│  │   Page Routes     │    │         API Routes               │  │
│  │  (RSC + CC mix)   │    │   /api/canva/*                   │  │
│  │                   │    │   /api/payments/*                │  │
│  │  /               │    │   /api/admin/*                   │  │
│  │  /frames/[id]    │    └──────────┬───────────────────────┘  │
│  │  /design/[id]    │               │                           │
│  │  /checkout       │               │                           │
│  │  /orders         │               │                           │
│  │  /admin/**       │               │                           │
│  └───────────────────┘               │                           │
└───────────────────────┬──────────────┼──────────────────────────┘
                        │              │
          ┌─────────────┘              │
          │                            │
          ▼                            ▼
┌──────────────────┐      ┌────────────────────────┐
│    Supabase      │      │  External Services      │
│                  │      │                         │
│  ● PostgreSQL    │      │  ┌─────────────────┐   │
│    (orders,      │      │  │ Canva Connect   │   │
│     frames,      │      │  │ API v1          │   │
│     canva_tokens)│      │  │ api.canva.com   │   │
│                  │      │  └─────────────────┘   │
│  ● Auth          │      │                         │
│    (users +      │      │  ┌─────────────────┐   │
│     sessions)    │      │  │ Razorpay        │   │
│                  │      │  │ (orders +       │   │
│  ● Storage       │      │  │  webhooks)      │   │
│    (design       │      │  └─────────────────┘   │
│     exports)     │      │                         │
└──────────────────┘      └────────────────────────┘
```

---

## Authentication Strategy

### User Authentication

- **Provider:** Supabase Auth (email/password for v1; Google OAuth as a v1.1 addition)
- **Session management:** `@supabase/ssr` — sessions stored in HTTP-only cookies, refreshed transparently in `middleware.ts`
- **Middleware:** `middleware.ts` at the root protects routes — redirects unauthenticated users away from `/checkout`, `/orders`, `/design/*`
- **Client access:** `createBrowserClient` for Client Components; `createServerClient` for Server Components and API routes

### Admin Role Differentiation

- No separate admin user table. Admin status is a flag on the standard Supabase Auth user.
- Set via Supabase Dashboard (or service role client): `user.user_metadata.role = 'admin'`
- Checked in middleware and in every admin API route:
  ```
  if (session.user.user_metadata.role !== 'admin') return 403
  ```
- Admin routes: `/admin/**` — middleware redirects non-admins to `/`

### Canva OAuth (Separate from Site Auth)

Canva auth is a *secondary* OAuth layer, independent of Supabase Auth. A user is logged into the site (Supabase session) AND separately authorises the app on Canva. Canva tokens are stored in the `canva_tokens` table keyed to `user_id`.

---

## Data Flow — 3 Critical Paths

### Path A: Frame Selection → Canva OAuth → Design → Export → Checkout

```
1. User selects frame on /frames/[id]
       │
       ▼
2. POST /api/canva/create-design
   → Server generates PKCE pair, stores in session
   → Calls Canva POST /rest/v1/designs with frame dimensions
   → Returns { designId, editUrl }
       │
       ▼
3. Client redirects user to editUrl (canva.com/design/{id}/edit)
   [USER LEAVES SITE — designs in Canva]
       │
       ▼
4. User clicks "Done" back on the site → /design/[designId]
       │
       ▼
5. POST /api/canva/export
   → Calls Canva POST /rest/v1/exports with designId
   → Polls GET /rest/v1/exports/{exportId} every 3s (server-side loop)
   → On success: downloads file, uploads to Supabase Storage
   → Returns { previewUrl, storagePath }
       │
       ▼
6. Client shows design preview → user clicks "Proceed to Checkout"
   → designId and storagePath stored in session/localStorage for checkout
```

### Path B: Razorpay Payment → Webhook → Order Creation

```
1. User on /checkout fills address, clicks "Pay"
       │
       ▼
2. POST /api/payments/create-order
   → Server calls Razorpay Orders API: creates order with amount in paise
   → Returns { razorpayOrderId, amount, currency }
       │
       ▼
3. Client opens Razorpay checkout modal (Razorpay.js)
   → User completes UPI payment
   → Razorpay returns { razorpayPaymentId, razorpaySignature } to client
       │
       ▼
4. Razorpay fires webhook → POST /api/payments/webhook
   → Server verifies HMAC-SHA256 signature using RAZORPAY_WEBHOOK_SECRET
   → On valid signature: INSERT into orders table
   → Returns 200 (Razorpay retries on non-2xx)
       │
       ▼
5. Client POSTs /api/payments/verify with { razorpayOrderId, razorpayPaymentId, razorpaySignature }
   → Server re-verifies signature (defence in depth)
   → Returns { orderId } from the orders table
   → Client redirects to /orders/[orderId]/confirmation
```

> Note: the order is created in the **webhook handler**, not in the client-side verify call. The verify call only confirms the order exists and returns the ID for the redirect. This ensures no order is ever missed if the client disconnects post-payment.

### Path C: Admin Updates Order Status / Tracking

```
1. Admin on /admin/orders/[orderId]
       │
       ▼
2. Selects new status from dropdown, optionally inputs tracking number
       │
       ▼
3. PATCH /api/admin/orders/[orderId]
   → Verifies admin role from session
   → UPDATE orders SET status = $1, tracking_number = $2, courier = $3 WHERE id = $4
   → Returns updated order row
       │
       ▼
4. Customer on /orders/[orderId] sees updated status
   (Next.js revalidation or Supabase real-time subscription)
```

---

## File Storage Strategy (Supabase Storage)

### Bucket: `design-exports` (private)

```
design-exports/
  {userId}/
    {orderId}/
      preview.png        ← shown to customer in UI
      print.pdf          ← sent to print shop for fulfilment
```

- Bucket is **private** — no public URLs
- Access via Supabase signed URLs (generated server-side, short-lived: 1 hour for admin download, 5 minutes for preview)
- RLS: users can read only their own `{userId}/*` paths; admins can read all paths
- Files are never deleted (permanent storage for order records); add a purge policy in v2 if storage costs grow

---

## Environment Variables

All values are secrets — never commit. Store in `.env.local` (local) and in Vercel environment settings (production).

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public — used in browser client) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (public — used in browser client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — bypasses RLS. Server-only. Never expose to client. |
| `CANVA_CLIENT_ID` | OAuth client ID from Canva Developer Portal |
| `CANVA_CLIENT_SECRET` | OAuth client secret — server-only |
| `CANVA_REDIRECT_URI` | Full URL of the OAuth callback route: `https://yoursite.com/api/canva/callback` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay public key (used in browser for checkout modal) |
| `RAZORPAY_KEY_SECRET` | Razorpay secret key — server-only (used to create orders + verify signatures) |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook signing secret — used to verify webhook payload authenticity |
| `NEXT_PUBLIC_APP_URL` | Full public URL of the deployed app (e.g., `https://framers.in`) — used to build redirect URIs |

---

## Third-Party Service Dependency Map

| Service | On Critical Path? | What Fails If It's Down |
|---|---|---|
| Supabase | YES | Entire site — auth, data, storage all unavailable |
| Canva Connect API | YES | Users cannot create or export designs; existing orders unaffected |
| Razorpay | YES | No new payments can be taken; existing orders unaffected |
| Vercel (hosting) | YES | Entire site unavailable |
| Canva (editor, canva.com) | YES | Users cannot access the editor; distinct from the API being down |

There is no redundancy for any of these in v1. All are managed SaaS with their own uptime guarantees. Acceptable for a launch-stage product.
