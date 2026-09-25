-- =============================================================================
-- Framers — PSD-derived studio templates
-- An admin converts a Photoshop file into a starting StudioDocument; customers
-- browse the published ones from the studio's Templates tab. Conversion is
-- lossy/best-effort, so a template is never customer-visible until an admin
-- reviews it and flips is_active.
-- =============================================================================

create table if not exists public.templates (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  is_active        boolean not null default false,
  -- Post-migrateDocument() StudioDocument JSON. Never trust this table's
  -- contents as pre-validated on read — migrateDocument() again on load, same
  -- as every other document source (see src/lib/studio/document.ts).
  document         jsonb not null check (jsonb_typeof(document) = 'object'),
  -- Storage path in the public "template-assets" bucket.
  thumbnail_path   text not null,
  -- Storage path in the private "template-sources" bucket for the original
  -- upload, kept so conversion can be re-run later without re-uploading.
  -- Null if the source was deleted after conversion.
  source_psd_path  text,
  created_by       uuid not null references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists templates_active on public.templates(is_active, created_at desc);

drop trigger if exists templates_updated_at on public.templates;
create trigger templates_updated_at
  before update on public.templates
  for each row execute function public.set_updated_at();

alter table public.templates enable row level security;

-- Any signed-in customer may browse published templates.
drop policy if exists "Anyone reads active templates" on public.templates;
create policy "Anyone reads active templates"
  on public.templates for select
  to authenticated
  using (is_active = true);

-- Admins manage the full catalogue, published or not.
drop policy if exists "Admins manage templates" on public.templates;
create policy "Admins manage templates"
  on public.templates for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================================
-- Storage
-- =============================================================================

-- Public: background raster + thumbnail. No PII, served to any browsing
-- customer, so a public bucket is simpler than signing every thumbnail URL.
insert into storage.buckets (id, name, public)
values ('template-assets', 'template-assets', true)
on conflict (id) do nothing;

-- Private: the raw uploaded .psd. Never customer-facing.
insert into storage.buckets (id, name, public)
values ('template-sources', 'template-sources', false)
on conflict (id) do nothing;

-- No client write policy on either bucket: the upload route writes both with
-- the service-role client, which bypasses RLS (same shape as 0002_storage.sql).
drop policy if exists "Public reads template assets" on storage.objects;
create policy "Public reads template assets"
  on storage.objects for select
  using (bucket_id = 'template-assets');

drop policy if exists "Admins read template sources" on storage.objects;
create policy "Admins read template sources"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'template-sources' and public.is_admin());
