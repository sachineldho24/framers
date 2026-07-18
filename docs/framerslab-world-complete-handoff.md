# Framers Lab `/world` — complete project handoff

Last updated: 2026-07-16  
Workspace: `C:\Projects\Framers`  
Local review URL: `http://127.0.0.1:3000/world`

This is the authoritative handoff for the Framers Lab cinematic scroll-world work
completed in this Codex conversation. It records the decisions, generated assets,
current implementation, failed approaches, deployment state, and the exact prompt for
continuing the work without losing context.

## 1. Non-negotiable product rules

- Public brand name: **Framers Lab**.
- Intended production domain: **framerslab.in**.
- Never display or generate the text **PosterX** anywhere in the website, including
  images, metadata, alt text, source copy, navigation, or new pages.
- All still images for this experience must be generated with Codex's built-in Image 2
  workflow. Do not silently substitute stock imagery or another image generator.
- Kling is used for video generation only, with approved start and end frames.
- Work and perfect the experience locally first.
- Do not deploy, alter DNS, or connect `framerslab.in` unless the user explicitly asks
  again. A previous Sites attempt did not produce a live deployment.
- Preserve unrelated user changes in the dirty working tree. Never reset, clean, or
  overwrite them.
- The target family photograph represents an ordinary meaningful photo people actually
  frame. Do not replace it with neural-network imagery, abstract diagrams, random
  snapshots, or unrelated art.

## 2. Original scroll-world decision

Two scroll-world repositories were compared:

- `https://github.com/cth9191/scroll-world`
- `https://github.com/oso95/scroll-world`

The `cth9191` fork was selected because it is the hardened superset. Its useful additions
include spend gates, device-tier fallbacks, seam testing, crawlable SEO content, and
resumability. The initial skill comparison is preserved in:

`C:\Users\USER\.codex\attachments\1d95fe16-180d-4ea6-ae90-91763894d4ff\pasted-text.txt`

The original engine was not copied blindly because it owns global window scrolling and
does not provide a React-safe teardown. The experience was therefore implemented as a
dedicated `/world` route with a native React/TypeScript scroll controller.

The toolchain was intentionally adapted:

- Image 2 for all keyframe stills.
- Kling start/end-frame generation for motion.
- Next.js 16 / React 19 for the route.
- No new GSAP dependency; the existing request-animation-frame timeline is sufficient.

## 3. Approved visual direction

The final direction is a premium, photoreal Framers Lab factory/laboratory world:

- Dark charcoal concrete and blackened steel.
- Walnut workbenches and precise framing tools.
- Warm amber task lighting.
- Restrained Kerala tropical planting.
- Real people performing believable framing work.
- A connected architectural world rather than random polygonal rooms.
- The visual story should feel like an atelier, material laboratory, and factory—not a
  generic showroom or a toy diorama.

The preferred worldview exploration was:

`C:\Users\USER\Downloads\Generated image 1 (3).png`

It was preferred over `Generated image 1 (2).png` because it communicated a real
laboratory/factory process, darker premium atmosphere, material storage, workers, and
an understandable framing workflow. The earlier image was brighter and more
architectural but felt closer to a luxury home or studio than a working Framers Lab.

The website UI direction is **cinematic black atelier**:

- Near-black and graphite background.
- Warm ivory typography.
- Muted stone secondary text.
- One restrained aged-brass accent sampled from the workshop lighting.
- Borderless editorial copy blended over the footage.
- Sleek wordmark and CTA instead of bright red/lime navigation.
- No card or boxed typography panel.
- No top red scroll-progress bar.
- Eight-stage hairline rail on the right for desktop and a compact horizontal rail on
  mobile.

The full visual/interaction decision is documented in:

`docs/plans/2026-07-16-eight-stage-scroll-world-design.md`

## 4. Corrected eight-frame story

The final narrative fixes the earlier continuity mistakes. The target family image must
not be physically framed before the Craft/Quality transition.

