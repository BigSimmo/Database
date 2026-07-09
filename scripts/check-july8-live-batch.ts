import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const R17_INDEX = "ingestion_jobs_one_open_per_document_uidx";
const PROBE_JOB_ID = "00000000-0000-0000-0000-000000000099";
const PROBE_DOC_ID = "00000000-0000-0000-0000-000000000098";
const R17_PROBE_JOB_PRIMARY = "00000000-0000-0000-0000-000000000097";
const R17_PROBE_JOB_DUPLICATE = "00000000-0000-0000-0000-000000000096";

type DriftIndex = {
  name?: unknown;
  def?: unknown;
};

type DriftSnapshot = {
  indexes?: DriftIndex[];
};

export function normalizeIndexDef(def: string) {
  return def.replace(/\s+/g, " ").trim().toLowerCase();
}

export function isExpectedR17IndexDef(def: string) {
  const normalized = normalizeIndexDef(def);
  return (
    normalized.includes("create unique index") &&
    normalized.includes("ingestion_jobs") &&
    normalized.includes("(document_id)") &&
    normalized.includes("where") &&
    normalized.includes("pending") &&
    normalized.includes("processing")
  );
}

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

async function findR17ProbeDocument(supabase: AdminClient) {
  const { data: docs, error } = await supabase.from("documents").select("id").limit(200);
  if (error) {
    throw new Error(`R17 probe: could not list documents: ${error.message}`);
  }
  if (!docs?.length) {
    throw new Error("R17 probe: no documents available for enforcement check");
  }

  for (const doc of docs) {
    const { data: openJobs, error: openError } = await supabase
      .from("ingestion_jobs")
      .select("id")
      .eq("document_id", doc.id)
      .in("status", ["pending", "processing"])
      .limit(1);
    if (openError) {
      throw new Error(`R17 probe: open-job lookup failed: ${openError.message}`);
    }
    if (!openJobs?.length) {
      return doc.id;
    }
  }

  throw new Error("R17 probe: could not find a document without open ingestion jobs");
}

async function checkR17IndexEnforcement(supabase: AdminClient) {
  const documentId = await findR17ProbeDocument(supabase);
  const nextRunAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const baseRow = {
    document_id: documentId,
    status: "pending" as const,
    stage: "queued",
    progress: 0,
    next_run_at: nextRunAt,
  };

  const { error: firstError } = await supabase.from("ingestion_jobs").insert({
    id: R17_PROBE_JOB_PRIMARY,
    ...baseRow,
  });
  if (firstError) {
    throw new Error(`R17 probe: could not insert primary open job: ${firstError.message}`);
  }

  try {
    const { error: duplicateError } = await supabase.from("ingestion_jobs").insert({
      id: R17_PROBE_JOB_DUPLICATE,
      ...baseRow,
    });

    if (!duplicateError) {
      await supabase.from("ingestion_jobs").delete().eq("id", R17_PROBE_JOB_DUPLICATE);
      throw new Error(
        `${R17_INDEX} is not enforcing uniqueness — duplicate open job insert succeeded for document ${documentId}`,
      );
    }

    const duplicateMessage = duplicateError.message.toLowerCase();
    const isUniqueViolation =
      duplicateError.code === "23505" ||
      duplicateMessage.includes(R17_INDEX) ||
      duplicateMessage.includes("duplicate key");
    if (!isUniqueViolation) {
      throw new Error(`R17 probe: unexpected duplicate-insert error: ${duplicateError.message}`);
    }
  } finally {
    await supabase.from("ingestion_jobs").delete().eq("id", R17_PROBE_JOB_PRIMARY);
  }
}

async function checkR17Index(supabase: AdminClient) {
  const { data, error } = await supabase.rpc("schema_drift_snapshot" as never);
  if (error) {
    throw new Error(`schema_drift_snapshot unavailable — cannot verify ${R17_INDEX}: ${error.message}`);
  }

  const indexes = (data as DriftSnapshot | null)?.indexes ?? [];
  const entry = indexes.find((index) => index?.name === R17_INDEX);
  if (!entry) {
    throw new Error(
      `${R17_INDEX} missing on live — apply 20260708170000_ingestion_jobs_one_open_per_document.sql (or manual CONCURRENTLY + repair 20260708170000)`,
    );
  }

  const definition = typeof entry.def === "string" ? entry.def : "";
  if (!isExpectedR17IndexDef(definition)) {
    throw new Error(
      `${R17_INDEX} definition mismatch — expected partial unique index on ingestion_jobs(document_id) for open statuses; got: ${definition || "<empty>"}`,
    );
  }

  await checkR17IndexEnforcement(supabase);
  console.log("[July8 Live Batch] PASS: R17 partial unique index is live, valid, and enforcing.");
}

async function main() {
  const { requireServerEnv } = await import("@/lib/env");
  requireServerEnv();

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
