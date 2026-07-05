# 10 — Frame Preview / Virtual Try-On

A "Lenskart-style" preview: the user picks a frame style + standard size, uploads an
image (or returns from Canva), and sees their art **inside the chosen frame** live —
drag/zoom to set the crop, switch material/finish to see it change, then check out
with that exact framed mockup attached.

This replaces the dead, cosmetic-only material selector in `ProductDetail.tsx` (flagged
in `08-open-questions.md`) with a real, persisted choice.

---

## 0. Core insight — what makes this cheap

A framed poster on screen is a **flat 2D composite**, not AR. Unlike eyewear try-on
(face tracking + 3D model), nothing moves and nothing is rendered in 3D. So no camera,
no ML, no three.js required for the front-on view.

**You do not need one frame asset per size.** A black frame in A5 and A3 is the *same
molding* — only the **aspect ratio** and **price** differ. The asset/library size is:

> **N frame styles (black / white / oak / walnut / metal) × ~2–3 finishes** —
> NOT styles × sizes.

Size is pure data (aspect ratio + dimensions + price). ~5–8 styles cover the catalog.

### Standard sizes (rows in `frames`, already modelled as sibling SKUs)

| Size | Aspect | Size | Aspect |
|---|---|---|---|
| A5 / A4 / A3 / A2 | 1 : √2 | 8×10″ | 4 : 5 |
| 12×16″ | 3 : 4 | 12×12″ | 1 : 1 |

---

## 1. The layered model (the "try-on")

```
┌───────────────────────────────┐ ← FINISH overlay  (matte=none, glossy=specular
│  ╔═══════════════════════════╗ │                    highlight, premium=glass tint)
│  ║ ░░░░ white mat / passe ░░░ ║ │ ← MAT board (optional real framing feature)
│  ║ ░┌─────────────────────┐░ ║ │
│  ║ ░│  user's image –     │░ ║ │ ← IMAGE  (drag / pinch-zoom to set the crop)
│  ║ ░│  draggable & zoom   │░ ║ │
│  ║ ░└─────────────────────┘░ ║ │
│  ╚═══════════════════════════╝ │ ← FRAME molding (per style, data-driven source)
└───────────────────────────────┘
```

- **Frame molding** — varies per *frame style* (border). v1 = CSS/SVG; later swap to
  real frame PNGs via a data column with no component rewrite.
- **Finish** (Matte / Glossy / Premium) — a CSS/blend **reflection overlay**, not a
  separate photo. Glossy = strong specular highlight; Matte = none; Premium = subtle
  glass tint.
- **Mat board** — optional inner white border (real framing upsell).
- **Image** — user upload, instantly previewable client-side via
  `URL.createObjectURL(file)` (no Supabase round-trip for preview); draggable +
  pinch-zoom to control the crop. Switching size changes the aspect ratio so the user
  sees live whether their photo will be cropped (the "size-compatible" check).

---

## 2. Tech decision — Konva.js, stylized-now, data-driven molding

| Tier | Tech | Realism | Assets | Verdict |
|---|---|---|---|---|
| 1 | HTML/CSS layers (`border-image` + gradient) | Stylized | ~0 | Drag/zoom/export awkward |
| **2** | **Konva.js** interactive `<canvas>` | Good + real interaction | small | ✅ **CHOSEN** |
| 3 | WebGL displacement/perspective (pixi.js/three.js) | Photoreal, angled/in-room | frame photos | Later, optional |
| — | Mockup APIs (Dynamic Mockups / Placid / Printful) | Photoreal | none | Fallback if we don't build it |

**Chosen (build): native HTML5 Canvas 2D API, no Konva dependency.** Konva (Tier 2) was
the plan, but `react-konva`'s `react-reconciler` peer dep is fragile on React 19 / Next 16
/ Turbopack and pulls SSR complications. The native `<canvas>` 2D context delivers the same
three things with zero dependencies and a clean build:
1. **Drag + pinch-zoom crop** — pointer-event math on the canvas.
2. **`canvas.toDataURL()`** — the composited framed mockup as an image, reused as the
   order thumbnail + admin/print reference, free.
