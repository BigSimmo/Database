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
/**
 * v2 dropped `review_state.counts` and re-ordered `review_state.records` by
 * `head`. Both are shape changes, so the version moves with them: a committed
 * snapshot left at v1 fails `assertRepoAwarenessVersion` loudly instead of
 * rendering a page from data whose order and totals no longer mean what the
 * reader is told.
 */
export const REPO_AWARENESS_SNAPSHOT_VERSION = "repo-awareness-snapshot-v2";

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
  sections: { name: string }[];
  counts: { documents: number; catalogued: number; uncatalogued: number; sections: number };
};

export type QuarantinedTest = {
  id: string;
  title: string;
  spec: string;
  reason: string;
  owner: string;
  reproduction: string;
  first_seen: string;
  last_seen: string;
  expires: string;
  tracking: string;
};

export type TestHealthSection = {
  /** The ledger's own explanation of its state, so an empty panel can quote it. */
  note: string | null;
  quarantined: QuarantinedTest[];
  counts: { quarantined: number };
};

export type ReviewRecord = {
  date: string;
  ref: string;
  head: string;
  scope: string;
  outcome: string;
  checks: string;
};

/**
 * No `counts`, and that is the deliberate rule this file states once for the
 * whole snapshot:
 *
 *   A count over an APPEND-ONLY set is derived at render. A count over a closed
 *   set stays generator-computed.
 *
 * The generator rule "counts are computed once, so a count and its own list
 * cannot disagree" holds for `routes` and `documentation`, whose lists change
 * only when someone deliberately adds a route or a document. It cannot hold for
 * an append-only set: every concurrent append changes the aggregate on BOTH
 * sides, so a stored total is a guaranteed merge conflict that no ordering can
 * disperse. `documentation.sections[]` already dropped its per-section
 * `documents`/`uncatalogued` counts for the render-time list (`#XHADPV`, which
 * asked for exactly this choice to be made deliberately rather than by
 * omission); `review_state.counts` follows for the stronger reason (`#EFETZT`).
 *
 * Deriving loses nothing: `reviewStateCounts()` in `repo-awareness-snapshot.ts`
 * computes both totals once from the very list the page renders, so they still
 * cannot disagree with it.
 */
export type ReviewStateSection = {
  records: ReviewRecord[];
};

export type RepoAwarenessSnapshot = {
  version: string;
  /** Null only in a snapshot written before this field existed; the generator always writes it. */
  captured_revision: { sha: string; committed_at: string } | null;
  routes: RoutesSection;
  documentation: DocumentationSection;
  test_health: TestHealthSection;
  review_state: ReviewStateSection;
};
