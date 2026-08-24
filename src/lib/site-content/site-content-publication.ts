import "server-only";

import {
  assertRecoveryReadinessForOperation,
  parseActivationReceipt,
  parseRollbackReceipt,
  type ActivationReceipt,
  type RecoveryReadinessEvidence,
} from "@/lib/recovery-readiness-evidence";

const privateKeys = new Set([
  "actor",
  "actorid",
  "owner",
  "ownerid",
  "publishedby",
  "sourceownerid",
  "sourcerowid",
  "privatedocumentid",
]);

function isPrivateKey(key: string) {
  return privateKeys.has(key.replace(/[^a-z0-9]/gi, "").toLowerCase());
}

type RpcClient = {
  rpc: unknown;
};

async function callRpc(client: RpcClient, name: string, args: Record<string, unknown>) {
  return await (
    client.rpc as (
      name: string,
      args?: Record<string, unknown>,
    ) => PromiseLike<{
      data: unknown;
      error: { message: string } | null;
    }>
  )(name, args);
}

function publicProjection(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicProjection);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !isPrivateKey(key))
      .map(([key, child]) => [key, publicProjection(child)]),
  );
}

export async function readCanonicalSiteContentRecords<T>(input: {
  supabase: RpcClient;
  kind: string;
  slug: string | null;
  seeds: readonly T[];
  mapRecord?: (record: Record<string, unknown>) => T;
}): Promise<{ records: T[]; source: "canonical_public" | "seed_uninitialized"; snapshot: unknown | null }> {
  const { data, error } = await callRpc(input.supabase, "read_site_content_public_records", {
    p_kind: input.kind,
    p_slug: input.slug,
  });
  if (error) throw new Error(`Canonical site-content read failed: ${error.message}`);
  if (!Array.isArray(data)) throw new Error("Canonical site-content read failed: invalid RPC response.");
  const rows = data as Array<Record<string, unknown>>;
  const initialized = rows.some((row) => row.initialized === true);
  const snapshot = rows.find((row) => row.snapshot != null)?.snapshot ?? null;
  if (!initialized) {
    const seeds = input.slug
      ? input.seeds.filter((seed) => {
          const value = seed as Record<string, unknown>;
          const record = value.record as Record<string, unknown> | undefined;
          const workflow = value.workflow as Record<string, unknown> | undefined;
          return value.slug === input.slug || record?.slug === input.slug || workflow?.id === input.slug;
        })
      : [...input.seeds];
    return { records: seeds, source: "seed_uninitialized", snapshot };
  }
  const records = rows.flatMap((row) => {
    const record = row.render_payload ?? row.record;
    if (!record || typeof record !== "object" || Array.isArray(record)) return [];
    const mapped = input.mapRecord ? input.mapRecord(record as Record<string, unknown>) : (record as T);
    return [publicProjection(mapped) as T];
  });
  return { records, source: "canonical_public", snapshot };
}

export type SiteContentPublicationCommand = {
  action: "publish" | "retire";
  kind: "service" | "form" | "medication" | "differential" | "presentation";
  sourceRowId: string;
  expectedSourceVersion: string;
  expectedChangeEpoch: string;
  reconciliationPlanDigest?: string;
};

export async function publishSiteContentCommand(input: {
  supabase: RpcClient;
  actorId: string;
  command: SiteContentPublicationCommand;
}) {
  const rpcName = input.command.action === "publish" ? "publish_site_content_record" : "retire_site_content_record";
  const { data, error } = await callRpc(input.supabase, rpcName, {
    p_kind: input.command.kind,
    p_source_row_id: input.command.sourceRowId,
    p_expected_source_version: input.command.expectedSourceVersion,
    p_expected_change_epoch: input.command.expectedChangeEpoch,
    p_reconciliation_plan_digest: input.command.reconciliationPlanDigest ?? null,
    p_published_by: input.actorId,
  });
  if (error) throw new Error(`Site-content publication command failed: ${error.message}`);
  return data;
}

export async function activateSiteContentRelease(input: {
  supabase: RpcClient;
  projectRef: string;
  releaseId: string;
  releaseDigest: string;
  expectedChangeEpoch: string;
  recoveryEvidence: RecoveryReadinessEvidence;
  activationReceipt: unknown;
}) {
  const evidence = assertRecoveryReadinessForOperation(input.recoveryEvidence, "site_release", input.projectRef);
  const receipt = parseActivationReceipt(input.activationReceipt);
  if (
    receipt.projectRef !== input.projectRef ||
    receipt.recoveryReadinessDigest !== evidence.digest ||
    receipt.resource.kind !== "site_release" ||
    receipt.resource.siteReleaseId !== input.releaseId ||
    receipt.resource.siteReleaseDigest !== input.releaseDigest
  )
    throw new Error("Activation receipt does not match the requested site-content release.");
  const { data, error } = await callRpc(input.supabase, "activate_site_content_release", {
    p_release_id: input.releaseId,
    p_expected_release_digest: input.releaseDigest,
    p_expected_change_epoch: input.expectedChangeEpoch,
    p_recovery_digest: evidence.digest,
    p_activation_receipt: receipt,
  });
  if (error) throw new Error(`Site-content activation failed: ${error.message}`);
  return data === true;
}

export async function rollbackSiteContentRelease(input: {
  supabase: RpcClient;
  projectRef: string;
  expectedActiveReleaseId: string;
  targetReleaseId: string;
  recoveryEvidence: RecoveryReadinessEvidence;
  activationReceipt: ActivationReceipt;
  rollbackReceipt: unknown;
}) {
  const evidence = assertRecoveryReadinessForOperation(input.recoveryEvidence, "site_release", input.projectRef);
  const activation = parseActivationReceipt(input.activationReceipt);
  const receipt = parseRollbackReceipt(input.rollbackReceipt, activation);
  if (
    activation.projectRef !== input.projectRef ||
    activation.resource.kind !== "site_release" ||
    activation.resource.siteReleaseId !== input.expectedActiveReleaseId ||
    receipt.target.kind !== "site_release" ||
    receipt.target.siteReleaseId !== input.targetReleaseId
  )
    throw new Error("Rollback receipt does not match the retained site-content release.");
  const { data, error } = await callRpc(input.supabase, "rollback_site_content_release", {
    p_expected_active_release_id: input.expectedActiveReleaseId,
    p_target_release_id: input.targetReleaseId,
    p_recovery_digest: evidence.digest,
    p_rollback_receipt: receipt,
  });
  if (error) throw new Error(`Site-content rollback failed: ${error.message}`);
  return data === true;
}
