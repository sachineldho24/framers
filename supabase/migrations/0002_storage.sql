-- =============================================================================
-- Framers — Storage bucket for exported design files
-- Bucket layout: design-exports/{userId}/{orderId}/{preview.png|print.pdf}
-- Private bucket; access only via server-generated signed URLs.
-- =============================================================================

-- Create the private bucket (no-op if it already exists).
insert into storage.buckets (id, name, public)
values ('design-exports', 'design-exports', false)
on conflict (id) do nothing;

-- RLS on storage.objects is enabled by default in Supabase.

-- Users may read objects under their own user-id prefix.
-- Object name convention: "{userId}/{orderId}/preview.png"
-- so the first path segment must equal auth.uid().
drop policy if exists "Users read own design exports" on storage.objects;
create policy "Users read own design exports"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'design-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins may read all design exports.
drop policy if exists "Admins read all design exports" on storage.objects;
create policy "Admins read all design exports"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'design-exports'
    and public.is_admin()
  );

-- No client insert/update/delete policy: uploads happen server-side via the
-- service-role key (export route), which bypasses RLS.
