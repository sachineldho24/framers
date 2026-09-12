# Framers gallery: website integration design

Date: 2026-09-08. Status: initial implementation built; see [implementation results](18-gallery-first-slice-results.md). Physical-phone acceptance and the remaining five room bakes are pending. The design below records the original proposal.

Reviewed against [ICG_Findings_By_GPT_SOL.md](../ICG_Findings_By_GPT_SOL.md), the downloaded ICG camera and first-floor GLBs, and the current v06 export and application code on 2026-09-08. The new [implementation-readiness review](17-gallery-implementation-readiness.md) records the concrete gaps and first milestone. [Fresh measurements](icg-gallery-evidence/integration-readiness-audit.json) reproduce the model comparison below; physical-phone performance remains unmeasured.

## Recommendation

Build a dedicated, full-screen `/gallery` experience inside the existing Next.js application, using Three.js for the scene and React for the navigation and frame details. Let scrolling or swiping move the camera along the approved continuous gallery path. Add six room stops and clickable artwork, with a direct handoff into the existing framing designer.

The immediate priority is preparing the scene for this experience: bake its final lighting, reduce geometry for the viewing distance, and compress textures for GPU use. The current v06 asset is a useful review model, but its texture and geometry costs are too high to adopt as the default mobile asset without further work.

Port 8766 was stopped and verified to have no listener. No replacement server was started.

## What the downloaded ICG site actually does

Inspected snapshot: `C:\Users\Sachin\Downloads\icggallery.irisceramicagroup.com\icggallery.irisceramicagroup.com`.

The download contains compiled Nuxt/Vue application code, a Three.js renderer, GSAP-driven transitions, floor assets, textures, audio, and camera animation. It is a captured site, not its original development repository. The desktop POV assets referenced by its code are absent; the downloaded floor models are mobile variants. The live first-floor URL timed out during this investigation, so the implementation findings below are from the local snapshot.

| Finding | Evidence in the downloaded source | Implication for Framers |
| --- | --- | --- |
| Floor geometry and the camera path load separately | `webgl/models/camera_paths.glb`; `ByP-3qHx.js:48011` | Export the tour separately so furniture updates cannot resample or change camera timing. |
| Scrolling drives normalized camera animation time | `kr04TWo_.js:829`; animation sampling at `ByP-3qHx.js:47974` | Use one continuous progress value for scroll, swipe, room navigation, and optional playback. |
| Desktop navigation has drag and gentle snapping | `kr04TWo_.js:760` and `:841` | Support familiar scroll/drag input and settle at room compositions. |
| Pins are HTML elements projected from 3D coordinates | `kr04TWo_.js:118` and `:128` | Use accessible DOM buttons attached to artwork anchors. |
| Opening a pin pauses movement and adjusts the camera | `kr04TWo_.js:134`; `ByP-3qHx.js:50209` | Freeze navigation while a frame detail panel is open, then restore the exact position. |
| Assets vary by mobile/desktop | `ByP-3qHx.js:47184` asset manifest | Produce separate quality variants; select conservatively and adapt to rendering performance. |
| First-floor field of view is about 32.27° desktop and 45° portrait mobile | `ByP-3qHx.js:49116` and `:50264` | Author mobile framing explicitly instead of cropping the desktop camera. |
| Texture atlases contain visible lighting and shadows | Extracted first-floor atlas, linked below | Much of the visual richness can be prepared offline. |
| POV scenes use ambient light and an environment texture | `ByP-3qHx.js:50183` and `:50270` | A small browser lighting setup can complement prepared scene textures. |
| The overview and POV are different presentations | `slider.glb`, `iso_ff` textures, overview reveal shader at `ByP-3qHx.js:48336` | A small overview can help navigation without exposing unrestricted orbit controls. |

The atlas visibly contains cast shadows around the kitchen furniture. Its GLB material uses it as a base-color texture. This supports a baked appearance; the exact baking workflow cannot be recovered without ICG's authoring files. The POV GLB still uses PBR materials, so describing the whole site as unlit would be inaccurate.

[Inspected texture atlas](icg-gallery-evidence/icg-ff-texture-atlas.webp) · [Measured asset inventory](icg-gallery-evidence/asset-inventory.json)

## The measured gap

Decimal MB; model file sizes exclude application JavaScript, shared assets, and other network requests.

| Metric | ICG first-floor mobile GLB | Current Framers v06 GLB |
| --- | ---: | ---: |
| File size | 1.80 MB | 28.65 MB |
| Triangles across all indexed meshes | 124,140 | 1,305,750 |
| Meshes / materials | 17 / 16 | 79 / 35 |
| Embedded images | 17 | 40 |
| Embedded image payload | 0.78 MB | 22.99 MB |
| Image dimensions | 512² and 1024² | 1024², 1254², and 2048² |
| Estimated RGBA8 texture storage with mipmaps | 78.3 MB | 508.9 MB |

