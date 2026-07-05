# 00 — Project Brief

## Business Goal

Replace a manual, DM-based poster-framing order flow with a self-serve web platform. The business (@_posterx.in on Instagram) already has a proven audience — Kerala automotive enthusiasts — but loses orders because customers won't DM to enquire. The platform eliminates that friction: a user arrives, picks a frame, designs it, pays, and leaves with a confirmed order number. No human intervention required until fulfilment.

Secondary goal: establish a proper brand domain so that future marketing (Instagram ads, WhatsApp campaigns, referral programs) drives to an owned property rather than a social profile.

## Target User

**Primary:** Indian automotive enthusiast, 18–35, smartphone-first, Canva-literate, UPI-native. Buys custom poster frames of cars, bikes, and motorsport content as gifts or for personal display. Located in Kerala initially, expanding nationally in v2.

**Secondary (Admin):** The business owner. Needs to see incoming orders, mark them as shipped, and input a tracking number. Not technical — the admin UI must be simple and opinionated.

## The Exact User Journey

### New Customer

1. Lands on homepage — sees frame size options (A3, A4, A5, custom, etc.)
2. Selects a frame size → arrives at frame detail page showing dimensions, price, and a preview
3. Clicks **"Design Your Frame"** → app creates a Canva design with exact pixel dimensions via Connect API
4. User is redirected to `canva.com/design/{id}/edit` — designs in Canva normally
5. Returns to the app (via a "Done designing" link or by navigating back to the order page)
6. App exports the design from Canva (PNG + PDF_PRINT) — a loading state is shown during the ~10–30s export
7. Design preview is shown — user confirms, clicks **"Proceed to Checkout"**
8. Checkout page: delivery address, UPI payment via Razorpay
9. Payment completes → Razorpay webhook fires → order record created in Supabase
10. User lands on order confirmation page with order ID and estimated delivery

### Returning Customer (Token Already Valid)

Steps 1–3 are the same. At step 3, no re-auth is required if the stored Canva refresh token is still valid. The user is redirected straight to the Canva editor.

### Order Tracking

User visits `/orders` → sees list of their past orders with status badges (Pending → Processing → Shipped → Delivered). Clicking an order shows the tracking number once the admin has added it.

## Admin Journey

1. Admin logs in at `/admin` (Supabase Auth, role = `'admin'` in user metadata)
2. Sees a table of all orders: order ID, customer name, frame size, design thumbnail, payment status, fulfilment status
3. Opens an order detail page: sees full design export (downloadable), delivery address, customer contact
4. Updates status (Pending → Processing → Shipped → Delivered)
5. Inputs a tracking number and courier name when marking as Shipped
6. Customer's order history page reflects the updated status in real time (Supabase real-time subscription or on-demand refetch)

## Non-Negotiable Technical Constraints

| Constraint | Reason |
|---|---|
| Next.js 14+ with App Router | SSR, React Server Components, API Routes in one repo |
| TypeScript — strict mode | Mandatory; no `any`, no implicit returns |
| Supabase | Database (PostgreSQL), Auth, Storage, RLS |
| Razorpay | Only payment gateway with robust UPI support in India at this price tier |
| Canva Connect API v1 | The only officially supported way to create Canva designs programmatically |
| Tailwind CSS + shadcn/ui | Utility-first CSS; shadcn for accessible, unstyled base components |
| Mobile-first | All layouts designed at 390px width first, then scaled up |

## What Is Explicitly OUT of Scope for V1

- **WordPress / WooCommerce** — considered and rejected; custom Next.js gives full control
- **Canva Add-on / Apps SDK** — a future growth channel (Phase 2, post-launch); not part of v1
- **Custom design editor** — no in-house canvas editor; Canva handles all design work
- **AI-generated designs** — explicitly rejected by the business owner (current models not accurate enough)
- **Multi-vendor / marketplace** — single-seller only in v1
- **International shipping** — India-only addresses and INR pricing in v1
- **Inventory management** — print-on-demand; no stock to track
- **Discount codes / promotions** — post-launch feature
- **Email notifications** — nice-to-have, deferred to v1.1 (Razorpay sends payment receipts; Supabase can send auth emails)
- **National expansion** — Kerala-first launch; address validation and logistics can be expanded later

## Success Definition — What "Done" Looks Like for V1

A customer can:
1. Select a frame, design it in Canva, pay via UPI, and receive an order confirmation — end to end, unassisted
2. Return to the site and view their order status and tracking number

The admin can:
1. Log in and see every order
2. Download the design file for a given order
3. Update the status and add a tracking number

The system:
1. Never creates an order without a verified Razorpay payment webhook signature
2. Never exposes another user's order data (RLS enforced)
3. Passes a manual QA walkthrough of all 5 user flows defined in `plan/06-user-flows.md`
4. Has been submitted for Canva Connect API public integration review (even if approval is pending)
