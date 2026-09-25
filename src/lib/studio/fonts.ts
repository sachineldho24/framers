/**
 * The studio's font catalogue.
 *
 * Canvas can only draw a family the browser has actually loaded, and it fails
 * *silently* — an unloaded family falls back to the default sans and the export
 * quietly differs from the preview. So this module is deliberately narrow:
 *
 *   - every family here is a real Google Fonts family, requested by exact name;
 *   - `weights` lists only weights we are confident the family ships, because
 *     asking css2 for a weight a family doesn't have makes the whole stylesheet
 *     request fail, taking the other weights down with it;
 *   - every family carries a `fallback` stack, so a failed network still draws
 *     something legible rather than nothing.
 *
 * Loading is the DOM half of this and lives in `fontLoader.ts`. Everything here
 * is pure so it can be unit-tested and imported on the server.
 */

export type FontCategory =
  | "display"
  | "sans"
  | "serif"
  | "script"
  | "handwriting"
  | "mono"
  | "indic"
  /** Uploaded by the user. Never in the catalogue; see `customFontDefinition`. */
  | "custom";

export interface FontDefinition {
  /** Stable id stored in the document. Never change one — documents refer to it. */
  id: string;
  /** The CSS family name, exactly as Google Fonts publishes it. */
  family: string;
  category: FontCategory;
  /** Weights offered in the UI *and* requested from Google. */
  weights: number[];
  /** Whether to request (and offer) a true italic. */
  italic: boolean;
  /** Drawn if the webfont never arrives. */
  fallback: string;
  /** Shown in the picker instead of the family name where it helps. */
  note?: string;
  /** Uploaded font: loaded as a FontFace from storage, never from Google. */
  custom?: boolean;
}

const SANS_FALLBACK = "system-ui, sans-serif";
const SERIF_FALLBACK = "Georgia, serif";
const MONO_FALLBACK = "ui-monospace, monospace";
const CURSIVE_FALLBACK = "cursive";

/**
 * Chosen for the product, not for breadth: condensed and technical faces for
 * automotive posters, a small serif set for classic prints, two scripts for
 * captions, and Malayalam + Devanagari because the storefront is Kerala-first
 * and a poster with a name on it is the common case.
 */
