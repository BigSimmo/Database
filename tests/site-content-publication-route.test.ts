import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { loadDifferentialSnapshot } from "@/lib/differential-fixtures";
import {
  diagnosisToRow,
  presentationToRow,
  rowToDifferentialRecord,
  rowToPresentationWorkflow,
  type DifferentialRecordRow,
} from "@/lib/differential-records";
import { formRecords } from "@/lib/forms";
import { loadMedicationSnapshot } from "@/lib/medication-snapshot";
import {
  recordToRow as medicationToRow,
  rowToMedicationRecord,
  type MedicationRecordRow,
} from "@/lib/medication-records";
import {
  clinicalRegistryRecordToCorpusEntry,
  differentialRecordToCorpusEntry,
  medicationRecordToCorpusEntry,
} from "@/lib/registry-corpus";
import { recordToRow as registryToRow, type RegistryRecordRow } from "@/lib/registry-records";
import { mergeRegistryRecordWithDefault } from "@/lib/registry-seed";
import { serviceRecords } from "@/lib/services";
import { registryEntryToSiteContentRecord } from "@/lib/site-content/adapters/registry";
import { canonicalDynamicSiteContentProjection } from "@/lib/site-content/site-content-publication";

const rpc = vi.fn();
const sourceRow = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  slug: "sertraline",
  name: "Sertraline",
  class: "SSRI",
  subclass: "SSRI",
  category: "Antidepressant",
  accent: "#000000",
  tag: "Medication",
  schedule: "S4",
  stats: [],
  sections: [],
  quick: [],
  source_status: "current",
  validation_status: "approved",
  last_reviewed_at: null,
  review_due_at: null,
  created_at: "2026-08-24T00:00:00.000Z",
  updated_at: "2026-08-24T00:00:00.000Z",
};
const requireAuthenticatedUser = vi.fn();

const ownerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const rowAudit = {
  id: "11111111-1111-4111-8111-111111111111",
  created_at: "2026-08-24T00:00:00.000Z",
  updated_at: "2026-08-24T00:00:00.000Z",
  last_reviewed_at: null,
  review_due_at: null,
};

function assertNoPrivateKeys(value: unknown) {
  if (Array.isArray(value)) return value.forEach(assertNoPrivateKeys);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    expect(key.replace(/[^a-z0-9]/gi, "").toLowerCase()).not.toMatch(
      /^(actor|actorid|owner|ownerid|publishedby|sourceownerid|sourcerowid|privatedocumentid)$/,
    );
    assertNoPrivateKeys(child);
  }
}

function mockRuntime() {
  vi.resetModules();
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
      rpc,
      from: () => ({
        select: () => ({
          eq: () => ({ single: async () => ({ data: sourceRow, error: null }) }),
        }),
      }),
    }),
  }));
  vi.doMock("@/lib/supabase/auth", async (original) => {
    const actual = await original<typeof import("@/lib/supabase/auth")>();
    return { ...actual, requireAuthenticatedUser };
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  rpc.mockReset();
  requireAuthenticatedUser.mockReset();
});