These are different scenes, so the ratios are not a like-for-like quality benchmark. They do identify the main costs: textures make up approximately 80% of the current Framers download. GPU memory estimates assume every embedded image becomes an RGBA8 texture with a full mip chain; they are not measured allocations and exclude render targets, environment maps, and geometry.

Draco already compresses our geometry. Further geometry compression alone will not address the texture payload or its decoded memory cost. WebP/JPEG reduce download bytes; KTX2/Basis can also reduce GPU texture storage. Three.js provides both Draco and KTX2 support through its loaders. [GLTFLoader documentation](https://threejs.org/docs/pages/GLTFLoader.html), [KTX2Loader documentation](https://threejs.org/docs/pages/KTX2Loader.html).

## Approaches considered

| Approach | Strength | Tradeoff | Decision |
| --- | --- | --- | --- |
| Embed the current standalone viewer in an iframe | Quickest reuse of the preview | Retains asset costs and creates a second navigation/input boundary; shopping integration needs messaging | Suitable for internal review, not the recommended storefront experience |
| Native Three.js gallery in Next.js, with image fallback | Continuous perspective, artwork interaction, shared app navigation, control over quality | Requires asset preparation and a small camera/input runtime | Recommended |
| Pre-rendered room images or a video tour | Consistent render quality and inexpensive playback | Limited camera freedom and weak continuous interactive navigation | Use as the fallback and homepage entrance imagery |

React Three Fiber is a viable alternative renderer integration, but it would require rewriting the existing Three.js runtime. There is no demonstrated need for that additional change here. Keep the renderer isolated behind a small interface so React owns UI state while Three.js owns per-frame work.

## Visitor experience

1. A strong living-room render and **Explore the gallery** link introduce the experience on the homepage and navigation drawer. The standard framing CTA remains immediately usable. Do not preload the complete gallery on every storefront visit.
2. `/gallery` displays that composition immediately while loading the lightweight scene. A short **Scroll or swipe to explore** hint explains the movement.
3. Scroll, trackpad, touch, keyboard next/previous controls, and six chapter buttons all navigate the same path: Living → Motoring → Together → Childhood → Study → Anniversary.
4. Camera movement passes through the connecting architecture. Room changes do not crossfade between disconnected models. Chapter jumps travel along the path with duration bounded for usability.
5. Artwork pins appear near the current room. Selecting one opens a frame panel on desktop or a compact bottom panel on mobile, with the artwork, description, and **Create your frame** action.
6. That action uses `/design/start`, or `/design/start?frameId=...` only when a real catalogue frame ID is configured. This starts framing the visitor's own upload; it does not import the gallery artwork. The current designer has sign-in handling, but the proxy currently puts only the pathname into `next`, so a signed-out visitor loses `frameId` after sign-in. Preserve and test the intended query before enabling catalogue-specific handoffs. Do not manufacture product IDs, prices, or promises that a displayed sample is an available editable template.
7. Closing the panel restores progress, input, and keyboard focus. An always-visible exit returns to the storefront. An optional overview offers direct room selection.

The six spaces are settings for showing frames; they do not require six new product categories. The showroom can retain its warm architecture while UI controls use the existing Framers typography, hard edges, and restrained brand accents.

## Asset preparation

Keep `gallery_v06/framers_gallery_v06_meshy.blend` as the full-detail master, including the corrected sofa. Generate a separate production web revision from it.

1. **Freeze composition before baking.** Retain the approved floor plan and sofa orientation. Reuse the existing v05 baking scripts as a starting point, but rebake from v06. Earlier wall/floor shadows no longer match the replacement furniture or its corrected placement.
2. **Simplify by viewing distance.** Reduce furniture meshes, remove hidden undersides and unseen rear detail, retain sofa outlines and frame edges, and transfer useful normal detail where necessary. Validate silhouettes from the whole camera path, not only the opening shot.
3. **Bake static diffuse appearance.** Capture soft shadows, indirect light, and lamp spill into suitable texture atlases. Fully baked static surfaces can use unlit materials. Keep selected metal, glass, and frame surfaces separately shaded with PBR/environment reflections. Do not apply full dynamic diffuse lighting over an already fully lit texture.
4. **Preserve material and artwork control.** Export artwork planes, interaction anchors, reflective accents, and room bounds with stable semantic IDs. Keep artwork images separate from the environment atlases so detail can load on demand and images can change without rebaking the room.
5. **Compress for the device.** Use KTX2/Basis for environment textures, with careful visual checks on gradients, small text, and normal maps. Test ETC1S for broad static color and UASTC for sensitive artwork/normal detail. Keep a small shared decoder bundle and choose a supported format at runtime.
6. **Package by useful visibility.** Keep the continuous shell and low-detail representations available throughout the tour. Load detailed room groups independently and prefetch adjacent spaces. Several rooms can be visible at a turn; do not hide everything except the current room. Any moving camera must have at least the complete low-detail environment ahead of it.
7. **Export camera data separately.** Store the tour keyframes, room poses, and hotspot anchors independently from furniture geometry. Verify that production geometry exports leave the camera data identical.

Use cached, versioned static URLs for assets. A same-origin `public/gallery-assets/<revision>/` path is enough for the first implementation; a CDN can serve the same manifest paths later. Exclude this exact static prefix from the Next.js proxy matcher: the current matcher sends GLB, KTX2, WASM, JSON, and decoder JS requests through Supabase session refresh. Keep `/gallery` as an ordinary application route. A local Python server and port 8766 are not part of the website deployment.

## Next.js implementation boundary

Proposed files:

```text
src/app/gallery/page.tsx                 server-rendered shell, metadata, fallback
src/components/gallery/GalleryClient.tsx browser-only loader and lifecycle
src/components/gallery/GalleryChrome.tsx room controls, progress, exit
src/components/gallery/FramePanel.tsx    artwork details and designer CTA
src/lib/gallery/manifest.ts              rooms, assets, anchors, optional frame IDs
src/lib/gallery/runtime.ts               renderer, disposal, render scheduling
src/lib/gallery/camera.ts                normalized progress and input arbitration
public/gallery-assets/<revision>/       optimized assets, previews, decoders
```

Lazy-load the browser-only gallery from a Client Component. Next.js documents that `ssr: false` belongs in a Client Component, while the route shell and fallback can remain server-rendered. [Next.js lazy-loading guide](https://nextjs.org/docs/app/guides/lazy-loading).

Runtime contract: `setProgress`, `goToRoom`, `focusArtwork`, `restoreTour`, `resize`, and `dispose`. Store renderer objects and frame state in refs/runtime objects, not React state updated every animation frame. React receives discrete events such as room changes, selection, readiness, and errors.

One controller owns camera position at any instant. Scroll and swipe set a target progress; damping follows it; a chapter selection sets a bounded path transition; opening details suspends movement. New user input cancels an automatic transition. Playback, if added, is opt-in and uses elapsed time; it must not assume 60 FPS or inherit the preview's 0.1-second delta cap as its tour clock.

Dispose geometries, materials, textures, image bitmaps, decoders, listeners, and pending animation frames on exit. Pause rendering when idle or the page is hidden, and restore safely after visibility or WebGL context changes. Product navigation and modal keyboard handling remain ordinary React/HTML behavior.

## Mobile, accessibility, and quality targets

These are starting budgets to validate on real devices, not achieved measurements or guarantees.

| Budget | Mobile target | Desktop target |
| --- | --- | --- |
| First navigable environment download | At most 3–4 MB including required scene textures | At most 5–6 MB |
| Complete scene download after exploration | Approximately 6–10 MB | Approximately 10–16 MB |
| Visible triangles | At most 200,000 | At most 500,000 |
| Draw calls in representative views | At most 50 | At most 80 |
| Resident scene textures | Aim below 128 MB | Aim below 256 MB |
| Sustained interaction | At least 30 FPS on the chosen test phone | Aim for 60 FPS on the chosen test laptop |

Track decoder and JavaScript costs separately from scene download. Use actual frame timings and a conservative default quality level; viewport width alone does not identify a device's GPU. Bound pixel ratio, avoid multiple shadow-casting lights in the mobile tier, and keep post-processing optional. Better lighting preparation is more valuable here than adding bloom or expensive real-time effects.

Provide portrait-specific camera framing, touch-sized controls, keyboard next/previous, focus restoration, and a readable HTML artwork list. Reduced-motion mode uses deliberate chapter selection with immediate or very short transitions and no idle camera drift. Failed WebGL or asset loading falls back to the six rendered room images with the same artwork actions; visitors can still start framing.

## Recommended implementation sequence

1. Prepare the living room and adjoining visible transition as a production-quality slice. Bake from the final v06 geometry and create a mobile export, retaining the corrected sofa.
2. Exercise that slice inside a minimal `/gallery` shell: separate camera asset, scroll/swipe controller, portrait framing, one artwork pin and detail panel, generic designer CTA, and an image fallback. Do this before processing all six rooms so the asset and runtime costs are measured together.
3. Compare the result with the approved render on a real phone and the available Intel integrated-GPU laptop. Use the measurements to settle atlas resolution, shading, geometry density, and quality budgets, then apply the pipeline to all six settings.
4. Add the complete continuous shell, all six chapters, artwork anchors, adjacent-room detail loading, and actual catalogue mapping where available. Validate the signed-out handoff before passing frame IDs.
5. Add the six-image fallback, optional overview, and the homepage/navigation entrance once the direct route passes its acceptance checks.
6. Verify continuous corner transitions, room jumps, touch/keyboard controls, rewind after the final stop, modal restoration, portrait rotation, repeated mount/unmount, context loss, and normal checkout access. Capture real-device frame and memory evidence before calling the scene production-ready.

No new backend or payment work is required for the initial gallery. Existing designer routes are sufficient. Artwork-to-product mappings can be filled from the catalogue when the gallery is implemented; the safe default CTA remains `/design/start`.

The recommended next unit of work is the optimized, baked living-room slice. That establishes whether the intended visual quality and mobile performance can coexist before the rest of the gallery receives the same treatment.
