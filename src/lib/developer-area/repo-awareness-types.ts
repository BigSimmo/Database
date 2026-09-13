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
 *
 * v3 finishes what v2 started, and it exists because v2's stopping point rested
 * on a premise that measurement refuted. v2 kept `routes.counts`,
 * `documentation.counts` and `test_health.counts` on the reasoning that those
 * lists "change only when someone deliberately adds a route or a document,
 * never as a side effect of another branch's work". The second clause does not
 * follow from the first: from either branch's point of view, the OTHER
 * branch's deliberate addition is exactly a side effect, and both branches
 * rewrite the same aggregate line. Measured 2026-09-06 on PR #2674 — a single
 * added mockup route, no production code — which conflicted against `main`
 * twice inside one hour, on `routes.counts` and on `captured_revision`.
 *
 * So v3 applies the rule this file already states, to the sets it had exempted:
 * every stored aggregate is dropped and derived at read. `captured_revision`
 * also loses its `sha`, which nothing has ever rendered, and its timestamp is
 * coarsened to a date so that two branches merging on the same day write
 * IDENTICAL bytes and git resolves the line without a conflict.
 */
export const REPO_AWARENESS_SNAPSHOT_VERSION = "repo-awareness-snapshot-v3";

export type RouteArea = "product" | "mockup";

export type RoutesSection = {
  modes: { id: string; label: string; home: string; dev_only: boolean }[];
  pages: { path: string; file: string; area: RouteArea }[];
  redirects: { path: string; file: string; target: string }[];
  api: { path: string; file: string }[];
};

/**
 * `sections[]` carries a name and nothing else, and since v3 so does this
 * section: no stored totals at all.
 *
 * The per-section `documents`/`uncatalogued` totals went first (`#XHADPV`),
 * because nothing read them — the documentation page computes
 * `section.documents.length` at render from the list it is about to show. The
 * section-level `counts` object survived that pass on the reasoning that
 * `documents` and `sections` are "closed sets ... never as a side effect of
 * another branch's work, so a stored total cannot become a conflict".
 *
 * That reasoning was wrong, and the correction is the whole of v3. Closed is
 * not the same as uncontended. Two branches can each deliberately add a
 * document, and each one's addition is a side effect from the other's point of
 * view; both rewrite `documents` and `catalogued` on the same lines, so git has
 * two different values for one line and stops. It is the identical failure the
 * append-only argument describes — the frequency differs, the mechanism does
 * not. Measured on PR #2674 (see the version constant above).
 *
 * The rule, stated once and now without exceptions: A COUNT IS NEVER STORED. It
 * is derived at read from the list it counts, which is also the only way a
 * count and its list cannot disagree. `documentationCounts()` in
 * `repo-awareness-snapshot.ts` does it here.
 */
export type DocumentationSection = {
  documents: { path: string; section: string; catalogued: boolean }[];
  sections: { name: string }[];
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
 * No `counts` — and since v3 that is true of every section, which is why the
 * rule is stated here once for the whole snapshot without an exception:
 *
 *   A COUNT IS NEVER STORED. It is derived at read from the list it counts.
 *
 * v1 and v2 carried a narrower rule — derive over an append-only set, store
 * over a closed one — and the narrower half did not survive contact with a busy
 * repository. A stored aggregate conflicts whenever TWO BRANCHES CHANGE THE
 * LIST, and nothing about a set being closed prevents that; it only makes it
 * less frequent. `review_state.counts` went first because appends made the
 * collision constant (`#EFETZT`), and `routes`/`documentation`/`test_health`
 * followed once the same collision was measured on ordinary route additions
 * (PR #2674, two conflicts in one hour).
 *
 * Deriving loses nothing, and gains the property the old rule was reaching for:
 * `reviewStateCounts()`, `routesCounts()`, `documentationCounts()` and
 * `testHealthCounts()` in `repo-awareness-snapshot.ts` each compute from the
 * very list the page renders, so a count and its list cannot disagree — which
 * a generator-computed total only approximated, since it could be committed
 * against a list that a later merge changed underneath it.
 */
export type ReviewStateSection = {
  records: ReviewRecord[];
};

export type RepoAwarenessSnapshot = {
  version: string;
  /**
   * Null only in a snapshot written before this field existed; the generator
   * always writes it.
   *
   * A DATE, not a timestamp, and no `sha` — both since v3. The sha was never
   * rendered anywhere; it existed only to be rewritten by every commit, which
   * is the worst possible property for a committed line. The timestamp is
   * coarsened for the same reason: two branches merging on the same day now
   * write the same string, and git resolves an identical change on both sides
   * without a conflict.
   *
   * This does not make the field free: two branches merging on DIFFERENT days
   * still disagree on this one line. That residue is deliberate rather than
   * overlooked — freshness is the one thing here a reader cannot recompute, and
   * one line is a conflict a person resolves in seconds, unlike ten aggregate
   * lines spread across three sections.
   */
  captured_revision: { committed_at: string } | null;
  routes: RoutesSection;
  documentation: DocumentationSection;
  test_health: TestHealthSection;
  review_state: ReviewStateSection;
};