export const FONT_CATALOGUE: FontDefinition[] = [
  // Display / poster
  {
    id: "anton",
    family: "Anton",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Heavy poster caps",
  },
  {
    id: "bebas-neue",
    family: "Bebas Neue",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Tall condensed caps",
  },
  {
    id: "archivo-black",
    family: "Archivo Black",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
  },
  {
    id: "oswald",
    family: "Oswald",
    category: "display",
    weights: [300, 400, 500, 600, 700],
    italic: false,
    fallback: SANS_FALLBACK,
  },
  {
    id: "teko",
    family: "Teko",
    category: "display",
    weights: [400, 500, 600, 700],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Instrument-cluster numerals",
  },
  {
    id: "rajdhani",
    family: "Rajdhani",
    category: "display",
    weights: [400, 500, 600, 700],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Squared technical",
  },
  {
    id: "chakra-petch",
    family: "Chakra Petch",
    category: "display",
    weights: [400, 500, 600, 700],
    italic: true,
    fallback: SANS_FALLBACK,
    note: "Motorsport technical",
  },
  {
    id: "racing-sans-one",
    family: "Racing Sans One",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
  },
  {
    id: "bungee",
    family: "Bungee",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Signage",
  },
  {
    id: "monoton",
    family: "Monoton",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Retro neon",
  },

  // Sans
  {
    id: "montserrat",
    family: "Montserrat",
    category: "sans",
    weights: [400, 500, 600, 700, 800, 900],
    italic: true,
    fallback: SANS_FALLBACK,
    note: "The Framers headline face",
  },
  {
    id: "inter",
    family: "Inter",
    category: "sans",
    weights: [400, 500, 600, 700, 800, 900],
    italic: false,
    fallback: SANS_FALLBACK,
  },
  {
    id: "poppins",
    family: "Poppins",
    category: "sans",
    weights: [400, 500, 600, 700, 800, 900],
    italic: true,
    fallback: SANS_FALLBACK,
  },
  {
    id: "work-sans",
    family: "Work Sans",
    category: "sans",
    weights: [400, 500, 600, 700, 800, 900],
    italic: true,
    fallback: SANS_FALLBACK,
  },
  {
    id: "barlow-condensed",
    family: "Barlow Condensed",
    category: "sans",
    weights: [400, 500, 600, 700],
    italic: true,
    fallback: SANS_FALLBACK,
  },
  {
    id: "space-grotesk",
    family: "Space Grotesk",
    category: "sans",
    weights: [400, 500, 600, 700],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "The Framers label face",
  },

  // Serif
  {
    id: "playfair-display",
    family: "Playfair Display",
    category: "serif",
    weights: [400, 500, 600, 700, 800, 900],
    italic: true,
    fallback: SERIF_FALLBACK,
  },
  {
    id: "cormorant-garamond",
    family: "Cormorant Garamond",
    category: "serif",
    weights: [400, 500, 600, 700],
    italic: true,
    fallback: SERIF_FALLBACK,
  },
  {
    id: "libre-baskerville",
    family: "Libre Baskerville",
    category: "serif",
    weights: [400, 700],
    italic: true,
    fallback: SERIF_FALLBACK,
  },

  // Script
  {
    id: "great-vibes",
    family: "Great Vibes",
    category: "script",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
  {
    id: "dancing-script",
    family: "Dancing Script",
    category: "script",
    weights: [400, 500, 600, 700],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
  {
    id: "caveat",
    family: "Caveat",
    category: "script",
    weights: [400, 500, 600, 700],
    italic: false,
    fallback: CURSIVE_FALLBACK,
    note: "Handwritten",
  },
  {
    id: "pacifico",
    family: "Pacifico",
    category: "script",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },

  // Mono
  {
    id: "jetbrains-mono",
    family: "JetBrains Mono",
    category: "mono",
    weights: [400, 500, 600, 700, 800],
    italic: true,
    fallback: MONO_FALLBACK,
    note: "Spec sheets",
  },
  {
    id: "space-mono",
    family: "Space Mono",
    category: "mono",
    weights: [400, 700],
    italic: true,
    fallback: MONO_FALLBACK,
  },

  // Indic
  {
    id: "noto-sans-malayalam",
    family: "Noto Sans Malayalam",
    category: "indic",
    weights: [400, 500, 600, 700, 800, 900],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "മലയാളം",
  },
  {
    id: "baloo-chettan-2",
    family: "Baloo Chettan 2",
    category: "indic",
    weights: [400, 500, 600, 700, 800],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Malayalam display",
  },
  {
    id: "noto-sans-devanagari",
    family: "Noto Sans Devanagari",
    category: "indic",
    weights: [400, 500, 600, 700, 800, 900],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "हिन्दी",
  },

  // ---------------------------------------------------------------------
  // The Canva-style set: popular Google families across every mood, each
  // one's weights checked against the css2 API (a wrong weight fails the
  // whole batched stylesheet, so none are guessed).
  // ---------------------------------------------------------------------
  // Display
  {
    id: "abril-fatface",
    family: "Abril Fatface",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Fashion-magazine headline",
  },
  {
    id: "alfa-slab-one",
    family: "Alfa Slab One",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Chunky slab",
  },
  {
    id: "righteous",
    family: "Righteous",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Retro rounded",
  },
  {
    id: "lilita-one",
    family: "Lilita One",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
  },
  {
    id: "titan-one",
    family: "Titan One",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Bubbly",
  },
  {
    id: "black-ops-one",
    family: "Black Ops One",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Stencil",
  },
  {
    id: "russo-one",
    family: "Russo One",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
  },
  {
    id: "orbitron",
    family: "Orbitron",
    category: "display",
    weights: [400, 500, 600, 700, 800, 900],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Futuristic",
  },
  {
    id: "audiowide",
    family: "Audiowide",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
  },
  {
    id: "bungee-shade",
    family: "Bungee Shade",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "3D signage",
  },
  {
    id: "luckiest-guy",
    family: "Luckiest Guy",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Comic",
  },
  {
    id: "bangers",
    family: "Bangers",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Comic caps",
  },
  {
    id: "press-start-2p",
    family: "Press Start 2P",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Pixel",
  },
  {
    id: "rubik-mono-one",
    family: "Rubik Mono One",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
  },
  {
    id: "staatliches",
    family: "Staatliches",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
  },
  {
    id: "big-shoulders-display",
    family: "Big Shoulders Display",
    category: "display",
    weights: [400, 500, 600, 700, 800, 900],
    italic: false,
    fallback: SANS_FALLBACK,
  },
  {
    id: "unbounded",
    family: "Unbounded",
    category: "display",
    weights: [300, 400, 500, 600, 700, 800, 900],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Wide modern",
  },
  {
    id: "syne",
    family: "Syne",
    category: "display",
    weights: [400, 500, 600, 700, 800],
    italic: false,
    fallback: SANS_FALLBACK,
  },
  {
    id: "cinzel-decorative",
    family: "Cinzel Decorative",
    category: "display",
    weights: [400, 700, 900],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Engraved flourish",
  },
  {
    id: "faster-one",
    family: "Faster One",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Speed lines",
  },
  {
    id: "zen-dots",
    family: "Zen Dots",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
  },
  {
    id: "fredoka",
    family: "Fredoka",
    category: "display",
    weights: [300, 400, 500, 600, 700],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Soft rounded",
  },
  {
    id: "shrikhand",
    family: "Shrikhand",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Retro italic",
  },
  {
    id: "rampart-one",
    family: "Rampart One",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
    note: "Outlined",
  },
  {
    id: "bowlby-one-sc",
    family: "Bowlby One SC",
    category: "display",
    weights: [400],
    italic: false,
    fallback: SANS_FALLBACK,
  },
  // Sans serif
  {
    id: "raleway",
    family: "Raleway",
    category: "sans",
    weights: [300, 400, 500, 600, 700, 800, 900],
    italic: true,
    fallback: SANS_FALLBACK,
  },
  {
    id: "josefin-sans",
    family: "Josefin Sans",
    category: "sans",
    weights: [300, 400, 500, 600, 700],
    italic: true,
    fallback: SANS_FALLBACK,
    note: "Geometric vintage",
  },
  {
    id: "lato",
    family: "Lato",
    category: "sans",
    weights: [300, 400, 700, 900],
    italic: true,
    fallback: SANS_FALLBACK,
  },
  {
    id: "nunito",
    family: "Nunito",
    category: "sans",
    weights: [300, 400, 600, 700, 800, 900],
    italic: true,
    fallback: SANS_FALLBACK,
  },
  {
    id: "outfit",
    family: "Outfit",
    category: "sans",
    weights: [300, 400, 500, 600, 700, 800],
    italic: false,
    fallback: SANS_FALLBACK,
  },
  {
    id: "dm-sans",
    family: "DM Sans",
    category: "sans",
    weights: [400, 500, 700],
    italic: true,
    fallback: SANS_FALLBACK,
  },
  {
    id: "quicksand",
    family: "Quicksand",
    category: "sans",
    weights: [300, 400, 500, 600, 700],
    italic: false,
    fallback: SANS_FALLBACK,
  },
  {
    id: "league-spartan",
    family: "League Spartan",
    category: "sans",
    weights: [300, 400, 500, 600, 700, 800, 900],
    italic: false,
    fallback: SANS_FALLBACK,
  },
  {
    id: "kanit",
    family: "Kanit",
    category: "sans",
    weights: [300, 400, 500, 600, 700, 800, 900],
    italic: true,
    fallback: SANS_FALLBACK,
  },
  {
    id: "sora",
    family: "Sora",
    category: "sans",
    weights: [300, 400, 500, 600, 700, 800],
    italic: false,
    fallback: SANS_FALLBACK,
  },
  {
    id: "open-sans",
    family: "Open Sans",
    category: "sans",
    weights: [300, 400, 500, 600, 700, 800],
    italic: true,
    fallback: SANS_FALLBACK,
  },
  {
    id: "roboto",
    family: "Roboto",
    category: "sans",
    weights: [300, 400, 500, 700, 900],
    italic: true,
    fallback: SANS_FALLBACK,
  },
  // Serif
  {
    id: "dm-serif-display",
    family: "DM Serif Display",
    category: "serif",
    weights: [400],
    italic: true,
    fallback: SERIF_FALLBACK,
    note: "High-contrast headline",
  },
  {
    id: "cinzel",
    family: "Cinzel",
    category: "serif",
    weights: [400, 500, 600, 700, 800, 900],
    italic: false,
    fallback: SERIF_FALLBACK,
    note: "Roman capitals",
  },
  {
    id: "lora",
    family: "Lora",
    category: "serif",
    weights: [400, 500, 600, 700],
    italic: true,
    fallback: SERIF_FALLBACK,
  },
  {
    id: "merriweather",
    family: "Merriweather",
    category: "serif",
    weights: [300, 400, 700, 900],
    italic: true,
    fallback: SERIF_FALLBACK,
  },
  {
    id: "bodoni-moda",
    family: "Bodoni Moda",
    category: "serif",
    weights: [400, 500, 600, 700, 800, 900],
    italic: true,
    fallback: SERIF_FALLBACK,
    note: "Didone elegance",
  },
  {
    id: "prata",
    family: "Prata",
    category: "serif",
    weights: [400],
    italic: false,
    fallback: SERIF_FALLBACK,
  },
  {
    id: "yeseva-one",
    family: "Yeseva One",
    category: "serif",
    weights: [400],
    italic: false,
    fallback: SERIF_FALLBACK,
  },
  {
    id: "fraunces",
    family: "Fraunces",
    category: "serif",
    weights: [300, 400, 500, 600, 700, 800, 900],
    italic: true,
    fallback: SERIF_FALLBACK,
    note: "Soft old-style",
  },
  {
    id: "eb-garamond",
    family: "EB Garamond",
    category: "serif",
    weights: [400, 500, 600, 700, 800],
    italic: true,
    fallback: SERIF_FALLBACK,
  },
  {
    id: "ultra",
    family: "Ultra",
    category: "serif",
    weights: [400],
    italic: false,
    fallback: SERIF_FALLBACK,
    note: "Fat western slab",
  },
  // Script
  {
    id: "allura",
    family: "Allura",
    category: "script",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
    note: "Formal wedding script",
  },
  {
    id: "sacramento",
    family: "Sacramento",
    category: "script",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
    note: "Monoline",
  },
  {
    id: "parisienne",
    family: "Parisienne",
    category: "script",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
  {
    id: "satisfy",
    family: "Satisfy",
    category: "script",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
  {
    id: "alex-brush",
    family: "Alex Brush",
    category: "script",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
  {
    id: "kaushan-script",
    family: "Kaushan Script",
    category: "script",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
    note: "Brush",
  },
  {
    id: "lobster",
    family: "Lobster",
    category: "script",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
    note: "Bold retro script",
  },
  {
    id: "yellowtail",
    family: "Yellowtail",
    category: "script",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
  {
    id: "tangerine",
    family: "Tangerine",
    category: "script",
    weights: [400, 700],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
  {
    id: "pinyon-script",
    family: "Pinyon Script",
    category: "script",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
    note: "Copperplate",
  },
  {
    id: "italianno",
    family: "Italianno",
    category: "script",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
  {
    id: "cookie",
    family: "Cookie",
    category: "script",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
  {
    id: "mrs-saint-delafield",
    family: "Mrs Saint Delafield",
    category: "script",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
    note: "Signature",
  },
  {
    id: "playball",
    family: "Playball",
    category: "script",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
  {
    id: "courgette",
    family: "Courgette",
    category: "script",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
  {
    id: "monsieur-la-doulaise",
    family: "Monsieur La Doulaise",
    category: "script",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
    note: "Ornate",
  },
  // Handwritten
  {
    id: "permanent-marker",
    family: "Permanent Marker",
    category: "handwriting",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
    note: "Marker",
  },
  {
    id: "amatic-sc",
    family: "Amatic SC",
    category: "handwriting",
    weights: [400, 700],
    italic: false,
    fallback: CURSIVE_FALLBACK,
    note: "Hand-drawn caps",
  },
  {
    id: "shadows-into-light",
    family: "Shadows Into Light",
    category: "handwriting",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
  {
    id: "indie-flower",
    family: "Indie Flower",
    category: "handwriting",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
  {
    id: "gloria-hallelujah",
    family: "Gloria Hallelujah",
    category: "handwriting",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
  {
    id: "homemade-apple",
    family: "Homemade Apple",
    category: "handwriting",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
  {
    id: "rock-salt",
    family: "Rock Salt",
    category: "handwriting",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
    note: "Rough marker",
  },
  {
    id: "kalam",
    family: "Kalam",
    category: "handwriting",
    weights: [300, 400, 700],
    italic: false,
    fallback: CURSIVE_FALLBACK,
    note: "Handwritten, Devanagari too",
  },
  {
    id: "patrick-hand",
    family: "Patrick Hand",
    category: "handwriting",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
  {
    id: "architects-daughter",
    family: "Architects Daughter",
    category: "handwriting",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
  {
    id: "reenie-beanie",
    family: "Reenie Beanie",
    category: "handwriting",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
  {
    id: "nanum-pen-script",
    family: "Nanum Pen Script",
    category: "handwriting",
    weights: [400],
    italic: false,
    fallback: CURSIVE_FALLBACK,
  },
];

export const CATEGORY_LABELS: Record<FontCategory, string> = {
  display: "Poster & display",
  sans: "Sans serif",
  serif: "Serif",
  script: "Script",
  handwriting: "Handwritten",
  mono: "Monospace",
  indic: "Malayalam & Devanagari",
  custom: "Your fonts",
};

/** Catalogue order is the display order, so the picker groups follow it. */
export const CATEGORY_ORDER: FontCategory[] = [
  "display",
  "sans",
  "serif",
  "script",
  "handwriting",
  "mono",
  "indic",
];

const BY_ID = new Map(FONT_CATALOGUE.map((f) => [f.id, f]));

export const DEFAULT_FONT_ID = "anton";

/**
 * Look a font up. Falls back to the default rather than returning null: a
 * document referring to a font we later dropped should still render.
 */
export function getFont(id: string): FontDefinition {
  if (isCustomFontId(id)) return customFontDefinition(id);
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_FONT_ID)!;
}

/* -------------------------------------------------------------------------- */
/* Uploaded fonts                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Uploaded fonts share one id space, marked by this prefix. The id is what text
 * layers store, exactly as for a catalogue font.
 */
export const CUSTOM_FONT_PREFIX = "custom-";

export function isCustomFontId(id: string): boolean {
  return id.startsWith(CUSTOM_FONT_PREFIX) && id.length > CUSTOM_FONT_PREFIX.length;
}

/** Display names, filled in as the document's fonts are registered. */
const customNames = new Map<string, string>();

export function nameCustomFont(id: string, name: string): void {
  customNames.set(id, name);
}

/**
 * The definition of an uploaded font, derived from its id alone.
 *
 * Derived rather than looked up, so a custom id can never fall back to the
 * default: `getFont` is how documents are coerced on load, and a lookup that
 * ran before the font was registered would quietly rewrite every layer in it
 * to Anton. The CSS family is a private name the loader registers the file
 * under, so an upload called "Arial" can't shadow the real Arial.
 *
 * One file is one face. Offering 400 and 700 lets the browser synthesise bold,
 * which is what every editor does with a single-weight upload.
 */
export function customFontDefinition(id: string): FontDefinition {
  return {
    id,
    family: `Framers Custom ${id.slice(CUSTOM_FONT_PREFIX.length)}`,
    category: "custom",
    weights: [400, 700],
    italic: false,
    fallback: SANS_FALLBACK,
    note: customNames.get(id) ?? "Uploaded font",
    custom: true,
  };
}

/** Name shown in the picker: the uploaded font's own, or the family's. */
export function fontDisplayName(font: FontDefinition): string {
  return font.custom ? (customNames.get(font.id) ?? "Uploaded font") : font.family;
}

export function fontsByCategory(category: FontCategory): FontDefinition[] {
  return FONT_CATALOGUE.filter((f) => f.category === category);
}

/** Nearest weight the family actually ships, so the UI can't request a miss. */
export function nearestWeight(font: FontDefinition, weight: number): number {
  return font.weights.reduce((best, w) =>
    Math.abs(w - weight) < Math.abs(best - weight) ? w : best
  );
}

/**
 * The css2 stylesheet URL for one family.
 *
 * Uses the `ital,wght@` tuple form when the family has an italic, because css2
 * requires axes in alphabetical order and every tuple to carry every axis.
 */
export function fontCssUrl(font: FontDefinition): string {
  const weights = [...font.weights].sort((a, b) => a - b);
  const name = font.family.replace(/ /g, "+");
  const spec = font.italic
    ? `ital,wght@${weights.map((w) => `0,${w}`).join(";")};${weights
        .map((w) => `1,${w}`)
        .join(";")}`
    : `wght@${weights.join(";")}`;
  return `https://fonts.googleapis.com/css2?family=${name}:${spec}&display=swap`;
}

/** One URL for a set of families — one request instead of N. */
export function fontCssUrlFor(fonts: FontDefinition[]): string | null {
  if (fonts.length === 0) return null;
  const families = fonts
    // Sorted so the same set always produces the same URL and hits the cache.
    .slice()
    .sort((a, b) => a.family.localeCompare(b.family))
    .map((font) => {
      const url = fontCssUrl(font);
      return url.slice(url.indexOf("family=") + 7, url.indexOf("&display"));
    });
  return `https://fonts.googleapis.com/css2?family=${families.join(
    "&family="
  )}&display=swap`;
}

/** `font-family` value: the real family first, then its fallback stack. */
export function fontStack(font: FontDefinition): string {
  return `"${font.family}", ${font.fallback}`;
}

/**
 * A CSS `font` shorthand for `ctx.font`.
 *
 * Canvas parses this with the CSS font shorthand grammar, so the order is fixed
 * (`style weight size family`) and the size must carry a unit.
 */
export function fontShorthand(params: {
  fontId: string;
  weight: number;
  italic: boolean;
  sizePx: number;
}): string {
  const font = getFont(params.fontId);
  const style = params.italic && font.italic ? "italic " : "";
  const weight = nearestWeight(font, params.weight);
  // Guard the size: canvas throws on a non-finite or zero size and then draws
  // nothing at all, which would look like the text having been deleted.
  const size = Number.isFinite(params.sizePx) ? Math.max(1, params.sizePx) : 16;
  return `${style}${weight} ${size}px ${fontStack(font)}`;
}
