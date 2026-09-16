import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { readCanonicalSiteContentRecords } from "@/lib/site-content/site-content-publication";

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const seed = { slug: "sertraline", record: { slug: "sertraline", name: "Sertraline" } };
const otherSeed = { slug: "lithium", record: { slug: "lithium", name: "Lithium" } };

function failingClient(error: Error) {
  return {
    rpc: vi.fn(async () => {
      throw error;
    }),
  };
}

/**
 * Regression cover for the 2026-09-15 Supabase edge incident: HTTP 520/521/522/525
 * responses from the project's Cloudflare front end returned an HTML error page
 * instead of a PostgREST body, the read threw, and the whole medication catalogue
 * answered 500 while a complete curated copy sat in process memory.
 */
describe("canonical site-content reads when the database is unreachable", () => {
  it("still throws by default, so publication and operator surfaces cannot silently degrade", async () => {
    await expect(
      readCanonicalSiteContentRecords({
        supabase: failingClient(new Error("fetch failed")),
        kind: "medication",
        slug: null,
        seeds: [seed],
      }),
    ).rejects.toThrow(/fetch failed/);
  });

  it("answers from the retained seeds when a caller opts in", async () => {
    const result = await readCanonicalSiteContentRecords({
      supabase: failingClient(new Error("Canonical site-content read failed: upstream connect error")),
      kind: "medication",
      slug: null,
      seeds: [seed, otherSeed],
      fallbackToSeedsOnUnavailable: true,
    });

    expect(result.source).toBe("seed_unavailable");
    expect(result.snapshot).toBeNull();
    expect(result.records).toEqual([seed, otherSeed]);
  });

  it("narrows the retained answer to the requested slug", async () => {
    const result = await readCanonicalSiteContentRecords({
      supabase: failingClient(new Error("upstream unavailable")),
      kind: "medication",
      slug: "lithium",
      seeds: [seed, otherSeed],
      fallbackToSeedsOnUnavailable: true,
    });

    expect(result.source).toBe("seed_unavailable");
    expect(result.records).toEqual([otherSeed]);
  });

  it("propagates an abort rather than treating a withdrawn request as an outage", async () => {
    const abort = new Error("The operation was aborted.");
    abort.name = "AbortError";

    await expect(
      readCanonicalSiteContentRecords({
        supabase: failingClient(abort),
        kind: "medication",
        slug: null,
        seeds: [seed],
        fallbackToSeedsOnUnavailable: true,
      }),
    ).rejects.toThrow(/aborted/);
  });

  it("never logs the upstream failure text, which can be a whole HTML error page", async () => {
    const { logger } = await import("@/lib/logger");
    const warn = vi.mocked(logger.warn);
    warn.mockClear();

    await readCanonicalSiteContentRecords({
      supabase: failingClient(new Error("<!DOCTYPE html><h2>What happened?</h2> Ray ID: abc123")),
      kind: "medication",
      slug: null,
      seeds: [seed],
      fallbackToSeedsOnUnavailable: true,
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls[0])).not.toMatch(/DOCTYPE|What happened|Ray ID/i);
  });
});

describe("routes that opt in to the retained snapshot", () => {
  const optedIn = ["src/app/api/medications/route.ts", "src/app/api/medications/[slug]/route.ts"];

  it("labels the degraded response and keeps it out of shared caches", () => {
    for (const route of optedIn) {
      const source = readFileSync(route, "utf8");
      expect(source).toContain("fallbackToSeedsOnUnavailable: true");
      expect(source).toContain('canonical.source === "seed_unavailable" ? { retainedSnapshot: true as const }');
      // `fixture` is what selects the public CDN cache policy. A retained answer must
      // never take it, or a one-hour s-maxage outlives the outage that caused it.
      expect(source).toContain('fixture: canonical.source === "seed_uninitialized"');
      expect(source).not.toContain('fixture: canonical.source === "seed_unavailable"');
    }
  });

  it("does not extend the opt-in to publication, reconciliation, or other registry surfaces", () => {
    const notOptedIn = [
      "src/app/api/registry/records/route.ts",
      "src/app/api/registry/records/[slug]/route.ts",
      "src/app/api/differentials/route.ts",
      "src/app/api/differentials/[slug]/route.ts",
      "src/app/api/differentials/presentations/[slug]/route.ts",
      "src/lib/universal-search.ts",
      "src/lib/site-content/differential-page-records.ts",
    ];
    for (const route of notOptedIn) {
      expect(readFileSync(route, "utf8")).not.toContain("fallbackToSeedsOnUnavailable");
    }
  });

  it("surfaces the retained state to the reader on both medication surfaces", () => {
    expect(readFileSync("src/components/clinical-dashboard/use-medication-catalog.ts", "utf8")).toMatch(
      /retainedSnapshot\?: boolean/,
    );
    for (const component of [
      "src/components/clinical-dashboard/medication-prescribing-workspace.tsx",
      "src/components/clinical-dashboard/medication-record-page.tsx",
    ]) {
      expect(readFileSync(component, "utf8")).toContain("RetainedSnapshotNotice");
    }
  });
});