| Stage | Approved keyframe | Required state |
| --- | --- | --- |
| 1. Closed exterior | `public/world/keyframes/00-exterior-closed-van.png` | Complete roof closed; one matte-charcoal van already parked beneath the side porch. |
| 2. Open world | `public/world/keyframes/00-exterior-open-clean.png` | Roof lifted; connected Framers Lab rooms and courtyard revealed; target family absent. |
| 3. Art intake | `public/world/keyframes/01-art-intake-raw.png` | Target photograph appears for the first time as one loose, raw, unmounted print. |
| 4. Design lab | `public/world/keyframes/02-design-lab-screen-clean-v2.png` | Target appears once as a borderless digital screen image; no physical frame and no fake monitor legs. |
| 5. Craft | `public/world/keyframes/03-craft-in-progress.png` | Physical print and mat on the bench; incomplete moulding with one open corner/fourth rail separate. |
| 6. Quality | `public/world/keyframes/04-quality-finale-clean.png` | First point where the target family image is fully framed; inspected under calibrated light. |
| 7. Dispatch | `public/world/keyframes/05-dispatch-ready.png` | Same completed frame protected and entering one fitted package beside the same parked van. |
| 8. Shipping | `public/world/keyframes/06-delivery-loading.png` | One opaque sealed package loaded into the same stationary van; family image no longer visible. |

Continuity rules:

- The van exists from the opening exterior and stays in the same porch/road location.
- The target family image is absent from the exterior/open-roof world.
- It is raw and unmounted at intake.
- It is digital-only in the design lab.
- It is incomplete during craft.
- It becomes fully framed only at quality control.
- It is concealed after the shipping carton closes.
- Background frames contain unrelated previous customer work only.
- Do not duplicate the target family on monitors, walls, benches, or packages.
- Do not invent screens with stands/legs, neural-network art, floating tools, automatic
  self-assembly, or morphing architecture.

## 5. Authoritative Kling generation material

The final corrected video chain consists of eight still frames and seven start/end
videos. The exact settings, filenames, constraints, and verbatim prompts are already
preserved in:

`docs/kling-corrected-eight-frame-chain.md`

That file is the final authority. Do not use the older prompts when they conflict.

Shared final Kling settings:

- Image to Video.
- First and Last Frame / Start-End Frame.
- Kling Video 3.0, not Turbo.
- 10 seconds.
- 720p / Standard.
- 16:9 / automatic from the supplied frames.
- One output.
- Multi-shot off.
- Audio off.
- Default creativity/relevance.
- Camera controls unset.
- Negative prompt blank because constraints are embedded in the main prompt.

The earlier three-clip/manual guide remains at:

`docs/kling-manual-generation.md`

The broader local asset and seam runbook remains at:

`docs/scroll-world-runbook.md`

Generated/reviewed video files supplied during the conversation included:

- `C:\Users\USER\Downloads\kling_20260715_VIDEO_Single_con_4240_0.mp4`
- `C:\Users\USER\Downloads\kling_20260715_VIDEO_Single_con_4408_0.mp4`
- `C:\Users\USER\Downloads\kling_20260715_VIDEO_Single_con_4641_0.mp4`
- `C:\Users\USER\Downloads\FRAMERS_V1.mp4`
- `C:\Users\USER\Downloads\FRAMERS_V2.mp4`

`FRAMERS_V2.mp4` was selected and copied into the project as:

`public/world/vid/framers-v2.mp4`

Current master properties measured locally:

- File size: 43,156,745 bytes (about 41.16 MiB).
- Resolution: 1920×1080.
- Frame rate: 30 fps.
- Frame count: 1,687.
- Duration: 56.233333 seconds.

## 6. Current `/world` implementation

Primary files:

- `src/app/world/page.tsx`
- `src/components/ScrollWorldClient.tsx`
- `src/components/ScrollWorldClient.module.css`
- `src/components/scroll-world/content.ts`
- `src/components/scroll-world/timeline.ts`
- `src/components/scroll-world/imageFallback.ts`
- `src/components/scroll-world/videoScrub.ts`
- `src/components/scroll-world/*.test.ts`

Current stage/time contract:

| Stage | Film time | Current headline |
| --- | --- | --- |
| Arrival | 0.0–5.5 s | The house of the frame. |
| Reveal | 5.5–10.5 s | Eight rooms. One standard. |
| Intake | 10.5–20.5 s | First, we read the image. |
| Design | 20.5–29.0 s | Proportion before profile. |
| Craft | 29.0–38.0 s | Made to the millimetre. |
| Quality | 38.0–44.5 s | Inspected in real light. |
| Dispatch | 44.5–51.5 s | Protected for the road. |
| Shipping | 51.5–56.2 s | From our lab to your wall. |

