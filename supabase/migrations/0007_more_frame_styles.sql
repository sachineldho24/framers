-- =============================================================================
-- Framers — additional frame styles (molding options for the designer grid).
-- Pure data: new rows appear automatically in /design/[id]/frame and the colour
-- filter. molding_color is the hex <FramePreview> draws the border in.
-- Prices are PLACEHOLDERS — confirm with the client.
-- =============================================================================

insert into public.frame_styles
  (name, slug, material, color, molding_color, molding_width_mm, price_modifier_paise, is_active, sort_order)
values
  ('Charcoal',      'charcoal',      'composite', 'black',  '#2b2b2b', 20,     0, true, 15),
  ('Espresso',      'espresso',      'wood',      'wood',   '#3b2415', 24, 35000, true, 35),
  ('Natural Maple', 'natural-maple', 'wood',      'wood',   '#e3c79a', 22, 30000, true, 45),
  ('Champagne Gold','champagne-gold','metal',     'gold',   '#c9a227', 16, 60000, true, 55),
  ('Brushed Brass', 'brushed-brass', 'metal',     'gold',   '#b08d57', 16, 60000, true, 60),
  ('Slate Silver',  'slate-silver',  'metal',     'silver', '#9ea3a8', 14, 50000, true, 65)
on conflict (slug) do nothing;
