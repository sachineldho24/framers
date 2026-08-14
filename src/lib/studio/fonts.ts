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
  | "mono"
  | "indic";

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
];

export const CATEGORY_LABELS: Record<FontCategory, string> = {
  display: "Poster & display",
  sans: "Sans serif",
  serif: "Serif",
  script: "Script",
  mono: "Monospace",
  indic: "Malayalam & Devanagari",
};

/** Catalogue order is the display order, so the picker groups follow it. */
export const CATEGORY_ORDER: FontCategory[] = [
  "display",
  "sans",
  "serif",
  "script",
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
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_FONT_ID)!;
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