Implemented behavior:

- Dedicated full-viewport `/world` route.
- Eight scroll sections with contiguous scroll ranges.
- SEO-readable server content hidden after the interactive client mounts.
- Fixed full-bleed cinematic stage on desktop.
- Wide 16:9 cinematic band on mobile so the architecture is not aggressively cropped.
- Borderless alternating copy reveal.
- Premium right-side story rail and `01 / 08` counter.
- Reduced-motion and data-saver fallbacks use corrected still frames.
- React cleanup removes listeners, cancels animation frames, and restores body state.
- The top red scroll bar was removed.
- Red/lime navigation was replaced with black/ivory/brass styling.

Automated status at the latest completed check:

- `npm run test:world`: 19 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed after allowing the configured Google Fonts to download.
- Local route: `http://127.0.0.1:3000/world`.

## 7. Motion experiments and why they are not final

Three MP4 scrub strategies were tried:

1. Partial seek chasing: each scroll target was approached in repeated 28% time jumps.
   This created about 480 ms of artificial settling delay and excessive decode work.
2. Direct seeking: the controller jumped immediately to the latest target. This removed
   lag but made the film look like unrelated still images changing in the background.
3. Play-to-target: nearby forward targets use real video playback while large/reverse
   jumps seek directly. This is the current code and is better, but it still does not
   provide the uncompromised scroll-locked result the user wants.

The user has now explicitly approved replacing MP4 `currentTime` scrubbing with a
canvas image sequence. **That replacement has not been implemented yet.** Only the
architecture discussion and source-video measurements were completed before this
handoff request interrupted the work.

## 8. Final approved performance direction

Replace the MP4 scrubber with a progressively loaded WebP frame sequence rendered on an
HTML5 canvas.

Why:

- Random `video.currentTime` seeks depend on GOP/keyframe decoding and produce delay or
  visible jumps.
- Canvas frame selection maps one deterministic image to one scroll position.
- A directional preload window and bounded decoded-frame cache prevent loading all
  frames into memory.
- Separate desktop/mobile tiers preserve perceived quality without forcing phones to
  decode 1920×1080 assets.

Approved quality target:

- Source remains the untouched 1920×1080, 30 fps `framers-v2.mp4` master.
- Desktop tier: 1920×1080 WebP, visually lossless target quality around 90, sampled at
  15 fps.
- Mobile tier: 960×540 WebP, target quality around 86, sampled at the same 15 fps.
- Expected frame count: 844 frames per tier, indexed `0000` through `0843`.
- Do not replace the source master or delete it. Once canvas QA passes, stop serving the
  MP4 publicly; keep a safe local source copy for future re-encoding.
- WebP is preferred over AVIF for this interaction because its browser decode cost is
  generally lower and more predictable during rapid scroll scrubbing.

Required canvas behavior:

- Use `requestAnimationFrame` to coalesce scroll updates.
- Convert scene scroll progress to the existing storyboard time, then map time to a
  deterministic frame index.
- Draw with cover geometry and cap canvas device-pixel ratio at 2.
- Load the exact requested frame first.
- Prefetch more frames in the current scroll direction than behind it.
- Keep at most about 8–10 decoded desktop `ImageBitmap` objects and 12–14 mobile
  objects; call `close()` when evicting an `ImageBitmap`.
- Limit network/decode concurrency to approximately four frames.
- If the exact frame is not ready, draw the nearest cached frame instead of blocking
  scrolling.
- Cancel or de-prioritize obsolete requests after a large scroll jump.
- Fade the canvas in only after its first valid frame is drawn so first paint never
  flashes black.
- Retain corrected still images underneath as the first-paint, error, reduced-motion,
  and data-saver fallback.
- `prefers-reduced-motion: reduce` and `navigator.connection.saveData` must prevent
  frame-sequence downloads.
- Do not add GSAP merely for frame selection. The existing timeline and rAF scheduler
  are sufficient.

Suggested asset structure:

```text
public/world/frames/desktop/frame-0000.webp ... frame-0843.webp
public/world/frames/mobile/frame-0000.webp  ... frame-0843.webp
public/world/frames/manifest.json
```

