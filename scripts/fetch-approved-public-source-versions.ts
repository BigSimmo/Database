import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";

import { australianSourceByKey } from "@/lib/australian-source-catalogue";
import {
  fetchApprovedPublicSource,
  parseFetchApprovedSourceArgs,
  parsePublicSourceAcquisitionPlan,
  type PublicSourceAcquisitionPlan,
} from "@/lib/public-source-acquisition";
import type { Json } from "@/lib/supabase/database.types";

export function parseAcquisitionBatch(raw: string) {
  const input: unknown = JSON.parse(raw);
  if (!input || typeof input !== "object" || (input as { version?: unknown }).version !== 1) {
    throw new Error("Acquisition manifest version is invalid.");
  }
  const rawPlans = (input as { plans?: unknown }).plans;
  if (!Array.isArray(rawPlans) || rawPlans.length < 1 || rawPlans.length > 500) {
    throw new Error("Acquisition manifest plan count must be between 1 and 500.");
  }
  const plans = rawPlans.map(parsePublicSourceAcquisitionPlan);
  const identities = plans.map((plan) => `${plan.catalogueKey}\u0000${plan.exactUrl}`);
  if (new Set(identities).size !== identities.length)
    throw new Error("Acquisition manifest contains duplicate exact URLs.");
  return plans;
}

type FetchedPublicSource = Awaited<ReturnType<typeof fetchApprovedPublicSource>>;
type PublicSourceVersionState = {
  id: string;
  lifecycle: string;
  staging_document_id: string | null;
  reservation_key?: string;
  source_catalogue_key?: string;
  source_policy_version?: string;
  source_policy_digest?: string;
  activation_event_id?: string;
  activation_sequence?: number;
  exact_canonical_url?: string;
  exact_version_url?: string;
  exact_version?: string;
  content_hash?: string;
  licence_evidence_digest?: string;
  steward_id?: string;
  intended_disposition?: string;
  reserved_document_id?: string;
  reserved_storage_path?: string;
};
type PublicSourceReservation = {
  id: string;
  reservedDocumentId: string;
  storagePath: string;
  stagingDocumentId: string | null;
  lifecycle: string;
};

export type PublicSourceStagingDependencies = {
  preflight?(input: { manifest: Json }): Promise<unknown>;
  reserve(input: { manifest: Json }): Promise<PublicSourceReservation>;
  upload(input: { storagePath: string; content: Uint8Array; mime: string; upsert: true }): Promise<void>;
  finalize(input: { manifest: Json; maxAttempts: number }): Promise<PublicSourceVersionState>;
  lookup(reservationId: string): Promise<PublicSourceVersionState | null>;
  abandon?(input: { manifest: Json }): Promise<{ status: string; storagePath: string; storageOwned: boolean }>;
  remove?(storagePath: string): Promise<void>;
};

export function publicSourceAuthorityManifest(planInput: PublicSourceAcquisitionPlan): Json {
  const plan = parsePublicSourceAcquisitionPlan(planInput);
  const definition = australianSourceByKey(plan.catalogueKey)!;
  return {
    catalogueKey: plan.catalogueKey,
    activationEventId: plan.activationEventId,
    activationSequence: plan.activationSequence,
    sourcePolicyVersion: plan.sourcePolicyVersion,
    sourcePolicyDigest: plan.sourcePolicyDigest,
    exactCanonicalUrl: definition.canonicalUrl,
    exactVersionUrl: plan.exactUrl,
    exactHostname: new URL(plan.exactUrl).hostname.toLowerCase(),
    stewardId: plan.stewardId,
  };
}

function acquisitionFileExtension(fetched: FetchedPublicSource) {
  if (fetched.mime === "text/plain") return ".txt";
  if (fetched.mime === "application/pdf") return ".pdf";
  if (fetched.mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return ".docx";
  return extname(new URL(fetched.finalUrl).pathname).toLowerCase() || ".bin";
}

function reservationKey(plan: PublicSourceAcquisitionPlan, fetched: FetchedPublicSource) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: 1,
        catalogueKey: plan.catalogueKey,
        activationEventId: plan.activationEventId,
        activationSequence: plan.activationSequence,
        exactUrl: fetched.finalUrl,
        exactVersion: plan.exactVersion,
        contentHash: fetched.contentHash,
        disposition: fetched.disposition,
      }),
      "utf8",
    )
    .digest("hex");
}

