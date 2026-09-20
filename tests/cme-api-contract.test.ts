import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { cmeEntryCreateSchema, cmeEntryUpdateSchema, cmeListQuerySchema } from "@/lib/cme/schemas";

const routePaths = [
  "src/app/api/cme/entries/route.ts",
  "src/app/api/cme/entries/[id]/route.ts",
  "src/app/api/cme/year/route.ts",
] as const;

const routes = routePaths.map((path) => ({ path, source: readFileSync(path, "utf8") }));
const list = routes[0]!.source;
const detail = routes[1]!.source;
const year = routes[2]!.source;

describe("the CME API", () => {
  for (const { path, source } of routes) {
    it(`${path} takes the owner from the session, never the request`, () => {
      expect(source).toMatch(/requireAuthenticatedUser\(/);
      expect(source).not.toMatch(/body\.(owner_id|ownerId)/);
      expect(source).not.toMatch(/searchParams\.get\("owner/);
    });

    it(`${path} refuses writes in demo mode rather than faking them`, () => {
      if (!/export async function (POST|PATCH|DELETE|PUT)/.test(source)) return;
      expect(source).toMatch(/isDemoMode\(\)/);
      expect(source).toMatch(/demo_mode_unavailable/);
    });

    it(`${path} rate-limits under the "cme" bucket, never a copy-pasted "on_call" one`, () => {
      if (!/consumeSubjectApiRateLimit/.test(source)) return;
      expect(source).toMatch(/bucket:\s*"cme"/);
      expect(source).not.toMatch(/bucket:\s*"on_call"/);
    });

    it(`${path} exports only names Next.js's App Router recognises on a route file`, () => {
      // The full recognised set for a route.ts (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md):
      // the seven HTTP method handlers, the route-segment-config scalars, and generateStaticParams.
      // Anything else — a schema, a helper, a type — must live in a separate module: an extra
      // export here is exactly the shape of mistake that would make `cmeYearConfirmSchema` (or a
      // future helper) importable straight from a route file instead of from `@/lib/cme/schemas.ts`.
      const NEXT_ROUTE_EXPORTS = new Set([
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "HEAD",
        "OPTIONS",
        "dynamic",
        "dynamicParams",
        "revalidate",
        "fetchCache",
        "runtime",
        "preferredRegion",
        "maxDuration",
        "generateStaticParams",
      ]);

      const exportedNames = new Set<string>();
      for (const match of source.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)) {
        exportedNames.add(match[1]!);
      }
      for (const match of source.matchAll(/^export\s+const\s+(\w+)/gm)) {
        exportedNames.add(match[1]!);
      }
      for (const match of source.matchAll(/^export\s*\{([^}]+)\}/gm)) {
        for (const entry of match[1]!.split(",")) {
          const name = entry.trim().split(/\s+as\s+/)[0]?.trim();
          if (name) exportedNames.add(name);
        }
      }

      // Fails closed: every one of these three route files exports at least `runtime` plus one
      // HTTP method today. If a refactor ever left a file with no top-level export at all, this
      // stops silently passing on an empty set.
      expect(exportedNames.size).toBeGreaterThan(0);
      for (const name of exportedNames) {
        expect(
          NEXT_ROUTE_EXPORTS.has(name),
          `${path} exports "${name}", which Next.js does not recognise on a route file`,
        ).toBe(true);
      }
    });
  }

  /**
   * Every `cme_*` table access in every route is scoped by `owner_id`, on the same query chain
   * as its `.from()` call — either an `.eq("owner_id", …)` filter (a read/update/delete) or an
   * inline `owner_id: …` key in the write payload (an insert/upsert) — so a query can never be
   * misread by looking at the `.from()` call alone without also seeing how it is scoped.
   *
   * One documented exception: `replaceCmeAllocations`'s `.from("cme_allocations").insert(allocationRows)`
   * (entries/[id]/route.ts) scopes ownership through the row payload itself, built one statement
   * above (`allocationRows = allocations.map((allocation) => ({ owner_id: ownerId, … }))`) — the
   * same "a write is scoped by what it writes" idiom `insertCmeEntry` uses in the repository —
   * rather than an inline `.eq()`/`owner_id:` inside the chain text itself. Verified separately
   * below rather than silently excluded.
   */
  it("scopes every cme_* query in every route by owner_id, on the same chain as .from()", () => {
    const chains = routes.flatMap(({ path, source }) =>
      [...source.matchAll(/\.from\("cme_\w+"\)([\s\S]*?)(?:;\n|\n\n)/g)].map((match) => ({
        path,
        chainTail: match[1]!,
      })),
    );
    // Fails closed: if every `.from("cme_...")` call in these routes ever moved into the
    // repository, this would stop testing anything without anyone noticing.
    expect(chains.length).toBeGreaterThan(0);

    const chainsRequiringInlineScope = chains.filter(({ chainTail }) => !/\.insert\(allocationRows\)/.test(chainTail));
    expect(chainsRequiringInlineScope.length).toBeGreaterThan(0);
    for (const { path, chainTail } of chainsRequiringInlineScope) {
      const scoped = /\.eq\(\s*["']owner_id["']/.test(chainTail) || /\bowner_id\s*:/.test(chainTail);
      expect(scoped, `${path}: a .from("cme_...") chain has no owner_id scope: ${chainTail.slice(0, 160)}`).toBe(true);
    }
  });

  it("scopes the one documented exception — the cme_allocations insert — through its row payload", () => {
    expect(detail).toMatch(/allocationRows = allocations\.map\(\(allocation\) => \(\{\s*\n\s*owner_id: ownerId,/);
    expect(detail).toMatch(/\.from\("cme_allocations"\)\s*\n\s*\.insert\(allocationRows\)/);
  });
});

describe("CME entry [id] route", () => {
  it("returns 404 identically for a missing id and an id owned by someone else", () => {
    expect(detail).toContain("CME entry not found.");
    // Three not-found branches — the PATCH pre-check, the PATCH update, and the DELETE — each
    // fed by a query already scoped by id AND owner_id on the same chain. None of them ever
    // learns whether the id was missing or just belongs to another owner, so none of them can
    // leak that distinction to the caller as a 403-vs-404 oracle.
    expect(detail.match(/CME entry not found\./g)?.length).toBe(3);
  });

  it("never carries a 403 or a wrong-owner-specific status a caller could use to tell the two cases apart", () => {
    expect(detail).not.toMatch(/\b403\b/);
    expect(detail).not.toMatch(/forbidden/i);
  });

  it("validates linked routine/document IDs are not yet checked for ownership — and says so, twice", () => {
    // Fix 3 (recorded, not implemented): both acceptance points carry the same explicit
    // not-checked/why-safe/what-would-break-it comment, so a future author cannot miss it.
    for (const source of [list, detail]) {
      expect(source).toMatch(/NOT CHECKED: that `routineId`\/`documentId` belong to this owner\./);
      expect(source).toMatch(/cross-tenant existence oracle/);
    }
  });
});

describe("CME entry PATCH schema (cmeEntryUpdateSchema)", () => {
  const completeBody = {
    date: "2026-03-01",
    title: "Grand round: catatonia",
    allocations: [{ category: "educational" as const, hours: 1.5 }],
    reflection: "Reviewed diagnostic criteria and bedside screening.",
    costCents: 0,
    routineId: null,
    documentId: null,
    buckets: [] as string[],
  };

  it("accepts a complete PATCH body", () => {
    const result = cmeEntryUpdateSchema.safeParse(completeBody);
    expect(result.success).toBe(true);
  });

  it("rejects a PATCH body that omits reflection instead of silently defaulting it to empty", () => {
    const withoutReflection: Record<string, unknown> = { ...completeBody };
    delete withoutReflection.reflection;
    const result = cmeEntryUpdateSchema.safeParse(withoutReflection);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "reflection")).toBe(true);
    }
  });

  it("rejects a PATCH body that omits any other defaulted field, not only reflection", () => {
    // This is exactly the bug Fix 1 closes: `cmeEntryCreateSchema` on its own would silently
    // default every one of these fields, discarding the owner's reflection text, recorded cost,
    // routine/document link, and buckets on a partial save. `cmeEntryUpdateSchema` must reject
    // instead.
    for (const field of ["costCents", "routineId", "documentId", "buckets"] as const) {
      const partial: Record<string, unknown> = { ...completeBody };
      delete partial[field];
      const result = cmeEntryUpdateSchema.safeParse(partial);
      expect(result.success, `omitting ${field} should be rejected`).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.join(".") === field), `${field} should be the failing path`).toBe(
          true,
        );
      }
    }
  });

  it("still rejects the same shape violations cmeEntryCreateSchema rejects", () => {
    expect(cmeEntryUpdateSchema.safeParse({ ...completeBody, title: "" }).success).toBe(false);
    expect(cmeEntryUpdateSchema.safeParse({ ...completeBody, date: "01-03-2026" }).success).toBe(false);
    expect(cmeEntryUpdateSchema.safeParse({ ...completeBody, allocations: [] }).success).toBe(false);
  });
});

