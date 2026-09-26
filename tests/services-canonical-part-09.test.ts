import { describe, expect, it } from "vitest";

import { canonicalServiceRecords, canonicalServiceValidationErrors } from "@/lib/service-governance";
import { sourceAuthorityIdentityForPublisher } from "@/lib/source-authority-registry";
import part09 from "@/lib/services-canonical-data/part-09";

const PART_09_IDS = ["SVC-LEG-002", "SVC-CHP-001"] as const;

describe("part-09 WA service records written 2026-09-26", () => {
  it("contains exactly the records written in this batch", () => {
    expect(part09.map((record) => record.id).sort()).toEqual([...PART_09_IDS].sort());
  });

  it("passes the shared governance validation and keeps IDs unique across every part", () => {
    expect(canonicalServiceValidationErrors(canonicalServiceRecords())).toEqual([]);
    const allIds = canonicalServiceRecords().map((record) => record.id);
    for (const id of PART_09_IDS) expect(allIds.filter((candidate) => candidate === id)).toHaveLength(1);
  });

  it("cites a dated page from a publisher the authority register already knows", () => {
    // Every issuer here resolves without a new register entry. Ruah, Vinnies and Youth Focus
    // do not, which is why their records are not in this batch (#6X06YS, #YDENFM).
    for (const record of part09) {
      expect(record.sources.length).toBeGreaterThan(0);
      for (const source of record.sources) {
        expect(source.url).toMatch(/^https:\/\//);
        expect(source.date.trim()).not.toBe("");
        expect(sourceAuthorityIdentityForPublisher(source.issuer), source.issuer).not.toBeNull();
      }
    }
  });

  it("does not invent hours the source page does not state", () => {
    const links = part09.find((record) => record.id === "SVC-LEG-002");
    expect(links?.hours.verification_status).toBe("unable_to_verify");
    expect(links?.contacts.map((contact) => contact.value)).toContain("(08) 9218 4819");
  });
});