async function defaultStagingDependencies(): Promise<{
  dependencies: PublicSourceStagingDependencies;
  maxAttempts: number;
}> {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());
  const [{ env }, { createAdminClient }] = await Promise.all([import("@/lib/env"), import("@/lib/supabase/admin")]);
  const supabase = createAdminClient();
  return {
    maxAttempts: env.WORKER_MAX_ATTEMPTS,
    dependencies: {
      preflight: async ({ manifest }) => {
        const { data, error } = await supabase.rpc("preflight_public_source_acquisition", { p_manifest: manifest });
        if (error || !data) throw new Error("Current public source authority preflight failed.");
        return data;
      },
      reserve: async ({ manifest }) => {
        const { data, error } = await supabase.rpc("reserve_public_source_version", { p_manifest: manifest });
        if (error || !data) throw new Error("Public source authority reservation failed.");
        return {
          id: data.id,
          reservedDocumentId: data.reserved_document_id,
          storagePath: data.reserved_storage_path,
          stagingDocumentId: data.staging_document_id,
          lifecycle: data.lifecycle,
        };
      },
      upload: async ({ storagePath, content, mime, upsert }) => {
        const result = await supabase.storage.from(env.SUPABASE_DOCUMENT_BUCKET).upload(storagePath, content, {
          contentType: mime,
          upsert,
        });
        if (result.error) throw new Error("Public source storage write failed.");
      },
      finalize: async ({ manifest, maxAttempts }) => {
        const { data, error } = await supabase.rpc("finalize_public_source_version", {
          p_manifest: manifest,
          p_max_attempts: maxAttempts,
        });
        if (error || !data) throw new Error("Public source version finalization failed.");
        return data;
      },
      lookup: async (reservationId) => {
        const { data, error } = await supabase
          .from("public_source_versions")
          .select(
            "id,lifecycle,staging_document_id,reservation_key,source_catalogue_key,source_policy_version,source_policy_digest,activation_event_id,activation_sequence,exact_canonical_url,exact_version_url,exact_version,content_hash,licence_evidence_digest,steward_id,intended_disposition,reserved_document_id,reserved_storage_path",
          )
          .eq("id", reservationId)
          .maybeSingle();
        if (error) throw new Error("Public source reservation recovery failed.");
        return data;
      },
      abandon: async ({ manifest }) => {
        const { data, error } = await supabase.rpc("abandon_public_source_reservation", { p_manifest: manifest });
        if (error || !data || typeof data !== "object") {
          throw new Error("Public source reservation abandonment failed.");
        }
        const result = data as { status?: unknown; storagePath?: unknown; storageOwned?: unknown };
        if (
          typeof result.status !== "string" ||
          typeof result.storagePath !== "string" ||
          typeof result.storageOwned !== "boolean"
        ) {
          throw new Error("Public source reservation abandonment returned an invalid result.");
        }
        return { status: result.status, storagePath: result.storagePath, storageOwned: result.storageOwned };
      },
      remove: async (storagePath) => {
        const { error } = await supabase.storage.from(env.SUPABASE_DOCUMENT_BUCKET).remove([storagePath]);
        if (error) throw new Error("Abandoned public source storage cleanup failed.");
      },
    },
  };
}

function recoveryIdentityMatches(
  recovered: PublicSourceVersionState,
  reservation: PublicSourceReservation,
  manifest: Record<string, Json | undefined>,
) {
  return (
    recovered.id === reservation.id &&
    recovered.reservation_key === manifest.reservationKey &&
    recovered.source_catalogue_key === manifest.catalogueKey &&
    recovered.source_policy_version === manifest.sourcePolicyVersion &&
    recovered.source_policy_digest === manifest.sourcePolicyDigest &&
    recovered.activation_event_id === manifest.activationEventId &&
    recovered.activation_sequence === manifest.activationSequence &&
    recovered.exact_canonical_url === manifest.exactCanonicalUrl &&
    recovered.exact_version_url === manifest.exactVersionUrl &&
    recovered.exact_version === manifest.exactVersion &&
    recovered.content_hash === manifest.contentHash &&
    recovered.licence_evidence_digest === manifest.licenceEvidenceDigest &&
    recovered.steward_id === manifest.stewardId &&
    recovered.intended_disposition === manifest.disposition &&
    recovered.reserved_document_id === reservation.reservedDocumentId &&
    recovered.reserved_storage_path === reservation.storagePath
  );
}

function isCommittedRecovery(recovered: PublicSourceVersionState, reservation: PublicSourceReservation) {
  return (
    recovered.staging_document_id === reservation.reservedDocumentId &&
    ["shadow", "quarantined", "approved", "active", "tombstoned"].includes(recovered.lifecycle)
  );
}

