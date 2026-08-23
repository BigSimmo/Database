import { describe, expect, it } from "vitest";

import {
  assertRecoveryReadinessForOperation,
  createActivationReceipt,
  createRollbackReceipt,
  parseActivationReceipt,
  parseRecoveryReadinessEvidence,
  parseRollbackReceipt,
  recoveryReadinessDigest,
  type RecoveryReadinessEvidence,
} from "@/lib/recovery-readiness-evidence";
import { runRecoveryReadinessEvidenceCli } from "../scripts/verify-recovery-readiness-evidence";

const now = new Date("2026-08-24T12:00:00.000Z");
const projectRef = "offline-project-ref";

function evidenceInput(overrides: Record<string, unknown> = {}) {
  const governed = {
    version: "recovery-readiness-evidence-v1" as const,
    projectRef,
    operation: "document_generation" as const,
    issuedAt: "2026-08-24T11:30:00.000Z",
    validUntil: "2026-08-24T13:00:00.000Z",
    database: {
      evidenceId: "database-evidence-2026-08-24",
      recoveryMode: "pitr" as const,
      observedAt: "2026-08-24T11:20:00.000Z",
      latestRecoveryPointAt: "2026-08-24T11:15:00.000Z",
      maximumAgeSeconds: 3_600,
      maximumRpoSeconds: 900,
      restorable: true as const,
    },
    storage: {
      evidenceId: "storage-evidence-2026-08-24",
      recoveryMode: "versioned_backup" as const,
      observedAt: "2026-08-24T11:20:00.000Z",
      latestRecoveryPointAt: "2026-08-24T11:10:00.000Z",
      maximumAgeSeconds: 3_600,
      maximumRpoSeconds: 1_800,
      recoverable: true as const,
    },
    restoreDrill: {
      evidenceId: "restore-drill-evidence-2026-08",
      drillId: "isolated-drill-2026-08",
      completedAt: "2026-08-20T09:00:00.000Z",
      maximumAgeSeconds: 2_592_000,
      environment: "isolated" as const,
      databaseRestored: true as const,
      storageRestored: true as const,
      integrityDigest: "a".repeat(64),
      outcome: "succeeded" as const,
    },
    ...overrides,
  };
  return { ...governed, digest: recoveryReadinessDigest(governed) };
}

function parsedEvidence(overrides: Record<string, unknown> = {}) {
  return parseRecoveryReadinessEvidence(evidenceInput(overrides));
}