describe("site-content publication POST", () => {
  it("normalizes only the selected locked legacy row through static SQL branches", () => {
    const migration = readFileSync(
      "supabase/migrations/20260824122000_add_site_content_release_and_outbox.sql",
      "utf8",
    );
    expect(migration).toContain("from public.clinical_registry_records r");
    expect(migration).toContain("from public.medication_records r");
    expect(migration).toContain("from public.differential_records r");
    expect(migration).toContain("for update;");
    expect(migration).not.toMatch(/execute\s+format/i);
  });

  it("denies a non-administrator before any command RPC can change state", async () => {
    mockRuntime();
    const { AuthenticationError } = await import("@/lib/supabase/auth");
    requireAuthenticatedUser.mockRejectedValue(new AuthenticationError("Administrator access required."));
    const { POST } = await import("../src/app/api/site-content/publications/route");

    const response = await POST(
      new Request("http://localhost/api/site-content/publications", {
        method: "POST",
        body: JSON.stringify({
          action: "publish",
          kind: "medication",
          sourceRowId: "11111111-1111-4111-8111-111111111111",
          expectedSourceVersion: "2026-08-24T00:00:00.000Z",
          expectedChangeEpoch: "0",
          reconciliationPlanDigest: "a".repeat(64),
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("derives the actor from administrator authentication and never accepts public JSON", async () => {
    mockRuntime();
    requireAuthenticatedUser.mockResolvedValue({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    rpc.mockResolvedValue({
      data: [{ outcome: "applied", logical_id: "medications:sertraline", change_epoch: 1 }],
      error: null,
    });
    const { POST } = await import("../src/app/api/site-content/publications/route");

    const response = await POST(
      new Request("http://localhost/api/site-content/publications", {
        method: "POST",
        body: JSON.stringify({
          action: "publish",
          kind: "medication",
          sourceRowId: "11111111-1111-4111-8111-111111111111",
          expectedSourceVersion: "2026-08-24T00:00:00.000Z",
          expectedChangeEpoch: "0",
          reconciliationPlanDigest: "a".repeat(64),
          actorId: "attacker",
          record: { body: "crafted public JSON" },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();

    const validResponse = await POST(
      new Request("http://localhost/api/site-content/publications", {
        method: "POST",
        body: JSON.stringify({
          action: "publish",
          kind: "medication",
          sourceRowId: "11111111-1111-4111-8111-111111111111",
          expectedSourceVersion: "2026-08-24T00:00:00.000Z",
          expectedChangeEpoch: "0",
          reconciliationPlanDigest: "a".repeat(64),
        }),
      }),
    );
    expect(validResponse.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "publish_site_content_record",
      expect.objectContaining({
        p_expected_record_digest: expect.stringMatching(/^[0-9a-f]{64}$/),
        p_published_by: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    );
  });

  it("returns 409 when the optimistic publication command is stale or a no-op", async () => {
    mockRuntime();
    requireAuthenticatedUser.mockResolvedValue({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    rpc.mockResolvedValue({ data: [{ outcome: "conflict", conflict_code: "already_retired" }], error: null });
    const { POST } = await import("../src/app/api/site-content/publications/route");

    const response = await POST(
      new Request("http://localhost/api/site-content/publications", {
        method: "POST",
        body: JSON.stringify({
          action: "retire",
          kind: "medication",
          sourceRowId: "11111111-1111-4111-8111-111111111111",
          expectedSourceVersion: "2026-08-24T00:00:00.000Z",
          expectedChangeEpoch: "0",
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/conflict|no-op/i) });
  });
});

describe("canonical dynamic public projection", () => {
  it("matches every P03 converter and preserves each rendered public fixture without audit identifiers", () => {
    const serviceRow = {
      ...registryToRow(serviceRecords[0]!, ownerId, "service"),
      ...rowAudit,
    } as RegistryRecordRow;
    const formRow = { ...registryToRow(formRecords[0]!, ownerId, "form"), ...rowAudit } as RegistryRecordRow;
    const medicationRow = {
      ...medicationToRow(loadMedicationSnapshot()[0]!, ownerId),
      ...rowAudit,
    } as MedicationRecordRow;
    const snapshot = loadDifferentialSnapshot();
    const diagnosisRow = {
      ...diagnosisToRow(snapshot.diagnoses[0]!, ownerId, snapshot),
      ...rowAudit,
    } as DifferentialRecordRow;
    const presentationRow = {
      ...presentationToRow(snapshot.presentations[0]!, ownerId, snapshot),
      ...rowAudit,
    } as DifferentialRecordRow;

    for (const [kind, row] of [
      ["service", serviceRow],
      ["form", formRow],
    ] as const) {
      const render = mergeRegistryRecordWithDefault(kind, row);
      const logicalId = `${kind === "service" ? "services" : "forms"}:${render.slug}`;
      const entry = clinicalRegistryRecordToCorpusEntry(render, kind, {
        ownerId: null,
        recordId: logicalId,
        sourceStatus: row.source_status,
        validationStatus: row.validation_status,
      });
      const projected = canonicalDynamicSiteContentProjection(kind, row);
      expect(projected.record).toEqual(registryEntryToSiteContentRecord(entry, { logicalId, sourceLineage: [] }));
      expect(projected.renderPayload).toEqual(JSON.parse(JSON.stringify(render)));
      assertNoPrivateKeys(projected.renderPayload);
    }

    const medication = rowToMedicationRecord(medicationRow);
    const medicationId = `medications:${medication.slug}`;
    const medicationEntry = medicationRecordToCorpusEntry(medication, {
      ownerId: null,
      recordId: medicationId,
      sourceStatus: medicationRow.source_status,
      validationStatus: medicationRow.validation_status,
    });
    const projectedMedication = canonicalDynamicSiteContentProjection("medication", medicationRow);
    expect(projectedMedication.record).toEqual(
      registryEntryToSiteContentRecord(medicationEntry, { logicalId: medicationId, sourceLineage: [] }),
    );
    expect(projectedMedication.renderPayload).toEqual(JSON.parse(JSON.stringify(medication)));

    const diagnosis = rowToDifferentialRecord(diagnosisRow);
    const diagnosisId = `differentials:diagnosis:${diagnosis.slug}`;
    const diagnosisEntry = differentialRecordToCorpusEntry(diagnosis, "diagnosis", {
      ownerId: null,
      recordId: diagnosisId,
      sourceStatus: diagnosisRow.source_status,
      validationStatus: diagnosisRow.validation_status,
    });
    const projectedDiagnosis = canonicalDynamicSiteContentProjection("differential", diagnosisRow);
    expect(projectedDiagnosis.record).toEqual(
      registryEntryToSiteContentRecord(diagnosisEntry, { logicalId: diagnosisId, sourceLineage: [] }),
    );
    expect(projectedDiagnosis.renderPayload).toEqual(JSON.parse(JSON.stringify(diagnosis)));

    const presentation = rowToPresentationWorkflow(presentationRow);
    const presentationId = `differentials:presentation:${presentation.id}`;
    const presentationEntry = differentialRecordToCorpusEntry(presentation, "presentation", {
      ownerId: null,
      recordId: presentationId,
      sourceStatus: presentationRow.source_status,
      validationStatus: presentationRow.validation_status,
    });
    const projectedPresentation = canonicalDynamicSiteContentProjection("presentation", presentationRow);
    expect(projectedPresentation.record).toEqual(
      registryEntryToSiteContentRecord(presentationEntry, { logicalId: presentationId, sourceLineage: [] }),
    );
    expect(projectedPresentation.renderPayload).toEqual(JSON.parse(JSON.stringify(presentation)));
    for (const projected of [projectedMedication, projectedDiagnosis, projectedPresentation]) {
      assertNoPrivateKeys(projected.renderPayload);
      expect(JSON.stringify(projected)).not.toContain(ownerId);
    }

    const privateToken = "99999999-9999-4999-8999-999999999999";
    const privateMedicationRow = {
      ...medicationRow,
      sections: [
        {
          title: "Safe section",
          type: "safe",
          ownerId: privateToken,
          rows: [
            {
              key: "Safe row",
              val: "Public value",
              privateDocumentId: privateToken,
              patient: { note: "Public note", actor: { id: privateToken } },
            },
          ],
        },
      ],
    } as unknown as MedicationRecordRow;
    const privateProjection = canonicalDynamicSiteContentProjection("medication", privateMedicationRow);
    assertNoPrivateKeys(privateProjection.renderPayload);
    expect(JSON.stringify(privateProjection)).not.toContain(privateToken);

    const privateSourceRow = {
      ...serviceRow,
      source: { label: "Public source", id: privateToken },
    } as unknown as RegistryRecordRow;
    const privateSourceProjection = canonicalDynamicSiteContentProjection("service", privateSourceRow);
    expect(privateSourceProjection.renderPayload).toMatchObject({ source: { label: "Public source" } });
    expect(JSON.stringify(privateSourceProjection)).not.toContain(privateToken);
  });

  it("freezes the complete current P03 dynamic seed population into epoch zero without a semantic diff", () => {
    const migration = readFileSync(
      "supabase/migrations/20260824122000_add_site_content_release_and_outbox.sql",
      "utf8",
    );
    const match = migration.match(/\$site_content_bootstrap_records\$([\s\S]*?)\$site_content_bootstrap_records\$/);
    expect(match).not.toBeNull();
    if (!match) return;
    const frozen = (JSON.parse(match[1]!) as Array<Record<string, unknown>>).map(
      ({ logicalId, record, renderPayload }) => ({ logicalId, record, renderPayload }),
    );
    const snapshot = loadDifferentialSnapshot();
    const audit = {
      id: ownerId,
      owner_id: ownerId,
      created_at: "2026-08-24T00:00:00.000Z",
      updated_at: "2026-08-24T00:00:00.000Z",
      last_reviewed_at: null,
      review_due_at: null,
    };
    const current = [
      ...serviceRecords.map((record) =>
        canonicalDynamicSiteContentProjection("service", {
          ...registryToRow(record, ownerId, "service"),
          ...audit,
        } as RegistryRecordRow),
      ),
      ...formRecords.map((record) =>
        canonicalDynamicSiteContentProjection("form", {
          ...registryToRow(record, ownerId, "form"),
          ...audit,
        } as RegistryRecordRow),
      ),
      ...loadMedicationSnapshot().map((record) =>
        canonicalDynamicSiteContentProjection("medication", {
          ...medicationToRow(record, ownerId),
          ...audit,
        } as MedicationRecordRow),
      ),
      ...snapshot.diagnoses.map((record) =>
        canonicalDynamicSiteContentProjection("differential", {
          ...diagnosisToRow(record, ownerId, snapshot),
          ...audit,
        } as DifferentialRecordRow),
      ),
      ...snapshot.presentations.map((record) =>
        canonicalDynamicSiteContentProjection("presentation", {
          ...presentationToRow(record, ownerId, snapshot),
          ...audit,
        } as DifferentialRecordRow),
      ),
    ]
      .map(({ record, renderPayload }) => ({ logicalId: record.logicalId, record, renderPayload }))
      .sort((left, right) => left.logicalId.localeCompare(right.logicalId));

    expect(frozen).toEqual(current);
  });
});
