# 11 — Designer Flow (Framebridge-style, brutalist-rendered)

Target UX for the custom-frame builder, modelled on Framebridge's digital-photo flow
(`FramerBridge_Screenshots/`, analysed in `User_Flow/framebridge_ux_flow_analysis.html`).

**Adopt the flow structure and UX patterns — NOT the visual style.** Framebridge is warm
cream / serif / soft / rounded. Framers is brutalist: 0px radius, black/white, action-red,
neon-accent, Montserrat all-caps, 2–3px solid black borders. Every pattern below is
re-skinned into that language (e.g. the yellow forward-CTA → `action-red`; the warm
dashed drop-zone → a hard 2px-black dashed box).

Depends on `plan/10` (`<FramePreview>` Konva component, `frame_styles` / `finishes` /
`design_sessions` schema). This doc defines the **routing + step UX**; plan/10 defines the
**preview rendering**.

---

## 1. The Framebridge flow (what the screenshots show)

| Step | URL | Layout | Key element |
|---|---|---|---|
| 1 Entry | `/pages/digital-uploads` | 3 stacked option cards (thumb + title + "starting at" price) | price anchored upfront |
| 2 Upload | `…/framing-flow/upload` (`digital>photo>size`) | **split-screen**: left copy+CTA, right dashed drop-zone | QR "upload from phone"; breadcrumb + exit |
| 3 Size | same app (`…>size`) | split: left slider, right **live preview of the actual photo in a mat** | print-size limit disclosed ("up to 10″×17.75″"); XS/S/M tiers + 5×7/8×10/11×14 shortcuts |
| 4 Frame | `…/framing-flow/frame-select` | dense 3-col grid; **every thumbnail rendered with the user's own photo** | selected frame = highlight ring |

**The three UX moves worth stealing:**
1. **Persistent split-screen** (controls left, live preview right) from Step 2 on — trains
   the eye; by Step 3 it feels familiar.
2. **The user's actual photo everywhere** — in the size preview AND composited into every
   frame thumbnail. Removes all "imagine how it'd look" effort. This is the killer feature.
3. **Honest disclosure** — print-size limit and price tiers shown *before* commitment.

Framebridge's own weak spots (we will fix, see §5): no file-format guidance pre-pick, no
"how it works" preview on entry, and a 60+ frame grid with **no filters** = decision fatigue.

---

## 2. How it maps onto Framers (two design sources, one flow)

Framers has something Framebridge doesn't: **two design sources — Upload, and Design in
Canva.** The Framebridge flow is upload-centric. We unify:

```
                 ┌─ UPLOAD ─→ upload → SIZE → FRAME → REVIEW → checkout
ENTRY (source) ──┤                         (live preview shows the real photo)
                 └─ CANVA ──→ SIZE → FRAME → [Canva redirect to design] ─┐
                                  (preview shows a placeholder)          │
                                  REVIEW (art now in preview) ←──────────┘
```

Why the order differs by source: **Canva needs the dimensions before you can design**
(size sets the canvas px), so Canva users pick size+frame first, then design. Upload users
have the photo first, so we can show it live at the size step (the Framebridge strength).
Both paths **share the same Size and Frame components and the same `<FramePreview>`** — only
what fills the preview differs (real photo vs. placeholder until Canva returns).

State for all steps lives in a **`design_sessions`** row (already introduced in plan/10):
`{frame_id (size), frame_style_id, finish_id, design_source, upload_path|canva_design_id}`.
For Canva, the session id is the only thing that fits through `correlation_state` (~50 chars).

---

## 3. Routing

Replace the single `/frames/[slug]/design-method` step with a stepped designer. Carry the
session id in the URL so steps are linkable/refresh-safe:

| Step | Route | Notes |
|---|---|---|
| Entry / source | `/design/start` (+ optional `?frameId=` from a product card) | source choice; brutalist version of the 3-card entry |
| Upload | `/design/[sessionId]/upload` | split-screen drop-zone; **show accepted formats + min-DPI up front** |
| Size | `/design/[sessionId]/size` | slider + standard-size shortcuts; live `<FramePreview>` |
| Frame | `/design/[sessionId]/frame` | personalized grid (user photo in each style) + **filters** |
| Review | `/design/[sessionId]/review` | full preview, final framed size, itemised price → checkout |