describe("recovery readiness evidence", () => {
  it("strictly parses a bounded exact-shape artifact and freezes the value", () => {
    const parsed = parsedEvidence();

    expect(parsed).toEqual(evidenceInput());
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.database)).toBe(true);
    expect(() =>
      parseRecoveryReadinessEvidence({ ...evidenceInput(), rawProviderPayload: { backupNames: ["private"] } }),
    ).toThrow(/missing, extra, or invalid shape/i);
    expect(() =>
      parseRecoveryReadinessEvidence({
        ...evidenceInput(),
        database: { ...evidenceInput().database, providerResponse: "private-content" },
      }),
    ).toThrow(/missing, extra, or invalid shape/i);
  });

  it("uses versioned code-unit canonicalization for a deterministic SHA-256 digest", () => {
    const first = evidenceInput();
    const reordered = {
      restoreDrill: first.restoreDrill,
      storage: first.storage,
      database: first.database,
      validUntil: first.validUntil,
      issuedAt: first.issuedAt,
      operation: first.operation,
      projectRef: first.projectRef,
      version: first.version,
    };

    expect(recoveryReadinessDigest(reordered)).toBe(first.digest);
    expect(first.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(() => parseRecoveryReadinessEvidence({ ...first, digest: "0".repeat(64) })).toThrow(/digest/i);
  });

  it.each([
    ["absent database evidence", { database: undefined }],
    ["absent Storage evidence", { storage: undefined }],
    ["absent restore drill", { restoreDrill: undefined }],
    ["invalid issued timestamp", { issuedAt: "24 August 2026" }],
    ["non-canonical timestamp", { issuedAt: "2026-08-24T11:30:00Z" }],
  ])("rejects %s", (_label, overrides) => {
    expect(() => parseRecoveryReadinessEvidence(evidenceInput(overrides))).toThrow();
  });

  it("requires exact project and operation binding", () => {
    const evidence = parsedEvidence();

    expect(() => assertRecoveryReadinessForOperation(evidence, "site_release", projectRef, { now: () => now })).toThrow(
      /operation/i,
    );
    expect(() =>
      assertRecoveryReadinessForOperation(evidence, "document_generation", "different-project", {
        now: () => now,
      }),
    ).toThrow(/project/i);
    expect(assertRecoveryReadinessForOperation(evidence, "document_generation", projectRef, { now: () => now })).toBe(
      evidence,
    );
  });

  it("rejects absent, stale, future, and overlong evidence windows", () => {
    expect(() =>
      assertRecoveryReadinessForOperation(
        parsedEvidence({ issuedAt: "2026-08-24T12:01:00.000Z" }),
        "document_generation",
        projectRef,
        {
          now: () => now,
        },
      ),
    ).toThrow(/future/i);
    expect(() =>
      assertRecoveryReadinessForOperation(
        parsedEvidence({ validUntil: "2026-08-24T11:59:59.000Z" }),
        "document_generation",
        projectRef,
        {
          now: () => now,
        },
      ),
    ).toThrow(/expired|stale/i);
    expect(() =>
      assertRecoveryReadinessForOperation(
        parsedEvidence({ validUntil: "2026-08-26T11:30:00.000Z" }),
        "document_generation",
        projectRef,
        {
          now: () => now,
        },
      ),
    ).toThrow(/validity window/i);
  });

  it("enforces separate database PITR and Storage RPO freshness", () => {
    const base = evidenceInput();
    const staleDatabase = parsedEvidence({
      database: { ...base.database, observedAt: "2026-08-24T10:59:59.000Z" },
    });
    const futureStorage = parsedEvidence({
      storage: { ...base.storage, observedAt: "2026-08-24T12:00:01.000Z" },
    });
    const missedDatabaseRpo = parsedEvidence({
      database: { ...base.database, latestRecoveryPointAt: "2026-08-24T10:00:00.000Z" },
    });
    const missedStorageRpo = parsedEvidence({
      storage: { ...base.storage, latestRecoveryPointAt: "2026-08-24T10:00:00.000Z" },
    });

    expect(() =>
      assertRecoveryReadinessForOperation(staleDatabase, "document_generation", projectRef, { now: () => now }),
    ).toThrow(/database.*stale/i);
    expect(() =>
      assertRecoveryReadinessForOperation(futureStorage, "document_generation", projectRef, { now: () => now }),
    ).toThrow(/storage.*future/i);
    expect(() =>
      assertRecoveryReadinessForOperation(missedDatabaseRpo, "document_generation", projectRef, { now: () => now }),
    ).toThrow(/database.*RPO/i);
    expect(() =>
      assertRecoveryReadinessForOperation(missedStorageRpo, "document_generation", projectRef, { now: () => now }),
    ).toThrow(/storage.*RPO/i);
  });

  it("requires a current successful isolated database-and-Storage restore drill", () => {
    const base = evidenceInput();
    for (const restoreDrill of [
      { ...base.restoreDrill, environment: "production" },
      { ...base.restoreDrill, databaseRestored: false },
      { ...base.restoreDrill, storageRestored: false },
      { ...base.restoreDrill, outcome: "failed" },
    ]) {
      expect(() => parseRecoveryReadinessEvidence(evidenceInput({ restoreDrill }))).toThrow();
    }
    const stale = parsedEvidence({
      restoreDrill: { ...base.restoreDrill, completedAt: "2026-07-24T11:59:59.000Z" },
    });
    expect(() =>
      assertRecoveryReadinessForOperation(stale, "document_generation", projectRef, { now: () => now }),
    ).toThrow(/restore drill.*stale/i);
  });

  it("requires independently identified database, Storage, and restore-drill evidence", () => {
    const base = evidenceInput();
    expect(() =>
      parseRecoveryReadinessEvidence(
        evidenceInput({ storage: { ...base.storage, evidenceId: base.database.evidenceId } }),
      ),
    ).toThrow(/separate evidence identities/i);
    expect(() =>
      parseRecoveryReadinessEvidence(
        evidenceInput({ restoreDrill: { ...base.restoreDrill, evidenceId: base.database.evidenceId } }),
      ),
    ).toThrow(/separate evidence identities/i);
  });
});

