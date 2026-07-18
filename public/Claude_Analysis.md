Now I have all the precise data. Let me write the full technical teardown.I now have complete quantitative data. Here is the full technical teardown:

---

## VIDEO ANALYSIS: THREE SCROLLYTELLING SITES

The recording is a single screen capture traversing **three separate websites**. Site boundaries were identified by zero-delta frozen frames at ~24.0–26.0 s and ~42.5–43.75 s, followed by instantaneous pixel-diff spikes (Δ=129.9 and Δ=61.6 respectively) — both **hard cuts** by the recorder jumping to the next site's start frame.

---

## SITE 1 — Pearl & Co.
**Timespan in recording:** 0–26.25 s · **Video source:** 60 fps, 1280×648

### 1. Scene Inventory

Six discrete scenes, each its own independent floating island/diorama suspended in a cream void. **Not a connected world** — the camera traverses a sequence of unrelated set-pieces.

| # | Nav Label | Hero Copy | Timestamp |
|---|---|---|---|
| 01/06 | The Farms | "It starts in the hills." | 0–~4 s |
| 02/06 | The Kitchen | "Inside the pearl kitchen." | ~4–7 s |
| 03/06 | The Flagship | "Step into the shop." | ~7–13 s |
| 04/06 | Delivery | "Out for delivery." | ~13–17 s |
| 05/06 | The People | "Where it all comes alive." | ~17–21 s |
| 06/06 | The Cup | "One perfect cup." | ~21–26 s |

### 2. Composition

**Camera angle:** True 3D perspective, not isometric. Camera pitched ~35–40° from horizontal, slightly behind and above the subject. Islands read as "toy world viewed from a slight angle," never top-down.

**Subject vs. negative space:**
- Island overview shots (Farms, People at full pullback): island fills **~57%** of viewport; remainder is flat cream void
- Close-up / camera-dived-in shots (Kitchen, Delivery, People tight): subject fills **~83–90%** of viewport
- The Cup scene: cup centered, fills ~65–70% of frame width; background cream with floating boba debris

**Text/copy placement:** Text is **not in the scroll video** at all — it is HTML-overlaid on top of the canvas. From the overlay design visible in frames: text block sits in the **bottom-left quadrant**, occupying roughly 24% of viewport width × 40–45% of height. Layout is: small counter label ("01/06") → eyebrow tag in uppercase → H1 headline (~40 px) → 2-line body → tag pills. All left-aligned, semi-transparent white/dark background-less.

**Aspect ratio (source video):** 1280×648 ≈ 1.976:1 (~2:1, wider than 16:9). Islands are never cropped — always shown with breathing room to the void.

**Right edge nav:** Vertical dot-rail with current scene labeled and 6 dots. Always right-anchored, ~18 px from edge.

### 3. Camera Motion Per Scene

| Scene | Motion Type | Magnitude |
|---|---|---|
| The Farms | Z-axis push-in (drone dive) from wide overview → ground level among tea workers. Slight right lateral drift as it descends | **Aggressive** — covers ~80% of Z-depth in scene |
| The Kitchen | Overhead push-in + gentle clockwise orbit as camera lowers into the kitchen-pot set | **Moderate-aggressive** |
| The Flagship | Pull-back first (reveals full shop exterior), then slow push-in toward the storefront counter. Nav says "Flagship" throughout | **Moderate** — deliberate deceleration in mid-scene |
| Delivery | Lateral truck + mild pull-back to reveal the full delivery-city island; then slight orbit right to track the rider | **Moderate lateral** |
| The People | Push-in at roughly ground-plane height, slight lateral left-to-right tracking as camera skims the plaza crowd | **Moderate push** |
| The Cup | Z-axis pull-back (cup was very close; camera retreats slightly), with slow counter-clockwise drift exposing floating boba pearls/leaves | **Subtle** — mostly static with ambient debris animation |

### 4. Transitions Between Scenes

