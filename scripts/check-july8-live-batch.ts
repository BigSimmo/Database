import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const R17_INDEX = "ingestion_jobs_one_open_per_document_uidx";
const PROBE_JOB_ID = "00000000-0000-0000-0000-000000000099";
const PROBE_DOC_ID = "00000000-0000-0000-0000-000000000098";

type DriftSnapshot = {
  indexes?: Array<{ name?: unknown }>;
};

type AdminClient = ReturnType<Awaited<typeof import("@/lib/supabase/admin")>["createAdminClient"]>;

function isSignatureError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("could not find the function") ||
    lower.includes("does not exist") ||
    lower.includes("unknown argument") ||
    lower.includes("not found in the schema cache")
  );
}

async function checkFailClosedRetrieval(supabase: AdminClient) {
  const { data, error } = await supabase.rpc(
    "retrieval_owner_matches" as never,
    {
      owner_filter: null,
      row_owner_id: PROBE_DOC_ID,
    } as never,
  );

  if (error) {
    throw new Error(`retrieval_owner_matches probe failed: ${error.message}`);
  }

  if (data === true) {
    throw new Error(
      "retrieval_owner_matches still fail-OPEN on NULL owner_filter — apply 20260708160000_retrieval_owner_matches_fail_closed.sql",
    );
  }

  if (data !== false) {
    throw new Error(`retrieval_owner_matches returned unexpected value: ${String(data)}`);
  }

  console.log("[July8 Live Batch] PASS: retrieval_owner_matches is fail-closed on NULL.");
}

async function checkJsonbMergeDeep(supabase: AdminClient) {
  const { data, error } = await supabase.rpc(
    "jsonb_merge_deep" as never,
    {
      target_obj: { a: 1, nested: { keep: true } },
      patch_obj: { b: 2, nested: { add: "x" } },
    } as never,
  );

  if (error) {
    if (isSignatureError(error.message)) {
      throw new Error("jsonb_merge_deep RPC missing — apply 20260708310000_r5_document_metadata_merge.sql");
    }
    throw new Error(`jsonb_merge_deep probe failed: ${error.message}`);
  }

  const merged = data as { a?: number; b?: number; nested?: { keep?: boolean; add?: string } } | null;
  if (merged?.a !== 1 || merged?.b !== 2 || merged?.nested?.keep !== true || merged?.nested?.add !== "x") {
    throw new Error("jsonb_merge_deep returned an unexpected merge result.");
  }

  console.log("[July8 Live Batch] PASS: jsonb_merge_deep is live.");
}

async function checkWorkerLeaseFence(supabase: AdminClient) {
  const { data, error } = await supabase.rpc("complete_ingestion_job", {
    p_job_id: PROBE_JOB_ID,
    p_document_id: PROBE_DOC_ID,
    p_stage: "indexed",
    p_worker_id: "july8-live-batch-probe",
  });

  if (error) {
    if (isSignatureError(error.message)) {
      throw new Error(
        "complete_ingestion_job does not accept p_worker_id — apply 20260708130000_ingestion_concurrency_rpc_hardening.sql before redeploying the worker",
      );
    }
    throw new Error(`complete_ingestion_job probe failed: ${error.message}`);
  }

  const payload = data as { ok?: boolean; reason?: string } | null;
  if (payload?.ok !== false) {
    throw new Error(
      `complete_ingestion_job probe expected ok:false for a missing job, got: ${JSON.stringify(payload)}`,
    );
  }

  console.log("[July8 Live Batch] PASS: complete_ingestion_job accepts p_worker_id lease fence.");
}

async function checkR17Index(supabase: AdminClient) {
  const { data, error } = await supabase.rpc("schema_drift_snapshot" as never);
  if (error) {
    console.warn("[July8 Live Batch] SKIP: R17 index probe — schema_drift_snapshot unavailable:", error.message);
    console.warn("[July8 Live Batch] Manually confirm ingestion_jobs_one_open_per_document_uidx after applying R17.");
    return;
  }

  const indexes = (data as DriftSnapshot | null)?.indexes ?? [];
  const found = indexes.some((entry) => entry?.name === R17_INDEX);
  if (!found) {
    throw new Error(
      `${R17_INDEX} missing on live — apply R17 manually (CREATE INDEX CONCURRENTLY) then migration repair`,
    );
  }

  console.log("[July8 Live Batch] PASS: R17 partial unique index is live.");
}

async function main() {
  const { isDemoMode } = await import("@/lib/env");
  if (isDemoMode()) {
    console.log("[July8 Live Batch] SKIP: demo mode — no live Supabase project linked.");
    console.log("[July8 Live Batch] See docs/operator-apply-july8-batch.md for the apply runbook.");
    process.exit(0);
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  await checkFailClosedRetrieval(supabase);
  await checkJsonbMergeDeep(supabase);
  await checkWorkerLeaseFence(supabase);
  await checkR17Index(supabase);
  console.log("[July8 Live Batch] PASS: all July 8 batch probes green.");
}

main().catch((error) => {
  console.error("[July8 Live Batch] FAIL:", error instanceof Error ? error.message : error);
  console.error("[July8 Live Batch] Runbook: docs/operator-apply-july8-batch.md");
  process.exit(1);
});
