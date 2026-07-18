# Framers Lab scroll-world asset runbook

This runbook is intentionally local-first. Nothing in this workflow deploys or changes
`framerslab.in`; deployment starts only after an explicit request.

The approved factory-world anchor and the four generated keyframes now live under
`public/world/`. Because the Kling account's 66 bonus credits are platform-only and the
MCP reports zero spendable credits, use `docs/kling-manual-generation.md` for the exact
manual website settings, start/end-frame mapping, prompts, filenames, and review gate.

## Non-negotiable asset rules

- Every still is generated with the built-in Image 2 tool in Codex.
- Generate one anchor still first. Stop and get visual approval before making any other
  still or any video.
- Kling MCP generates motion only. It must receive approved Image 2 stills as its start
  and end frames.
- Public-facing brand copy is **Framers Lab**.
- Generated visuals contain no text, letters, numbers, logos, signage, or watermarks.
- Keep the subject horizontally centred so the 16:9 master remains readable when a
  portrait phone crops its sides.

## Story and file contract

| Beat | Purpose | Approved still | Kling clip played during the beat |
|---|---|---|---|
| 1. Your Art | A personal image enters the process | `public/world/art.webp` | `public/world/vid/art.mp4` (Art → Design) |
| 2. Your Design | Size, crop, frame, and finish become visible | `public/world/design.webp` | `public/world/vid/design.mp4` (Design → Craft) |
| 3. The Craft | The physical piece is printed, fitted, and finished | `public/world/craft.webp` | `public/world/vid/craft.mp4` (Craft → Wall) |
| 4. On Your Wall | The finished piece lands in a real home | `public/world/wall.webp` | No video; the page uses a restrained still-image push-in |

Extracted loading posters belong at:

```text
public/world/art-poster.webp
public/world/design-poster.webp
public/world/craft-poster.webp
```

Until these files exist, `/world` uses existing catalog art as a deliberate local
fallback. Missing video never blocks the page; the still remains visible.

## Gate 1 — Image 2 anchor only

Generate **The Craft** first because it contains the most important materials, light,
frame construction, and art-direction cues. This is preview-only until approved.

### Shared style preamble

Reuse this paragraph unchanged in all four Image 2 prompts after the anchor is approved:

```text
Ultra-photorealistic editorial interior photography with understated premium realism,
grounded and contemporary rather than futuristic. A coherent Indian design language,
24mm wide-angle lens at adult eye height, camera looking straight forward, centre-safe
composition that survives a portrait crop. Matte black steel, dark graphite, warm oak,
off-white mineral plaster, with only restrained physical accents in pure red #FF0000
and electric lime #CCFF00. Natural Kerala daylight mixed with warm practical lighting,
deep clean blacks, crisp real material texture, subtle depth of field, believable scale.
No people. No text, no letters, no numbers, no logos, no signage, no watermark.
```

### Craft anchor prompt

```text
Use case: photorealistic-natural
Asset type: full-bleed keyframe for a scroll-driven landing page
Primary request: a premium but real custom-framing workshop captured in the middle of
building one personal framed artwork
Scene/backdrop: an organised contemporary workshop in India, connected visually to a
modern gallery studio; a deep doorway or open passage sits exactly at the centre rear so
a camera can continue forward into the next scene
Subject: one large photographic art print centred on a waist-height oak workbench, with
matte-black frame moulding cut and fitted around it; precise mitre corners, archival
backing, clean hand tools, frame samples, and a second finished frame leaning nearby
Style/medium: Ultra-photorealistic editorial interior photography with understated
premium realism, grounded and contemporary rather than futuristic. A coherent Indian
design language, 24mm wide-angle lens at adult eye height, camera looking straight
forward, centre-safe composition that survives a portrait crop. Matte black steel, dark
graphite, warm oak, off-white mineral plaster, with only restrained physical accents in
pure red #FF0000 and electric lime #CCFF00. Natural Kerala daylight mixed with warm
practical lighting, deep clean blacks, crisp real material texture, subtle depth of
field, believable scale. No people. No text, no letters, no numbers, no logos, no
signage, no watermark.
Composition/framing: landscape cinematic keyframe, central vanishing point, essential
objects inside the middle half of the frame, clear foreground parallax from frame
moulding without blocking the artwork
Constraints: physically plausible frame construction; one coherent room; no floating
objects; no readable UI; no branded tools; no gradients added as graphics
```

Approval means the palette, realism, room geometry, material quality, lighting, camera
height, and centre-safe composition all feel right. If any of those miss, revise only
the anchor and repeat this gate.

## Gate 2 — remaining Image 2 keyframes

Only after the craft anchor is approved, use it as the visual reference for the other
three stills. Preserve its camera height, lens, palette, light direction, material
language, and central passage. Do not ask Kling to invent or restyle these stills.

### Art keyframe

