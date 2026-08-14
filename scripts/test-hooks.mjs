// Module resolution hooks for `node --test`.
// - Maps the "@/..." path alias to the src directory (matching tsconfig).
// - Resolves extensionless relative imports, which "moduleResolution": "bundler"
//   allows in source but Node requires an extension for.
// - Stubs "server-only" (a build-time marker with no runtime behaviour).
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export{}", shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const target = pathToFileURL(join(srcRoot, specifier.slice(2) + ".ts")).href;
    return next(target, context);
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    if (!extname(specifier) && context.parentURL?.startsWith("file:")) {
      const resolved = new URL(specifier, context.parentURL);
      // Only rewrite when the .ts file is really there; otherwise leave the
      // specifier alone so Node reports the original, more useful error.
      for (const ext of [".ts", ".tsx"]) {
        const candidate = new URL(resolved.href + ext);
        if (existsSync(fileURLToPath(candidate))) {
          return next(candidate.href, context);
        }
      }
    }
  }
  return next(specifier, context);
}
