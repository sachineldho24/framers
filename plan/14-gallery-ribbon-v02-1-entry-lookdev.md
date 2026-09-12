# Gallery Ribbon v02.1 Entry/Living LookDev Plan

## Overview

Create a strict material-and-lighting prototype for the approved v02 Entry/Living camera. Preserve the approved architecture and all earlier files. The output is an A/B-compatible look-development scene and two same-camera renders: normal artwork and neutral-grey artwork control.

## Remember

- Preserve `framers_gallery_ribbon_v01.*` and `framers_gallery_ribbon_v02_checkpoint.blend` byte-for-byte.
- Save only to `framers_gallery_ribbon_v02_1_entry_lookdev.blend`.
- Do not move the camera or change focal length, FOV, exposure, artwork imagery, or major geometry.
- Do not propagate look-development materials across all 205 objects.
- No final camera animation and no production GLB export at this stage.

## Prerequisites

- Blender MCP available at `127.0.0.1:9876`.
- Approved v02 checkpoint loads with 205 objects, 8,870 approximate triangles and the Entry camera at the saved transform.
- Existing packed artwork imagery remains available.

## Task 1: Protect the approved baseline

**Read:** `C:\Personal_Projects\Framers\framers_gallery_ribbon_v02_checkpoint.blend`

**Write:** `C:\Personal_Projects\Framers\framers_gallery_ribbon_v02_1_entry_lookdev.blend`

Record SHA-256 hashes for v01 and v02 before editing. Open v02 and immediately save to the v02.1 path. Record the camera matrix, 32.269-degree vertical FOV, exposure and visible artwork assignments.

### Verification

After look development, recompute v01 and v02 hashes. Both must exactly match their recorded values.

## Task 2: Build the six-material prototype

**Script:** `C:\Personal_Projects\Framers\scripts\build_gallery_ribbon_v02_1_lookdev.py`

Create procedural, WebGL-conscious masters:

1. `M01_Mineral_Plaster_LookDev` — pale warm mineral plaster; 2–4% low-frequency colour variation; roughness approximately 0.58–0.68; fine bump visible mainly under grazing light.
2. `M02_Honed_Limestone_LookDev` — continuous warm floor; broad 1.5–3 m tonal variation; roughness approximately 0.38–0.46; extremely weak micro-bump; no tile seams.
3. `M03_Graphite_Ceiling_LookDev` — charcoal rather than black; roughness around 0.50; enough indirect response to retain the ceiling plane.
4. `M04_Boucle_Ivory_LookDev` — roughness approximately 0.78–0.84; fine procedural weave/bump and restrained sheen.
5. `M05_Walnut_Satin_LookDev` — controlled grain; roughness approximately 0.38–0.46; satin highlights without lacquer-like gloss.
6. `M06_Graphite_Frame_LookDev` — satin black frame/profile material; roughness approximately 0.24–0.30.

Only assign these materials to surfaces visible from the approved Entry camera and its immediate Living/Dining background.

## Task 3: Establish hero-frame production construction

Without moving or replacing the Living artwork:

- Refine the existing four frame bars to a 1–3 mm edge bevel.
- Add a separate glazing plane with controlled reflection and approximately 0.10–0.16 roughness.
- Retain a visible recess between glazing and artwork.
- Add a thin backing panel and shadow gap behind the artwork.
- Preserve the independent `ART_Living_Hero` mesh and its image material.

### Verification

The render must show distinct highlight behaviour for frame, glazing and print while keeping the artwork legible.

## Task 4: Add controlled edge response

Apply non-destructive bevel modifiers only to Entry/Living-visible architecture and furniture:

- Architecture: 5–12 mm, two segments.
- Table/console: 3–6 mm, two segments.
- Upholstered hard proxy edges: 12–20 mm, two segments.
- Frame profile: 1–3 mm, two segments.

Do not change room dimensions, openings, furniture placement or silhouette proportions.

## Task 5: Rebalance Entry/Living lighting

- Base Living/Dining illumination: approximately 4200 K, soft and neutral.
- Artwork accents: approximately 3300 K, narrow enough to create hierarchy without recolouring the room.
- Ceiling datum: approximately 2800 K, with visible emission reduced by 40–60%.
- Add one low-energy grazing light to reveal plaster and frame depth.
- Preserve exposure at 0.0 and retain the existing camera.
- Keep the Automobile and other zones unchanged.

## Task 6: Render the strict A/B checkpoint

**Render script:** `C:\Personal_Projects\Framers\scripts\render_v02_1_entry_lookdev.py`

Render at the exact saved Entry camera:

1. `v02_1_entry_lookdev.png` — normal artwork.
2. `v02_1_entry_neutral_art.png` — temporarily replace all visible artwork materials with a neutral-grey control material, render, then restore without saving.

Use a fresh headless Blender process with compositing disabled to avoid the Blender 5.2 UI-session render-context issue encountered during the v02 checkpoint.

## Acceptance Criteria

- Floor variation is broad and non-repeating at camera scale.
- Plaster texture is subtle head-on but visible under grazing light.
- Ceiling remains dark while retaining material information.
- Whites appear neutral rather than peach/orange.
- Ceiling datum is subordinate to artwork and architecture.
- Fabric, plaster, floor, walnut, frame and glass have visibly different highlight signatures.
- Bevels create edge highlights without looking rounded.
- Neutral-art control render still reads as a premium, materially differentiated room.
- Camera transform, FOV, exposure, artwork and major geometry match the approved v02 baseline.

## Rollback

Close v02.1 without saving and reopen `framers_gallery_ribbon_v02_checkpoint.blend`. Because v02 is never overwritten, no destructive rollback operation is required.
