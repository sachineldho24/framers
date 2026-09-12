# Gallery first-slice implementation

Date: 2026-09-08. Local review build; physical-phone acceptance remains pending.

Visual revision after user review: removed the visible 3D caption card and solid white header/footer/button backgrounds. Navigation now sits directly over the scene. Artwork uses a circular eye marker with a neutral dark hover, replacing the square plus and green hover. Desktop Study and portrait Living screenshots are saved as `gallery_v07/browser/minimal-study-desktop.png` and `minimal-living-mobile.png`; browser checks confirmed that the eye opens details and Escape restores its focus. Production build and targeted component lint pass.

The eye now follows the outside of the projected frame instead of its center. It prefers the right edge and uses the left, lower, or upper edge when necessary on a narrow viewport. A fixed screen-space gap keeps the icon and its hover expansion clear of the artwork and molding.

Latest user revision: removed the entire header, caption, scroll hint, status notice, room counter, room names, navigation arrows, and progress controls. The tour now shows only the scene and the eye beside the artwork. Scroll, swipe, and keyboard travel remain available; Enter opens artwork details when the canvas has focus. Image fallback also supports wheel, swipe, and keyboard room changes with an eye for details. Production build and targeted lint pass. `gallery_v07/browser/scene-only-review.json` records desktop/mobile overlay removal, wheel/swipe travel, keyboard navigation, dialog focus restoration, and context-loss fallback checks; screenshots are `scene-only-desktop.png` and `scene-only-mobile.png` in the same directory.

## Built

- Full-screen `/gallery` in the existing Next.js site, entered through the homepage **Explore the gallery** feature and navigation drawer.
- Browser-only Three.js import on gallery entry, with server-rendered room imagery. Homepage links disable prefetch.
- Continuous scrolling, swipe/drag input, keyboard navigation, and six chapter stops using the existing exported `CAM_TOUR` hierarchy and keyframes. Portrait framing uses a wider field of view and a vertical lens shift; it is not a separately authored camera animation.
- World-space artwork pins with projection, visibility and occlusion checks. The artwork dialog freezes travel, owns keyboard focus, supports Escape, and restores the opener.
- **Create your own frame** opens `/design/start`. The gallery supplies inspiration; it does not import the displayed artwork into a design session or invent catalogue product IDs.
- Six image rooms remain usable after model/decoder failures or WebGL context loss. Reduced-motion preference starts with images and no model downloads.
- A shared architectural shell, separate camera data, per-room detail, current/adjacent room loading, and disposal of distant rooms. Rendering stops while idle or hidden.
- Same-origin Draco decoder, exact gallery asset prefix excluded from auth proxy, and explicit revalidation while this revision is being regenerated.

## Living-room asset work

The corrected master is `gallery_v06/framers_gallery_v06_meshy.blend`. The bake process opens it, changes the working scene in memory, exports separately, and verifies the source SHA-256 without saving the master. Furniture world matrices are recorded and checked; the sofa retains its corrected placement.

`scripts/bake_gallery_living.py` simplifies the living furniture to approximately 118,000 triangles and bakes diffuse appearance, indirect light, and shadows. Wall/floor patches cover the living area and overlay the shared shell. The bake uses dedicated UV coordinates, OIDN denoising, edge padding, and unlit materials, preventing dynamic diffuse light from being added again. Artwork and other architectural materials retain PBR shading and environment reflections.

`scripts/package_gallery_assets.mjs` exports Draco geometry and WebP textures. Tiled material maps use 512px; artwork/source furniture maps use up to 1024px; the furniture bake uses 2048px. WebP reduces download size but still decodes to ordinary GPU textures. KTX2 and separate mobile/desktop geometry variants were not produced in this milestone.

The other five rooms use their existing geometry, packaged separately with smaller textures for navigation review. They have **not** received the new lighting bake or geometry pass. Their representative views still exceed the mobile 200,000-triangle budget.

## Evidence and checks

Measured deployment assets (decimal MB):

| Measurement | Result |
| --- | ---: |
| Scene required for first useful frame, including camera | 1,835,344 bytes / 1.84 MB |
| Draco wrapper + WASM, separate from scene | 250,876 bytes / 251 KB |
| Adjoining motoring detail, fetched after first useful frame | 894,336 bytes |
| All six scene files after full exploration | 13,693,484 bytes / 13.69 MB |
| Living-room furniture + baked patches | 118,002 triangles |
| Opening portrait view, including visible surroundings | 165,160 triangles / 22 draws |
| Opening desktop view | 174,440 triangles / 26 draws |
| Estimated RGBA8 scene textures with mipmaps, first room | 48.9 MB |
| Same estimate with adjoining room resident | 71.3 MB |