| Seam | Approx. Timestamp | Type | Seamless? |
|---|---|---|---|
| Farms→Kitchen | ~4 s | **Spatial Dive** — camera pushes through the rim/cliff edge of the floating island platform. As the curved brown cliff fills the frame, the scene resolves to the kitchen floor | Mostly seamless; brief half-frame of void |
| Kitchen→Flagship | ~7 s | **Spatial Dive** — exits through the island underside, brief cream void (~0.5 s), then approaches the Flagship island from above | **Breaks flow** — the cream void is clearly visible |
| Flagship→Delivery | ~12–13 s | **Continuous camera reverse-pull** — the Flagship building shrinks as the camera pulls back to reveal it's just one building on the larger delivery-city island. No cut | **Very seamless** — feels like a natural reveal |
| Delivery→People | ~16–17 s | **Hard cut** or extremely fast crossfade (<2 frames). Both islands are separate scenes | **Noticeable break** |
| People→Cup | ~20–21 s | **Opacity-blend crossfade** over ~1.5 s — the 3D plaza world fades while the photorealistic cup materializes. The stylistic shift (toy 3D → product-photo-style render) amplifies the seam | **Most visible seam in site** |

### 5. Art Direction

**Rendering style:** Stylized 3D rendering (not claymation, not ArchViz, not photoreal). Closest comparisons: Blender Cycles with custom cartoon shaders, or a polished game-engine cinematic (Unreal 5 Stylized mode). Characters and foliage are slightly oversimplified (low-poly trees, chibi-proportioned characters). The Cup scene switches to a higher-fidelity photorealistic product render — deliberately different.

**Palette (k-means over 5 representative frames):**
- `#F3E9DA` — warm cream void/background (39.8% of all pixels)
- `#D0B9AA` — rose-beige (mid-tones in clay surfaces)
- `#866E62` — warm brown (earth, paths, wooden elements)
- `#A99183` — muted tan
- `#3D2B24` — deep aubergine (shadows, dark architecture)
- Accent (visually dominant but lower coverage): dusty lavender `≈#8E7AA0` — all building roofs, awnings, van bodies, character trousers, delivery boxes. Lime `#CFFD6E` does NOT appear here; it's Meridian's accent.
- Boba cup body: muted purple-grey `≈#A18290`

**Lighting:** Soft overhead ambient, warm directional. No harsh shadows; all bounce-lit. Shadows are fully visible but never strong.

**Texture/detail:** High but stylized — tile textures readable, cobblestone visible, tea-leaf fine detail present. No tilt-shift/blur applied to the overview shots.

### 6. Scroll Feel

Camera motion in the video is **continuous** (frame diffs 25–65 across all 0–24 s frames — the camera is always moving). No built-in holds within the video. Any "pause" is entirely in the JavaScript scroll-locking logic — probably a `ScrollTrigger.pin()` that locks the viewport for 200–300 px of scroll per scene before releasing to the next. The dot navigation on the right implies **soft snapping** to scene boundaries (but this is HTML logic, not video logic). No momentum/easing visible in the video itself.

---

## SITE 2 — Belvedere
**Timespan in recording:** 26.25–43.75 s (hard-cut start at 26.25 s) · **Same video specs**

### 1. Scene Inventory

Six scenes representing rooms/moments in a single luxury residence. **One continuous architectural space** — not separate islands. The camera walks a path through the same building.

| # | Nav Label | Hero Copy | Timestamp |
|---|---|---|---|
| 01/06 | Arrival | "Arrive somewhere rare." | 26.25–~30 s |
| 02/06 | The Great Room | "The view walks in with you." | ~30–33 s |
| 03/06 | The Kitchen | "For a hundred guests, or two." | ~33–35 s |
| 04/06 | The Suite | "Wake to the horizon." | ~35–38 s |
| 05/06 | Wellness | "A resort you never leave." | ~38–40 s |
| 06/06 | The View | "Where the property ends and the view begins." | ~40–43.75 s |

### 2. Composition

**100% full-bleed, zero negative space.** The ArchViz photography/render fills every pixel. No cream void, no letterbox.

**Camera angle:** Architectural eye-level — camera pitched roughly 0–10° from horizontal (as if a 6-foot person is walking through the space). Creates strong depth lines.

**Subject fill:** 100% — there is no "subject vs. background" distinction. The entire frame is the environment.

