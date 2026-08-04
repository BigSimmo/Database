import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const PAGE_SIZE = 500;

async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

async function main() {
  const supabase = await loadAdminClient();
  const documents: Array<{ id: string; title: string; metadata: Record<string, unknown> | null }> = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("documents")
      .select("id, title, metadata")
      .eq("status", "indexed")
      .is("owner_id", null)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    documents.push(...((data ?? []) as typeof documents));
    if ((data ?? []).length < PAGE_SIZE) break;
  }

  const approvalIds = documents
    .map((document) => String(document.metadata?.publication_approval_id ?? ""))
    .filter(Boolean);
  const approvals = new Map<
    string,
    { document_id: string; manifest_digest: string; reviewed_state_digest: string | null; decision: string }
  >();
  for (let index = 0; index < approvalIds.length; index += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("document_publication_approvals")
      .select("id, document_id, manifest_digest, reviewed_state_digest, decision")
      .in("id", approvalIds.slice(index, index + PAGE_SIZE));
    if (error) throw new Error(error.message);
    for (const approval of data ?? []) approvals.set(approval.id, approval);
  }

  const missing = documents.filter((document) => {
    const approvalId = String(document.metadata?.publication_approval_id ?? "");
    const digest = String(document.metadata?.publication_manifest_digest ?? "");
    const reviewedStateDigest = String(document.metadata?.publication_reviewed_state_digest ?? "");
    const approval = approvals.get(approvalId);
    return (
      !approval ||
      approval.document_id !== document.id ||
      approval.decision !== "approved" ||
      approval.manifest_digest !== digest ||
      !approval.reviewed_state_digest ||
      approval.reviewed_state_digest !== reviewedStateDigest
    );
  });

  console.log(`[public-documents:audit] indexed public documents: ${documents.length}`);
  console.log(`[public-documents:audit] lacking matching approval evidence: ${missing.length}`);
  for (const document of missing) console.log(`${document.id}\t${document.title}`);
  console.log("[public-documents:audit] read-only audit complete; no ownership or publication state was changed.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