describe("activation and rollback receipts", () => {
  function documentActivation(evidence: RecoveryReadinessEvidence = parsedEvidence()) {
    return createActivationReceipt(
      {
        promotionId: "document-generation:promotion-42",
        activatedAt: "2026-08-24T12:00:00.000Z",
        resource: {
          kind: "document_generation",
          documentId: "document-42",
          generationId: "generation-current",
          generationDigest: "b".repeat(64),
          previousGenerationId: "generation-previous",
          previousGenerationDigest: "c".repeat(64),
        },
        evidence,
        expectedProjectRef: projectRef,
      },
      { now: () => now },
    );
  }

  it("creates deterministic immutable activation receipts bound to evidence and promotion identity", () => {
    const first = documentActivation();
    const second = documentActivation();

    expect(second).toEqual(first);
    expect(first.receiptId).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(first.recoveryReadinessDigest).toBe(parsedEvidence().digest);
    expect(Object.isFrozen(first.resource)).toBe(true);
    expect(() =>
      parseActivationReceipt({ ...first, receiptId: `sha256:${"0".repeat(64)}` }, { now: () => now }),
    ).toThrow(/receipt identity/i);
    expect(() =>
      parseActivationReceipt({ ...first, activatedAt: "2026-08-24T12:01:00.000Z" }, { now: () => now }),
    ).toThrow(/future|receipt identity/i);
    expect(() =>
      createActivationReceipt(
        {
          promotionId: " document-generation:promotion-42",
          activatedAt: "2026-08-24T12:00:00.000Z",
          resource: first.resource,
          evidence: parsedEvidence(),
          expectedProjectRef: projectRef,
        },
        { now: () => now },
      ),
    ).toThrow(/promotion identity/i);
  });

  it("rejects missing previous-generation pointers and reconstruction-required rollback", () => {
    const evidence = parsedEvidence();
    expect(() =>
      createActivationReceipt(
        {
          promotionId: "document-generation:promotion-42",
          activatedAt: "2026-08-24T12:00:00.000Z",
          resource: {
            kind: "document_generation",
            documentId: "document-42",
            generationId: "generation-current",
            generationDigest: "b".repeat(64),
            previousGenerationDigest: "c".repeat(64),
          },
          evidence,
          expectedProjectRef: projectRef,
        },
        { now: () => now },
      ),
    ).toThrow(/previousGenerationId/i);

    const activation = documentActivation();
    expect(() =>
      createRollbackReceipt({
        activationReceipt: activation,
        rolledBackAt: "2026-09-01T00:00:00.000Z",
        method: "reconstructed",
        requiresReconstruction: true,
        outcome: "succeeded",
        target: {
          kind: "document_generation",
          documentId: "document-42",
          generationId: "generation-previous",
          generationDigest: "c".repeat(64),
        },
      }),
    ).toThrow(/reconstruction/i);
  });

  it("keeps site-release and document-generation promotion identities distinct", () => {
    const siteEvidence = parsedEvidence({ operation: "site_release" });
    const site = createActivationReceipt(
      {
        promotionId: "site-release:promotion-42",
        activatedAt: "2026-08-24T12:00:00.000Z",
        resource: {
          kind: "site_release",
          siteReleaseId: "site-release-current",
          siteReleaseDigest: "d".repeat(64),
          previousSiteReleaseId: "site-release-previous",
          previousSiteReleaseDigest: "e".repeat(64),
        },
        evidence: siteEvidence,
        expectedProjectRef: projectRef,
      },
      { now: () => now },
    );
    const document = documentActivation();

    expect(site.operation).toBe("site_release");
    expect(document.operation).toBe("document_generation");
    expect(site.promotionId).toMatch(/^site-release:/);
    expect(document.promotionId).toMatch(/^document-generation:/);
    expect(site.receiptId).not.toBe(document.receiptId);
    expect(() =>
      createActivationReceipt(
        {
          promotionId: "document-generation:promotion-42",
          activatedAt: "2026-08-24T12:00:00.000Z",
          resource: site.resource,
          evidence: siteEvidence,
          expectedProjectRef: projectRef,
        },
        { now: () => now },
      ),
    ).toThrow(/promotion identity/i);
  });

  it("proves rollback from the activation receipt after general readiness expires", () => {
    const activation = documentActivation();
    const rollback = createRollbackReceipt(
      {
        activationReceipt: activation,
        rolledBackAt: "2026-09-01T00:00:00.000Z",
        method: "retained_previous",
        requiresReconstruction: false,
        outcome: "succeeded",
        target: {
          kind: "document_generation",
          documentId: "document-42",
          generationId: "generation-previous",
          generationDigest: "c".repeat(64),
        },
      },
      { now: () => new Date("2026-09-01T00:00:00.000Z") },
    );

    expect(rollback.activationReceiptId).toBe(activation.receiptId);
    expect(rollback.receiptId).toMatch(/^sha256:[0-9a-f]{64}$/);
    const rollbackClock = { now: () => new Date("2026-09-01T00:00:00.000Z") };
    expect(parseRollbackReceipt(rollback, activation, rollbackClock)).toEqual(rollback);
    expect(() =>
      parseRollbackReceipt(
        { ...rollback, target: { ...rollback.target, generationId: "replacement" } },
        activation,
        rollbackClock,
      ),
    ).toThrow(/receipt identity|previous/i);
    expect(() =>
      createRollbackReceipt(
        { ...rollback, activationReceipt: activation, rolledBackAt: "2026-09-01T00:00:01.000Z" },
        { now: () => new Date("2026-09-01T00:00:00.000Z") },
      ),
    ).toThrow(/future/i);
  });
});