**Text placement:** Bottom-left HTML overlay, same rough zone as Pearl & Co. (24% width, ~40% height). Dark vibes — the text is in near-white on a very dark left gradient. The left 30% of the frame is significantly darker than the right (the architecture is composed to be sky/window heavy on the right, leaving dark wall/floor on the left for legibility).

**Intentional compositional trick:** Every scene has a **glass wall or open archway** as the dominant center element, creating strong leading lines into depth and always implying the next space is through that opening.

### 3. Camera Motion Per Scene

| Scene | Motion Type | Magnitude |
|---|---|---|
| Arrival | Push-in along driveway axis, perfectly centered on the front door void | **Moderate aggressive** — camera moves ~60% of driveway depth |
| The Great Room | Push-in continues through the open glass threshold, slows to reveal interior | **Moderate** |
| The Kitchen | Lateral truck left-to-right along the kitchen island + slight push | **Moderate lateral** |
| The Suite | Slow lateral truck left — bed on left, floor-to-ceiling canyon view on right | **Subtle drift** |
| Wellness | Near-static camera on the indoor pool; minimal push forward | **Very subtle** |
| The View | Pull-back/reveal — camera retreats to show the full infinity pool panorama | **Moderate pull** |

### 4. Transitions Between Scenes

| Seam | Approx. Timestamp | Type | Seamless? |
|---|---|---|---|
| Arrival→Great Room | ~29.5–30 s | **Threshold Pass** — camera crosses the glass/steel door threshold. At the exact moment the door frame fills the periphery, the exterior becomes interior. Zero opacity blend | **Completely seamless** — indistinguishable from walking through a door |
| Great Room→Kitchen | ~32–33 s | **Speed-matched lateral truck** — same camera height and speed continues; great room slides out of frame left, kitchen slides in from right | **Seamless** |
| Kitchen→Suite | ~34–35 s | **Speed-matched push + lateral** — continuous interior traversal | **Seamless** |
| Suite→Wellness | ~36–37 s | **Lateral truck** continuing the interior path | **Seamless** |
| Wellness→The View | ~40–41 s | **Threshold Pass** — camera pushes through the glass wall into exterior. The pool foreground edge acts as the transition plane | **Seamless** |

### 5. Art Direction

**Rendering style:** AI-generated ArchViz (architectural visualization) photography. Photoreal. Think Midjourney/DALL·E luxury real estate renders with controlled golden-hour lighting.

**Palette (k-means, 5 frames):**
- `#1F1814` — near-black (dominant shadows/vignette, 26.6%)
- `#4B372A` — dark warm brown (travertine, dark wood)
- `#6C584B` — mid warm brown (stone walls, floor)
- `#917D6D` — honeyed stone
- `#C1AD9D` — warm off-white (bright stone, linen)
- `#EAE3DA` — cream-white (brightest surfaces, 8.6%)
- Accent: amber sunset glow `≈#C4802E` (visible in sky through glass), deep navy-grey `≈#2B2A35` (evening sky above horizon)

**Lighting:** Consistent warm golden-hour throughout all 6 scenes. Strong single directional source from outside (sunset), creating deep interior shadows and bright window halation. No artificial overhead fill — very cinematic.

**Texture:** High-detail stone, visible wood grain in ceilings, fabric-texture linens. No tilt-shift.

### 6. Scroll Feel

Camera is always moving — frame diffs 27–60 throughout Belvedere segment. No holds within the video. The Belvedere segment has the smoothest motion profile of all three sites; differences don't spike as dramatically, suggesting the camera speed is more uniform. Likely a `ScrollTrigger.scrub(true)` style implementation with constant velocity.

---

## SITE 3 — Meridian Motors
**Timespan in recording:** 43.75–60 s (hard-cut start at 43.75 s)

### 1. Scene Inventory

Six scenes representing the EV supply chain from renewable energy → assembly → road. **Six separate shoot locations** — not connected. More like a commercial film than a spatial world.

