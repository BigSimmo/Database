// src/app/api/caring-contacts/intake/route.ts
//
// Manual hospital referral intake fallback (Hazard H-44). Validates a discharge
// payload, then persists and accepts a referral through the audited store writes
// so Initiate Care Plan can open `/plans/new?referral=<id>` against a real record.
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

import { auditableIdentifier, writeContextFor, writeHandler } from "@/lib/caring-contacts-server/handler";
import { DEMO_SEED_PATHWAY_VERSION_ID } from "@/lib/caring-contacts-server/demo-seed";
import { isAccessObjectIdShape } from "@/lib/caring-contacts/access-audit";
import { patientId, pathwayVersionId, referralId } from "@/lib/caring-contacts/ids";
import { SyntheticHospitalReferralAdapter } from "@/lib/caring-contacts/referral";

export const runtime = "nodejs";

const intakeSchema = z
  .object({
    patientIdentifier: z.string().min(1),
    givenName: z.string().min(1),
    familyName: z.string().min(1),
    mobileNumber: z.string().min(1),
    dischargeDate: z.string().min(1),
    hospitalFacility: z.string().min(1),
    cohort: z.string().min(1),
    admittingWard: z.string().min(1),
    clinicalSummary: z.string(),
    safetyAlerts: z.array(z.string()),
    idempotencyKey: auditableIdentifier,
    pathwayVersionId: auditableIdentifier.optional(),
  })
  .strict();

function toObjectId(prefix: string, raw: string): string {
  const compact = raw
    .replace(/[^A-Za-z0-9_:-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const candidate = `${prefix}-${compact}`.slice(0, 128);
  if (isAccessObjectIdShape(candidate)) return candidate;
  const digest = createHash("sha256").update(`${prefix}:${raw}`).digest("hex").slice(0, 32);
  return `${prefix}-${digest}`;
}

const adapter = new SyntheticHospitalReferralAdapter();

export const POST = writeHandler({
  schema: intakeSchema,
  action: "createReferral",
  access: { objectType: "patientDirectory", objectId: (body) => toObjectId("intake", body.patientIdentifier) },
  write: async (store, actor, body) => {
    const validated = await adapter.ingestReferral(body);
    if (!validated.ok) {
      return { ok: false, reason: validated.error };
    }

    const referral = validated.value;
    const nextReferralId = referralId(toObjectId("referral", `${referral.patientIdentifier}-${randomUUID()}`));
    const nextPatientId = patientId(toObjectId("patient", referral.patientIdentifier));

    const created = await store.createReferral(
      { referralId: nextReferralId, patientId: nextPatientId },
      writeContextFor(actor, body.idempotencyKey),
    );
    if (!created.ok) return created;

    const versions = await store.listPathwayVersions({ actor });
    const approved = versions.find((version) => version.state === "approved");
    const requested =
      body.pathwayVersionId &&
      versions.some((version) => version.id === body.pathwayVersionId && version.state === "approved")
        ? pathwayVersionId(body.pathwayVersionId)
        : approved
          ? approved.id
          : pathwayVersionId(DEMO_SEED_PATHWAY_VERSION_ID);

    if (!versions.some((version) => version.id === requested && version.state === "approved")) {
      return {
        ok: false,
        reason: "No approved pathway version is available to accept this intake referral.",
      };
    }

    const accepted = await store.transitionReferral(
      { referralId: nextReferralId, action: { type: "accept", pathwayVersionId: requested } },
      writeContextFor(actor, `${body.idempotencyKey}-accept`),
    );
    if (!accepted.ok) return accepted;

    return {
      ok: true,
      value: {
        referralId: accepted.value.id,
        patientId: accepted.value.patientId,
        state: accepted.value.state,
        pathwayVersionId: accepted.value.pathwayVersionId,
        referral,
      },
    };
  },
});
