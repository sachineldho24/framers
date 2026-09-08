# Gallery

`/gallery` is a full-screen room tour. Only the scene and an eye beside the artwork appear during exploration. Wheel/drag/swipe input travels continuously through six camera stops. Arrow keys change rooms, Home/End jump to the endpoints, and Enter opens artwork details. The dialog pauses travel and restores focus on close; its framing link opens `/design/start` with the customer's own artwork.

The renderer is imported after route entry. Room photographs cover loading and provide a fallback for reduced motion, unavailable WebGL, or asset failure. Fallback rooms support wheel, swipe, and keyboard input. The homepage entry disables route prefetch.

## Source and deployment assets

- `GalleryClient.tsx` owns the canvas, fallback, and accessible artwork dialog.
- `runtime.ts` loads the shared shell and current/adjacent rooms, projects the eye outside the artwork, and disposes distant rooms. Rendering pauses while idle or hidden.
- `camera.ts` samples the exported animation, preserving its hierarchy and transforms.
- `navigation.ts` smooths input and controls interruptible room transitions.
- `public/gallery-assets/v07` contains all required models, camera data, images, metadata, and the local Draco decoder. A normal app build needs only these committed assets.

The initial scene is 1.84 MB, plus a 251 KB decoder and fallback imagery. All scene files together total 13.69 MB. The living room uses a separate lighting bake and approximately 118,000 furniture/patch triangles. The other five rooms have lighter texture downloads but retain their existing geometry and lighting. Physical-phone performance acceptance is still pending.

## Checks

```powershell
npm ci
npm run test:unit
npm run build
node scripts/audit_gallery_web_assets.mjs
```

For browser checks, run one production server at `http://127.0.0.1:3000` and a local Chromium instance with remote debugging on port 9337 and a page open. Run `node scripts/verify_gallery_scene.mjs` using Node 22 or later. This verifies the clean desktop/mobile scene, artwork details and focus restoration, wheel/swipe and keyboard travel, and context-loss image fallback. Reports and screenshots are written to the ignored `gallery_v07/browser` directory. Viewport emulation does not measure physical-phone GPU performance.

## Optional asset regeneration

Authoring inputs and intermediate exports stay outside Git. Keep a separate backup of the corrected `gallery_v06/framers_gallery_v06_meshy.blend` master, `gallery_v06/framers_gallery_v06.glb`, `gallery_v06/gallery-structure.json`, and six named room preview PNGs in `gallery_v06/previews` (or `gallery_v05/previews`). These inputs are required only to regenerate the deployed assets.

1. Run Blender 5.2 with `--background --factory-startup --threads 3 --python scripts/bake_gallery_living.py`. This writes the living bake to `gallery_v07` without saving the master.
2. Run `python scripts/denoise_gallery_living.py`. This Windows authoring helper needs NumPy, Pillow, and Blender 5.2's bundled Open Image Denoise DLLs at the path declared in the script.
3. Run `node scripts/package_gallery_assets.mjs`, then `node scripts/audit_gallery_web_assets.mjs`.

The package step preserves the authored camera animation, compresses geometry with Draco, and encodes WebP textures. WebP reduces transfer size; it does not compress decoded GPU texture memory. Review appearance and performance on a physical phone before applying the living-room optimization process to the remaining rooms.
