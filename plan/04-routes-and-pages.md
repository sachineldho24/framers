# 04 — Routes and Pages

All routes are in `src/app/` using the Next.js 14 App Router convention. API routes live in `src/app/api/`.

Legend:
- **RSC** = React Server Component (default in App Router)
- **CC** = Client Component (`'use client'` directive)
- **API** = Next.js Route Handler

---

## Page Routes

### `/` — Homepage

| Field | Value |
|---|---|
| Route type | RSC |
| Auth required | Public |
| Reads | `frames` table — all active frames, ordered by `sort_order` |
| Writes | None |

**Purpose:** Entry point. Displays the full frame catalogue as a grid of cards. Each card shows the frame name, size, price, and a "Design Your Frame" CTA.

**Key UI elements:**
- Sticky top navigation bar with logo and "My Orders" link (shows Login if unauthenticated)
- Hero section: bold headline, subheadline, one CTA button
- Frame grid: 2-column mobile, 3–4 column desktop. Each card: frame image placeholder, name (all-caps Montserrat), dimensions, price in ₹, "Design This Frame" button
- Footer with Instagram link and contact

---

### `/frames/[slug]` — Frame Detail

| Field | Value |
|---|---|
| Route type | RSC (page shell) + CC (design CTA interaction) |
| Auth required | Public to view; redirects to `/login` if unauthenticated when clicking "Design" |
| Reads | `frames` WHERE `slug = params.slug` |
| Writes | None |

**Purpose:** Shows full details of one frame size — dimensions, price, description, sample product images. The "Design Your Frame" button triggers the Canva OAuth + design creation flow.

**Key UI elements:**
- Frame name (headline), physical dimensions (e.g., "A4 — 210 × 297mm"), price
- Sample poster images in the frame (from `/posterx_posters/`)
- "Design Your Frame" primary button — initiates OAuth if no valid Canva token exists, otherwise calls `/api/canva/create-design` directly
- A note: "You'll design in Canva, then return here to checkout"

---

### `/design/[designId]` — Design Review & Export Trigger

| Field | Value |
|---|---|
| Route type | CC (polling state required) |
| Auth required | User auth required |
| Reads | Session (designId, frameId) — NOT from Supabase directly |
| Writes | Calls `/api/canva/export` which writes to Supabase Storage |

**Purpose:** The page the user lands on after returning from Canva. Shows an export button, triggers the export, polls for completion, shows the preview, then links to checkout.

**Key UI elements:**
- "Welcome back! Ready to print your design?" heading
- "Export My Design" button → starts polling, shows spinner with progress text ("Exporting… this takes ~15 seconds")
- On success: design preview image (PNG from Supabase Storage signed URL)
- "Looks good — Proceed to Checkout" primary button
- "Go back to Canva to edit" ghost button (links back to `canva.com/design/{designId}/edit`)

---

### `/api/canva/callback` — OAuth Callback (see API routes section)

Handled as an API route that redirects the browser — not a rendered page.

---

### `/checkout` — Checkout

| Field | Value |
|---|---|
| Route type | CC |
| Auth required | User auth required |
| Reads | Session (designId, frameId, previewPath, printPath); `frames` for price confirmation |
| Writes | Calls `/api/payments/create-order` |

**Purpose:** Collects delivery address, confirms order summary, initiates Razorpay payment.

**Key UI elements:**
- Order summary sidebar: frame name, price, design preview thumbnail
- Delivery form: name, phone, address line 1, address line 2 (optional), city, state, pincode
- "Pay ₹{amount} via UPI" button — opens Razorpay modal
- On payment success: redirect to `/orders/[orderId]/confirmation`
- On payment failure: error message inline, "Try Again" button

---

### `/orders` — Order History

| Field | Value |
|---|---|
| Route type | RSC |
| Auth required | User auth required |
| Reads | `orders` WHERE `user_id = currentUser.id` ORDER BY `created_at DESC` |
| Writes | None |

**Purpose:** Lists all past orders for the logged-in customer.

**Key UI elements:**
- Table/card list: Order ID (truncated), frame name, date, amount, status badge (colour-coded)
- Each row links to `/orders/[orderId]`
- Empty state: "No orders yet — design your first frame"

---

### `/orders/[orderId]` — Order Detail

| Field | Value |
|---|---|
| Route type | RSC |
| Auth required | User auth required (RLS enforces that only the owner can read the row) |
| Reads | `orders JOIN frames` WHERE `orders.id = params.orderId AND orders.user_id = currentUser.id` |
| Writes | None |

**Purpose:** Shows full detail for one order — design preview, delivery address, payment info, current status, tracking number if shipped.

**Key UI elements:**
- Status timeline: Pending → Processing → Shipped → Delivered (visual stepper)
- Tracking number + courier name (shown only when status = 'shipped' or 'delivered')
- Design preview image (signed URL from Supabase Storage)
- Order summary: frame, price, date

---

### `/orders/[orderId]/confirmation` — Order Confirmation

| Field | Value |
|---|---|
| Route type | RSC |
| Auth required | User auth required |
| Reads | `orders` WHERE `id = params.orderId AND user_id = currentUser.id` |
| Writes | None |

**Purpose:** Post-payment success screen. Confirms the order was received.

**Key UI elements:**
- Large success indicator (no emoji per design rules — use a bold check mark or typography)
- Order ID prominently displayed
- "We'll start processing your order shortly" message
- CTA: "View Order Status" → `/orders/[orderId]`
- Secondary CTA: "Design Another Frame" → `/`

