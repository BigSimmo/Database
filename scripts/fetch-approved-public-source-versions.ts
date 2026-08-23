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
};
type PublicSourceReservation = {
  id: string;
  reservedDocumentId: string;
  storagePath: string;
  stagingDocumentId: string | null;
  lifecycle: string;
};

export type PublicSourceStagingDependencies = {
  reserve(input: { manifest: Json }): Promise<PublicSourceReservation>;
  upload(input: { storagePath: string; content: Uint8Array; mime: string; upsert: true }): Promise<void>;
  finalize(input: { manifest: Json; maxAttempts: number }): Promise<PublicSourceVersionState>;
  lookup(reservationId: string): Promise<PublicSourceVersionState | null>;
};

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
          .select("id,lifecycle,staging_document_id")
          .eq("id", reservationId)
          .maybeSingle();
        if (error) throw new Error("Public source reservation recovery failed.");
        return data;
      },
    },
  };
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
  const reservation = await dependencies.reserve({
    manifest: {
      reservationKey: reservationKey(plan, fetched),
      catalogueKey: plan.catalogueKey,
      sourcePolicyVersion: plan.sourcePolicyVersion,
      sourcePolicyDigest: plan.sourcePolicyDigest,
      activationEventId: plan.activationEventId,
      exactCanonicalUrl: definition.canonicalUrl,
      exactVersionUrl: fetched.finalUrl,
      exactVersion: plan.exactVersion,
      contentHash: fetched.contentHash,
      retrievedAt: new Date().toISOString(),
      licenceEvidenceDigest: plan.licenceEvidenceDigest,
      stewardId: plan.stewardId,
      disposition: fetched.disposition,
      fileExtension: safeExtension,
    } satisfies Json,
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
    const recovered = await dependencies.lookup(reservation.id);
    if (
      recovered?.staging_document_id === reservation.reservedDocumentId &&
      recovered.lifecycle === fetched.disposition
    ) {
      return { disposition: fetched.disposition, version: recovered };
    }
    throw new Error("Public source finalization failed without committed state; reservation remains retryable.");
  }
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
    const fetched = await fetchApprovedPublicSource(plan);
    const result = await stageFetchedPublicSource(plan, fetched);
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
