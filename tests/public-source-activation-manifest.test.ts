import { describe, expect, it } from "vitest";

import { australianSourceCatalogue, australianSourcePolicyVersion } from "@/lib/australian-source-catalogue";
import {
  activationManifestDigest,
  canonicalizePublicSourcePolicyPayload,
  createPublicSourceActivationManifest,
  parsePublicSourceActivationManifest,
  publicSourcePolicyDigest,
} from "@/lib/public-source-activation-manifest";

const operatorId = "11111111-1111-4111-8111-111111111111";

function manifestInput(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    sourcePolicyVersion: australianSourcePolicyVersion,
    sourcePolicyDigest: publicSourcePolicyDigest,
    catalogueKey: "wa-health",
    decision: "activate",
    operatorId,
    reason: "Approved for controlled acquisition after policy review.",
    evidenceReferences: ["legal-review:WAH-2026-08"],
    ...overrides,
  };
}

describe("public source activation manifests", () => {
  it("pins the canonical policy digest to the exact governed catalogue", () => {
    expect(publicSourcePolicyDigest).toBe("93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f");
  });

  it("canonicalizes object keys, source keys, set-like roles, and NFC strings deterministically", () => {
    const sourceA = { ...australianSourceCatalogue[0], key: "a", roles: ["service_policy"] };
    const sourceZ = {
      ...australianSourceCatalogue[1],
      key: "z",
      publisher: "policy-e\u0301",
      roles: ["safety_alert", "legal"],
    };
    const forward = {
      version: 1,
      sourcePolicyVersion: australianSourcePolicyVersion,
      sources: [sourceZ, sourceA],
    };
    const reordered = {
      sources: [{ ...sourceA }, { ...sourceZ, publisher: "policy-\u00e9", roles: ["legal", "safety_alert"] }],
      sourcePolicyVersion: australianSourcePolicyVersion,
      version: 1,
    };

    expect(canonicalizePublicSourcePolicyPayload(forward)).toBe(canonicalizePublicSourcePolicyPayload(reordered));
  });

  it("rejects duplicate set-like source roles without changing the pinned catalogue digest", () => {
    const source = { ...australianSourceCatalogue[0], roles: ["legal", "legal"] };
    expect(() =>
      canonicalizePublicSourcePolicyPayload({
        version: 1,
        sourcePolicyVersion: australianSourcePolicyVersion,
        sources: [source],
      }),
    ).toThrow(/role.*unique|duplicate.*role/i);
    expect(publicSourcePolicyDigest).toBe("93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f");
  });

  it.each([
    ["missing", { version: 1, sourcePolicyVersion: australianSourcePolicyVersion }],
    [
      "extra",
      {
        version: 1,
        sourcePolicyVersion: australianSourcePolicyVersion,
        sources: [],
        unexpected: true,
      },
    ],
    [
      "non-finite",
      { version: 1, sourcePolicyVersion: australianSourcePolicyVersion, sources: [{ fallbackRank: Number.NaN }] },
    ],
  ])("rejects %s canonical policy payload values", (_label, payload) => {
    expect(() => canonicalizePublicSourcePolicyPayload(payload)).toThrow(/canonical policy|finite|shape/i);
  });

  it("creates a strict activation manifest with the exact policy identity and evidence", () => {
    const manifest = createPublicSourceActivationManifest(manifestInput());

    expect(manifest).toEqual(manifestInput());
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.evidenceReferences)).toBe(true);
    expect(activationManifestDigest(manifest)).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ["unknown", "healthdirect"],
    ["historical", "nps-medicinewise"],
    ["link-only", "etg-complete"],
    ["index-forbidden", "nps-medicinewise"],
  ])("rejects activate for a %s catalogue definition", (_label, catalogueKey) => {
    expect(() => createPublicSourceActivationManifest(manifestInput({ catalogueKey }))).toThrow(
      /active catalogue|historical|link-only|licence/i,
    );
  });

  it("allows quarantine and retire records without treating them as fetch authority", () => {
    expect(
      createPublicSourceActivationManifest(manifestInput({ catalogueKey: "healthdirect", decision: "quarantine" })),
    ).toMatchObject({ catalogueKey: "healthdirect", decision: "quarantine" });
    expect(
      createPublicSourceActivationManifest(manifestInput({ catalogueKey: "nps-medicinewise", decision: "retire" })),
    ).toMatchObject({ catalogueKey: "nps-medicinewise", decision: "retire" });
  });

  it("strictly rejects policy drift, duplicate evidence, and extra manifest fields", () => {
    expect(() =>
      parsePublicSourceActivationManifest({ ...manifestInput(), sourcePolicyDigest: "0".repeat(64) }),
    ).toThrow(/policy digest/i);
    expect(() =>
      parsePublicSourceActivationManifest({
        ...manifestInput(),
        evidenceReferences: ["legal-review:1", "legal-review:1"],
      }),
    ).toThrow(/evidence.*unique/i);
    expect(() => parsePublicSourceActivationManifest({ ...manifestInput(), extra: "not allowed" })).toThrow();
  });

  it("keeps the digest stable across the catalogue's current raw ordering", () => {
    expect(australianSourceCatalogue).toHaveLength(21);
    expect(
      canonicalizePublicSourcePolicyPayload({
        version: 1,
        sourcePolicyVersion: australianSourcePolicyVersion,
        sources: australianSourceCatalogue,
      }),
    ).toContain('"sourcePolicyVersion":"australian-source-policy-v1"');
  });
});