Scene download totals exclude JavaScript, decoder and rendered fallback images. Texture estimates exclude the generated reflection environment, framebuffers, geometry, browser memory, and driver overhead. The remaining rooms account for most of the full-tour geometry and download cost.

Validation: production build and TypeScript pass; all 290 unit tests pass; targeted lint for gallery source, integration edits, and packaging/QA scripts passes. Full-repository lint still reports existing errors in `CheckoutClient.tsx`, `ErrorBanner.tsx`, and `Animations_Sample/`; these were not changed as part of this work.

- `gallery_v07/bake-report.json`: source hash, preserved transforms, output geometry, and bake dimensions.
- `gallery_v07/web-asset-audit.json`: deployment file hashes, download bytes, embedded image dimensions, and conservative decoded texture estimates.
- `gallery_v07/browser/initial-report.json`: desktop/portrait opening-view draw counts and triangles.
- `gallery_v07/browser/verification-report.json`: touch input, all six stops, end reversal, modal pause/focus, repeated-tour resource disposal, idle scheduling, reduced motion, asset/context failure, homepage network isolation, and signed-out designer handoff.
- `gallery_v07/browser/*.png`: room, homepage and artwork-panel screenshots.
- `gallery_v07/browser/performance-report.json`: production HTTP cold-load sample and sustained canvas-frame measurements.
- `gallery_v07/browser/fallback-report.json`: unavailable WebGL, disabled JavaScript, 320px width and landscape layout checks.

Earlier production checks verified that all six projected artwork pins are available at their stops, switching from images creates a fresh WebGL canvas, and leaving while loading aborts without an uncaught error. The explicit image/3D switch was removed with the header in the latest revision. Homepage network checks locate the actual built Three.js/runtime chunk and verify it is not fetched before gallery entry. Static GLB responses carry the configured revalidation header and no session cookie.

Browser viewport emulation checks layout and interaction plumbing. It does not establish physical-phone GPU performance. The phone gate remains: 60 seconds of forward/backward travel on a named phone/browser, at least 30 FPS, with frame intervals, stalls, temperature/power conditions, and visual comparison to the corrected render recorded.

Measured on Windows Chromium 151 with Intel HD Graphics 620 / ANGLE D3D11, using the production server:

| Test | Duration | Average canvas FPS | Median / p95 interval | Stalls over 100 ms |
| --- | ---: | ---: | --- | ---: |
| Emulated 390 × 844 portrait; 487 × 1055 drawing buffer | 60 s | 59.8 | 16.7 / 22.5 ms | 1 (maximum 170.5 ms) |
| 1440 × 1000 desktop; native drawing buffer | 30 s | 39.6 | 24.8 / 34.0 ms | 0 |

The initial desktop sample was 25.5 FPS. Rendering opaque baked surfaces before the shell allows the GPU to skip hidden PBR fragments and raised the result to 39.6 FPS without lowering resolution. The 60 FPS desktop aim is **not yet met** on this integrated GPU. These are local samples, with temperature/power and other desktop processes not controlled; they do not establish a device fleet result.

The final HTTP cold-load sample reached a useful scene frame in 4.08 seconds with browser HTTP cache disabled, 10 Mbps down / 2 Mbps up and 80 ms simulated latency. GPU shader caches were not reset. JavaScript, decoder and completed resource transfer details are retained in the performance report; this sample includes startup work and is separate from sustained-motion timings.

## Reproduce

Use one server at `http://127.0.0.1:3000`.

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --threads 3 --python scripts/bake_gallery_living.py
python scripts/denoise_gallery_living.py
node scripts/package_gallery_assets.mjs
node scripts/audit_gallery_web_assets.mjs
npm run typecheck
npm run test:unit
npm run build
```

The browser scripts connect to a locally running Chromium debugging port 9337. `scripts/check_gallery_browser.mjs` captures opening views. The earlier `scripts/verify_gallery_browser.mjs` and fallback report include checks that use the now-removed navigation controls; they describe the previous UI revision. `tmp/gallery-scene-only-review.mjs` checks the current scene-only interaction, producing the report above. Generated exports, vendored decoders and browser working data are excluded from ESLint; application source and packaging/QA scripts remain checked.

## Remaining acceptance work

Validate the living-room appearance and sustained performance on a physical phone before baking/simplifying the other rooms. The six-room route is available for interaction review now; this is not a claim that all six rooms meet the mobile budget. Keep the original corrected render as the visual reference. Production deployment and artwork-template import were not performed.
