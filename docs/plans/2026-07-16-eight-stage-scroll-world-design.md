# Eight-stage scroll world design

## Problem statement

The current `/world` page compresses a 56.2-second production film into four broad
chapters. The copy changes are not locked to the film's actual storyboard, the bright
red/lime navigation competes with the footage, and the mobile crop hides too much of
the architectural walkthrough.

## Goals

- Make the continuous V2 film the unmistakable USP of the page.
- Give all eight storyboard beats their own scroll range and matching copy reveal.
- Preserve the full motion range when scrolling forward or backward.
- Blend the interface into the charcoal, walnut and amber film palette.
- Keep the walkthrough legible on large laptops and mobile screens.

## Non-goals

- No new image or video generation.
- No deployment.
- No changes to the commerce/designer flows.
- No new animation dependency.

## Alternatives considered

### Four broad chapters over one film

Fast and lightweight, but it hides half the production story and is the source of the
current mismatch.

### Eight separately loaded clips

Precise per chapter, but adds download overhead and risks visible seams or different
colour/exposure at every boundary.

### One film with eight timed chapters — selected

Keep `FRAMERS_V2.mp4` continuous and map each scroll segment to a known time window.
This preserves film continuity, supports reverse scrolling, and gives every storyboard
beat an exact copy and navigation state.

## Visual direction: cinematic black atelier

- Background: near-black and graphite.
- Type: warm ivory, muted stone and one restrained aged-brass accent sampled from the
  workshop lighting.
- Header: quiet wordmark and text CTA only; no coloured logo tile or chapter navbar.
- Progress: an eight-mark hairline rail, not a bright progress bar.
- Copy: editorial, borderless and asymmetrical with generous negative space.
- Film blend: neutral colour treatment with a dark directional scrim; no neon or red.

## Storyboard

1. **Arrival** — 0.0–5.5s — The house of the frame.
2. **Reveal** — 5.5–10.5s — Eight rooms. One continuous standard.
3. **Intake** — 10.5–20.5s — First, we read the image.
4. **Design** — 20.5–29.0s — Proportion before profile.
5. **Craft** — 29.0–38.0s — Made to the millimetre.
6. **Quality** — 38.0–44.5s — Inspected in real light.
7. **Dispatch** — 44.5–51.5s — Protected for the road.
8. **Shipping** — 51.5–56.2s — From our lab to your wall.

## Responsive behaviour

### Large laptop and desktop

The film fills the viewport. Copy occupies the left third over a directional black
scrim. The eight-stage rail sits on the right edge. Headline size scales with viewport
width but is capped to avoid covering the central work.

### Mobile

The complete 16:9 film is presented as a wide cinematic band below the compact header,
instead of being aggressively cropped to portrait. Copy occupies the black space below
the film. The rail becomes a compact `01 / 08` marker and eight hairlines.

## Motion design

Each scroll segment maps to its own contiguous film time range. A request-animation-
frame loop eases the displayed time toward the newest scroll target, preventing the
staccato large seeks caused by the former direct assignment. Copy fades in, holds, and
fades out within the same chapter. Reduced-motion users still receive the corrected
storyboard stills and all eight pieces of copy.