```text
[SHARED STYLE PREAMBLE, unchanged]
A contemporary gallery intake studio where a personal image begins its framing journey.
One unframed photographic print is centred on a clean oak viewing table, surrounded by
only a few carefully spaced photo prints and paper samples. The selected image is the
clear hero. A dark central doorway leads forward into the design studio. Keep every
essential prop in the middle half of the frame. No people and no readable marks.
```

### Design keyframe

```text
[SHARED STYLE PREAMBLE, unchanged]
A tactile frame-design studio centred on the same selected photographic artwork. The art
appears on one large clean monitor as an image-only crop preview with no interface text,
surrounded by physical black and oak frame-corner samples and finish swatches. A central
open passage leads forward into the framing workshop. The artwork, monitor, and passage
form one straight visual axis. No people and no readable marks.
```

### Wall keyframe

```text
[SHARED STYLE PREAMBLE, unchanged]
A lived-in contemporary Kerala apartment in warm late-afternoon daylight. The completed
matte-black framed artwork hangs at eye level in the exact centre of an off-white plaster
wall above a restrained oak console. Subtle tropical greenery and one red object add
local warmth without turning the room into a showroom. The framed piece is unmistakably
the hero and remains readable in a portrait crop. No people and no readable marks.
```

Convert each approved still to WebP only after approval, keeping the original PNG files
in local working storage.

## Gate 3 — Kling MCP motion only

Use one Kling model for all three clips. Each clip uses the approved Image 2 files at
both endpoints. Generate motion only after all four stills have been approved together.

### Motion contract shared by all clips

```text
Single continuous cinematic camera move, no cuts, no dissolves, no time-lapse. Begin on
the supplied start frame and continue a slow, steady forward glide at adult eye height.
Keep the central subject stable while foreground objects create subtle parallax. Travel
through the centred doorway or passage toward the supplied end frame. In the final
second, settle into the same slow forward drift and land as closely as possible on the
supplied end frame. Preserve the exact photoreal material palette, exposure, lens feel,
and room geometry of both supplied frames. No people appearing, no new objects, no text,
no letters, no numbers, no logos, no signage, no captions, no sound, no cuts.
```

Clip-specific middle movement:

1. **Art → Design:** glide low past the selected print, then rise gently to monitor
   height while passing through the central doorway.
2. **Design → Craft:** make a slow half-orbit no more than 20 degrees around the frame
   samples, straighten, and continue through the central passage to the workbench.
3. **Craft → Wall:** push close to one mitre corner, ease back without reversing the
   overall travel direction, then continue forward until the completed piece resolves
   on the home wall.

Generate each clip without audio. Use the same duration and quality tier for all three.
Start with one clip, inspect its first frame, last frame, geometry, and motion direction,
then generate the other two. Do not batch three unreviewed motions.

## Encode for browser scrubbing

Run these commands from the repository root after placing Kling source videos under
`tmp/world-raw/` as `art.mp4`, `design.mp4`, and `craft.mp4`.

```powershell
New-Item -ItemType Directory -Force -Path public\world\vid | Out-Null

ffmpeg -y -i tmp\world-raw\art.mp4 -an -vf "unsharp=5:5:0.8:5:5:0.0" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart public\world\vid\art.mp4
ffmpeg -y -i tmp\world-raw\design.mp4 -an -vf "unsharp=5:5:0.8:5:5:0.0" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart public\world\vid\design.mp4
ffmpeg -y -i tmp\world-raw\craft.mp4 -an -vf "unsharp=5:5:0.8:5:5:0.0" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart public\world\vid\craft.mp4

ffmpeg -y -ss 0 -i public\world\vid\art.mp4 -frames:v 1 public\world\art-poster.webp
ffmpeg -y -ss 0 -i public\world\vid\design.mp4 -frames:v 1 public\world\design-poster.webp
ffmpeg -y -ss 0 -i public\world\vid\craft.mp4 -frames:v 1 public\world\craft-poster.webp
```

Encode at the native Kling resolution. Never upscale a 720p source to 1080p.

## Seam gate

Sharing Image 2 endpoints gives Kling a strong continuity target, but the encoded output
must still be measured. Compare the end of each encoded clip to the first frame of the
next approved visual. An SSIM score at or above `0.90` passes; `0.75–0.90` requires a
slow browser review; below `0.75` is a re-roll.

Also test:

- slow scroll and fast flick in both directions;
- a portrait phone crop and an iPad-sized viewport;
- reduced-motion mode (stills only);
- data saver mode (stills only, no video requests);
- first paint (poster to video must not jump);
- navigation away from `/world` (no lingering scroll listeners or black page styles).

## Local completion gate

The route is ready for review only when tests, lint, typecheck, production build, seam
checks, and real-device motion QA are all green. Hosting and domain work remain separate
until explicitly requested.