describe("recovery readiness evidence CLI", () => {
  it("emits only a bounded content-safe summary and redacts rejected artifact values", () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const artifact = JSON.stringify(evidenceInput());
    const passCode = runRecoveryReadinessEvidenceCli(
      ["--file", "evidence.json", "--operation", "document_generation", "--project-ref", projectRef],
      {
        readFile: () => artifact,
        now: () => now,
        stdout: (line) => stdout.push(line),
        stderr: (line) => stderr.push(line),
      },
    );

    expect(passCode).toBe(0);
    expect(JSON.parse(stdout.join(""))).toEqual({
      status: "pass",
      version: "recovery-readiness-evidence-v1",
      operation: "document_generation",
      projectRefDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      evidenceDigest: evidenceInput().digest,
      validUntil: "2026-08-24T13:00:00.000Z",
    });
    expect(stdout.join("\n")).not.toContain(projectRef);

    stdout.length = 0;
    const secretMarker = "PRIVATE-PROVIDER-CONTENT";
    const failCode = runRecoveryReadinessEvidenceCli(
      ["--file", "evidence.json", "--operation", "document_generation", "--project-ref", projectRef],
      {
        readFile: () => JSON.stringify({ ...evidenceInput(), rawProviderPayload: secretMarker }),
        now: () => now,
        stdout: (line) => stdout.push(line),
        stderr: (line) => stderr.push(line),
      },
    );
    expect(failCode).toBe(1);
    expect([...stdout, ...stderr].join("\n")).not.toContain(secretMarker);
    expect(stderr.at(-1)).toBe("FAIL: recovery readiness evidence rejected.");

    const oversizedCode = runRecoveryReadinessEvidenceCli(
      ["--file", "evidence.json", "--operation", "document_generation", "--project-ref", projectRef],
      {
        readFile: () => " ".repeat(65_537),
        now: () => now,
        stdout: (line) => stdout.push(line),
        stderr: (line) => stderr.push(line),
      },
    );
    expect(oversizedCode).toBe(1);
    expect(stderr.at(-1)).toBe("FAIL: recovery readiness evidence rejected.");
  });
});