export async function stageFetchedPublicSource(
  plan: PublicSourceAcquisitionPlan,
  fetched: FetchedPublicSource,
  injectedDependencies?: PublicSourceStagingDependencies,
) {
  plan = parsePublicSourceAcquisitionPlan(plan);
  const definition = australianSourceByKey(plan.catalogueKey)!;
  const safeExtension = acquisitionFileExtension(fetched);
  const defaults = injectedDependencies ? null : await defaultStagingDependencies();
  const dependencies = injectedDependencies ?? defaults!.dependencies;
  const maxAttempts = defaults?.maxAttempts ?? 3;
  const reserveManifest = {
    reservationKey: reservationKey(plan, fetched),
    catalogueKey: plan.catalogueKey,
    sourcePolicyVersion: plan.sourcePolicyVersion,
    sourcePolicyDigest: plan.sourcePolicyDigest,
    activationEventId: plan.activationEventId,
    activationSequence: plan.activationSequence,
    exactCanonicalUrl: definition.canonicalUrl,
    exactVersionUrl: fetched.finalUrl,
    exactVersion: plan.exactVersion,
    contentHash: fetched.contentHash,
    retrievedAt: new Date().toISOString(),
    licenceEvidenceDigest: plan.licenceEvidenceDigest,
    stewardId: plan.stewardId,
    disposition: fetched.disposition,
    fileExtension: safeExtension,
  } satisfies Json;
  const reservation = await dependencies.reserve({
    manifest: reserveManifest,
  });
  if (reservation.stagingDocumentId) {
    return { disposition: "duplicate" as const, version: reservation };
  }

  await dependencies.upload({
    storagePath: reservation.storagePath,
    content: fetched.content,
    mime: fetched.mime,
    upsert: true,
  });
  const metadata = {
    corpus_scope: "australian_public",
    source_kind: "document",
    source_catalogue_key: plan.catalogueKey,
    source_policy_version: plan.sourcePolicyVersion,
    source_policy_digest: plan.sourcePolicyDigest,
    public_source_activation_event_id: plan.activationEventId,
    public_source_activation_sequence: String(plan.activationSequence),
    public_source_version_id: reservation.id,
    public_source_steward_id: plan.stewardId,
    content_mode: "indexed_content",
    licence_policy: "public_index_permitted",
    acquisition_disposition: fetched.disposition,
    publisher: definition.publisher,
    publisher_code: definition.publisherCode,
    jurisdiction: definition.jurisdiction,
    source_role: definition.roles[0] ?? "clinical_guideline",
    source_title: plan.exactVersion,
    canonical_url: definition.canonicalUrl,
    exact_version_url: fetched.finalUrl,
    version: plan.exactVersion,
    document_status: "current",
    change_state: "changed",
    clinical_validation_status: "unverified",
    content_hash: fetched.contentHash,
  };
  try {
    const version = await dependencies.finalize({
      manifest: {
        reservationId: reservation.id,
        catalogueKey: plan.catalogueKey,
        activationEventId: plan.activationEventId,
        activationSequence: plan.activationSequence,
        sourcePolicyVersion: plan.sourcePolicyVersion,
        sourcePolicyDigest: plan.sourcePolicyDigest,
        reservationKey: reserveManifest.reservationKey,
        exactCanonicalUrl: definition.canonicalUrl,
        exactVersionUrl: fetched.finalUrl,
        exactVersion: plan.exactVersion,
        contentHash: fetched.contentHash,
        licenceEvidenceDigest: plan.licenceEvidenceDigest,
        stewardId: plan.stewardId,
        disposition: fetched.disposition,
        document: {
          id: reservation.reservedDocumentId,
          owner_id: plan.stewardId,
          title: `${definition.publisher} — ${plan.exactVersion}`,
          description: "Controlled public-source staging document.",
          file_name: `source${safeExtension}`,
          file_type: fetched.mime,
          file_size: fetched.byteCount,
          storage_path: reservation.storagePath,
          content_hash: fetched.contentHash,
          metadata,
        },
      } satisfies Json,
      maxAttempts,
    });
    return { disposition: fetched.disposition, version };
  } catch {
    let recovered: PublicSourceVersionState | null;
    try {
      recovered = await dependencies.lookup(reservation.id);
    } catch {
      throw new Error("Public source finalization recovery lookup was ambiguous; storage remains untouched.");
    }
    if (recovered && !recoveryIdentityMatches(recovered, reservation, reserveManifest)) {
      throw new Error("Public source recovery identity did not match the immutable reservation.");
    }
    if (recovered && isCommittedRecovery(recovered, reservation)) {
      return { disposition: fetched.disposition, version: recovered };
    }
    if (
      recovered &&
      ["discovered", "abandoned"].includes(recovered.lifecycle) &&
      recovered.staging_document_id === null &&
      dependencies.abandon &&
      dependencies.remove
    ) {
      const abandonmentManifest = {
        ...reserveManifest,
        reservationId: reservation.id,
        reservedDocumentId: reservation.reservedDocumentId,
        reservedStoragePath: reservation.storagePath,
      };
      let abandoned: Awaited<ReturnType<NonNullable<PublicSourceStagingDependencies["abandon"]>>>;
      try {
        abandoned = await dependencies.abandon({ manifest: abandonmentManifest });
      } catch {
        const afterAmbiguousAbandon = await dependencies.lookup(reservation.id);
        if (!afterAmbiguousAbandon || !recoveryIdentityMatches(afterAmbiguousAbandon, reservation, reserveManifest)) {
          throw new Error("Public source abandonment outcome was ambiguous; storage remains untouched.");
        }
        if (isCommittedRecovery(afterAmbiguousAbandon, reservation)) {
          return { disposition: fetched.disposition, version: afterAmbiguousAbandon };
        }
        if (afterAmbiguousAbandon.lifecycle !== "abandoned" || afterAmbiguousAbandon.staging_document_id !== null) {
          throw new Error("Public source abandonment outcome was not definitively unowned.");
        }
        abandoned = await dependencies.abandon({ manifest: abandonmentManifest });
      }
      if (
        abandoned.status === "abandoned" &&
        abandoned.storageOwned === false &&
        abandoned.storagePath === reservation.storagePath
      ) {
        await dependencies.remove(reservation.storagePath);
        throw new Error("Public source reservation was abandoned; retry requires fresh authority.");
      }
      if (abandoned.status === "committed" && abandoned.storageOwned === true) {
        const committed = await dependencies.lookup(reservation.id);
        if (
          committed &&
          recoveryIdentityMatches(committed, reservation, reserveManifest) &&
          isCommittedRecovery(committed, reservation)
        ) {
          return { disposition: fetched.disposition, version: committed };
        }
        throw new Error("Public source committed abandonment result could not be verified.");
      }
    }
    throw new Error("Public source finalization failed without definitive committed or abandoned state.");
  }
}

