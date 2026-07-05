-- =============================================================================
-- Framers — support the pending-order checkout pattern
-- The order row is created when the Razorpay order is created (status
-- 'created'), then marked 'paid' by the verified webhook / verify call. This
-- guarantees the order is never lost if the customer closes the tab after pay.
-- =============================================================================

-- payment_id only exists once a payment is attempted/captured.
alter table public.orders
  alter column razorpay_payment_id drop not null;

-- Broaden payment_status states and default to 'created'.
alter table public.orders
  alter column payment_status set default 'created';

alter table public.orders
  drop constraint if exists orders_payment_status_check;

alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in ('created', 'paid', 'failed', 'refunded'));
