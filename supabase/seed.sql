-- =============================================================================
-- Framers — seed data
-- Starter frame catalogue. Pixel dims are ISO sizes at 300 DPI (px = mm/25.4*300).
--
-- NOTE: prices and the exact catalogue are PLACEHOLDERS pending client
-- confirmation (see plan/08-open-questions.md Q-2, Q-3). Update before launch.
-- =============================================================================

insert into public.frames
  (name, slug, description, width_px, height_px, width_mm, height_mm, price_paise, is_active, sort_order)
values
  (
    'A5 Frame',
    'a5-frame',
    'Compact 148 x 210mm frame. Perfect for a single car or bike portrait on a desk or shelf.',
    1748, 2480, 148, 210,
    49900, true, 10
  ),
  (
    'A4 Frame',
    'a4-frame',
    'Classic 210 x 297mm frame. Our most popular size for custom vehicle posters.',
    2480, 3508, 210, 297,
    79900, true, 20
  ),
  (
    'A3 Frame',
    'a3-frame',
    'Statement 297 x 420mm frame. Big, bold wall art for your build.',
    3508, 4961, 297, 420,
    129900, true, 30
  ),
  (
    'Square 12"',
    'square-12',
    'Square 305 x 305mm frame. Great for badge shots and centred compositions.',
    3600, 3600, 305, 305,
    99900, true, 40
  )
on conflict (slug) do nothing;
