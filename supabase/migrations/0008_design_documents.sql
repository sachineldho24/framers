-- 0008_design_documents.sql
-- Durable storage for the in-app design studio.
--
-- The studio document is plain JSON (see src/lib/studio/document.ts) and is
-- saved on a debounce while the user works, so it lives in a jsonb column on
-- the session that already carries the rest of the designer state.
--
-- Every statement is idempotent: this file is run by hand in the Supabase SQL
-- editor and re-running it must not fail.
--
-- Until this migration is run the editor still works — the document route
-- detects the missing column (Postgres 42703) and the browser falls back to
-- localStorage, with the top bar honestly reading "Saved on this device".

alter table public.design_sessions
  add column if not exists document jsonb,
  -- Bumped on every write. Lets a stale tab detect it would clobber newer work.
  add column if not exists document_version integer not null default 0,
  add column if not exists title text,
  -- Flattened artefacts produced by the studio's Done action.
  add column if not exists thumbnail_path text,
  add column if not exists print_path text;

comment on column public.design_sessions.document is
  'Studio document JSON (version + page size + layers). Written by the in-app editor.';
comment on column public.design_sessions.document_version is
  'Monotonic counter, incremented on each document save.';
comment on column public.design_sessions.print_path is
  'Storage path of the flattened full-resolution export used as the print file.';

-- Existing RLS on design_sessions is row-level (auth.uid() = user_id), so it
-- already covers these columns. No policy changes needed.
