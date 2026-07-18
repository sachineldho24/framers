---
name: scroll-world-style-lock
description: Generate the master "style-lock" anchor image prompt for a scroll-linked animation world (scrollytelling). Use when the user wants to create the FIRST world design image that locks the theme/style for a scroll-driven landing page, or invokes /scroll-world-style-lock. Produces a single ready-to-paste image-generation prompt; every later frame and video inherits this anchor's palette, lighting, lens, materials, and composition.
---

# Scroll World Style Lock

You produce the single **master anchor prompt** for a scroll-linked animation
("scrollytelling") world — the kind where an MP4's frames are mapped to scroll
position, so scrolling advances/reverses the footage.

The first image is the most important asset in the entire experience: every
other keyframe and every generated video inherits its palette, lighting, lens,
material language, scale, and composition. Get this one right and the whole
world stays coherent. Get it wrong and nothing downstream can recover. This
skill's deliverable is ONE ready-to-paste image-generation prompt, not code and
not the image itself.

## Step 1 — Gather the world brief

If the user already described the theme, work from that. Otherwise ask a tight
batch (AskUserQuestion, ≤4 at a time) covering only what you cannot infer:

- **Subject / world**: what is the hero world? (a workshop, a boba diorama, a
  car factory, a landscape…)
- **Scene model**: one continuous connected world the camera travels through,
  or discrete self-contained "island" scenes?
- **Rendering style**: photoreal / ArchViz, claymation-isometric diorama,
  low-poly, stylised 3D, illustrated?
- **Palette & mood**: dominant colors, light vs. dark, warm vs. cool.
- **Number of scenes** and a one-line label for each (drives later frames).

Skip anything already obvious. Do not ask about implementation.

## Step 2 — Apply the non-negotiable composition rules

These are the lessons that separate an immersive scroll-dive from a slideshow.
Bake them into the prompt regardless of theme:

1. **Subject-first, full-bleed.** The hero world fills ~70–80% of the frame,
   centred, edge to edge. NOT a small object pushed to one side with a large
   empty column for text. A Z-axis dive only reads as immersive when the subject
   fills the frame — that is where the parallax lives.
2. **Central vanishing point + a rear portal.** Place a doorway / passage /
   opening EXACTLY at centre rear, aligned to the vanishing point, so a virtual
   camera can push straight forward THROUGH geometry into the next scene (the
   "spatial dive" transition). This is what makes seams seamless later.
3. **Centre-safe.** All essential objects inside the middle half of the frame so
   a portrait phone crop stays readable.
4. **Consistent single-direction key light**, stated explicitly, so every
   downstream frame can match exposure and shadow direction.
5. **Believable, locked scale** and a named lens (e.g. 24mm wide-angle at eye
   height, looking straight forward).
6. **Hard bans**: no text, letters, numbers, logos, signage, watermarks,
   captions, or UI anywhere (including on props/screens); no people unless the
   theme requires them; no floating objects; no morphing architecture; no
   graphic gradients or overlays; do not drift into a different rendering style
   than the one chosen.

## Step 3 — Emit the anchor prompt

Fill the template below with the Step-1 brief and Step-2 rules, then output it
inside a single fenced code block so the user can copy it verbatim into their
image generator. Keep the ROLE and COMPOSITION sections intact — those are the
load-bearing parts.

````text
ROLE: Generate the single master style-lock keyframe for a scroll-driven
cinematic landing page ("scrollytelling"). Every other frame and video in the
experience will inherit this image's palette, lighting, lens, materials, scale,
and composition — so this frame defines the entire visual world. Treat it as the
art-direction bible, not a one-off illustration.

USE CASE: <rendering style, e.g. photorealistic-natural>, full-bleed 16:9 hero keyframe.

SUBJECT (the hero, fills the frame):
<one vivid paragraph describing the hero world and the single focal action/object.
State that the subject occupies ~70-80% of the frame — subject-first, NOT a small
object floating in empty space.>

COMPOSITION (critical — this is what makes the scroll-dive read as immersive):
- Subject centred and full-bleed; fills the frame edge to edge with strong
  foreground parallax elements near the bottom edges.
- A single central vanishing point. A <doorway / passage / opening> sits EXACTLY
  at the centre rear, aligned to the vanishing point, so a virtual camera can
  push straight forward THROUGH it into the next scene (Z-axis "spatial dive").
- Centre-safe: all essential objects inside the middle half of the frame so a
  portrait phone crop stays readable.
- Minimal dead negative space; no large empty side column. The world is the hero,
  not a backdrop behind text.
- <named lens>, camera looking straight forward, <eye height>. Believable scale.

STYLE / MEDIUM:
<rendering style spelled out — e.g. ultra-photorealistic editorial photography /
claymation isometric diorama with tilt-shift / stylised low-poly>. Consistent,
grounded, never drifting into another style.

PALETTE (lock these):
<dominant colors and material notes>. <deep clean blacks / soft cream / etc.>.
Restrained accents only. No neon, no graphic gradients.

LIGHTING (lock this):
<light source + mood>, single consistent key-light direction so downstream frames
can match exposure and shadow direction.

HARD CONSTRAINTS:
- <No people, OR people if the theme needs them.>
- No text, letters, numbers, logos, signage, watermarks, captions, or UI anywhere,
  including on tools, screens, or props.
- One coherent scene; no floating objects; no morphing architecture; no added
  graphic overlays or gradients.
- Do not stylise into <the styles you are NOT using> — stay <chosen style>.

OUTPUT: one landscape 16:9 cinematic keyframe.
````

## Step 4 — Explain the lock gate

After the prompt, tell the user, in a few lines:

- Generate **only this one image first**, then judge it against: palette,
  rendering fidelity, scene geometry, material quality, key-light direction, and
  the centre-rear portal alignment. If any miss, revise ONLY this anchor and
  regenerate — do not proceed to other frames until it is approved.
- Once approved, this image becomes the visual reference every other keyframe is
  generated *from*, so they inherit camera height, lens, palette, light
  direction, and the central passage.
- The centre-rear portal is load-bearing: it is what lets a later camera move
  "travel forward through the opening into the next scene," which is the
  spatial-dive transition that prevents the scroll from feeling like a slideshow.

Do not generate the image or write any code in this skill — the deliverable is
the prompt and the gate explanation.
