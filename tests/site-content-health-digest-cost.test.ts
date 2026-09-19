/**
 * The deployment health probe must not canonicalise the same release twice.
 *
 * WHAT THIS DEFENDS. `public.site_content_health_operational_base()` decides whether the retained
 * epoch-zero release is intact. Until 2026-09-18 it compared two stored columns to the SAME
 * freshly computed `site_content_bootstrap_digest(...)` — the same digest, of the same release,
 * evaluated twice in one expression. The rollback branch carried the identical pair.
 *
 * WHY A COUNT AND NOT A REVIEW. `site_content_bootstrap_digest` canonicalises every `record` and
 * `render_payload` in the release through `site_content_canonical_json`, a recursive PL/pgSQL
 * function invoked once per JSON node. Measured in the pinned bare image on 2026-09-18 with
 * `track_functions = 'all'`:
 *
 *     one site_content_bootstrap_digest()      164,820 site_content_canonical_json invocations
 *     one site_content_release_digest()         10,969
 *     one site_content_dynamic_state_digest()        3
 *     ONE read_site_content_health()  BEFORE   351,594
 *     ONE read_site_content_health()  AFTER    186,774
 *
 * So a single duplicated call is 47% of the recursive work in a health read, and nothing about
 * reading the SQL makes that visible — the two lines look like two different checks. A committed
 * count is the only thing that keeps the next edit honest, because the obvious way to add a third
 * stored column to the comparison is to write a third digest call.
 *
 * WHAT IS ALLOWED. One evaluation per release identifier. The function legitimately checks two
 * releases: the active one (`r.id`) and, in the rollback branch, its predecessor (`p.id`).
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/** Strip `--` comments: prose that quotes a call must not be able to satisfy or break the count. */
const stripComments = (sql: string) =>
  sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");

const schema = stripComments(readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8"));

/**
 * The body is defined under its original name and renamed to the private base later in the file,
 * so slice from the definition to its dollar-quote terminator rather than searching for the name.
 */
function operationalBaseBody(): string {
  const start = schema.indexOf("create or replace function public.read_site_content_health()");
  expect(start, "health probe definition not found in supabase/schema.sql").toBeGreaterThan(-1);
  const end = schema.indexOf("\n$$;", start);
  expect(end, "unterminated health probe definition").toBeGreaterThan(start);
  return schema.slice(start, end);
}

const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe("site-content health probe digest cost", () => {
  it("evaluates the bootstrap digest once per release, not once per stored column", () => {
    const body = operationalBaseBody();

    expect(occurrences(body, "public.site_content_bootstrap_digest(r.id)"), "active release").toBe(1);
    expect(occurrences(body, "public.site_content_bootstrap_digest(p.id)"), "previous release").toBe(1);
    expect(occurrences(body, "public.site_content_bootstrap_digest("), "total in the probe body").toBe(2);
  });

  it("still proves both stored columns equal that digest, by chaining rather than recomputing", () => {
    const body = operationalBaseBody();

    // `A = D and B = D` became `B = A and A = D`: for a non-null D these are the same proposition,
    // and the surrounding CASE acts only on TRUE. Dropping either line would silently stop
    // checking one of the two stored columns, which is the failure this pair of asserts catches.
    expect(body).toContain("and r.dynamic_state_digest = r.release_digest");
    expect(body).toContain("and r.release_digest = public.site_content_bootstrap_digest(r.id)");
    expect(body).toContain("and p.dynamic_state_digest = p.release_digest");
    expect(body).toContain("and p.release_digest = public.site_content_bootstrap_digest(p.id)");
  });

  it("keeps the probe body free of the shape it replaced", () => {
    const body = operationalBaseBody();

    expect(body).not.toContain("r.dynamic_state_digest = public.site_content_bootstrap_digest");
    expect(body).not.toContain("p.dynamic_state_digest = public.site_content_bootstrap_digest");
  });

  it("is not vacuous: the anchors it counts are really in the mirror", () => {
    // Every assertion above is an upper bound or an absence, and all of them pass against an
    // empty string. This one fails if the slice stops resolving to the probe at all.
    const body = operationalBaseBody();

    expect(body.length).toBeGreaterThan(5000);
    expect(body).toContain("bootstrapIntegrityState");
    expect(body).toContain("'valid_retained'");
    expect(occurrences(body, "public.site_content_bootstrap_digest(")).toBeGreaterThan(0);
  });
});
