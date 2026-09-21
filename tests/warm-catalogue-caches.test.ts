import { afterEach, describe, expect, it, vi } from "vitest";

import { clearCatalogueSeedFallbackCooldown } from "@/lib/site-content/catalogue-seed-fallback";
import { clearSiteContentRecordCache } from "@/lib/site-content/site-content-record-cache";
import {
  catalogueSearchWarmKinds,
  warmCanonicalCatalogueSearchCaches,
} from "@/lib/site-content/warm-catalogue-caches";

const { readCanonicalSiteContentRecords, markCatalogueProcessConnectionWarmed } = vi.hoisted(() => ({
  readCanonicalSiteContentRecords: vi.fn(),
  markCatalogueProcessConnectionWarmed: vi.fn(),
}));

vi.mock("@/lib/site-content/site-content-publication", () => ({
  readCanonicalSiteContentRecords,
}));

vi.mock("@/lib/site-content/catalogue-seed-fallback", async () => {
  const actual = await vi.importActual<typeof import("@/lib/site-content/catalogue-seed-fallback")>(
    "@/lib/site-content/catalogue-seed-fallback",
  );
  return {
    ...actual,
    markCatalogueProcessConnectionWarmed,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ mocked: true }),
}));

afterEach(() => {
  vi.clearAllMocks();
  clearCatalogueSeedFallbackCooldown();
  clearSiteContentRecordCache();
});

describe("warmCanonicalCatalogueSearchCaches", () => {
  it("warms form, service and medication serially and marks the process warm on success", async () => {
    const order: string[] = [];
    readCanonicalSiteContentRecords.mockImplementation(async ({ kind }: { kind: string }) => {
      order.push(`start:${kind}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push(`end:${kind}`);
      return { records: [], source: "canonical_public", snapshot: null };
    });

    await warmCanonicalCatalogueSearchCaches({} as never);

    expect(catalogueSearchWarmKinds).toEqual(["form", "service", "medication"]);
    expect(order).toEqual([
      "start:form",
      "end:form",
      "start:service",
      "end:service",
      "start:medication",
      "end:medication",
    ]);
    expect(markCatalogueProcessConnectionWarmed).toHaveBeenCalledTimes(3);
  });

  it("continues through a failed kind rather than aborting the warm", async () => {
    readCanonicalSiteContentRecords
      .mockRejectedValueOnce(new Error("form boom"))
      .mockResolvedValue({ records: [], source: "canonical_public", snapshot: null });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await warmCanonicalCatalogueSearchCaches({} as never);

    expect(readCanonicalSiteContentRecords).toHaveBeenCalledTimes(3);
    expect(markCatalogueProcessConnectionWarmed).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
