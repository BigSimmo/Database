/**
 * The snapshot's shape, described once.
 *
 * It lives in `src/lib` rather than in the generator so that both the generator
 * (`scripts/generate-repo-awareness-snapshot.ts`, via the `@/` alias) and the
 * Server Component reader (`repo-awareness-snapshot.ts`) bind to the same
 * definition. Two hand-kept copies would drift, and the drift would be a
 * mis-rendered page rather than a compile error.
 *
 * No value imports here, and in particular no `import` of the generated JSON:
 * the types must be usable before the JSON file exists.
 */
export const REPO_AWARENESS_SNAPSHOT_VERSION = "repo-awareness-snapshot-v1";

export type RouteArea = "product" | "mockup";

export type RoutesSection = {
  modes: { id: string; label: string; home: string; dev_only: boolean }[];
  pages: { path: string; file: string; area: RouteArea }[];
  redirects: { path: string; file: string; target: string }[];
  api: { path: string; file: string }[];
  counts: {
    modes: number;
    pages: number;
    product_pages: number;
    mockup_pages: number;
    redirects: number;
    api: number;
  };
};

export type DocumentationSection = {
  documents: { path: string; section: string; catalogued: boolean }[];
  sections: { name: string; documents: number; uncatalogued: number }[];
  counts: { documents: number; catalogued: number; uncatalogued: number; sections: number };
};
