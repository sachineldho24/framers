-- =============================================================================
-- Framers — the AI generation ledger.
--
-- The studio's generative tools (Create, Edit, Replace, Expand, Upscale…) call
-- paid provider APIs from `POST /api/studio/ai/generate`. Every request gets a
-- row here with its estimated cost, and the route checks the last 24 hours
-- against the limits in the environment (AI_GEN_DAILY_LIMIT,
-- AI_GEN_USER_DAILY_USD, AI_GEN_DAILY_BUDGET_USD) before it spends anything.
--
-- Written only by the server (service role). Customers may read their own
-- rows, which is all a future "your AI history" view would need.
-- =============================================================================

create table if not exists public.ai_generations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  task         text not null,
  -- Catalogue id, `provider:model` (src/lib/aiGen/catalog.ts).
  model        text not null,
  status       text not null default 'running' check (status in ('running', 'ok', 'error')),
  images       integer not null default 0,
  -- Estimated at the start; replaced by the provider's figure when it reports one.
  cost_usd     numeric(10, 4) not null default 0,
  error        text,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create index if not exists ai_generations_user_recent
  on public.ai_generations(user_id, created_at desc);

create index if not exists ai_generations_recent
  on public.ai_generations(created_at desc);

alter table public.ai_generations enable row level security;

drop policy if exists "Users read own AI generations" on public.ai_generations;
create policy "Users read own AI generations"
  on public.ai_generations for select
  to authenticated
  using (user_id = auth.uid());
