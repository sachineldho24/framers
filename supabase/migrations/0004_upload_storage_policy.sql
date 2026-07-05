-- =============================================================================
-- Framers — allow authenticated users to upload their own design files
-- directly to the design-exports bucket (the "Upload Finished Art" path).
-- Files go to "{userId}/uploads/{filename}" so the first path segment is the
-- user id and the existing "own folder" read policy applies.
-- =============================================================================

drop policy if exists "Users upload own design files" on storage.objects;
create policy "Users upload own design files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'design-exports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
