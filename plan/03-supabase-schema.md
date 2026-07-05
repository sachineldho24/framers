# 03 — Supabase Database Schema

All tables live in the default `public` schema. Supabase Auth manages the `auth.users` table; this schema references it via foreign keys. Enable RLS on every table.

---

## Table: `frames`

Stores the product catalogue — one row per frame size/variant available for purchase.

```sql
CREATE TABLE public.frames (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,                        -- e.g. "A4 Black Frame"
  slug          text NOT NULL UNIQUE,                 -- e.g. "a4-black-frame" (used in URLs)
  description   text,                                 -- optional marketing copy
  width_px      integer NOT NULL,                     -- canvas width at 300 DPI for Canva design creation
  height_px     integer NOT NULL,                     -- canvas height at 300 DPI
  width_mm      integer NOT NULL,                     -- physical print width in mm (shown to user)
  height_mm     integer NOT NULL,                     -- physical print height in mm
  price_paise   integer NOT NULL,                     -- price in paise (INR × 100) for Razorpay
  is_active     boolean NOT NULL DEFAULT true,        -- false = hidden from storefront (soft-delete)
  sort_order    integer NOT NULL DEFAULT 0,           -- controls display order on homepage
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

**Indexes:**
```sql
CREATE INDEX frames_is_active_sort ON public.frames (is_active, sort_order);
CREATE UNIQUE INDEX frames_slug_idx ON public.frames (slug);
```

**RLS Policies:**
```sql
ALTER TABLE public.frames ENABLE ROW LEVEL SECURITY;

-- Anyone can read active frames (storefront is public)
CREATE POLICY "Public can read active frames"
  ON public.frames FOR SELECT
  USING (is_active = true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can manage frames"
  ON public.frames FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');
```

---

## Table: `canva_tokens`

Stores per-user Canva OAuth tokens. One row per user; upserted on each successful OAuth flow.

```sql
CREATE TABLE public.canva_tokens (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token      text NOT NULL,                    -- short-lived; treat as sensitive
  refresh_token     text NOT NULL,                    -- long-lived; treat as sensitive
  expires_at        timestamptz NOT NULL,             -- UTC expiry of the access token
  canva_user_id     text,                             -- Canva's internal user ID (from profile:read)
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
```

**Indexes:**
```sql
CREATE UNIQUE INDEX canva_tokens_user_id_idx ON public.canva_tokens (user_id);
```

**RLS Policies:**
```sql
ALTER TABLE public.canva_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only read their own token row (needed for client-side "is connected?" check)
CREATE POLICY "Users read own canva token"
  ON public.canva_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Only the service role (server-side API routes) can insert/update tokens
-- No client-facing insert/update policy — all writes go through API routes using the service role key
```

> Token values are stored in plaintext in Supabase. Supabase encrypts data at rest. For additional security in v2, encrypt tokens using a server-side key before storing. Flag this as a v2 hardening task.

---

## Table: `orders`

The core order record. Created only after a verified Razorpay webhook — never before.

```sql
CREATE TABLE public.orders (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  frame_id              uuid NOT NULL REFERENCES public.frames(id) ON DELETE RESTRICT,

  -- Design
  canva_design_id       text NOT NULL,                -- Canva's design ID (DAFxxxxxxx)
  design_preview_path   text NOT NULL,                -- Supabase Storage path: {userId}/{orderId}/preview.png
  design_print_path     text NOT NULL,                -- Supabase Storage path: {userId}/{orderId}/print.pdf

  -- Payment
  razorpay_order_id     text NOT NULL UNIQUE,         -- Razorpay order ID (order_xxxxx)
  razorpay_payment_id   text NOT NULL,                -- Razorpay payment ID (pay_xxxxx)
  amount_paise          integer NOT NULL,             -- amount charged, in paise
  payment_status        text NOT NULL DEFAULT 'paid', -- 'paid' | 'refunded' (v1 only expects 'paid')

  -- Delivery
  customer_name         text NOT NULL,
  customer_phone        text NOT NULL,                -- Indian mobile number (10 digits)
  address_line1         text NOT NULL,
  address_line2         text,
  city                  text NOT NULL,
  state                 text NOT NULL,
  pincode               text NOT NULL,                -- 6-digit Indian postal code

  -- Fulfilment
  status                text NOT NULL DEFAULT 'pending',
  -- 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  tracking_number       text,                         -- set by admin when shipped
  courier               text,                         -- e.g. "Delhivery", "BlueDart"
  notes                 text,                         -- internal admin notes

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
```

**Indexes:**
```sql
-- Customer views their order history (filtered by user, sorted by date)
CREATE INDEX orders_user_id_created_at ON public.orders (user_id, created_at DESC);

-- Admin filters by status
CREATE INDEX orders_status_created_at ON public.orders (status, created_at DESC);

-- Webhook deduplication
CREATE UNIQUE INDEX orders_razorpay_order_id_idx ON public.orders (razorpay_order_id);
```

**RLS Policies:**
```sql
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Users can read their own orders only
CREATE POLICY "Users read own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

-- No client-side insert — orders are created via service role in the webhook handler
-- No client-side update — status updates go through the admin API route

-- Admins can read and update all orders
CREATE POLICY "Admins manage all orders"
  ON public.orders FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');
```

**`updated_at` Trigger:**
```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER canva_tokens_updated_at
  BEFORE UPDATE ON public.canva_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

---

## Supabase Storage

Not a database table, but documented here for completeness.

**Bucket: `design-exports`** (private)

```
Bucket policy: authenticated users can read objects matching their own user_id prefix.
Admin service role can read all objects.
```

Object naming: `{userId}/{orderId}/preview.png` and `{userId}/{orderId}/print.pdf`

---

## Queries We Know We Will Run

Validating the schema against real access patterns before the build starts.

| # | Feature | Query |
|---|---|---|
| 1 | Homepage — load active frames in display order | `SELECT * FROM frames WHERE is_active = true ORDER BY sort_order ASC` |
| 2 | Frame detail page | `SELECT * FROM frames WHERE slug = $1 AND is_active = true LIMIT 1` |
| 3 | Check if user has valid Canva token | `SELECT expires_at FROM canva_tokens WHERE user_id = $1 LIMIT 1` |
| 4 | Upsert Canva tokens after OAuth | `INSERT INTO canva_tokens (...) ON CONFLICT (user_id) DO UPDATE SET access_token = ..., refresh_token = ..., expires_at = ...` |
| 5 | Webhook — create order (must be idempotent) | `INSERT INTO orders (...) ON CONFLICT (razorpay_order_id) DO NOTHING` |
| 6 | Customer order history page | `SELECT id, status, tracking_number, created_at, amount_paise FROM orders WHERE user_id = $1 ORDER BY created_at DESC` |
| 7 | Admin — order list with frame name | `SELECT o.*, f.name AS frame_name FROM orders o JOIN frames f ON o.frame_id = f.id ORDER BY o.created_at DESC` |
| 8 | Admin — update order status + tracking | `UPDATE orders SET status = $1, tracking_number = $2, courier = $3 WHERE id = $4` |

All queries are covered by the indexes defined above. No full-table scans in the happy path.