For a live deployment, do not push the full image sequence through Git if the hosting
repository rejects it. Upload the immutable frame assets to object storage/CDN and let
the manifest use a configurable public base URL, with the local `/world/frames` path as
the development fallback.

## 9. Required tests for the canvas conversion

Use test-driven development. Write failing tests before implementation.

At minimum test:

- Time `0` maps to frame `0`.
- Time `56.2` maps to the final frame.
- Every scene endpoint maps continuously with the next scene start.
- Out-of-range times clamp safely.
- Desktop/mobile tier selection is deterministic.
- Preload ordering prioritizes the requested frame and scroll direction.
- The preload window never requests an invalid index.
- Decoded-frame cache size is bounded and least-recently-used frames are evicted.
- Presentation source contains a canvas and no active MP4/currentTime scrub controller.
- Reduced motion/data saver do not start frame downloads.
- First paint still uses `00-exterior-closed-van.png`.

After implementation run:

```text
npm run test:world
npm run typecheck
npm run build
```

Then verify in the local browser:

- 1920×1080 desktop.
- A common large laptop viewport such as 1366×768.
- 390×844 mobile.
- Slow wheel/trackpad scrolling.
- Fast flicks and chapter-rail jumps.
- Forward and reverse scrolling.
- Resizing and orientation changes.
- Reduced motion.
- Data saver.
- Navigation away from and back to `/world` without leaked listeners or black body
  styling.

## 10. Sites deployment state

A private OpenAI Sites project was created during an attempted live-link publish:

- Sites slug: `framerslab-world`.
- Project ID: `appgprj_6a58971932448191905f69b695b888d9`.
- The same ID is persisted in `.openai/hosting.json`.

Important:

- Do not call `create_site` again for this local site.
- The normal Next.js production build passed.
- An isolated Sites/vinext wrapper was prepared under `tmp/sites-world-live` and its
  Cloudflare-compatible build completed.
- A source snapshot was committed in that temporary repository as
  `599cff0b883cb1ed9ed488fee8d4d33e19c21b67`.
- The source push failed twice with HTTP 500 while uploading the large binary bundle.
  At the time, the remote branch was still empty.
- No Sites version was saved.
- No deployment was started.
- There is no live Sites URL.
- No custom domain or DNS record was changed.
- Never copy an old/expired repository credential from logs or chat. Obtain a fresh
  credential through Sites if publishing is explicitly requested again.
- The temporary wrapper may be stale after the canvas conversion. Do not deploy it
  blindly; rebuild the exact validated source first.

The likely durable deployment solution is to keep the application/source repository
small and serve the large immutable frame sequence from object storage/CDN.

## 11. Repository safety notes

The root working tree already contains many unrelated user changes and untracked files.
They do not belong to this task. In particular:

- Do not use `git reset --hard`, `git clean`, or checkout-based restoration.
- Do not stage or commit unrelated files.
- Do not delete the user's design screenshots or historical docs.
- Treat `tmp/sites-world-live` as deployment scratch space, not application source.
- Make application changes only to the world route/components, required tests, a frame
  extraction script, and the generated frame asset directories/manifest.

## 12. Exact continuation prompt

Copy the prompt below into a new Codex task opened at `C:\Projects\Framers`.

````text
Continue the Framers Lab cinematic `/world` project from the existing working tree at
`C:\Projects\Framers`.

First read these files completely:

1. `AGENTS.md`
2. `docs/framerslab-world-complete-handoff.md`
3. `docs/plans/2026-07-16-eight-stage-scroll-world-design.md`
4. `docs/kling-corrected-eight-frame-chain.md`
5. `src/components/ScrollWorldClient.tsx`
6. `src/components/ScrollWorldClient.module.css`
7. every non-test TypeScript file under `src/components/scroll-world/`
8. every existing `*.test.ts` file under `src/components/scroll-world/`

Do not regenerate any keyframes or videos. Use the already approved master:
`public/world/vid/framers-v2.mp4` (1920×1080, 30 fps, 1,687 frames,
56.233333 seconds). Preserve every current scene, headline, time window, corrected
continuity rule, premium black/ivory/brass visual treatment, desktop layout, mobile
cinematic band, and the eight-stage rail.

