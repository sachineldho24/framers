-- =============================================================================
-- Framers — order fulfilment: an append-only transition log + a searchable ref
--
-- Nothing recorded *when* an order changed state. `orders.updated_at` is a
-- trigger-maintained single value, so the next edit erases the evidence of the
-- last one — which is why the customer's stepper shows stages with no dates and
-- why "who marked this shipped?" had no answer.
--
-- Every statement is idempotent: this file is run by hand in the Supabase SQL
-- editor and re-running it must not fail.
-- =============================================================================

-- =============================================================================
-- order_events — one row per transition, never updated, never deleted
-- Kinds are separate because they answer different questions: 'status' is
-- fulfilment progress, 'payment' is money, 'tracking' is the consignment, and
-- 'note' is anything an operator (or a failed email) wants on the record.
-- =============================================================================
create table if not exists public.order_events (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  kind         text not null default 'status'
                 check (kind in ('status', 'payment', 'tracking', 'note')),
  from_status  text,
  to_status    text,
  note         text,
  -- null actor = written by the system (webhook, verify route), not a person.
  actor_id     uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists order_events_order_created
  on public.order_events (order_id, created_at);

alter table public.order_events enable row level security;

-- Customers read the log for their own orders — it is what dates their stepper.
drop policy if exists "Users read own order events" on public.order_events;
create policy "Users read own order events"
  on public.order_events for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_events.order_id
        and o.user_id = auth.uid()
    )
  );

drop policy if exists "Admins manage order events" on public.order_events;
create policy "Admins manage order events"
  on public.order_events for all
  using (public.is_admin())
  with check (public.is_admin());

-- No client-facing insert policy: writes go through the service-role key, the
-- same rule that already governs `orders`.

-- Seed the "Order placed" event for orders that predate this table, so an old
-- order's timeline does not start blank. Guarded, so re-running is a no-op.
insert into public.order_events (order_id, kind, to_status, note, created_at)
select o.id, 'status', 'pending', 'Order placed', o.created_at
from public.orders o
where not exists (
  select 1 from public.order_events e where e.order_id = o.id
);

-- =============================================================================
-- orders.short_ref — the reference the customer is actually told to quote
-- `/orders/[orderId]` tells people to message us with "#A1B2C3D4", so an
-- operator has to be able to paste that into a search box. A uuid cannot be
-- pattern-matched through PostgREST, so the value is stored and indexed.
-- Byte-identical to shortOrderId() in src/lib/format.ts.
-- GENERATED ALWAYS: never include this column in an insert or update payload.
-- =============================================================================
alter table public.orders
  add column if not exists short_ref text
    generated always as (
      upper(substring(replace(id::text, '-', ''), 1, 8))
    ) stored;

create index if not exists orders_short_ref on public.orders (short_ref);

comment on column public.orders.short_ref is
  'Customer-facing order reference (first 8 hex chars of the id, upper-cased). Generated; do not write to it.';

-- Covers the admin queue's default view: paid orders still awaiting action,
-- newest first.
create index if not exists orders_payment_status_status_created
  on public.orders (payment_status, status, created_at desc);
