# Framers Lab — manual Kling video generation

The Kling MCP cannot spend the account's platform-only bonus credits. Generate the
three source clips manually on the Kling website and return the untouched MP4 files to
Codex for encoding, seam checks, poster extraction, and local integration.

## Opening exterior sequence

Do this as **two clips**, not one. A single generation that lifts the roof, changes from
an isometric camera to eye level, passes through the entrance, and resolves into the
intake lab is too likely to morph the architecture. The two-clip chain keeps every seam
locked to an exact PNG.

Use the same settings as the interior clips: **Kling Video 3.0**, First and Last Frame,
10 seconds, 720p / Standard, 16:9, one output, multi-shot off, audio off, default
creativity/relevance, camera controls unset, and negative prompt blank.

### Opening A — Closed exterior to revealed world

Start frame: `public/world/keyframes/00-exterior-closed.png`

End frame: `public/world/keyframes/00-exterior-open.png`

Save the untouched result as: `exterior-roof-reveal-source.mp4`

```text
Single continuous cinematic architectural reveal, one unbroken shot, no cuts. Begin
exactly on the supplied first frame, holding the elevated three-quarter isometric view
of the complete closed Framers Lab courtyard building. Keep the camera almost locked,
with only a very slow controlled five-percent forward drift and a subtle descent. After
the first second, the entire continuous black rectangular roof ribbon separates cleanly
from the wall tops and rises vertically as one rigid architectural piece. The roof does
not bend, fragment, dissolve, rotate or transform. Its aligned skylights, straight edges
and exact rectangular proportions remain unchanged while it lifts upward and gradually
leaves the top of frame. Beneath it, the four connected framing laboratories are already
fully built and illuminated around the same planted central courtyard. Reveal them
through natural occlusion only; no room, wall, bench, plant or entrance moves. In the
final two seconds, the lifted roof has cleared the view and the camera settles precisely
onto the supplied last frame of the open Framers Lab world.

Preserve the exact camera axis, orthogonal architecture, entrance portal, perfectly
legible FRAMERSLAB sign, courtyard tree, landscaping, charcoal concrete, black steel,
dark walnut, warm amber lighting and warm-grey background. No people appearing or
disappearing, no geometry morphing, no wall movement, no camera orbit, no zoom pulse,
no shake, no cut, no dissolve, no particles, no smoke, no extra text, no altered letters,
no PosterX, no captions, no watermark, no sound.
```

### Opening B — Revealed world through the doorway to Art Intake

Start frame: `public/world/keyframes/00-exterior-open.png`

End frame: `public/world/keyframes/01-art-intake.png`

Save the untouched result as: `exterior-to-art-intake-source.mp4`

```text
Single continuous cinematic camera flight, one unbroken shot, no cuts. Begin exactly on
the supplied first frame in the elevated three-quarter isometric view of the open Framers
Lab courtyard world. Immediately begin a slow, physically believable forward descent
along the building's central entrance axis. Keep moving toward the monumental entrance
portal at constant speed while the four workshop wings and planted courtyard show
natural restrained parallax. Gradually change from the elevated architectural view to
adult eye height without rolling, orbiting or reversing. Centre the entrance precisely,
pass directly beneath the stable, perfectly legible FRAMERSLAB sign, and travel through
the open doorway as its timber-and-black-steel edges expand naturally beyond the frame.
Continue forward through the real connected entry passage into the premium art-intake
laboratory; do not teleport or dissolve between spaces. The courtyard and exterior fall
behind naturally, warm task lights take over, and the intake scanning table, archival
tools, black cabinetry and the same Indian family photograph resolve ahead. In the final
second, slow the forward drift gently and land as closely as possible on the supplied
last frame inside the art-intake lab.

Preserve the exact Framers Lab world: orthogonal charcoal architecture, blackened steel,
dark walnut, warm amber lighting, restrained Kerala tropical planting, realistic framing
equipment, the same family members and photograph, stable exposure and lens character.
Keep FRAMERSLAB spelled exactly until the camera passes beneath it; do not create any
other text. No roof reappearing, no room morphing, no stretching walls, no flying through
solid walls, no camera shake, no fisheye, no speed ramp, no cuts, no dissolve, no portal
effect, no time-lapse, no duplicated people, no new objects, no PosterX, no captions, no
watermark, no sound.
```

## Keyframes

Use these PNG files exactly as supplied. Do not screenshot, crop, resize, colour-grade,
or convert them before uploading.

| Clip | Start frame | End frame | Save the returned source video as |
|---|---|---|---|
| 1. Art to Design | `public/world/keyframes/01-art-intake.png` | `public/world/keyframes/02-design-lab.png` | `art-to-design-source.mp4` |
| 2. Design to Craft | `public/world/keyframes/02-design-lab.png` | `public/world/keyframes/03-craft-workshop.png` | `design-to-craft-source.mp4` |
| 3. Craft to Finale | `public/world/keyframes/03-craft-workshop.png` | `public/world/keyframes/04-quality-finale.png` | `craft-to-finale-source.mp4` |

Each seam deliberately reuses the exact same PNG: Clip 1 ends on the same file that
Clip 2 starts from, and Clip 2 ends on the same file that Clip 3 starts from.

## Identical settings for all three clips

