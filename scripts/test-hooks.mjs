// Module resolution hooks for `node --test`.
// - Maps the "@/..." path alias to the src directory (matching tsconfig).
// - Stubs "server-only" (a build-time marker with no runtime behaviour).
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export{}", shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const target = pathToFileURL(join(srcRoot, specifier.slice(2) + ".ts")).href;
    return next(target, context);
  }
  return next(specifier, context);
}
