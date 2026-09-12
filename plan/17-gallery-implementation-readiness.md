# Gallery implementation readiness and first milestone

Date: 2026-09-08. Status: initial implementation built after this review; see [implementation results](18-gallery-first-slice-results.md). The audit and proposed sequence below are the pre-implementation record.

## Decision

Proceed with the full-screen `/gallery` direction from [plan 16](16-icg-gallery-web-integration-design.md). The first deliverable should be one optimized, baked living room running inside the actual website, with scrolling, a clickable artwork panel, designer navigation, and fallback imagery. Measure this combined asset/runtime slice before preparing the other five rooms.

The visual target is the corrected v06 composition, including the sofa's long back along the left side. The browser screenshot currently differs substantially in brightness and shadow treatment from the saved corrected-room render. Compare matching camera poses and output color settings when approving the bake; a rendered image alone cannot establish the appearance of the browser material setup.

## What the SOL findings establish

[The supplied findings](../ICG_Findings_By_GPT_SOL.md) describe a useful system: an authored camera animation scrubbed by smoothed input, prepared lighting, mobile assets, projected HTML pins, shader preparation, and limited runtime effects. Preserve these principles in our own architecture.

The independent read of ICG's downloaded `camera_paths.glb` confirms four cameras and four clips. The first-floor translation and rotation tracks contain 97 samples over four seconds; the file is 13,344 bytes. The captured first-floor mobile model is 1,801,172 bytes and 124,140 indexed triangles, with Draco geometry and WebP textures. Its generator identifies glTF-Transform v3.4.2.

The SOL report's 1500 ms scroll smoothing, pointer effects, and captured compositor timings are reference observations, not performance targets already achieved by Framers. A four-second animation does not mean a four-second visitor journey. Nor does 24 Hz animation sampling cap the renderer at 24 FPS: the browser interpolates the samples. Its reported compositor cadence is not proof that our scene will sustain that rate on a physical phone.

## Current code and assets: verified gaps

Read-only audit: [integration-readiness-audit.json](icg-gallery-evidence/integration-readiness-audit.json). File hashes bind measurements to the inspected exports. This review did not run a new browser benchmark or modify a Blender scene.

| Area | Current evidence | Required change |
| --- | --- | --- |
| Camera animation | `CAM_TOUR` already has translation and quaternion tracks; 193 samples from approximately 0.033333 to 96.033333 seconds | Extract a camera-only asset and retain its hierarchy, transforms, projection, and animation. Runtime controls sampling time; it does not reconstruct the architecture path. |
| Sampling | v06 reuses an exporter with `export_frame_step=15` at 30 FPS, producing half-second sample spacing | Check corners against the source Blender animation. Increase sampling only where comparison reveals interpolation error; the nominal 2 Hz rate alone does not establish a visual defect. |
| Camera projection | All seven exported cameras use approximately 38 degrees vertical FOV | Preserve this verified desktop baseline. The viewer's initial 32.27-degree camera is replaced by the GLB camera. Author and review portrait composition separately. |
| Chapter movement | `gallery_v06/index.html` calls `pose(CAM_ROOM_*)` immediately on a room click | Animate normalized progress through the tour. Fixed room cameras remain composition references. |
| Chapter consistency | Exported tour versus fixed-room poses differ by up to 0.078 m in position and about 0.57 degrees in view direction at declared stops | Use a single tour source for movement and chapter destinations so closing details or resuming motion cannot switch between subtly different poses. |
| Input | Existing viewer provides a range slider, timed playback, and OrbitControls | Add wheel, touch, and keyboard input to one cancellable progress controller. The storefront tour needs controlled navigation. |
| Geometry | Entire export: 1,305,750 triangles. Living furniture group: 167,845; sofa component before merge: 113,279 | Simplify by visible silhouette and projected size. The room export's inherited mesh name can describe a whole merged group; do not mistake it for the sofa alone. |
| Texture cost | 22,994,114 of 28,652,284 bytes are embedded images, approximately 80.3% | Baking must replace redundant maps, followed by resize/compression. Adding bake textures alongside every old map would increase the cost. |
| GPU texture estimate | Approximately 508.9 MB under an RGBA8/full-mip assumption | Introduce KTX2/Basis and measure supported-device output formats. This estimate is not measured GPU allocation. |
| Lighting | Current export has no unlit-material extension. Viewer uses an environment, a hemisphere light, two area lights, two shadow spots, and four wash spots | Bake static diffuse appearance from corrected v06; retain PBR reflections only where they materially help the scene. |
| Mobile | Current viewer caps DPR at 1.25 but loads the same GLB and camera. Saved mobile QA checks 390px layout | Produce a lighter asset and intentional portrait camera. Real-phone timing is still required; raising DPR to match ICG's 1.5 cap is not a performance improvement. |
| Idle work | Viewer skips idle renders but still schedules animation frames and evaluates lighting every frame | Stop scheduling once motion and loading settle; restart on actual input, resize, asset readiness, or visibility restoration. |
| Packaging | No `/gallery` route or Three.js npm dependency in current application. Preview vendors Three.js r180 | Add one pinned Three.js dependency and matching types/addons when implementing. Reuse runtime concepts from the preview; keep dependencies isolated from homepage imports. |
| Proxy | Matcher excludes common images but includes GLB, KTX2, WASM, and JS | Exclude the dedicated `/gallery-assets/` prefix so static downloads do not each trigger Supabase session checks. |
| Designer | `/design/start` accepts only `frameId`; StartChooser creates an upload session | Initial gallery CTA starts the visitor's own design. Selecting a displayed artwork does not currently import that artwork or create an editable template. |
| Login return | Proxy builds `next` from pathname only | Preserve the query and retain same-origin validation before using a frame-specific handoff. Generic `/design/start` is already sufficient for the first slice. |