The existing `frames/[slug]` product page stays as a browse/marketing surface; its CTA
seeds `/design/start?frameId=…`. The old `design-method` page is retired (its two paths
become the Entry source choice).

---

## 4. Pattern → token mapping (the re-skin, exactly)

Every Framebridge UX pattern, bound to a concrete DESIGN.md / `globals.css` token or
existing utility. **This is the contract — no warm/serif/rounded anything.** Tokens below
exist already (`@theme` in `globals.css`); the global `* { border-radius:0 !important }`
rule keeps everything sharp for free.

| Framebridge (warm) | Framers token / class | Notes |
|---|---|---|
| Cream page bg `#faf6ef` | `bg-background` (#f9f9f9) | the "Tuxedo" white canvas |
| Serif headings (Recoleta) | `font-display` Montserrat 800, **all-caps** (auto via `h1–h3`) | "FIND THE RIGHT SIZE." |
| Body serif | `font-body` Hanken Grotesk | |
| Breadcrumb / dims text | `.label-caps` (Space Grotesk, +0.1em, caps) | `digital›photo›size` → `UPLOAD › SIZE › FRAME` |
| Yellow forward-CTA `#d8e04a` | **`bg-action-red text-white`** + `.brutalist-shadow` + `.brutalist-press` | the only forward-progress colour |
| Soft rounded drop-zone | **2px black dashed** box, 0px radius, `surface-muted` fill | `border-2 border-dashed border-black` |
| Right preview panel (cream) | `bg-surface-muted` (#ebebeb) — the one allowed "depth" tone | matches Product Card rule in DESIGN.md |
| Orange selected-frame ring | **`neon-accent` ring** (the "redline"/status accent) | `ring-4 ring-neon-accent` + 2px black border |
| Soft mat border in preview | hard **1px solid black inset** on the image | DESIGN.md Product-Card image rule |
| Pill size shortcuts (rounded) | **ghost buttons**: 2px black border, no bg; active → `bg-black text-white` | DESIGN.md Ghost button |
| Slider thumb (round, pastel) | square `action-red` thumb on a 2px black track | circles only where a square is illegible |
| Secondary links (underlined) | black text, `.label-caps`, 2px black underline on hover | "Edit Photo", "EXIT" |
| Quality/price chips | **black bg + white `.label-caps`** (DESIGN.md Chip) | DPI badge is the exception below |

**DPI badge is the one place colour encodes meaning, not action:** green `#16a34a` ≥300,
`action-red` for <150 — and amber uses `neon-accent` text-on-black so we stay on-palette.
Keep it a chip (black bg, coloured pip + white label) so it doesn't compete with the red CTA.

---

## 5. Step-by-step UX

**Step 1 — Entry (`/design/start`).** Two bordered `surface-muted` cards
(`border-2 border-black` + `.brutalist-shadow` on hover): **"UPLOAD YOUR PHOTO"** and
**"DESIGN IN CANVA"** (Canva card shows a clear "needs Canva" note / 503 when unconfigured,
as today). Fix the gap Framebridge has: a 3-step **"HOW IT WORKS"** strip (UPLOAD → SIZE →
FRAME) using `.label-caps`. Price anchor in Space Grotesk: "FRAMES FROM ₹—".

**Step 2 — Upload (`…/upload`, upload path only).** Split-screen on `bg-background`: left =
Montserrat all-caps heading + Hanken subcopy + **`bg-action-red text-white` "UPLOAD PHOTO"**
button (`.brutalist-shadow` + `.brutalist-press`) + a ghost QR "upload from phone"; right =
**2px black dashed** drop-zone (`surface-muted` fill, 0px radius) with placeholder icon and
"OR DRAG & DROP" in `.label-caps`. **Fix Framebridge's gap:** show
`JPG / PNG / PDF · MAX 30 MB · MIN 150 DPI` as a black/white chip row *before* the picker.
Preview via `URL.createObjectURL` — nothing hits Supabase until Review/checkout.

**Step 3 — Size (`…/size`).** Split-screen: left = horizontal size slider (square `action-red`
thumb, 2px black track) mapped to the `frames` standard-size rows, each tier labelled with
its price in `.label-caps` (XS/S/M → our A5/A4/A3…), plus ghost-button quick-picks for exact
standard sizes. Right = live `<FramePreview>` on `surface-muted` with the user's photo
(placeholder for Canva), image carrying the 1px black inset. **Disclose max print size**
(`upload px ÷ 300`) and the **DPI badge** per §4. Forward CTA `bg-action-red text-white`:
"NEXT: PICK A FRAME".

**Step 4 — Frame (`…/frame`).** Dense responsive grid of `frame_styles`, **each thumbnail
composited with the user's own photo** via Konva `toDataURL` (render once per style, cache).
Selected = **`ring-4 ring-neon-accent`** + 2px black border. Under each: name (`.label-caps`)
+ material descriptor + `+₹` modifier. **Fix decision fatigue:** sticky **filter bar**
(colour / material / price — ghost buttons, active = black fill) + a pinned **"POPULAR /
RECOMMENDED FOR THIS PHOTO"** row (orientation-matched). Finish (matte/glossy/premium) =
small ghost sub-control driving the preview overlay. For Canva, this is the last step before
the redirect.

**Step 5 — Review (`…/review`).** Full read-only `<FramePreview>`, the **FINAL FRAMED SIZE**
stated explicitly in Space Grotesk (distinct from the photo's pixels), itemised price
(`base + style + finish`) in a black-bordered spec table, then `bg-action-red` → checkout.
For Canva, this is where return-navigation lands, art now in the preview.

**Persistent chrome (all steps):** fixed top bar — white bg, **1px solid black bottom
border** (DESIGN.md Nav rule) — carrying the **breadcrumb** (`UPLOAD › SIZE › FRAME ›
REVIEW`, `.label-caps`, current step black / others `on-surface-variant`) and an
always-visible **EXIT** (ghost). These are Framebridge's commitment-anxiety reducers, which
matter at this price point.

---

## 6. Improvements over Framebridge (explicitly adopt)

From the analysis, things Framers should do that Framebridge doesn't:
- **Frame-grid filters** (colour / material / price) + a **"Popular / recommended"** pinned
  row — directly attacks the 60+ option decision fatigue (Step 4).
- **Resolution / DPI quality badge** at the Size step (Step 3).
- **Format + size + DPI guidance shown before the file picker** (Step 2).
- **"How it works" preview** on the Entry page (Step 1).
- (Stretch) social/cloud import on upload; **"View in Room"** mockup — defer to the Tier-3
  WebGL idea in plan/10 §2.

---

## 7. Build order

1. `design_sessions` + `frame_styles` + `finishes` schema (plan/10 §3, migration `0006`).
2. `<FramePreview>` Konva component (plan/10 §4) — needed by Steps 3, 4, 5.
3. Designer route shell `/design/start` + `/design/[sessionId]/…` with breadcrumb/exit chrome.
4. Step 2 Upload (objectURL preview, format/DPI guidance).
5. Step 3 Size (slider + shortcuts + live preview + DPI badge + max-print disclosure).
6. Step 4 Frame (personalized grid + filters + finish sub-control).
7. Step 5 Review → wire into existing checkout (`sessionStorage`/session handoff).
8. Canva path: size+frame before redirect; `create-design` reads session dims; return lands
   on Review (plan/10 §6 hand-off).
9. Retire `/frames/[slug]/design-method`; point product CTA at `/design/start?frameId=…`.

---

## 8. Open decisions
- **Entry ordering for Canva** — confirm size→frame→design is acceptable (it must be; canvas
  needs dims). Upload stays upload→size→frame.
- **Finish placement** — sub-control on the Frame step (recommended) vs. its own step.
- **Mat board** — still DEFERRED (plan/10); when added it inserts between Size and Frame and
  shrinks the Canva canvas.
- **Filters taxonomy** — needs the client's real frame_styles list to define colour/material
  facets.
