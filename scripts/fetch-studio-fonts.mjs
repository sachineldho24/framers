/**
 * Fetch the studio's font binaries into `public/fonts/`.
 *
 * The studio picker can't use `next/font` — that's build-time and statically
 * analysed, and it mangles the family name (`__Montserrat_abc123`) so canvas
 * `fillText` can't reference it. So the studio self-hosts its own WOFF2 files
 * and registers them at runtime through the `FontFace` API.
 *
 * Self-hosting rather than linking fonts.googleapis.com is deliberate: a link
 * means a third-party request per visitor, and an unpinned version that could
 * reflow a saved document under us.
 *
 * Run: `node scripts/fetch-studio-fonts.mjs`
 * Then paste the printed manifest into `src/lib/studio/fonts.ts` if the family
 * list changed. Re-running is safe — existing files are overwritten in place.
 *
 * Every family here is licensed OFL-1.1 or Apache-2.0; both permit self-hosting
 * and selling rasterised output, which is all we do (the print is a PNG and
 * embeds no font).
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "fonts"
);

/** Only these subsets. Latin covers English; latin-ext adds ₹ and accents. */
const SUBSETS = new Set(["latin", "latin-ext"]);

/** A modern UA, or Google serves legacy TTF instead of WOFF2. */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * `weights` are the upright faces; `italic` says the family has a companion
 * italic, in which case we take it at every listed weight.
 *
 * Google serves these as variable fonts, so all weights of one family resolve
 * to a single file and the `font-weight` descriptor instances the `wght` axis.
 * Asking for three weights therefore costs the same bytes as asking for one —
 * which is why bold and bold-italic are worth requesting rather than rationing.
 */
const FAMILIES = [
  { id: "inter", family: "Inter", weights: [400, 600, 700], italic: true, slug: "inter" },
  { id: "montserrat", family: "Montserrat", weights: [400, 700, 900], italic: true, slug: "montserrat" },
  { id: "work-sans", family: "Work Sans", weights: [400, 600, 700], italic: true, slug: "worksans" },
  { id: "archivo-narrow", family: "Archivo Narrow", weights: [400, 700], italic: true, slug: "archivonarrow" },
  { id: "anton", family: "Anton", weights: [400], italic: false, slug: "anton" },
  { id: "bebas-neue", family: "Bebas Neue", weights: [400], italic: false, slug: "bebasneue" },
  { id: "playfair-display", family: "Playfair Display", weights: [400, 700, 900], italic: true, slug: "playfairdisplay" },
  { id: "lora", family: "Lora", weights: [400, 700], italic: true, slug: "lora" },
  { id: "jetbrains-mono", family: "JetBrains Mono", weights: [400, 700], italic: true, slug: "jetbrainsmono" },
  { id: "caveat", family: "Caveat", weights: [400, 700], italic: false, slug: "caveat" },
];

/**
 * All ten live under `ofl/` in google/fonts, i.e. SIL OFL 1.1. Clause 2 of that
 * licence requires the licence text and copyright notice to accompany the font
 * files wherever they are redistributed — and self-hosting is redistribution —
 * so we fetch each one rather than just asserting the licence in a comment.
 */
const LICENSE_DIR = "licenses";
const OFL_URL = (slug) =>
  `https://raw.githubusercontent.com/google/fonts/main/ofl/${slug}/OFL.txt`;

/** `Inter:400,700,400italic,700italic` — the v1 API's spec syntax. */
function cssUrl({ family, weights, italic }) {
  const spec = [
    ...weights.map(String),
    ...(italic ? weights.map((w) => `${w}italic`) : []),
  ].join(",");
  return (
    `https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}:${spec}` +
    `&subset=latin,latin-ext&display=swap`
  );
}

/**
 * Google emits one `@font-face` per subset, each preceded by a `/* subset *\/`
 * comment. Split on the comment so each block knows which subset it is.
 */
