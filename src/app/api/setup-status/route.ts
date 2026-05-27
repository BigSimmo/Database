import { NextResponse } from "next/server";
import { env, isDemoMode } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SetupCheckStatus = "ready" | "needs_setup" | "unknown";
type SetupCheckId = "env" | "schema" | "openai" | "worker";

type SetupCheck = {
  id: SetupCheckId;
  label: string;
  status: SetupCheckStatus;
  detail: string;
};

const requiredSupabaseEnvPresent = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

function check(id: SetupCheckId, label: string, status: SetupCheckStatus, detail: string): SetupCheck {
  return { id, label, status, detail };
}

async function readSchemaStatus() {
  if (!requiredSupabaseEnvPresent) {
    return check(
      "schema",
      "supabase/schema.sql applied",
      "unknown",
      "Supabase environment is missing, so schema checks were skipped.",
    );
  }

  try {
    const supabase = createAdminClient();
    const [documents, jobs, batches, buckets] = await Promise.all([
      supabase.from("documents").select("id,content_hash,import_batch_id").limit(1),
      supabase.from("ingestion_jobs").select("id,attempt_count,max_attempts,locked_at").limit(1),
      supabase.from("import_batches").select("id").limit(1),
      supabase.storage.listBuckets(),
    ]);

    const hasRequiredBuckets =
      !buckets.error &&
      buckets.data?.some((bucket) => bucket.id === env.SUPABASE_DOCUMENT_BUCKET) &&
      buckets.data?.some((bucket) => bucket.id === env.SUPABASE_IMAGE_BUCKET);

    if (documents.error || jobs.error || batches.error || !hasRequiredBuckets) {
      return check(
        "schema",
        "supabase/schema.sql applied",
        "needs_setup",
        "Required tables or private storage buckets were not confirmed.",
      );
    }

    return check(
      "schema",
      "supabase/schema.sql applied",
      "ready",
      "Required tables and storage buckets responded successfully.",
    );
  } catch {
    return check(
      "schema",
      "supabase/schema.sql applied",
      "needs_setup",
      "Schema check could not complete with the configured Supabase service role.",
    );
  }
}

async function readWorkerStatus() {
  const label = "npm run worker running";

  if (!requiredSupabaseEnvPresent) {
    return check(
      "worker",
      label,
      "unknown",
      "Worker status cannot be inferred until Supabase is configured.",
    );
  }

  try {
    const supabase = createAdminClient();
    const [latestResult, activeResult] = await Promise.all([
      supabase.from("ingestion_jobs").select("status,updated_at").order("updated_at", { ascending: false }).limit(1),
      supabase.from("ingestion_jobs").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]),
    ]);

    if (latestResult.error || activeResult.error) {
      return check("worker", label, "unknown", "Ingestion jobs could not be checked.");
    }

    const latest = latestResult.data?.[0];
    if (!latest?.updated_at) {
      return check("worker", label, "unknown", "No ingestion activity has been recorded yet.");
    }

    const updatedAt = new Date(latest.updated_at).getTime();
    const recentWindowMs = Math.max(env.WORKER_POLL_MS * 6, 60_000);
    if (Number.isFinite(updatedAt) && Date.now() - updatedAt <= recentWindowMs) {
      return check("worker", label, "ready", "Recent ingestion activity was detected.");
    }

    if ((activeResult.count ?? 0) === 0 && latest.status === "completed") {
      return check("worker", label, "ready", "No queued ingestion work is waiting; the latest job completed.");
    }

    return check(
      "worker",
      label,
      "unknown",
      "Queued or processing ingestion work exists, but no recent activity proves the worker is active.",
    );
  } catch {
    return check("worker", label, "unknown", "Worker status could not be inferred.");
  }
}

export async function GET() {
  const [schema, worker] = await Promise.all([readSchemaStatus(), readWorkerStatus()]);

  return NextResponse.json({
    demoMode: isDemoMode(),
    checks: [
      check(
        "env",
        ".env.local configured",
        requiredSupabaseEnvPresent ? "ready" : "needs_setup",
        requiredSupabaseEnvPresent
          ? "Required Supabase server environment variables are present."
          : "Set the required Supabase URL and server key.",
      ),
      schema,
      check(
        "openai",
        "OpenAI API key available",
        env.OPENAI_API_KEY ? "ready" : "needs_setup",
        env.OPENAI_API_KEY
          ? "OPENAI_API_KEY is present for answers, embeddings, and captions."
          : "Set OPENAI_API_KEY before real indexing or answers.",
      ),
      worker,
    ],
  });
}
