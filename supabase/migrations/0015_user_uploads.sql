-- =============================================================================
-- Framers — a per-user photo library.
--
-- Until now a photo lived only inside the design session it was uploaded to:
-- the studio's Uploads panel listed that session's photo and nothing else, so
-- every new design meant uploading the same pictures again, and picking the
-- same file twice stored it twice.
--
-- Files now go to "{userId}/library/{sha256}.{ext}" — named by content, so the
-- same photo is stored once however often it is picked — and each gets a row
-- here, which is what the Uploads panel lists. The existing "own folder"
-- storage policies (0004) already cover the path.
--
-- Removing a row only takes the photo out of the library. The file stays:
-- saved designs refer to it by path and would otherwise lose their picture.
-- =============================================================================

create table if not exists public.user_uploads (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- Storage path in the design bucket. Always under the owner's folder.
  path          text not null check (path like user_id::text || '/%'),
  -- Hex SHA-256 of the file's bytes: the dedupe key.
  sha256        text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  name          text not null default 'Image',
  width         integer not null check (width > 0),
  height        integer not null check (height > 0),
  bytes         bigint not null check (bytes > 0),
  content_type  text not null,
  created_at    timestamptz not null default now(),
  unique (user_id, sha256)
);

create index if not exists user_uploads_recent
  on public.user_uploads(user_id, created_at desc);

alter table public.user_uploads enable row level security;

drop policy if exists "Users read own uploads" on public.user_uploads;
create policy "Users read own uploads"
  on public.user_uploads for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users add own uploads" on public.user_uploads;
create policy "Users add own uploads"
  on public.user_uploads for insert
  to authenticated
  with check (user_id = auth.uid() and path like auth.uid()::text || '/%');

drop policy if exists "Users remove own uploads" on public.user_uploads;
create policy "Users remove own uploads"
  on public.user_uploads for delete
  to authenticated
  using (user_id = auth.uid());