describe("CME entry POST/PATCH shared schema (cmeEntryCreateSchema)", () => {
  const minimal = {
    date: "2026-01-15",
    title: "Journal club",
    allocations: [{ category: "reviewing" as const, hours: 1 }],
  };

  it("accepts a minimal create body and defaults every field a caller omitted", () => {
    const result = cmeEntryCreateSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reflection).toBe("");
      expect(result.data.costCents).toBeNull();
      expect(result.data.routineId).toBeNull();
      expect(result.data.documentId).toBeNull();
      expect(result.data.buckets).toEqual([]);
    }
  });

  it("rejects a body missing a required field", () => {
    const { title: _title, ...withoutTitle } = minimal;
    expect(cmeEntryCreateSchema.safeParse(withoutTitle).success).toBe(false);
    const { date: _date, ...withoutDate } = minimal;
    expect(cmeEntryCreateSchema.safeParse(withoutDate).success).toBe(false);
  });

  it("rejects a date that is not a Perth calendar date", () => {
    expect(cmeEntryCreateSchema.safeParse({ ...minimal, date: "15/01/2026" }).success).toBe(false);
    expect(cmeEntryCreateSchema.safeParse({ ...minimal, date: "2026-1-15" }).success).toBe(false);
  });

  it("rejects zero and more-than-three category allocations", () => {
    expect(cmeEntryCreateSchema.safeParse({ ...minimal, allocations: [] }).success).toBe(false);
    expect(
      cmeEntryCreateSchema.safeParse({
        ...minimal,
        allocations: [
          { category: "educational", hours: 1 },
          { category: "reviewing", hours: 1 },
          { category: "measuring", hours: 1 },
          { category: "educational", hours: 1 },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects non-positive allocation hours and an unknown category", () => {
    expect(cmeEntryCreateSchema.safeParse({ ...minimal, allocations: [{ category: "reviewing", hours: 0 }] }).success).toBe(
      false,
    );
    expect(
      cmeEntryCreateSchema.safeParse({ ...minimal, allocations: [{ category: "unknown", hours: 1 }] }).success,
    ).toBe(false);
  });

  it("rejects a negative cost and a non-UUID routine or document id", () => {
    expect(cmeEntryCreateSchema.safeParse({ ...minimal, costCents: -1 }).success).toBe(false);
    expect(cmeEntryCreateSchema.safeParse({ ...minimal, routineId: "not-a-uuid" }).success).toBe(false);
    expect(cmeEntryCreateSchema.safeParse({ ...minimal, documentId: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects more than eight buckets and an empty bucket string", () => {
    expect(
      cmeEntryCreateSchema.safeParse({ ...minimal, buckets: Array.from({ length: 9 }, (_, i) => `bucket-${i}`) })
        .success,
    ).toBe(false);
    expect(cmeEntryCreateSchema.safeParse({ ...minimal, buckets: [""] }).success).toBe(false);
  });
});

describe("CME list query schema (cmeListQuerySchema, shared by GET on entries and year)", () => {
  it("accepts an absent year and a valid year coerced from a query string", () => {
    expect(cmeListQuerySchema.safeParse({}).success).toBe(true);
    const result = cmeListQuerySchema.safeParse({ year: "2026" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.year).toBe(2026);
  });

  it("rejects a year outside 2000-2100 and a non-numeric year", () => {
    expect(cmeListQuerySchema.safeParse({ year: "1999" }).success).toBe(false);
    expect(cmeListQuerySchema.safeParse({ year: "2101" }).success).toBe(false);
    expect(cmeListQuerySchema.safeParse({ year: "not-a-year" }).success).toBe(false);
  });
});

describe("CME year route PUT schema (cmeYearConfirmSchema, local to the route)", () => {
  // `cmeYearConfirmSchema` is deliberately declared inside `src/app/api/cme/year/route.ts`
  // rather than exported from `@/lib/cme/schemas.ts` (see that route's own doc comment) — and it
  // must stay that way: the export test above would fail the moment a route file re-exported it.
  // This mirror reproduces the same constraints for accept/reject coverage; the fidelity test
  // right after it checks the route's actual source text still declares exactly these
  // constraints, so the mirror cannot silently drift from the real schema and end up testing a
  // shape the route no longer uses.
  const cmeYearConfirmSchemaMirror = z.object({
    year: z.number().int().min(2000).max(2100),
    totalHours: z.number().positive().max(500),
    confirmedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date."),
    confirmedSource: z.string().trim().min(1).max(200),
  });

  const validBody = {
    year: 2026,
    totalHours: 40,
    confirmedOn: "2026-01-01",
    confirmedSource: "AHPRA CPD homepage",
  };

  it("fidelity: the route's actual source still declares these same constraints", () => {
    expect(year).toMatch(/year:\s*z\.number\(\)\.int\(\)\.min\(2000\)\.max\(2100\)/);
    expect(year).toMatch(/totalHours:\s*z\.number\(\)\.positive\(\)\.max\(500\)/);
    expect(year).toMatch(/confirmedOn:\s*z\.string\(\)\.regex\(\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/, "Use a YYYY-MM-DD date\."\)/);
    expect(year).toMatch(/confirmedSource:\s*z\.string\(\)\.trim\(\)\.min\(1\)\.max\(200\)/);
  });

  it("accepts a complete confirmation body", () => {
    expect(cmeYearConfirmSchemaMirror.safeParse(validBody).success).toBe(true);
  });

  it("rejects a year outside 2000-2100, non-positive or too-large total hours, a malformed date, and an empty source", () => {
    expect(cmeYearConfirmSchemaMirror.safeParse({ ...validBody, year: 1999 }).success).toBe(false);
    expect(cmeYearConfirmSchemaMirror.safeParse({ ...validBody, totalHours: 0 }).success).toBe(false);
    expect(cmeYearConfirmSchemaMirror.safeParse({ ...validBody, totalHours: 501 }).success).toBe(false);
    expect(cmeYearConfirmSchemaMirror.safeParse({ ...validBody, confirmedOn: "01/01/2026" }).success).toBe(false);
    expect(cmeYearConfirmSchemaMirror.safeParse({ ...validBody, confirmedSource: "" }).success).toBe(false);
  });
});