The saved browser report records 54 draw calls and 796,106 rendered triangles in its initial measurement. It is historical, not a fresh benchmark, and its render counters should not be equated with unique asset triangles or GPU time. Geometry may also be submitted for shadow passes.

## Alternatives and scope

| Choice | Appropriate use | Decision |
| --- | --- | --- |
| Embed standalone viewer | Internal scene review with its existing transport controls | Keep as a review tool. |
| Native Three.js runtime with React controls | Reuse animation/loaders and share website navigation, accessibility, and designer routing | Recommended for the website. |
| Rendered room images | Immediate loading presentation, reduced motion, WebGL failure, and a lightweight browsing option | Build alongside the 3D slice and reuse the artwork data. |

React Three Fiber is possible, but introducing it is not necessary to preserve the current Three.js work. GSAP, the isometric construction reveal, noise/depth transitions, cursor parallax, and audio can wait until asset quality and the basic tour pass. The existing `motion` dependency can handle React panel transitions; camera progress needs only one runtime controller.

## First milestone: a living room visitors can actually use

### 1. Export a reproducible scene slice

Source: `gallery_v06/framers_gallery_v06_meshy.blend`. Create a separate production working revision. The corrected source and existing v06 exports remain the comparison baseline.

Proposed tools: `scripts/export_gallery_camera.py`, `scripts/prepare_gallery_living_slice.py`, and `scripts/validate_gallery_web_assets.py`. Give each an explicit source and output path. Avoid extending the current pattern of executing a text fragment from another exporter: it hides inherited export settings and makes the pipeline difficult to reproduce.

Export the living room plus architecture and low-detail neighboring content visible between Living and Motoring. Restrict the first slice's navigation to its covered range, starting with the existing stops `0` and approximately `0.112366`; do not allow the camera to enter unprepared empty space. This is a first-room test, not a six-room launch.

Separate logical groups before merging: static surfaces, furniture, reflective accents, artwork, and anchors. Keep the shared coordinate origin. Merge compatible static geometry within visibility groups; merging an entire house makes visibility culling and independent room loading ineffective. Remove unseen faces only after checking every permitted camera pose and any detail movement.

Bake final static lighting into UV atlases with padding for mipmaps. Transfer useful normal detail from the source when simplification changes its appearance. Retain the sofa silhouette and fabric reading, frame edges, floor contact shadows, wall illumination, and the opening beyond the living room. Check source color textures for preexisting lighting before adding another bake.

Use unlit materials for fully baked diffuse surfaces and selective PBR for reflective pieces. Keep artwork independent of the environment atlas. Establish one documented color/exposure pipeline so an already display-transformed bake is not tone-mapped a second time.