3. **`globalCompositeOperation` + gradients** — so glossy vs matte actually *looks* different.

**Decision: stylized-now (zero-asset), data-driven molding source.** The molding image
comes from `frame_styles.texture_url`; ship with CSS/SVG-generated borders, and drop in
real frame PNGs (Tier 3) later by populating that column — no component change. Tier 3
WebGL is reserved for an optional "see it on your wall" feature.

---

## 3. Schema changes

New, plus persistence onto the order (kills the cosmetic-only material bug):

- **`frame_styles`** — `id`, `name` (Black / Oak / Walnut / White / Metal),
  `texture_url` (nullable; CSS-rendered when null), `molding_width_mm`, `price_modifier_paise`.
- **`finishes`** — `id`, `name` (Matte / Glossy / Premium), `overlay_kind`
  (`none` | `gloss` | `glass`), `price_modifier_paise`.
- **`frames`** (existing, per size) — add `frame_style_id` FK, or keep style orthogonal
  and let the user pick style + size + finish independently. **Decide:** is a "frame"
  one (style × size) SKU, or is style a separate dimension? Recommendation: keep size as
  the `frames` SKU (as today) and treat **style + finish as configurable options** with
  price modifiers, persisted on the order.
- **`orders`** — add `frame_style_id`, `finish_id`, `mockup_path` (the Konva
  `toDataURL` composite uploaded to Storage), and the crop transform
  (`crop_x/y/scale/rotation`) so the print file can be regenerated at full res.
- **`design_sessions`** — `id`, `user_id`, `frame_id`, `frame_style_id`, `finish_id`,
  `mat` (bool), `created_at`. Holds the full configuration across the Canva redirect
  (see §6), since `correlation_state` only fits ~50 chars (one id, not three).
- Price = `frame.price_paise + style.price_modifier + finish.price_modifier`, computed
  **server-side** in `create-order` (never trust client) — same rule as today.
- Migration: `0006_frame_styles_finishes.sql` (+ seed styles/finishes + `design_sessions`).

---

## 4. Shared `<FramePreview>` component

One client component, used by every surface so the preview is identical everywhere:

```
<FramePreview
  widthMm height Mm        // aspect ratio + scale
  styleSrc                 // frame_styles.texture_url | null → CSS molding
  finish                   // 'matte' | 'gloss' | 'glass'
  mat={true|false}
  imageSrc                 // objectURL (upload) OR Canva export PNG
  editable                 // true on product/upload (drag+zoom), false on checkout
  onComposite(dataUrl, transform)  // emits mockup + crop for persistence
/>
```

- Konva `Stage` → layers: molding (Rect/Image), mat (Rect), image (`Konva.Image`,
  draggable, `Transformer` for zoom), finish (Rect + `globalCompositeOperation`).
- Aspect ratio from `width_mm / height_mm`; responsive width, mobile-first.
- Read-only mode just renders; editable mode enables drag/pinch + emits the composite.

---

## 5. Wiring into existing flows

- **Product page** (`ProductDetail.tsx`) — replace the fake Matte/Glossy/Premium buttons
  with real `finishes`; add a `frame_styles` picker; show an **empty** `<FramePreview>`
  (placeholder art) that updates live as size/style/finish change. Helps the buyer
  choose before designing.
- **Upload path** (`UploadArtwork.tsx`) — after file pick, feed the objectURL into an
  **editable** `<FramePreview>`; user drags/zooms to crop; on confirm, upload the
  original + the `toDataURL` mockup, carry crop transform into `sessionStorage`
  checkout handoff.
- **Canva return** (`/design/[designId]`) — look up the `design_sessions` row (§6) to
  recover frame size + style + finish + mat, then feed the exported PNG into the **same**
  `<FramePreview>` so both paths share one preview. Canva "design from scratch" flow is
  otherwise unchanged.
- **Checkout + confirmation** — render read-only `<FramePreview>` (or the stored
  `mockup_path`) so the buyer sees exactly what they bought.
