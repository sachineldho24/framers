export type WorldScene = {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  body: string;
  tags: string[];
  scroll: number;
  videoStart: number;
  videoEnd: number;
  still: string;
  poster?: string;
  fallbackStill: string;
};

export const WORLD_FILM_SOURCE = "/world/vid/framers-v2.mp4";

/**
 * Frame-sequence configuration for the canvas scrubber. The master
 * (framers-v2.mp4, 1920x1080/30fps/56.233s) is sampled at 15 fps into 844 WebP
 * frames per tier (see scripts/extract-world-frame-sequence.py + the generated
 * public/world/frames/manifest.json, which this mirrors).
 *
 * `baseUrl` defaults to the local dev path but can point at object storage / a
 * CDN for deploy via NEXT_PUBLIC_WORLD_FRAMES_BASE_URL, keeping the large
 * immutable sequence out of the app bundle.
 */
export const WORLD_FRAME_SEQUENCE = {
  baseUrl:
    process.env.NEXT_PUBLIC_WORLD_FRAMES_BASE_URL ?? "/world/frames",
  pattern: "frame-####.webp",
  fps: 15,
  frameCount: 844,
  duration: 56.2,
  tiers: {
    desktop: { width: 1920, height: 1080 },
    mobile: { width: 960, height: 540 },
  },
} as const;

// Keyframe stills are the first paint (shown before the canvas scrubber fades
// in) and every scene's poster is eagerly preloaded on mount, so they live on
// the critical path. Served as WebP (~150 KiB) rather than the ~2 MiB PNG
// masters to keep first load fast; the PNG originals stay in the folder unused.
const frame = (name: string) => `/world/keyframes/${name.replace(/\.png$/, ".webp")}`;

export const WORLD_SCENES: WorldScene[] = [
  {
    id: "arrival",
    label: "Arrival",
    eyebrow: "01 — Enter the world",
    title: "The house of the frame.",
    body: "A working world built around one purpose: turning the image you care about into something made to last.",
    tags: ["Framers Lab"],
    scroll: 1.35,
    videoStart: 0,
    videoEnd: 5.5,
    still: frame("00-exterior-closed-van.png"),
    poster: frame("00-exterior-closed-van.png"),
    fallbackStill: frame("00-exterior-closed-van.png"),
  },
  {
    id: "reveal",
    label: "The Reveal",
    eyebrow: "02 — The roof lifts",
    title: "Eight rooms. One standard.",
    body: "Intake, design, craft, inspection and dispatch unfold as one connected process. Nothing hidden. Nothing mass-made.",
    tags: ["Open process", "Made in-house"],
    scroll: 1.25,
    videoStart: 5.5,
    videoEnd: 10.5,
    still: frame("00-exterior-open-clean.png"),
    poster: frame("00-exterior-open-clean.png"),
    fallbackStill: frame("00-exterior-open-clean.png"),
  },
  {
    id: "intake",
    label: "Art Intake",
    eyebrow: "03 — Art intake",
    title: "First, we read the image.",
    body: "It arrives unmounted and untouched. We inspect tone, detail and proportion before deciding anything around it.",
    tags: ["Archival handling", "Image first"],
    scroll: 1.55,
    videoStart: 10.5,
    videoEnd: 20.5,
    still: frame("01-art-intake-raw.png"),
    poster: frame("01-art-intake-raw.png"),
    fallbackStill: frame("01-art-intake-raw.png"),
  },
  {
    id: "design",
    label: "Design Lab",
    eyebrow: "04 — Design lab",
    title: "Proportion before profile.",
    body: "Crop, scale, mat and moulding are resolved around the picture—never imposed on it.",
    tags: ["Made to measure", "Live proofing"],
    scroll: 1.45,
    videoStart: 20.5,
    videoEnd: 29,
    still: frame("02-design-lab-screen-clean-v2.png"),
    poster: frame("02-design-lab-screen-clean-v2.png"),
    fallbackStill: frame("02-design-lab-screen-clean-v2.png"),
  },
  {
    id: "craft",
    label: "The Workshop",
    eyebrow: "05 — The workshop",
    title: "Made to the millimetre.",
    body: "Moulding is cut, joined and fitted by hand until four corners become one precise frame.",
    tags: ["Hand finished", "Precision joins"],
    scroll: 1.5,
    videoStart: 29,
    videoEnd: 38,
    still: frame("03-craft-in-progress.png"),
    poster: frame("03-craft-in-progress.png"),
    fallbackStill: frame("03-craft-in-progress.png"),
  },
  {
    id: "quality",
    label: "Quality",
    eyebrow: "06 — Quality control",
    title: "Inspected in real light.",
    body: "Alignment, surface and finish are checked under calibrated light before the frame leaves the bench.",
    tags: ["Final inspection", "Glove handled"],
    scroll: 1.3,
    videoStart: 38,
    videoEnd: 44.5,
    still: frame("04-quality-finale-clean.png"),
    poster: frame("04-quality-finale-clean.png"),
    fallbackStill: frame("04-quality-finale-clean.png"),
  },
  {
    id: "dispatch",
    label: "Dispatch",
    eyebrow: "07 — Dispatch",
    title: "Protected for the road.",
    body: "The finished piece is wrapped, cornered and boxed as one secure package.",
    tags: ["Fitted protection", "India-wide"],
    scroll: 1.3,
    videoStart: 44.5,
    videoEnd: 51.5,
    still: frame("05-dispatch-ready.png"),
    poster: frame("05-dispatch-ready.png"),
    fallbackStill: frame("05-dispatch-ready.png"),
  },
  {
    id: "shipping",
    label: "Shipping",
    eyebrow: "08 — Shipping",
    title: "From our lab to your wall.",
    body: "Loaded with care and delivered ready to live with—no assembly, no uncertainty.",
    tags: ["Doorstep delivery", "Ready to hang"],
    scroll: 1.35,
    videoStart: 51.5,
    videoEnd: 56.2,
    still: frame("06-delivery-loading.png"),
    poster: frame("06-delivery-loading.png"),
    fallbackStill: frame("06-delivery-loading.png"),
  },
];