export async function fetchAndStageApprovedPublicSource(
  planInput: PublicSourceAcquisitionPlan,
  injectedDependencies?: PublicSourceStagingDependencies,
  acquisitionDependencies: Parameters<typeof fetchApprovedPublicSource>[1] = {},
) {
  const plan = parsePublicSourceAcquisitionPlan(planInput);
  const defaults = injectedDependencies ? null : await defaultStagingDependencies();
  const dependencies = injectedDependencies ?? defaults!.dependencies;
  if (!dependencies.preflight) throw new Error("Current public source authority preflight is required.");
  await dependencies.preflight({ manifest: publicSourceAuthorityManifest(plan) });
  const fetched = await fetchApprovedPublicSource(plan, acquisitionDependencies);
  return { fetched, result: await stageFetchedPublicSource(plan, fetched, dependencies) };
}

async function main() {
  const args = parseFetchApprovedSourceArgs(process.argv.slice(2));
  const raw = await readFile(args.manifestPath, "utf8");
  const plans = parseAcquisitionBatch(raw);
  const digest = createHash("sha256").update(raw, "utf8").digest("hex");
  console.log(`[public-sources:fetch] manifest SHA-256 ${digest}; exact count ${plans.length}`);
  if (!args.apply) {
    console.log("[public-sources:fetch] dry run only; no network, storage, database, enqueue, or activation occurred.");
    console.log(
      `[public-sources:fetch] apply with --expected-count ${plans.length} --confirm-sha256 ${digest} --apply`,
    );
    return;
  }
  if (args.expectedCount !== plans.length) throw new Error("Confirmed count does not match the acquisition manifest.");
  if (args.confirmSha256 !== digest) throw new Error("Confirmed SHA-256 does not match the acquisition manifest.");

  for (const plan of plans) {
    const { fetched, result } = await fetchAndStageApprovedPublicSource(plan);
    console.log(
      `[public-sources:fetch] ${plan.catalogueKey} ${new URL(plan.exactUrl).hostname} ${fetched.contentHash} ${result.disposition}`,
    );
  }
  console.log(
    "[public-sources:fetch] persisted owned shadow/quarantined versions only; no content was activated or published.",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Public source fetch failed.");
    process.exit(1);
  });
}
