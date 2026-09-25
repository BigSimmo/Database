import { describe, expect, it } from "vitest";

import {
  canonicalServiceRecords,
  canonicalServiceValidationErrors,
  mergeCanonicalCatalogServices,
} from "@/lib/service-governance";
import { normalizeCatalogService } from "@/lib/service-catalog";
import part08 from "@/lib/services-canonical-data/part-08";

const PART_08_IDS = ["SVC-LEG-001", "SVC-INT-001", "SVC-ABO-005", "SVC-REG-005", "SVC-REG-007", "SVC-REG-008"] as const;

describe("part-08 new WA service records", () => {
  it("contains exactly the new country/Aboriginal/specialty records, with no other part's IDs", () => {
    const ids = part08.map((record) => record.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual([...PART_08_IDS].sort());
  });

  it("passes the same governance validation as every other canonical part", () => {
    // canonicalServiceRecords() returns the aggregated dataset (all parts, including part-08,
    // as wired into src/lib/service-governance.ts). If part-08 broke the shared invariants —
    // a duplicate ID, a missing name, a malformed date, a missing/invalid source URL, or a
    // tier A record missing an urgent contact — this would report it, exactly as it would for
    // any other part.
    const errors = canonicalServiceValidationErrors(canonicalServiceRecords());
    expect(errors).toEqual([]);
  });

  it("has IDs that are unique across the whole aggregated canonical dataset (all parts)", () => {
    const allIds = canonicalServiceRecords().map((record) => record.id);
    for (const id of PART_08_IDS) {
      expect(allIds.filter((candidate) => candidate === id)).toHaveLength(1);
    }
  });

  it("cites at least one source per record, each with a real official URL", () => {
    for (const record of part08) {
      expect(record.sources.length).toBeGreaterThan(0);
      for (const source of record.sources) {
        expect(source.url).toMatch(/^https:\/\//);
        expect(source.id.trim()).not.toBe("");
        expect(source.issuer.trim()).not.toBe("");
      }
    }
  });

  it("only marks a record active/verified_current_core when it carries today's verification date", () => {
    for (const record of part08) {
      if (record.status === "active") {
        expect(record.verification).toBe("verified_current_core");
        expect(record.verified).toBe("2026-09-25");
      }
    }
  });

  it("does not duplicate the KEMH Mother Baby Unit or PCH Eating Disorders records already in part-05", () => {
    const names = part08.map((record) => record.name.toLowerCase());
    expect(names.some((name) => name.includes("kemh") && name.includes("mother"))).toBe(false);
    expect(names.some((name) => name.includes("eating disorders"))).toBe(false);
  });

  it("merges cleanly into the catalog alongside an empty legacy catalogue, surfacing every part-08 record", () => {
    const merged = mergeCanonicalCatalogServices([]);
    const stableIds = new Set(merged.map((service) => service.stable_id));
    for (const id of PART_08_IDS) {
      expect(stableIds.has(id)).toBe(true);
    }
  });

  it("supersedes the known legacy Goldfields adult mental health record by match key", () => {
    const legacyGoldfields = normalizeCatalogService(
      {
        id: "S060",
        name: "Goldfields Adult Mental Health Service",
        canonical_name_key: "goldfields-adult-mental-health-service",
      },
      0,
    );
    // mergeCanonicalCatalogServices appends every other unmatched canonical record from the
    // whole aggregated dataset (all parts) as its own new service, so the result is not just
    // the one legacy record passed in — only the merged Goldfields entry itself is asserted on.
    const merged = mergeCanonicalCatalogServices([legacyGoldfields]);
    const mergedGoldfields = merged.find((service) => service.id === "S060");
    expect(mergedGoldfields?.stable_id).toBe("SVC-REG-005");
  });
});
