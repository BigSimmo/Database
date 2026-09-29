import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  sourceAuthorityForPublisher,
  sourceAuthorityIdentityForPublisher,
  sourceAuthorityIsRuntimeClassifiable,
} from "@/lib/source-authority-registry";

/**
 * The crisis and support lines verified by the 2026-09-25 WA psychiatry build,
 * registered on the owner's decision of 2026-09-26 (ledger #2TRAJA).
 *
 * The first two tests are the whole safety argument, as in
 * `tests/therapy-services-source-registration.test.ts`: each entry resolves a
 * jurisdiction for the catalogue and the acquisition gate, and is excluded by
 * construction from the runtime classification that steers retrieval.
 */
const CRISIS_LINE_PUBLISHERS = {
  "Lifeline Australia": "australian_national",
  "Suicide Call Back Service": "australian_national",
  "13YARN": "australian_national",
  "Legal Aid Western Australia": "wa",
  "TIS National": "australian_national",
} as const;

describe("crisis-line source authorities", () => {
  it("registers each publisher for catalogue identity only", () => {
    for (const publisher of Object.keys(CRISIS_LINE_PUBLISHERS)) {
      const identity = sourceAuthorityIdentityForPublisher(publisher);
      expect(identity, `${publisher} is not in the source authority register`).not.toBeNull();
      expect(identity!.catalogueIdentityOnly, `${publisher} must not be runtime classifiable`).toBe(true);
      expect(sourceAuthorityIsRuntimeClassifiable(identity!)).toBe(false);
      expect(sourceAuthorityForPublisher(publisher)).toBeNull();
    }
  });

  it("places each publisher in the jurisdiction its own identity implies", () => {
    for (const [publisher, scope] of Object.entries(CRISIS_LINE_PUBLISHERS)) {
      expect(sourceAuthorityIdentityForPublisher(publisher)!.scope).toBe(scope);
    }
  });

  it("resolves the issuer names the service records actually carry", () => {
    const aliases = [
      ["Lifeline", "lifeline-australia"],
      ["Department of Home Affairs (TIS National)", "tis-national"],
      ["Legal Aid WA", "legal-aid-wa"],
    ] as const;
    for (const [publisher, key] of aliases) {
      expect(sourceAuthorityIdentityForPublisher(publisher)?.key, `${publisher} did not resolve`).toBe(key);
    }
  });
});
