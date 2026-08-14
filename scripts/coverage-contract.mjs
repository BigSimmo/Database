/** Shared coverage inventory contract for Vitest and the post-run LCOV guard. */
export const COVERAGE_INCLUDE_GLOBS = Object.freeze([
  "src/**/*.{ts,tsx}",
  "scripts/**/*.{ts,mjs,cjs}",
  "worker/**/*.ts",
  "supabase/functions/**/*.ts",
]);

export const COVERAGE_INVENTORY_ROOTS = Object.freeze(["src/", "scripts/", "worker/", "supabase/functions/"]);