- Tool: **Image to Video**
- Mode: **First and Last Frame** / **Start-End Frame**
- Model: **Kling Video 3.0** (not Kling 3.0 Turbo)
- Duration: **10 seconds**
- Resolution / quality: **720p / Standard**
- Aspect ratio: **16:9** (or automatic from the two matching 16:9 frames)
- Number of outputs: **1**
- Multi-shot / Intelligent shots: **Off**
- Audio: **Off**
- Creativity/relevance slider: leave at the Kling default if shown
- Camera controls: leave unset; the prompt defines the movement
- Negative prompt: leave blank; the constraints are already in the main prompt

Do not mix models, durations, resolutions, or multi-shot settings within the chain.
Do not use Turbo: the currently available Turbo model accepts a first frame but not a
last frame, so it cannot lock both ends of these transitions.

## Clip 1 — Art intake to Design lab

Start frame:
`01-art-intake.png`

End frame:
`02-design-lab.png`

Prompt (paste verbatim):

```text
Single continuous cinematic camera move, one unbroken shot, no cuts. Begin exactly on
the supplied first frame inside the premium dark custom-framing intake laboratory. Move
in a slow, steady forward glide at adult eye height. Glide past the central archival
scanning table while the same Indian family photograph remains visually stable and
recognisable. Foreground gloves, print trays and inspection tools pass with restrained
natural parallax. Continue physically forward through the centred black-steel glass
doorway into the connected frame-design and material-selection laboratory. Rise very
gently to monitor height as the frame moulding gallery and the same family photograph
on the large image-only display resolve ahead. Keep the worker's movement minimal and
natural. In the final second, settle into a slow steady forward drift and land as
closely as possible on the supplied last frame.

Preserve the exact Framers Lab world: photoreal dark charcoal concrete, blackened steel,
walnut workbenches, warm amber task lighting, restrained tropical Kerala plants and
realistic framing equipment. Preserve the family members, photograph content, room
geometry, exposure and lens character. No zoom out, no backward movement, no orbit, no
camera shake, no cuts, no dissolve, no morphing transition, no time-lapse, no object
transformation, no duplicated people, no new objects, no text, no letters, no numbers,
no logos, no signage, no captions, no watermark, no sound.
```

## Clip 2 — Design lab to Craft workshop

Start frame:
`02-design-lab.png`

End frame:
`03-craft-workshop.png`

Prompt (paste verbatim):

```text
Single continuous cinematic camera move, one unbroken shot, no cuts. Begin exactly on
the supplied first frame in the premium dark frame-design and material-selection
laboratory. Continue the same slow, steady forward glide at adult eye height. Track low
and level alongside the foreground frame-corner samples so they slide past with subtle
parallax; make only a restrained twelve-degree half-orbit around the central sample area,
then straighten fully without reversing direction. Keep the same Indian family
photograph stable and recognisable on the display and physical print. Continue forward
through the centred doorway into the connected precision cutting, joining and assembly
workshop. The assembly bench, matte-black frame, accurate mitre tools, underpinner and
moulding racks resolve naturally ahead. In the final second, settle into a slow steady
forward drift and land as closely as possible on the supplied last frame.

Preserve the exact Framers Lab world: photoreal dark charcoal concrete, blackened steel,
walnut workbenches, warm amber task lighting, restrained tropical Kerala plants and
realistic framing equipment. Preserve the family members, photograph content, workers,
room geometry, exposure and lens character. No zoom out, no backward movement, no
camera shake, no cuts, no dissolve, no morphing transition, no time-lapse, no object
transformation, no duplicated people, no new objects, no text, no letters, no numbers,
no logos, no signage, no captions, no watermark, no sound.
```

## Clip 3 — Craft workshop to Quality-control finale

Start frame:
`03-craft-workshop.png`

End frame:
`04-quality-finale.png`

Prompt (paste verbatim):

```text
Single continuous cinematic camera move, one unbroken shot, no cuts. Begin exactly on
the supplied first frame in the premium dark precision framing workshop. Continue the
same slow, steady forward glide at adult eye height. Track gently along the front edge
of the central assembly bench and push close to one accurate matte-black mitre corner
while the same Indian family photograph stays stable and recognisable. Ease back only
enough to clear the bench while continuing forward; never reverse the overall travel
direction. Pass through the centred inspection opening into the connected final
quality-control gallery, where the completed family frame is already upright under the
calibrated inspection light. Keep the craftsperson's movement minimal and natural. In
the final second, settle into a calm symmetrical forward drift and land as closely as
possible on the supplied last frame, with the completed framed memory centred.

Preserve the exact Framers Lab world: photoreal dark charcoal concrete, blackened steel,
walnut workbenches, warm amber task lighting, restrained tropical Kerala plants and
realistic framing equipment. Preserve the family members, photograph content, workers,
room geometry, exposure and lens character. Do not animate the photograph itself. No
zoom out, no backward camera movement, no camera shake, no cuts, no dissolve, no
morphing transition, no time-lapse, no object transformation, no duplicated people, no
new objects, no text, no letters, no numbers, no logos, no signage, no captions, no
watermark, no sound.
```

## Required generation order

Generate **Clip 1 only** first. This is the motion-quality gate from the scroll-world
skill. Return its untouched MP4 to Codex before spending credits on Clips 2 and 3. The
first-frame match, last-frame match, forward camera direction, geometry, family-photo
consistency, and absence of morphing must be checked before the remaining two jobs.

If Kling's displayed charge exceeds the available platform credits, stop before clicking
Generate. Do not silently change model, duration, or resolution, because every clip in
the chain must use identical settings.

## Return files

Return the original Kling MP4 output without trimming or recompressing it. Codex will
place it under `tmp/world-raw/`, inspect the boundary frames, and only then encode the
browser version with a small GOP, no audio, and an extracted matching poster.
