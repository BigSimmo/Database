import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  sourceAuthorityForPublisher,
  sourceAuthorityIdentityForPublisher,
  sourceAuthorityIsRuntimeClassifiable,
  sourceAuthorityRegistry,
} from "@/lib/source-authority-registry";

/**
 * WA service issuers registered on the owner's decision of 2026-09-26 (ledgers
 * #6X06YS, #YDENFM, #JHT39N). As in `tests/crisis-line-source-registration.test.ts`,
 * the first test is the safety argument: each resolves a WA jurisdiction for the
 * catalogue and the acquisition gate, and never reaches the runtime classification
 * that steers retrieval.
 */
const WA_SERVICE_ISSUERS = {
  "Ruah Community Services": "ruah-community-services",
  "St Vincent de Paul Society (WA) Inc": "st-vincent-de-paul-society-wa",
  "Youth Focus": "youth-focus",
  "Mental Health Advocacy Service": "mental-health-advocacy-service-wa",
} as const;

describe("WA service issuer authorities", () => {
  it("registers each issuer for catalogue identity only, in WA", () => {
    for (const [publisher, key] of Object.entries(WA_SERVICE_ISSUERS)) {
      const identity = sourceAuthorityIdentityForPublisher(publisher);
      expect(identity?.key, `${publisher} is not in the source authority register`).toBe(key);
      expect(identity!.scope).toBe("wa");
      expect(identity!.catalogueIdentityOnly, `${publisher} must not be runtime classifiable`).toBe(true);
      expect(sourceAuthorityIsRuntimeClassifiable(identity!)).toBe(false);
      expect(sourceAuthorityForPublisher(publisher)).toBeNull();
    }
  });

  it("resolves the issuer names the records actually carry", () => {
    const aliases = [
      ["Ruah", "ruah-community-services"],
      ["Vinnies WA", "st-vincent-de-paul-society-wa"],
      ["St Vincent de Paul Society (WA)", "st-vincent-de-paul-society-wa"],
    ] as const;
    for (const [publisher, key] of aliases) {
      expect(sourceAuthorityIdentityForPublisher(publisher)?.key, `${publisher} did not resolve`).toBe(key);
    }
  });

  it("registers each key and code exactly once", () => {
    for (const key of Object.values(WA_SERVICE_ISSUERS)) {
      expect(sourceAuthorityRegistry.filter((entry) => entry.key === key)).toHaveLength(1);
    }
    for (const code of ["RUAH", "SVDPWA", "YOUTHFOCUS", "MHASWA"]) {
      expect(sourceAuthorityRegistry.filter((entry) => entry.codes.includes(code))).toHaveLength(1);
    }
  });
});