Replace the current `<video>`/`currentTime` scrub architecture with a production-quality
HTML5 canvas image-sequence renderer. This is an implementation request, not a design
discussion. Work test-first and complete the local implementation and verification.

Asset requirements:

- Add an idempotent extraction script, preferably
  `scripts/extract-world-frame-sequence.py`, using the locally available OpenCV.
- Sample the approved master at 15 fps, preserving the first and last source frames.
- Produce 844 frames per tier, numbered `frame-0000.webp` through
  `frame-0843.webp`.
- Desktop: 1920×1080 WebP, visually lossless quality target around 90.
- Mobile: 960×540 WebP, quality target around 86.
- Write `public/world/frames/manifest.json` containing duration, frame count, fps,
  tier dimensions, quality settings, filename pattern, and source identity.
- Never overwrite or delete the approved source master.
- Report total and average compressed sizes after extraction.

Renderer requirements:

- Add pure tested helpers for time-to-frame mapping, responsive tier selection,
  directional preload order, clamping, and cover draw geometry.
- Use a `<canvas>` behind the existing scrim/copy, with corrected stills underneath as
  first-paint and failure fallbacks.
- Use passive scroll listeners and requestAnimationFrame coalescing.
- Draw the exact requested frame when available; otherwise immediately draw the nearest
  cached frame.
- Use `createImageBitmap` when supported, with an `HTMLImageElement.decode()` fallback.
- Limit concurrent fetch/decode work to four.
- Use a directional sliding preload window—more frames ahead in the current scroll
  direction, fewer behind.
- Bound decoded memory with an LRU cache: approximately 8–10 desktop frames and 12–14
  mobile frames. Close evicted ImageBitmap objects.
- Cancel or de-prioritize stale work after large scroll jumps.
- Cap canvas DPR at 2 and redraw correctly after resize/orientation changes.
- Fade the canvas in only after the first successful draw.
- Reduced-motion and data-saver users must make zero frame-sequence requests and keep
  the existing corrected still/copy experience.
- Remove the active MP4 scrub code and obsolete tests only after the canvas version is
  working. Do not add GSAP.

Required tests before implementation:

- First/last time-to-frame mapping and clamping.
- Continuous mapping across all eight scene seams.
- Responsive tier selection.
- Directional preload ordering and valid indices.
- Bounded LRU eviction.
- Canvas presentation with no `<video>`/`currentTime` scrub path.
- No sequence loading in reduced-motion/data-saver mode.
- Correct first-paint fallback still.

Run and pass:

- `npm run test:world`
- `npm run typecheck`
- `npm run build`

Then test `http://127.0.0.1:3000/world` locally at 1920×1080, 1366×768, and
390×844. Verify slow and fast scrolling, reverse scrolling, chapter jumps, resize,
reduced motion, data saver, and clean teardown on navigation. Measure rather than merely
claiming smoothness. Report frame-cache limits, generated asset sizes, any dropped-frame
or long-task evidence available, and remaining risks.

Brand and safety constraints:

- Never use the word PosterX anywhere.
- Public brand is Framers Lab; intended domain is framerslab.in.
- Do not alter the target-family continuity or introduce neural-network imagery,
  duplicate family images, premature physical framing, fake monitor legs, floating
  objects, morphing architecture, or a new vehicle.
- Preserve all unrelated user changes in the dirty worktree.
- Do not deploy, publish, change DNS, or connect the domain unless I explicitly request
  deployment again after local approval.
- Do not call Sites `create_site` again. The existing Sites project ID, if deployment is
  later requested, is in `.openai/hosting.json`.

Lead the final response with the local outcome, tests, measured performance, generated
asset sizes, and the exact files changed. Do not claim the project is deployed.
````

## 13. Definition of done for the next implementation

The canvas conversion is complete only when:

- Scroll movement visibly follows the camera motion rather than swapping paused video
  frames.
- There is no MP4 `currentTime` decoding lag.
- Frame requests and decoded memory stay bounded.
- High-quality desktop and mobile tiers are generated from the approved V2 master.
- The eight story sections and their copy remain aligned with the intended film times.
- Reduced-motion/data-saver fallbacks still work.
- All world tests, strict TypeScript, and production build pass.
- Desktop and mobile browser QA is complete.
- The user reviews and approves the local result before any renewed deployment attempt.

