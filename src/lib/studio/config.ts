import "server-only";

/**
 * Feature flags for studio capabilities that aren't production-ready by
 * default, following `shippingFlags()`'s shape
 * (`src/lib/shipping/config.ts`).
 */
export function studioFlags() {
  return {
    /** Customer-facing Templates tab and its `GET /api/templates*` routes. */
    templates: process.env.TEMPLATES_ENABLED === "true",
  };
}
