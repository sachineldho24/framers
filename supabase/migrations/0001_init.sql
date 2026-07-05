-- =============================================================================
-- Framers — initial schema
-- Mirrors plan/03-supabase-schema.md. Run in the Supabase SQL editor or via
-- the Supabase CLI. Idempotent where practical.
-- =============================================================================

-- Shared trigger: keep updated_at fresh on UPDATE -----------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Helper: is the current JWT an admin? ---------------------------------------
-- Admin role is stored in app_metadata (NOT user_metadata): app_metadata is
-- only writable via the service-role/admin API, so users cannot self-escalate.
-- Set it with:
--   UPDATE auth.users
--   SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
--   WHERE email = 'admin@example.com';
create or replace function public.is_admin()
returns boolean as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$ language sql stable;

-- =============================================================================
-- frames — product catalogue
-- =============================================================================
create table if not exists public.frames (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  description  text,
  width_px     integer not null,   -- 300 DPI canvas width for Canva design creation
  height_px    integer not null,   -- 300 DPI canvas height
  width_mm     integer not null,   -- physical print width (shown to user)
  height_mm    integer not null,   -- physical print height
  price_paise  integer not null,   -- price in paise (INR x 100) for Razorpay
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  constraint frames_price_nonneg check (price_paise >= 0),
  constraint frames_dims_pos check (width_px > 0 and height_px > 0 and width_mm > 0 and height_mm > 0)
);

create index if not exists frames_is_active_sort on public.frames (is_active, sort_order);

alter table public.frames enable row level security;

drop policy if exists "Public can read active frames" on public.frames;
create policy "Public can read active frames"
  on public.frames for select
  using (is_active = true);

drop policy if exists "Admins can manage frames" on public.frames;
create policy "Admins can manage frames"
  on public.frames for all
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================================
-- canva_tokens — per-user OAuth tokens
-- =============================================================================
create table if not exists public.canva_tokens (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users(id) on delete cascade,
  access_token   text not null,
  refresh_token  text not null,
  expires_at     timestamptz not null,
  canva_user_id  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.canva_tokens enable row level security;

-- Users may read their own token row (e.g. "is connected?" check).
drop policy if exists "Users read own canva token" on public.canva_tokens;
create policy "Users read own canva token"
  on public.canva_tokens for select
  using (auth.uid() = user_id);

-- No client-facing insert/update/delete policy: all writes go through API
-- routes using the service-role key, which bypasses RLS.

drop trigger if exists canva_tokens_updated_at on public.canva_tokens;
create trigger canva_tokens_updated_at
  before update on public.canva_tokens
  for each row execute function public.set_updated_at();

-- =============================================================================
-- orders — created only after a verified Razorpay webhook
-- =============================================================================
create table if not exists public.orders (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete restrict,
  frame_id             uuid not null references public.frames(id) on delete restrict,

  -- Design
  canva_design_id      text not null,
  design_preview_path  text not null,
  design_print_path    text not null,

  -- Payment
  razorpay_order_id    text not null unique,
  razorpay_payment_id  text not null,
  amount_paise         integer not null check (amount_paise >= 0),
  payment_status       text not null default 'paid'
                         check (payment_status in ('paid', 'refunded')),

  -- Delivery
  customer_name        text not null,
  customer_phone       text not null,
  address_line1        text not null,
  address_line2        text,
  city                 text not null,
  state                text not null,
  pincode              text not null,

  -- Fulfilment
  status               text not null default 'pending'
                         check (status in ('pending','processing','shipped','delivered','cancelled')),
  tracking_number      text,
  courier              text,
  notes                text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists orders_user_id_created_at on public.orders (user_id, created_at desc);
create index if not exists orders_status_created_at on public.orders (status, created_at desc);

alter table public.orders enable row level security;

-- Users read their own orders only.
drop policy if exists "Users read own orders" on public.orders;
create policy "Users read own orders"
  on public.orders for select
  using (auth.uid() = user_id);

-- Admins read + manage all orders.
drop policy if exists "Admins manage all orders" on public.orders;
create policy "Admins manage all orders"
  on public.orders for all
  using (public.is_admin())
  with check (public.is_admin());

-- No client-facing insert: orders are inserted by the webhook handler using the
-- service-role key. Status updates go through the admin API route (admin policy).

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();
