# Hybrid Asset Reference Pack Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Produce a gated 226-image hybrid reference pack that preserves Blender's architectural authority while giving AssetHub complete modular reconstruction coverage.

**Architecture:** The approved v02.1 scene remains the visual source of truth. Rendering occurs from a non-destructive reference-render copy/scene. Context cameras communicate placement; normalized isolated cameras communicate geometry; the manifest maps both back to source Blender objects.

**Tech Stack:** Blender 5.2 LTS, Python (`bpy`), PNG output, CSV/Markdown manifest, AgX color management.

---

### Task 1: Close the v02.1 approval gate

**Files:**
- Verify: `v02_1_entry_lookdev.png`
- Verify: `v02_1_entry_neutral_art.png`
- Verify: `framers_gallery_ribbon_v02_1_entry_lookdev.blend`
- Modify after approval: `asset_reference_pack/README.md`
- Modify after approval: `asset_reference_pack/00_manifest/manifest.csv`

**Step 1: Present the corrected normal and neutral-art renders.**

Keep the existing Entry camera, FOV, exposure, artwork, and major geometry unchanged.

**Step 2: Record explicit approval.**

Approval criterion: the room feels materially rich when the hero artwork is replaced by a neutral grey panel.

**Step 3: Freeze standards.**

Perform one atomic approval transition: change README and `approval_record.gate_status` to `APPROVED_FOR_REFERENCE_RENDERING`; transition both `approval_subject` and every blocked asset row, all 226 render rows, all 24 camera rows, and all 34 placement rows to `approved_pending_reference_scene`. Record approver, timestamp, approved scene hash, and both exact render hashes in `approval_record.yaml`. The verifier must reject an approved gate with blocked or mixed child metadata. The artwork source remains unchanged except for the deliberate temporary neutral-art control render.

### Task 2: Create a non-destructive reference-render scene

**Files:**
- Create: `scripts/build_asset_reference_scene.py`
- Create: `framers_gallery_asset_reference_v01.blend`
- Test: `scripts/test_asset_reference_scene.py`

**Step 1: Write failing validation checks.**

Assert source v01/v02/v02.1 hashes match the pre-recorded `approval_record.yaml`, 27 manifest assets resolve to objects, all isolated cameras exist, the isolated ground is at `Z = 0`, and no source object is destructively moved.

**Step 2: Build the reference-render copy.**

Create the reference file through an OS-level copy. Make every editable object, mesh, material, and image datablock single-user inside the copy; do not use editable linked datablocks. Put duplicated asset assemblies in a dedicated `ASSET_REFERENCE` collection. Lock and before/after-compare every scene-audit row with `generation_action=preserve_in_blender`, including architecture, lighting, camera stops, sightlines, and helpers. Add the standardized neutral rig and cameras from `render_spec.md`.

**Step 3: Run validation.**

Freeze `framers_gallery_asset_reference_v01.blend`, calculate its SHA-256, populate `render_scene_revision` and `render_scene_sha256` on all 226 active render rows, then atomically transition the 27 asset, 226 render, 24 camera, and 34 placement rows to `ready_to_render`. Expected: all manifest mappings resolve; every active row carries the same existing reference-scene hash/revision; canonical views have 12% ± 2% framing margin; no camera uses depth of field. Rendering must not start before this validation passes.

### Task 3: Render and validate context coverage

**Files:**
- Create: `scripts/render_asset_context_views.py`
- Output: `asset_reference_pack/01_context_views/**`
- Test: `scripts/test_context_coverage.py`

**Step 1: Implement the 24 exact filenames from `shot_list.md`.**

Create camera duplicates without altering the approved walkthrough camera.

**Step 2: Render primary, reverse, and oblique coverage.**

Use the frozen v02.1 color management and lighting logic.

**Step 3: Validate coverage.**

For every zone, confirm all named assets appear unobstructed in at least one view and the next zone is visible or implied.

### Task 4: Render the hero-frame product standard

**Files:**
- Create: `scripts/render_frame_reference_sheets.py`
- Output: `asset_reference_pack/02_frames/**`
- Test: `scripts/test_frame_reference_sheets.py`

**Step 1: Propagate the approved Living construction.**

Apply profile, glazing, artwork separation, backing, spacer/shadow gap, and controlled reflection logic to single-user reference copies of the six derivative hero frames. Preserve outer width, height, and aperture; change incomplete source depth to the approved 0.134 m target depth.

**Step 2: Render 42 standard frame views and one Living exploded view.**

No dramatic shadows or depth of field.

**Step 3: Validate separation.**

Assert artwork, glazing, backing, and frame remain separate named meshes suitable for WebGL material replacement.

### Task 5: Render isolated modular assets

**Files:**
- Create: `scripts/render_isolated_asset_sheets.py`
- Output: `asset_reference_pack/03_seating/**`
- Output: `asset_reference_pack/04_tables_consoles/**`
- Output: `asset_reference_pack/05_beds_kids/**`
- Output: `asset_reference_pack/06_automobile/**`
- Output: `asset_reference_pack/07_showcase_objects/**`
- Output: `asset_reference_pack/08_plants_decor/**`
- Test: `scripts/test_isolated_asset_sheets.py`

**Step 1: Render the 15 standard eight-view families.**

Expected: 120 files.

**Step 2: Render the five symmetric six-view families.**

Expected: 30 files.

**Step 3: Validate technical clarity.**

Check neutral background, grounding, complete silhouettes, no clipping, consistent scale, no showroom color cast, and visible rear construction.

### Task 6: Render scale references and package verification

**Files:**
- Create: `scripts/render_scale_references.py`
- Create: `scripts/verify_asset_reference_pack.py`
- Output: `asset_reference_pack/09_scale_refs/**`
- Modify: `asset_reference_pack/00_manifest/manifest.csv`

**Step 1: Render the nine exact scale-reference images.**

Use the same coordinates and meter dimensions recorded in the manifest.

**Step 2: Verify the complete pack.**

Fail if active `render_manifest.csv` rows do not equal 226, an active output is missing, a duplicate filename exists, a view code is invalid, or a Blender object/placement mapping is unresolved. Files under `archive/` are excluded.

**Step 3: Generate a checksum report.**

Record scene and image hashes in `asset_reference_pack/00_manifest/checksums.sha256` without modifying source Blender files.

### Task 7: Automobile post-propagation stress test

**Files:**
- Create: `asset_reference_pack/01_context_views/zone_05_automobile/automobile_stress_test_notes.md`

**Step 1: Review dark-zone material behavior.**

Verify black-level separation, roughness hierarchy, glazing/paint reflections, floor response, and artwork hierarchy.

**Step 2: Correct master logic, not one-off exposure.**

If Automobile fails, do not alter the frozen master in place. Any shared gallery material/lighting change creates a new candidate scene revision, reopens v02.1-style approval, and regenerates all affected active rows under a new image revision. A correction restricted to the neutral reference rig may proceed without changing gallery-master approval. Do not compensate by changing the Automobile camera exposure alone.

**Step 3: Approve gallery-wide dressing.**

Only after the stress test passes may the project proceed to full furniture dressing and final asset integration.