- **Admin** — show `mockup_path` next to the print file for QA.

---

## 6. Canva hand-off — carry exact size + style + finish through the round-trip

**Reality:** Canva's editor canvas is **only the printable art area**. Canva cannot
render the physical frame molding/material inside the editor. So the frame **type/finish
is carried as metadata** through the redirect (and lands on the order + preview + print
file); the **size** is what actually shapes the canvas.

What each selection does to the Canva design:

| Selection | Effect on Canva canvas | How it travels |
|---|---|---|
| **Size** (A3, 8×10″…) | **Sets canvas dimensions** — `width_px`/`height_px` @ 300 DPI (already wired) | `frames` row |
| **Frame style** (oak/metal…) | None — molding is physical, around the print | metadata only |
| **Finish** (matte/glossy) | None — glazing is physical | metadata only |
| **Mat board** | **Shrinks** the canvas to the visible window (art behind a mat is smaller) | affects `width_px`/`height_px` passed |

**The 50-char wall.** `correlation_state` (canva.ts:73) fits ~one UUID — not three.
So persist the full config in a **`design_sessions`** row and pass only its id:

1. **Start design** (`create-design/route.ts` + the OAuth-cookie path in `callback`):
   create a `design_sessions` row `{frame_id, frame_style_id, finish_id, mat}`; compute
   canvas px from the size (minus mat inset if `mat`); call `createDesign` with those px
   and an **enriched title** — e.g. `` `${size} · ${style} · ${finish} — Framers` `` —
   so it's recognizable in the user's Canva account and on the print file.
2. **Carry the session id**, not the frame id: set `correlation_state = sessionId`
   (replaces `frame.id` in `withCorrelationState`), and store `sessionId` in the OAuth
   cookie (replacing `CANVA_OAUTH_COOKIES.frameId`) for the first-auth path.
3. **Return** (`api/canva/return`): the JWT's `correlation_state` is now `sessionId` →
   redirect to `/design/{designId}?session={sessionId}`.
4. **Export screen** (`/design/[designId]`): load the session → know exact size + style +
   finish + mat → render `<FramePreview>` and persist them onto the order at checkout.

Net change to existing code: `frameId` carrier → `sessionId` carrier in
`create-design`, `callback`, and `return`; enrich the `createDesign` title; mat-aware
canvas px. The size→canvas mechanism itself is unchanged.

---

## 7. Build steps

1. **Schema** — `0006` migration: `frame_styles`, `finishes`, `design_sessions`, order
   columns, seed; update `src/lib/supabase/types.ts` (row types as `type` aliases, per
   CLAUDE.md).
2. **`<FramePreview>`** — install Konva + react-konva; build the shared component
   (read-only first, then editable drag/zoom + `onComposite`).
3. **Product page** — wire real style/finish selectors + live empty preview; server-side
   price = base + modifiers.
4. **Canva hand-off (§6)** — `create-design` + `callback` create a `design_sessions` row,
   enrich the title, mat-aware canvas px; switch the `frameId` carrier → `sessionId` in
   `create-design`, `callback`, `return`.
5. **Upload path** — editable preview + crop persistence + mockup upload to Storage.
6. **Canva return** — load the session, reuse `<FramePreview>` on the export screen.
7. **Checkout/confirmation/admin** — read-only preview from `mockup_path`; persist
   style/finish/size onto the order.
8. **Polish** — mobile pinch-zoom, crop-warning when image aspect ≠ frame aspect,
   loading skeletons.

---

## 8. Open decisions

- **Style as SKU vs option** — recommend style + finish as configurable options on the
  existing size-SKU `frames` (§3). Confirm with client.
- **Stylized-now vs wait for real frame photos** — recommend stylized-now with a
  data-driven `texture_url` so photoreal PNGs drop in later. Confirm.
- **Mat board** — include as a real upsell option, or omit for v1?
- **"On your wall" room mockup** (Tier 3 WebGL) — out of scope for v1; revisit later.