function parseFaces(css) {
  const out = [];
  const blocks = css.split(/\/\*\s*([a-z-]+)\s*\*\//i).slice(1);
  for (let i = 0; i + 1 < blocks.length; i += 2) {
    const subset = blocks[i].trim();
    const body = blocks[i + 1];
    const style = /font-style:\s*([a-z]+)/i.exec(body)?.[1] ?? "normal";
    const weight = Number(/font-weight:\s*(\d+)/i.exec(body)?.[1] ?? "400");
    const url = /src:\s*url\(([^)]+)\)/i.exec(body)?.[1];
    const range = /unicode-range:\s*([^;]+);/i.exec(body)?.[1]?.trim();
    if (url && range) out.push({ subset, style, weight, url, range });
  }
  return out;
}

async function main() {
  await mkdir(path.join(OUT_DIR, LICENSE_DIR), { recursive: true });

  /** url → filename, so a variable font shared across weights lands once. */
  const byUrl = new Map();
  /** Filenames already claimed, so a static family can't clobber a sibling. */
  const taken = new Set();
  /** subset → unicode-range, shared by every family. */
  const ranges = new Map();
  const manifest = [];
  let bytes = 0;

  for (const entry of FAMILIES) {
    const license = await fetch(OFL_URL(entry.slug));
    if (!license.ok) throw new Error(`${entry.family}: OFL.txt ${license.status}`);
    const licenseText = await license.text();
    await writeFile(
      path.join(OUT_DIR, LICENSE_DIR, `${entry.id}.txt`),
      licenseText
    );
    // The first line of an OFL.txt is the copyright notice the licence
    // requires us to carry. Surfaced in the manifest so the picker can show it.
    const copyright = licenseText.split("\n")[0].trim();

    const res = await fetch(cssUrl(entry), { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`${entry.family}: CSS ${res.status}`);
    const faces = parseFaces(await res.text()).filter((f) =>
      SUBSETS.has(f.subset)
    );
    if (faces.length === 0) throw new Error(`${entry.family}: no latin faces`);

    const files = [];
    for (const face of faces) {
      let file = byUrl.get(face.url);
      if (!file) {
        // No weight in the name: one variable file serves every weight, so
        // `inter-400-latin` would be a lie the moment 700 reused it. A family
        // that ever ships static per-weight files falls back to the suffixed
        // name rather than overwriting a sibling.
        const stem = `${entry.id}${face.style === "italic" ? "-italic" : ""}-${face.subset}`;
        file = `${stem}.woff2`;
        if (taken.has(file)) file = `${stem}-${face.weight}.woff2`;
        taken.add(file);
        const bin = await fetch(face.url, { headers: { "User-Agent": UA } });
        if (!bin.ok) throw new Error(`${file}: ${bin.status}`);
        const buf = Buffer.from(await bin.arrayBuffer());
        await writeFile(path.join(OUT_DIR, file), buf);
        byUrl.set(face.url, file);
        bytes += buf.length;
        console.log(`  ${file}  ${(buf.length / 1024).toFixed(1)} KB`);
      }
      files.push({
        weight: face.weight,
        style: face.style,
        subset: face.subset,
        file,
      });

      // The ranges are a property of the subset, not the family, so they belong
      // in one place. Assert rather than assume: if Google ever reshapes a
      // subset, this should fail loudly here instead of quietly dropping glyphs
      // from a print months later.
      const known = ranges.get(face.subset);
      if (known === undefined) ranges.set(face.subset, face.range);
      else if (known !== face.range) {
        throw new Error(
          `${entry.family}: ${face.subset} range differs from the others.\n` +
            `  expected ${known}\n  got      ${face.range}`
        );
      }
    }
    manifest.push({
      id: entry.id,
      family: entry.family,
      license: "OFL-1.1",
      copyright,
      files,
    });
  }

  await writeFile(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(
      { subsets: Object.fromEntries(ranges), families: manifest },
      null,
      2
    ) + "\n"
  );
  console.log(
    `\n${byUrl.size} files, ${(bytes / 1024).toFixed(0)} KB total → public/fonts/`
  );
}

await main();
