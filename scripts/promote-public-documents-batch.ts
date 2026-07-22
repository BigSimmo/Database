import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import {
  assertPublicationApplyConfirmation,
  parsePublicationCommandArgs,
  parsePublicationManifest,
  publicationManifestDigest,
} from "@/lib/publication-manifest";

loadEnvConfig(process.cwd());

async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

async function main() {
  const args = parsePublicationCommandArgs(process.argv.slice(2));
  const raw = await readFile(args.manifestPath, "utf8");
  const manifest = parsePublicationManifest(raw);
  const digest = publicationManifestDigest(raw);
  const supabase = await loadAdminClient();
  const ids = manifest.documents.map((document) => document.documentId);

  const { data: documents, error: documentError } = await supabase
    .from("documents")
    .select("id, owner_id, status, title")
    .in("id", ids);
  if (documentError) throw new Error(documentError.message);

  const documentsById = new Map((documents ?? []).map((document) => [document.id, document]));
  const validationErrors: string[] = [];
  for (const entry of manifest.documents) {
    const document = documentsById.get(entry.documentId);
    if (!document) validationErrors.push(`${entry.documentId}: not found`);
    else if (document.owner_id !== entry.expectedOwnerId) validationErrors.push(`${entry.documentId}: owner changed`);
    else if (document.status !== "indexed") validationErrors.push(`${entry.documentId}: status is ${document.status}`);
    else {
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
    .select("document_id, expected_prior_owner_id, decision, manifest_digest, reviewed_state_digest")
    .eq("manifest_digest", digest)
    .in("document_id", ids);
  if (existingApprovalError) throw new Error(existingApprovalError.message);
  const existing = new Set(
    (existingApprovals ?? []).map(
      (approval) =>
        `${approval.document_id}:${approval.expected_prior_owner_id}:${approval.decision}:${approval.manifest_digest}:${approval.reviewed_state_digest}`,
    ),
  );
  const approvals = manifest.documents
    .filter(
      (document) =>
        !existing.has(
          `${document.documentId}:${document.expectedOwnerId}:${document.decision}:${digest}:${document.expectedStateDigest}`,
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
