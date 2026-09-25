-- =============================================================================
-- Framers — simplify studio templates
-- Templates are no longer converted from an uploaded PSD (lossy, needed a
-- draft/publish review step). A template is now just a `StudioDocument`
-- snapshot saved directly from the studio itself — the same layers a
-- customer will get, so there is nothing left to review before it goes live.
-- =============================================================================

drop policy if exists "Anyone reads active templates" on public.templates;
create policy "Authenticated users read templates"
  on public.templates for select
  to authenticated
  using (true);

drop index if exists public.templates_active;

alter table public.templates drop column if exists is_active;
alter table public.templates drop column if exists source_psd_path;

drop policy if exists "Admins read template sources" on storage.objects;
