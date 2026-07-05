-- =============================================================================
-- Framers — support upload-based designs (not just Canva)
-- The design-method screen offers two paths: design in Canva, or upload a
-- finished file. Upload orders have no Canva design id and may have no separate
-- preview, so relax those constraints and record which path was used.
-- =============================================================================

alter table public.orders
  add column if not exists design_source text not null default 'canva'
    check (design_source in ('canva', 'upload'));

-- Canva id only exists for the Canva path.
alter table public.orders
  alter column canva_design_id drop not null;

-- Uploads of a print-ready file may not have a distinct preview image.
alter table public.orders
  alter column design_preview_path drop not null;
