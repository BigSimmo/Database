import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guards the shape of `read_site_content_public_records` that the 2026-09-16 outage was caused by.
 *
 * The function classified each release record's kind as `coalesce(p.kind, case ...)` over a column
 * from the NULLABLE side of a left join, and filtered on it in a later CTE. A predicate over the
 * nullable side cannot be pushed beneath the join, so every call built the entire active release
 * across all five kinds and discarded four of them. Asking for one form cost the whole catalogue,
 * which is what put the read past the 2500 ms budget universal search gives a registry domain and
 * left Forms, Medications and Services returning nothing for seven days.
 *
 * This is a STRUCTURAL check on the latest definition, not a behavioural one — the behaviour lives
 * in Postgres, and CI's migration replay is what executes it. It exists because the regression is
 * invisible in review: a `coalesce` over a left join reads as defensive, not as a plan hazard.
 *
 * If this fails, the filter has moved back above the join. Do not delete the assertion to make it
 * pass; move the predicate back onto the inner relation.
 */

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
const functionName = "public.read_site_content_public_records";

/** The body of the most recent migration that redefines the function — i.e. what is live. */
function latestDefinition(): { version: string; body: string } {
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  let latest: { version: string; body: string } | null = null;
  for (const name of files) {
    const sql = readFileSync(new URL(name, migrationsDir), "utf8");
    const start = sql.indexOf(`create or replace function ${functionName}(`);
    if (start === -1) continue;
    const end = sql.indexOf("$$;", start);
    expect(end).toBeGreaterThan(start);
    latest = { version: name, body: sql.slice(start, end + 3) };
  }
  if (!latest) throw new Error(`No migration defines ${functionName}.`);
  return latest;
}

describe("read_site_content_public_records keeps the kind filter where the planner can use it", () => {
  const { body } = latestDefinition();

  it("filters published records on the publication's own kind, inside the join", () => {
    expect(body).toContain("join public.site_content_publications p");
    expect(body).toContain("p.kind = p_kind");
    // An inner join is what makes that predicate pushable. The foreign key on
    // (target_publication_id, logical_id) guarantees it selects exactly the rows the old left join
    // did, so this is not a behaviour change dressed up as a performance one.
    expect(body).not.toContain("left join public.site_content_publications p");
  });

  it("no longer classifies kind over the nullable side of a join", () => {
    expect(body).not.toContain("coalesce(p.kind");
    expect(body).not.toContain("coalesce(p.slug");
  });

  it("does not filter on a computed kind in a later CTE", () => {
    expect(body).not.toMatch(/where\s+c\.kind\s*=\s*p_kind/);
  });

  it("still restricts the publication-less branch to retained bootstrap releases", () => {
    // The only rows the old WHERE admitted with a null target_publication_id. Losing this would
    // expose unpublished release records, which is a correctness and governance failure, not a
    // performance one. Accept every retained epoch-zero identity so fresh replay (ddc94ecf) and
    // live DBs still holding e4a1dd29 / 91ceaa8d all keep serving bootstrap records.
    expect(body).toContain("rr.target_publication_id is null");
    expect(body).toContain("e4a1dd29-14f6-556c-8fb7-f4f947d8b846");
    expect(body).toContain("91ceaa8d-470c-5661-8ce6-980c2a1bb137");
    expect(body).toContain("ddc94ecf-3527-5b4d-846b-af5724b428ca");
  });

  it("keeps the security boundary the function is reachable through", () => {
    // Reachable by anon, so it must stay security definer with a pinned empty search_path.
    expect(body).toContain("security definer");
    expect(body).toContain("set search_path = ''");
  });
});
