# Gallery Ribbon v02 Structural Checkpoint Implementation Plan

## Overview

Rebuild the Framers Lab gallery as an original, continuous U-shaped architectural journey informed by ICG Gallery's room-based storytelling. This checkpoint deliberately stops before detailed dressing and validates the circulation and five critical cinematic compositions first.

## Remember

- Preserve every `v01` deliverable unchanged.
- Build and save only new `v02` files.
- Reuse the working artwork imagery, material language, lighting logic, frame separation, WebGL optimization approach, and 32.27-degree camera FOV.
- Optimize the architecture for the walkthrough camera rather than top-view symmetry.
- Do not create final camera animation.

## Prerequisites

- Blender MCP server reachable at `127.0.0.1:9876`.
- Source scene `C:\Personal_Projects\Framers\framers_gallery_ribbon_v01.blend` loads successfully.
- Six existing packed artwork images and the source reference images remain readable.

## Task 1: Protect v01 and establish v02

**Files:**

- Read: `C:\Personal_Projects\Framers\framers_gallery_ribbon_v01.blend`
- Write: `C:\Personal_Projects\Framers\framers_gallery_ribbon_v02_checkpoint.blend`

### Verification

- Record v01 file size and SHA-256 before building.
- Save the rebuilt scene only to the v02 checkpoint path.
- Recompute v01 SHA-256 after building; it must match exactly.

## Task 2: Build the irregular U-shaped shell

**File:** `C:\Personal_Projects\Framers\scripts\build_gallery_ribbon_v02_checkpoint.py`

Build a continuous floor and ceiling datum around the sequence:

`Entry -> Living -> Dining -> Celebration -> Kids -> Automobile -> Showcase -> Signature Reveal`

Requirements:

- One continuous floor material.
- Two or three major openings per long wing.
- No repeated equal arch modules.
- Mix long hero walls, broad portals, partial-height screens, one curved transition, and one diagonal return.
- Minimum camera portal width 2.4 m; preferred major reveal width 3.2-5.0 m.
- The inner edge of the U remains a continuous camera lane.
- The Signature Wall must be visible as a controlled teaser from an earlier zone.

### Verification

- Render an orthographic top view with ceilings hidden.
- Confirm the travel line reads as one U and contains no isolated room boxes.
- Confirm every turn has an architectural continuation rather than a blank dead end.

## Task 3: Establish zone massing and visual hierarchy

Use low-detail furniture and frame proxies only where needed to judge camera composition.

- Living: sofa mass, one hero frame, Dining visible beyond.
- Dining: table mass and collage hero, warm Celebration attractor beyond.
- Celebration: emotional hero vignette; Kids glimpsed through a curved transition.
- Kids: lighter massing with Automobile visible as a dark threshold.
- Automobile: darkest zone, partial vehicle silhouette, dramatic hero frame.
- Showcase: sparse plinth/niche massing and small secondary frames.
- Signature Reveal: oversized final frame/brand wall, teased before arrival.

### Verification

- No zone contains more than one dominant frame.
- Supporting frames remain smaller and outside primary focal cones.
- Approximate balance remains 70% architecture, 20% furniture/context, 10% frames.

## Task 4: Add camera and lighting checkpoint systems

- Reuse 1.70 m eye height and 32.27-degree vertical FOV.
- Create unanimated checkpoint cameras/empties for Entry, first transition, deepest U-turn, and Signature Reveal.
- Create a visible `PATH_GUIDE_V02` along the inner U edge.
- Use a continuous warm ceiling light datum, selective hero accents, daylight cuts, and a darker automobile pocket.

### Verification

- No final animation data exists.
- All checkpoint cameras have foreground, midground, and background layers.
- The next destination is visible or strongly implied from each checkpoint.

## Task 5: Render the five-view checkpoint

Render:

1. `v02_checkpoint_top.png`
2. `v02_checkpoint_entry.png`
3. `v02_checkpoint_first_transition.png`
4. `v02_checkpoint_deep_turn.png`
5. `v02_checkpoint_signature_reveal.png`

Use 16:9 for camera views and a legible orthographic top view. Review the five images before any detailed furniture or decor work.

## Task 6: Structural QA and checkpoint handoff

- Verify object naming, floor elevation, portal widths, camera eye height, FOV, frame/art separation, lack of animation, and approximate triangle count.
- Save the checkpoint blend.
- Do not export the final production GLB until the five-view checkpoint is approved.
- Report the scene metrics, camera positions, identified clearance risks, and the five rendered views.

## Rollback

- Close the v02 checkpoint without saving and reopen `framers_gallery_ribbon_v01.blend`.
- Because v01 is never overwritten, rollback requires no destructive file operation.
