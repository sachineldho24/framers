import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated gallery exports, vendored decoders, and local tool/browser data.
    "gallery_v*/**",
    "public/gallery-assets/**",
    "asset_reference_pack/**",
    "tmp/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
  ]),
]);

export default eslintConfig;
