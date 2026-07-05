-- =============================================================================
-- Framers — frame styles, finishes, design sessions (plan/10 + plan/11)
-- Turns the cosmetic-only material selector into real, priced, persisted choices,
-- and adds a server-side session row that carries size+style+finish through the
-- Canva redirect (correlation_state only fits ~50 chars → one session id).
-- Mat board is intentionally DEFERRED (see CLAUDE.md / plan/10).
-- =============================================================================

-- =============================================================================
-- frame_styles — physical frame molding (Black / Oak / Walnut / White / Metal)
-- texture_url is nullable: when null, <FramePreview> renders the molding in CSS/
-- canvas from `molding_color`. price_modifier_paise adds to the base frame price.
-- =============================================================================
create table if not exists public.frame_styles (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  slug                  text not null unique,
  material              text not null,              -- "wood" | "metal" | "composite"
  color                 text not null,              -- facet for the filter bar
  molding_color         text not null default '#111111', -- hex used when texture_url is null
  molding_width_mm      integer not null default 20,
  texture_url           text,                       -- optional photoreal molding swap-in
  price_modifier_paise  integer not null default 0,
  is_active             boolean not null default true,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  constraint frame_styles_modifier_nonneg check (price_modifier_paise >= 0),
  constraint frame_styles_molding_pos check (molding_width_mm > 0)
);

create index if not exists frame_styles_active_sort
  on public.frame_styles (is_active, sort_order);

alter table public.frame_styles enable row level security;

drop policy if exists "Public can read active frame styles" on public.frame_styles;
create policy "Public can read active frame styles"
  on public.frame_styles for select
  using (is_active = true);

drop policy if exists "Admins manage frame styles" on public.frame_styles;
create policy "Admins manage frame styles"
  on public.frame_styles for all
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================================
-- finishes — glazing / surface (Matte / Glossy / Premium)
-- overlay_kind drives the <FramePreview> reflection overlay.
-- =============================================================================
create table if not exists public.finishes (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  slug                  text not null unique,
  overlay_kind          text not null default 'none'
                          check (overlay_kind in ('none', 'gloss', 'glass')),
  price_modifier_paise  integer not null default 0,
  is_active             boolean not null default true,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  constraint finishes_modifier_nonneg check (price_modifier_paise >= 0)
);

create index if not exists finishes_active_sort
  on public.finishes (is_active, sort_order);

alter table public.finishes enable row level security;

drop policy if exists "Public can read active finishes" on public.finishes;
create policy "Public can read active finishes"
  on public.finishes for select
  using (is_active = true);

drop policy if exists "Admins manage finishes" on public.finishes;
create policy "Admins manage finishes"
  on public.finishes for all
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================================
-- design_sessions — carries the full builder configuration across steps and the
-- Canva redirect. Owned by the user; rows are short-lived working state.
-- =============================================================================
create table if not exists public.design_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  frame_id         uuid references public.frames(id) on delete set null,
  frame_style_id   uuid references public.frame_styles(id) on delete set null,
  finish_id        uuid references public.finishes(id) on delete set null,
  design_source    text not null default 'upload'
                     check (design_source in ('canva', 'upload')),
  upload_path      text,            -- {userId}/uploads/... for the upload path
  canva_design_id  text,            -- set after Canva design creation / return
  mockup_path      text,            -- {userId}/sessions/{id}/mockup.png (composite)
  crop_x           real not null default 0,
  crop_y           real not null default 0,
  crop_scale       real not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists design_sessions_user
  on public.design_sessions (user_id, created_at desc);

alter table public.design_sessions enable row level security;

-- Users fully manage their own sessions (working state, not a financial record).
drop policy if exists "Users manage own design sessions" on public.design_sessions;
create policy "Users manage own design sessions"
  on public.design_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists design_sessions_updated_at on public.design_sessions;
create trigger design_sessions_updated_at
  before update on public.design_sessions
  for each row execute function public.set_updated_at();

-- =============================================================================
-- orders — persist the chosen style/finish + framed mockup + crop transform.
-- All nullable so existing Phase-4 orders and the create-order path keep working.
-- =============================================================================
alter table public.orders
  add column if not exists frame_style_id uuid references public.frame_styles(id) on delete set null;

alter table public.orders
  add column if not exists finish_id uuid references public.finishes(id) on delete set null;

alter table public.orders
  add column if not exists design_session_id uuid references public.design_sessions(id) on delete set null;

alter table public.orders
  add column if not exists mockup_path text;

alter table public.orders
  add column if not exists crop_x real;

alter table public.orders
  add column if not exists crop_y real;

alter table public.orders
  add column if not exists crop_scale real;

-- =============================================================================
-- Storage: allow users to write session mockups to {userId}/sessions/*
-- (the existing 0004 policy already covers {userId}/uploads/*; this is the same
-- "own folder" check, kept idempotent.)
-- =============================================================================
drop policy if exists "Users upload own design files" on storage.objects;
create policy "Users upload own design files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'design-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- Seed — starter styles + finishes (PLACEHOLDER prices, confirm with client).
-- =============================================================================
insert into public.frame_styles
  (name, slug, material, color, molding_color, molding_width_mm, price_modifier_paise, is_active, sort_order)
values
  ('Matte Black',  'matte-black',  'composite', 'black', '#141414', 22,     0, true, 10),
  ('Gallery White','gallery-white','composite', 'white', '#f4f4f4', 22,     0, true, 20),
  ('Natural Oak',  'natural-oak',  'wood',      'wood',  '#c8a061', 24, 30000, true, 30),
  ('Walnut',       'walnut',       'wood',      'wood',  '#5a3a22', 24, 40000, true, 40),
  ('Brushed Metal','brushed-metal','metal',     'silver','#b8bcc0', 16, 50000, true, 50)
on conflict (slug) do nothing;

insert into public.finishes
  (name, slug, overlay_kind, price_modifier_paise, is_active, sort_order)
values
  ('Matte',   'matte',   'none',  0,     true, 10),
  ('Glossy',  'glossy',  'gloss', 15000, true, 20),
  ('Premium', 'premium', 'glass', 30000, true, 30)
on conflict (slug) do nothing;