Create mobile and desktop outputs from the same source. Use a small number of suitably sized atlases instead of retaining all source material maps. Evaluate ETC1S for broad static color and UASTC for sensitive detail; the CLI supports both. This is a proposed selection to validate visually, not a claim that one compression preset fits every texture. [glTF-Transform CLI](https://gltf-transform.dev/cli).

Proposed artifact set:

```text
gallery_v07/                         production working assets and reports
  camera-paths.glb                   separate camera hierarchy and animation
  living-mobile.glb                 simplified/baked first slice
  living-desktop.glb                higher-detail variant, only if needed
  living-desktop.webp               matched loading/fallback composition
  living-portrait.webp              deliberately framed portrait view
  manifest.json                     asset paths, bytes, bounds, camera IDs, anchors
  validation.json                   geometry, animation, image and export checks
public/gallery-assets/v07/           selected deployment assets and decoders
```

For the first exact camera extraction, compare node/world transforms, projection, and track data against v06. Any later mobile choreography or denser resampling is a deliberate new camera revision with visual comparisons, not a claim of byte-identical preservation. Export artwork anchors from scene transforms; the metadata's `quad` fields describe reference-image pixels and are not world-space hotspot coordinates.

### 2. Use the slice inside the real route

Follow the component boundary in plan 16. Add `src/app/gallery/page.tsx`, `src/components/gallery/GalleryClient.tsx`, `GalleryChrome.tsx`, and `FramePanel.tsx`; isolate scene work in `src/lib/gallery/`. The current root layout imposes no shared Navbar/Footer, so the new route can provide its own full-screen controls without restructuring unrelated pages.

The server-rendered page presents useful imagery, title, artwork description, exit, and designer link immediately. Load Three.js only from the gallery client boundary. Put `ssr: false` inside a Client Component, as required by Next.js. On the eventual homepage entry link, use `prefetch={false}` and verify network behavior if the requirement is no gallery runtime download before entry. [Next.js lazy loading](https://nextjs.org/docs/app/guides/lazy-loading).

Configure the matching Draco/KTX2 loaders and their same-origin decoder assets. Detect texture support before KTX2 loading. Configure materials, lights, and the environment before `compileAsync`; keep fallback imagery until a first scene frame has rendered. Shader compilation alone does not guarantee that texture upload/decode work is finished. [KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html), [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html).

Adjust `src/proxy.ts` for the static asset prefix. Add and verify versioned-asset caching explicitly rather than assuming files in `public/` are served with immutable caching.

### 3. Give camera control one owner

```text
Wheel / touch / keyboard / chapter button
                 |
                 v
        target normalized progress
                 |
       time-based easing controller
                 |
                 v
     sample the exported tour animation
                 |
                 v
       camera matrices and HTML pins
```

Use the exported track interval: `sampleTime = start + progress * (end - start)`. v06's first sample is not exactly zero. Keep mixer/action time scales at one while explicitly sampling; setting the mixer time scale to zero also affects `setTime`. Use a non-looping action and deliberately re-enable/unpause it when seeking backward after the endpoint. Test the actual Three.js action, not just a pure clamp helper. [AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html), [AnimationAction](https://threejs.org/docs/pages/AnimationAction.html).

Normalize wheel delta units and touch displacement against the route's chosen scroll distance. Smooth progress using elapsed time, with ICG's reported 1500 ms behavior as a comparison preset; test reversal latency on trackpads and phones before settling on that duration. Avoid two smoothing systems acting on the same input.

Chapter buttons drive progress along the same path. New user input cancels an automatic chapter transition. Freeze the rendered progress and discard pending inertia when a detail panel opens. Closing returns to that exact value and restores focus, so leftover wheel input cannot cause a delayed move.

For the first slice, leave the camera at the artwork's tour composition when details open. A close-up camera move is a later addition that requires its own collision/composition checks. Reduced-motion mode uses explicit stop selection and static imagery or immediate camera changes, with no inertial travel.

### 4. Make one artwork interaction complete

Create a world-space anchor associated with `ART_01_LIVING`. Project it to a semantic HTML button. Hide it when behind the camera, outside the viewport, facing away, or occluded by the room. Keep it available through an HTML artwork list as well. Never make the only product action depend on canvas hit testing.

Opening the panel pauses navigation, moves focus into the panel, supports Escape/close, and restores the originating button on dismissal. Panel scrolling must not also move the tour. If a modal is used, trap focus and mark the background inert while it is open.

Use **Create your own frame** linking to `/design/start` for this milestone. The manifest should distinguish artwork identity, image, descriptive copy, and optional real catalogue frame ID. A frame ID identifies the purchasable physical configuration; it is not an artwork/template ID.

If a subsequent requirement is **Use this artwork**, add an explicit artwork selection/import flow with a print-ready source and durable session handoff. That is additional designer functionality and should not be implied by the first gallery's CTA. Before enabling `frameId` links, fix and test query preservation in `src/lib/supabase/middleware.ts` through sign-in and sign-up.

### 5. Measure before expanding

The following are acceptance targets, not current results:

| Check | First-slice target |
| --- | --- |
| Required mobile scene assets | At most 4 MB, including scene textures, camera, and required environment; report JS/decoder/image bytes separately |
| Representative visible geometry | At most 200,000 triangles, including visible neighboring content |
| Representative main-pass draws | At most 50; report additional render passes separately |
| Texture memory | Aim below 128 MB for resident scene textures; document measurement/estimation method and include environment/targets separately |
| Phone interaction | Sustain at least 30 FPS during a 60-second forward/backward exploration on a named physical test phone; record frame-time distribution and long stalls |
| Laptop interaction | Aim for 60 FPS; record GPU, viewport, DPR, browser, and power conditions |
| Visual fidelity | Correct sofa, stable contact shadows, readable artwork, no obvious atlas seams, and matched approved lighting at the same pose |
| Navigation | Forward, reverse, both ends, stop selection, and panel open/close all retain continuous state |
| Failure and accessibility | No-WebGL, failed model/decoder requests, reduced motion, keyboard-only use, portrait rotation, and designer CTA remain usable |
| Lifecycle | Leaving during loading and repeated mount/unmount release listeners, workers, textures, geometry, animation actions, and scheduled frames; no persistent loop after settling |

Record cold-load duration under a named network profile. Inspect the first rendered frame, not only the completion of a download. Separate initialization stalls from sustained interaction and report p50/p95 frame intervals. Browser emulation can verify layout and input plumbing; it cannot replace a physical-device GPU check.

Relevant implementation checks are `npm run typecheck`, `npm run lint`, `npm run test:unit`, and `npm run build`. Add behavioral tests for tour end-to-reverse seeking, input cancellation, modal restoration, and any query-preserving authentication change. Do not add tests that merely match markup strings for the new gallery. Asset validation should verify the scene contract and camera transforms in addition to file size.

Start only one Next.js development server, on the project's prescribed `http://127.0.0.1:3000`. Local browser checks should cover blocked asset requests, route exit during loading, focus restoration, and normal designer access. A physical phone/device connection is still needed to complete performance validation; record that as pending if unavailable.

## Expand after the first milestone

Apply the proven bake/export pipeline to the remaining settings. Keep a continuous low-detail shell available and load additional room detail before it becomes visible. Package textures per useful visibility group so one room does not force the entire house's atlas into memory. Preserve shared resources until every dependent room has released them.

Use the existing stop metadata as the starting point: Living `0`, Motoring `0.112366`, Together `0.448318`, Childhood `0.551653`, Study `0.874414`, Anniversary `0.990085`. These are actual manifest values, not the rounded progress samples used by the earlier browser test. Check all stops and the space between them in both aspect ratios.

Then add the homepage **Explore the gallery** image/link in `src/app/page.tsx` and the drawer entry in `src/components/mobile-navigation.ts`. Recheck that a normal homepage visit does not fetch GLBs, KTX2 textures, decoder workers, or initialize a renderer. The complete gallery can be removed from public discovery by removing these links; keep the HTML fallback route available during a rollback.

## Review completed in this turn

Read the SOL findings and plan 16; inspected the v06 exporter, optimizer, camera preservation helper, standalone viewer, previous bake scripts, browser report, designer start, login return logic, proxy, and homepage navigation. Re-read the ICG and Framers GLB metadata and embedded images, compared exported chapter/tour poses, viewed the saved corrected-room render and mobile browser screenshot, and checked the relevant official loader, animation, and Next.js documentation.

Only planning documents and the new audit JSON were written. No scene rebake, application change, package install, server launch, new physical-device test, or production deployment was performed.
