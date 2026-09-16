-- =============================================================================
-- Framers - flat frame pricing.
--
-- A frame costs what the frame costs. Moulding styles and finishes stay
-- selectable, because they change how the frame is made, but they no longer
-- change what it costs. The modifiers are zeroed rather than dropped: the
-- columns stay so historical orders keep their recorded values, the designer
-- flow keeps reading one shape, and the admin can still see what a style was
-- once priced at.
--
-- The server is the authority for this: `create-order` charges
-- `frames.price_paise` and nothing else. This migration aligns the data with
-- that rule so the on-screen totals and the charge agree.
--
-- Idempotent - safe to re-run.
-- =============================================================================

update public.frame_styles
set price_modifier_paise = 0
where price_modifier_paise <> 0;

update public.finishes
set price_modifier_paise = 0
where price_modifier_paise <> 0;