| # | Nav Label | Hero Copy | Timestamp |
|---|---|---|---|
| 01/06 | Renewable Source | "Power, before it's ever a car." | 43.75–~46 s |
| 02/06 | Battery Lab | "Every cell, tested twice." | ~46–48 s |
| 03/06 | Design Studio | "Built by machines. Held to human standards." | ~48–50 s |
| 04/06 | Robotic Assembly | (same headline continues) | ~50–52 s |
| 05/06 | Test Track | "Every mile, before your first one." | ~52–53 s |
| 06/06 | Open Road | "Every mile, zero compromise." | ~53–60 s |

### 2. Composition

**100% full-bleed** throughout. No negative space.

**Camera angle:** Varies per scene — wide-angle landscape (energy scenes), eye-level studio (Design Studio turntable), low-angle tracking (Assembly, Open Road). No single unifying camera angle across scenes.

**Subject fill:** 100% bleed, but the actual "hero" (car) occupies:
- Design Studio: car on turntable fills ~55% of frame width, centered, eye-level
- Open Road: car fills ~30% frame, positioned left-center on road receding to right

**Dominant compositional device:** A persistent **dark forest-green semi-transparent tint** covers the left 25–30% of every frame (except the turntable scene where it's all four edges). This is clearly a CSS overlay applied by the UI, not a video color grade, since it shows as a hard-edged vignette. This is where text is legible regardless of video content.

**UI accent:** Lime-green `#CFFD6E` nav pill (active section indicator). Single high-chroma accent color against otherwise dark palette.

### 3. Camera Motion Per Scene

| Scene | Motion Type | Magnitude |
|---|---|---|
| Renewable Source | Static camera on solar-panel road, wind turbines at distance. Subtle sky drift | **Very subtle** |
| Battery Lab | Near-identical composition to scene 1 — almost static | **Minimal** |
| Design Studio | **Orbit** — car on turntable slowly rotates (or camera orbits stationary car). 45–60° arc visible in scene | **Moderate** |
| Robotic Assembly | **Lateral truck** — camera pans left-to-right along the robotic assembly line showing sequential build stages | **Moderate lateral** |
| Test Track | Camera is **static**, framing the scene through a door/garage opening. The road is seen as a rectangle within the factory-door frame — like a portal | **Static** |
| Open Road | **Tracking shot** from directly behind the moving vehicle. Camera follows the car on coastal highway | **Aggressive** — blur implies speed |

### 4. Transitions Between Scenes

| Seam | Approx. Timestamp | Type | Seamless? |
|---|---|---|---|
| Renewable→Battery Lab | ~46 s | **Hard cut** masked by nearly identical imagery (same road, same sky angle). Near-zero subjective seam | **Effectively seamless** due to match-composition |
| Battery Lab→Design Studio | ~48 s | **Hard cut** — abrupt environment jump (outdoor sky → white interior). Most visible seam in this site | **Clearly visible** |
| Design Studio→Robotic Assembly | ~50 s | **Continuous spatial push** into the factory environment. Feels like a single space | **Seamless** |
| Assembly→Test Track | ~51–52 s | **Threshold Pass variant** — the camera approaches a large factory door/portal, the rectangular opening frames the test-track exterior, then the "camera" crosses through | **Clever and seamless** |
| Test Track→Open Road | ~53 s | **Match cut** on the moving vehicle — car exits test-track frame right, picks up again on open road. Speed direction matches | **Mostly seamless** |

### 5. Art Direction

**Rendering style:** Mixed — energy/road scenes are real footage or high-quality photoreal AI; the Design Studio and Assembly are stylized CG renders with controlled lighting.

**Palette (k-means):**
- `#1D332C` — deep forest green (UI overlay + dark environment shadows, 19.4%)
- `#3C4F49` — dark teal
- `#626A5D` — muted mid-green
- `#828980` — steel grey
- `#A5ACA3` — silver/light grey
- `#DACCB2` — warm sand (horizon, road surface)
- Accent: `#CFFD6E` — lime/chartreuse (only in nav pill, ~0.1% of pixels but visually defining)

**Lighting:** Varies — energy scenes use warm golden-hour (matching Belvedere's feel). Assembly is cool industrial fluorescent. Open Road is warm Mediterranean coastal daylight.

**No tilt-shift.** Assembly and Studio scenes have slight cinematic depth-of-field.

### 6. Scroll Feel

Strong motion in Assembly/Open Road scenes (diffs 34–54); near-static in energy scenes. The Open Road final sequence (53–60 s) shows the video FREEZES completely from ~55 s onward (diffs <0.1), indicating this site ends with a static last frame — the scrolltelling journey is complete and the user has reached the bottom.

---

## COMPARISON TABLE

| | Pearl & Co. | Belvedere | Meridian Motors |
|---|---|---|---|
| **Subject framing** | 57–90% fill, isometric toy-world on cream void; pull-back views show negative space | 100% full-bleed, eye-level architectural walk-through | 100% full-bleed, mixed landscape/studio/tracking angles |
| **Scene model** | 6 discrete floating islands (disconnected dioramas) | 6 continuous rooms in one physical building | 6 separate shoot locations (conceptually linked, spatially unrelated) |
| **Dominant transition type** | Spatial dive (through island platform geometry) with one major crossfade at end | Threshold pass (through architectural openings) | Hard cut masked by match-composition, plus one threshold-pass portal |
| **Palette** | `#F3E9DA` cream void dominant; dusty lavender accent `≈#8E7AA0`; deep aubergine `#3D2B24` | Dark travertine `#1F1814`→`#EAE3DA`; amber glow `≈#C4802E` | Forest green overlay `#1D332C`; steel `#828980`; lime accent `#CFFD6E` |
| **Overall immersion** | High — toy-world is charming but cream void reminds you it's a constructed set | **Highest** — spatial continuity makes it feel like inhabiting a real building | Medium — editorial momentum but viewer always aware of jumping between locations |

---

## VERDICT: Most Seamless Site, and Why You Can Reproduce It

**Belvedere has the most seamless transitions**, and the reason is purely structural, not aesthetic. Here is exactly what makes it work technically:

**1. One physical world, one video.**
All six scenes were rendered as a **single continuous camera path** through one 3D building. There is no inter-scene transition problem — the entire video is just the camera walking a scripted path. Compare this to Pearl & Co., where each island had to be composited separately and the connective tissue (the void between islands) is artificial.

**Implication for your build:** Compose your entire scroll-video as one unbroken camera move through a single connected environment. If you need discrete "chapters," they should be rooms or zones within the same space — not separate scene files.

**2. Threshold pass through existing geometry.**
The Arrival→Great Room and Wellness→View transitions use the existing door/glass-wall of the building as the transition mechanism. **The geometry itself is the wipe.** As the door frame crosses from edge to edge of the viewport, it occupies 100% of the frame for 3–5 video frames. In those frames, neither the old scene nor the new scene is visible — the door frame is. This acts as a natural optical black-out that the brain reads as "I passed through a doorway," not "the scene cut."

**To reproduce:** Design scene pairs so they share a common opening aligned on the camera Z-axis. The opening's near edge must cross the full frame width during the transition. Camera speed must remain constant through the crossing — any deceleration at the threshold draws attention to it.

**3. Consistent lighting temperature across all six scenes.**
Because the building is lit by the same simulated sunset throughout, color temperature never jumps. Compare Meridian where the outdoor sunset (Battery Lab) hard-cuts to the cool white-balance Design Studio — that's an immediate readout that you've changed locations.

**4. No opacity blending anywhere.**
Belvedere uses zero crossfades. Pure spatial navigation. This is more immersive because the viewer's spatial sense is never violated — you never see two overlapping environments. The moment you add an opacity blend, you're showing the viewer that this is a film edit, not a space.

**The one technique to steal from each site:**
- From **Belvedere**: threshold pass through geometry (no blend, the architecture is the wipe)
- From **Pearl & Co.**: the Flagship→Delivery **reveal pull-back** — zooming out to show the current scene is just a small corner of a larger world is a powerful reframe that doesn't require any transition at all
- From **Meridian**: the **Test Track portal** — framing the next scene as a window within the current scene before the camera crosses into it. Technically a threshold pass, but with a rectangular framed preview of the destination