---

### `/login` — Login / Sign Up

| Field | Value |
|---|---|
| Route type | CC |
| Auth required | Public (redirects to `/` if already authenticated) |
| Reads | None |
| Writes | Supabase Auth (sign in / sign up) |

**Purpose:** Authentication page. Email/password for v1.

**Key UI elements:**
- Toggle: "Sign In" / "Create Account" tabs
- Email + password fields
- Submit button
- On success: redirect to the page the user came from (stored in `next` query param)

---

### `/admin` — Admin Dashboard (Order List)

| Field | Value |
|---|---|
| Route type | RSC |
| Auth required | Admin only |
| Reads | `orders JOIN frames` — all orders, newest first |
| Writes | None |

**Purpose:** Admin's primary view. Full list of all orders with key info and quick-status filters.

**Key UI elements:**
- Filter tabs: All / Pending / Processing / Shipped / Delivered
- Table: Order ID, customer name, frame name, amount, date, status badge, "View" link
- Counts per status in the filter tabs

---

### `/admin/orders/[orderId]` — Admin Order Detail

| Field | Value |
|---|---|
| Route type | RSC (page) + CC (status update form) |
| Auth required | Admin only |
| Reads | `orders JOIN frames` WHERE `orders.id = params.orderId` |
| Writes | Calls `PATCH /api/admin/orders/[orderId]` |

**Purpose:** Admin views full order details, downloads the design file, and updates status/tracking.

**Key UI elements:**
- Design file: "Download Print File (PDF)" button (generates signed URL via API)
- Design preview image
- Customer info: name, phone, full address
- Status dropdown (Pending / Processing / Shipped / Delivered / Cancelled)
- Tracking number input + courier name input (enabled only when status = 'Shipped')
- "Save Changes" button
- Order metadata: order ID, Razorpay payment ID, amount, date

---

## API Routes

### `GET /api/canva/callback` — Canva OAuth Callback

| Field | Value |
|---|---|
| Auth required | User must be authenticated (state param encodes userId) |
| Reads | `code`, `state` from query params |
| Writes | `canva_tokens` table (upsert) |

Exchanges the OAuth code for tokens, verifies the state/CSRF token, upserts tokens into `canva_tokens`, then redirects the browser to `/frames/[slug]` (stored in session before OAuth redirect).

---

### `POST /api/canva/create-design` — Create Canva Design

| Field | Value |
|---|---|
| Auth required | User auth required |
| Reads | `canva_tokens` for the current user; `frames` for dimensions |
| Writes | Nothing in Supabase; calls Canva `POST /rest/v1/designs` |

**Request body:** `{ frameId: string }`

**Response:** `{ designId: string, editUrl: string }`

Validates the user has a valid (non-expired) Canva token; refreshes if expired. If no token exists, returns a `{ authUrl }` for the OAuth redirect instead.

---

### `POST /api/canva/export` — Export Canva Design

| Field | Value |
|---|---|
| Auth required | User auth required |
| Reads | `canva_tokens`; the design on Canva's servers |
| Writes | Supabase Storage (`design-exports` bucket) |

**Request body:** `{ designId: string, frameId: string }`

**Response:** `{ previewUrl: string, printPath: string }` (signed URL for preview, storage path for print file)

Server-side polling loop: creates export job, polls every 3s up to 20 times, downloads files, uploads to Supabase Storage, returns signed preview URL.

---

### `POST /api/payments/create-order` — Create Razorpay Order

| Field | Value |
|---|---|
| Auth required | User auth required |
| Reads | `frames` for the price (do NOT trust client-submitted price) |
| Writes | Razorpay (creates order); does NOT write to Supabase yet |

**Request body:** `{ frameId: string }`

**Response:** `{ razorpayOrderId: string, amount: number, currency: 'INR' }`

---

### `POST /api/payments/webhook` — Razorpay Webhook Handler

| Field | Value |
|---|---|
| Auth required | None (public endpoint — verified by HMAC signature) |
| Reads | Webhook payload from Razorpay |
| Writes | `orders` table (INSERT, idempotent via `ON CONFLICT DO NOTHING`) |

**Must verify** `razorpay-signature` header using `RAZORPAY_WEBHOOK_SECRET` before processing. Responds `200` on success; `400` on invalid signature.

---

### `POST /api/payments/verify` — Client-Side Payment Verification

| Field | Value |
|---|---|
| Auth required | User auth required |
| Reads | `orders` WHERE `razorpay_order_id = $1` |
| Writes | None (order was already created by webhook) |

**Request body:** `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }`

Re-verifies the client-provided signature. Returns `{ orderId }` if valid and the order exists. The client uses this to redirect to `/orders/[orderId]/confirmation`.

---

### `PATCH /api/admin/orders/[orderId]` — Admin Update Order

| Field | Value |
|---|---|
| Auth required | Admin only |
| Reads | Nothing |
| Writes | `orders` — `status`, `tracking_number`, `courier`, `notes` |

**Request body:** `{ status?: string, tracking_number?: string, courier?: string, notes?: string }`

---

### `GET /api/admin/orders/[orderId]/download` — Admin Download Design

| Field | Value |
|---|---|
| Auth required | Admin only |
| Reads | `orders` for the `design_print_path` |
| Writes | Nothing |

Generates a short-lived Supabase Storage signed URL for the print PDF and returns it. The client opens it in a new tab.
