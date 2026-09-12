import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import {
  assertAustralianPublicActivationMetadata,
  assertPublicationApplyConfirmation,
  parsePublicationCommandArgs,
  parseVersionedPublicationManifest,
  publicationManifestDigest,
  publicationManifestV2ExpectedStateDigest,
} from "@/lib/publication-manifest";
import type { Json } from "@/lib/supabase/database.types";

loadEnvConfig(process.cwd());

async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

function metadataString(metadata: Json, key: string) {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") return null;
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

async function main() {
  const args = parsePublicationCommandArgs(process.argv.slice(2));
  const raw = await readFile(args.manifestPath, "utf8");
  const manifest = parseVersionedPublicationManifest(raw);
  const digest = publicationManifestDigest(raw);
  const supabase = await loadAdminClient();
  const ids = manifest.documents.map((document) => document.documentId);
  const governedDocumentsById =
    manifest.version === 2
      ? new Map(manifest.documents.map((document) => [document.documentId, document] as const))
      : null;

  const { data: documents, error: documentError } = await supabase
    .from("documents")
    .select("id, owner_id, status, title, index_generation_id, metadata")
    .in("id", ids);
  if (documentError) throw new Error(documentError.message);

  const documentsById = new Map((documents ?? []).map((document) => [document.id, document]));
  const validationErrors: string[] = [];
  for (const entry of manifest.documents) {
    const document = documentsById.get(entry.documentId);
    const governedEntry = governedDocumentsById?.get(entry.documentId);
    let activationMetadataError: string | null = null;
    if (document && manifest.version === 2 && governedEntry?.decision === "approved") {
      try {
        assertAustralianPublicActivationMetadata(document.metadata, governedEntry.sourceCatalogueKey);
      } catch (error) {
        activationMetadataError = error instanceof Error ? error.message : "Australian activation metadata is invalid";
      }
    }
    if (!document) validationErrors.push(`${entry.documentId}: not found`);
    else if (document.owner_id !== entry.expectedOwnerId) validationErrors.push(`${entry.documentId}: owner changed`);
    else if (document.status !== "indexed") validationErrors.push(`${entry.documentId}: status is ${document.status}`);
    else if (manifest.version === 1 && metadataString(document.metadata, "corpus_scope") === "australian_public") {
      validationErrors.push(`${entry.documentId}: Australian public activation requires manifest v2`);
    } else if (
      manifest.version === 2 &&
      governedEntry &&
      document.index_generation_id !== governedEntry.expectedIndexGenerationId
    ) {
      validationErrors.push(`${entry.documentId}: committed index generation changed`);
    } else if (manifest.version === 2 && metadataString(document.metadata, "corpus_scope") !== "australian_public") {
      validationErrors.push(`${entry.documentId}: corpus_scope is not australian_public`);
    } else if (
      manifest.version === 2 &&
      governedEntry &&
      metadataString(document.metadata, "source_catalogue_key") !== governedEntry.sourceCatalogueKey
    ) {
      validationErrors.push(`${entry.documentId}: source catalogue key changed`);
    } else if (
      manifest.version === 2 &&
      metadataString(document.metadata, "source_policy_version") !== manifest.sourcePolicyVersion
    ) {
      validationErrors.push(`${entry.documentId}: source policy version changed`);
    } else if (activationMetadataError) {
      validationErrors.push(`${entry.documentId}: ${activationMetadataError}`);
    } else if (
      manifest.version === 2 &&
      governedEntry?.decision === "approved" &&
      metadataString(document.metadata, "content_mode") !== "indexed_content"
    ) {
      validationErrors.push(`${entry.documentId}: content mode is not indexed_content`);
    } else if (
      manifest.version === 2 &&
      governedEntry?.decision === "approved" &&
      metadataString(document.metadata, "licence_policy") !== "public_index_permitted"
    ) {
      validationErrors.push(`${entry.documentId}: document licence does not permit public indexing`);
    } else if (
      manifest.version === 2 &&
      governedEntry?.decision === "approved" &&
      metadataString(document.metadata, "document_status") !== "current"
    ) {
      validationErrors.push(`${entry.documentId}: document is not current`);
    } else if (
      manifest.version === 2 &&
      governedEntry?.decision === "approved" &&
      !["changed", "unchanged"].includes(metadataString(document.metadata, "change_state") ?? "")
    ) {
      validationErrors.push(`${entry.documentId}: source lifecycle is not active`);
    } else {
      const { data: currentStateDigest, error: digestError } = await supabase.rpc("document_publication_state_digest", {
        p_document_id: entry.documentId,
        p_expected_owner_id: entry.expectedOwnerId,
      });
      if (digestError) throw new Error(digestError.message);
      if (currentStateDigest !== entry.expectedStateDigest) {
        validationErrors.push(`${entry.documentId}: reviewed content/state digest changed`);
      }
    }
  }
  if (validationErrors.length > 0) {
    throw new Error(`Publication manifest validation failed:\n${validationErrors.join("\n")}`);
  }

  const decisionCounts = Object.fromEntries(
    ["approved", "keep_private", "quarantine"].map((decision) => [
      decision,
      manifest.documents.filter((document) => document.decision === decision).length,
    ]),
  );
  console.log(`[public-documents:promote] manifest SHA-256: ${digest}`);
  console.log(`[public-documents:promote] explicit document count: ${manifest.documents.length}`);
  console.log(`[public-documents:promote] decisions: ${JSON.stringify(decisionCounts)}`);

  if (!args.apply) {
    console.log("[public-documents:promote] dry run only; no approvals or document ownership were changed.");
    console.log(
      `[public-documents:promote] apply with --expected-count ${manifest.documents.length} --confirm-sha256 ${digest} --apply`,
    );
    return;
  }

  assertPublicationApplyConfirmation({
    manifest,
    digest,
    expectedCount: args.expectedCount,
    confirmSha256: args.confirmSha256,
  });

  const { data: existingApprovals, error: existingApprovalError } = await supabase
    .from("document_publication_approvals")
    .select(
      "document_id, expected_prior_owner_id, decision, manifest_digest, reviewed_state_digest, source_catalogue_key, source_policy_version, reviewed_index_generation_id",
    )
    .eq("manifest_digest", digest)
    .in("document_id", ids);
  if (existingApprovalError) throw new Error(existingApprovalError.message);
  const existing = new Set(
    (existingApprovals ?? []).map(
      (approval) =>
        `${approval.document_id}:${approval.expected_prior_owner_id}:${approval.decision}:${approval.manifest_digest}:${approval.reviewed_state_digest}:${approval.source_catalogue_key ?? ""}:${approval.source_policy_version ?? ""}:${approval.reviewed_index_generation_id ?? ""}`,
    ),
  );
  const approvals = manifest.documents
    .filter(
      (document) =>
        !existing.has(
          `${document.documentId}:${document.expectedOwnerId}:${document.decision}:${digest}:${document.expectedStateDigest}:${governedDocumentsById?.get(document.documentId)?.sourceCatalogueKey ?? ""}:${manifest.version === 2 ? manifest.sourcePolicyVersion : ""}:${governedDocumentsById?.get(document.documentId)?.expectedIndexGenerationId ?? ""}`,
        ),
    )
    .map((document) => ({
      document_id: document.documentId,
      expected_prior_owner_id: document.expectedOwnerId,
      approving_operator_id: manifest.approvingOperatorId,
      decision: document.decision,
      reason: manifest.reason,
      evidence_references: manifest.evidenceReferences,
      manifest_digest: digest,
      reviewed_state_digest: document.expectedStateDigest,
      source_catalogue_key: governedDocumentsById?.get(document.documentId)?.sourceCatalogueKey ?? null,
      source_policy_version: manifest.version === 2 ? manifest.sourcePolicyVersion : null,
      reviewed_index_generation_id: governedDocumentsById?.get(document.documentId)?.expectedIndexGenerationId ?? null,
    }));
  if (approvals.length > 0) {
    const { error: approvalError } = await supabase.from("document_publication_approvals").insert(approvals);
    if (approvalError) throw new Error(approvalError.message);
  }

  const approvedDocuments = manifest.documents
    .filter((document) => document.decision === "approved")
    .map((document) => ({
      document_id: document.documentId,
      expected_owner_id: document.expectedOwnerId,
      expected_state_digest: document.expectedStateDigest,
    }));
  if (approvedDocuments.length === 0) {
    console.log("[public-documents:promote] decisions recorded; no documents were approved for publication.");
    return;
  }

  if (manifest.version === 2) {
    const { data: result, error: activationError } = await supabase.rpc("activate_approved_public_documents", {
      p_manifest: manifest,
      p_expected_state_digest: publicationManifestV2ExpectedStateDigest(manifest),
      p_expected_generation_ids: manifest.documents.map((document) => document.expectedIndexGenerationId),
    });
    if (activationError) throw new Error(activationError.message);
    console.log(`[public-documents:promote] result: ${JSON.stringify(result)}`);
    return;
  }

  const { data: result, error: publishError } = await supabase.rpc("publish_approved_documents", {
    p_documents: approvedDocuments,
    p_manifest_digest: digest,
    p_expected_count: approvedDocuments.length,
  });
  if (publishError) throw new Error(publishError.message);
  console.log(`[public-documents:promote] result: ${JSON.stringify(result)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
