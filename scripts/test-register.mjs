// Registers the resolution hooks for `node --test`.
// Used via: node --import ./scripts/test-register.mjs
import { register } from "node:module";
register("./test-hooks.mjs", import.meta.url);
