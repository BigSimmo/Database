import { NextResponse } from "next/server";
import { env, isDemoMode } from "@/lib/env";
import { localProjectRequestIdentityPayload, unsafeLocalProjectResponse } from "@/lib/local-project-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatSupabaseUnavailableError, isSupabaseUnavailableError, probeSupabaseHealth } from "@/lib/supabase/health";
import { checkSupabaseProjectConfig, formatSupabaseProjectCheck } from "@/lib/supabase/project";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SetupCheckStatus = "ready" | "needs_setup" | "unknown";
type SetupCheckId = "env" | "project" | "schema" | "search" | "openai" | "worker";

type SetupCheck = {
  id: SetupCheckId;
  label: string;
  status: SetupCheckStatus;
  detail: string;
};

type WorkerStatus = {
  check: SetupCheck;
  activeWork: boolean;
};

type SetupStatusPayload = {
  demoMode: boolean;
  checks: SetupCheck[];
  indexingActive: boolean;
  pollAfterMs: number | null;
  generatedAt: string;
};

type AdminClient = ReturnType<typeof createAdminClient>;

const requiredSupabaseEnvPresent = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseProjectCheck = checkSupabaseProjectConfig(env, { requireMetadata: true });
const supabaseProjectCanBeQueried = requiredSupabaseEnvPresent && supabaseProjectCheck.status !== "mismatch";
const ACTIVE_INDEXING_POLL_MS = Math.max(3_000, Math.min(env.WORKER_POLL_MS, 15_000));
const SETUP_RECHECK_POLL_MS = 60_000;
const SETUP_STATUS_ACTIVE_CACHE_MS = Math.max(2_000, Math.min(ACTIVE_INDEXING_POLL_MS, 5_000));
const SETUP_STATUS_IDLE_CACHE_MS = 30_000;
const SETUP_STATUS_OUTAGE_CACHE_MS = 120_000;

let setupStatusCache: { expiresAt: number; payload: SetupStatusPayload } | null = null;
let setupStatusInFlight: Promise<SetupStatusPayload> | null = null;
let supabaseOutageBackoffUntil = 0;
let supabaseOutageDetail: string | null = null;

function check(id: SetupCheckId, label: string, status: SetupCheckStatus, detail: string): SetupCheck {
  return { id, label, status, detail };
}

async function readSupabaseAvailability(supabase: AdminClient | null) {
  if (!requiredSupabaseEnvPresent || !supabaseProjectCanBeQueried || !supabase) return null;
  const now = Date.now();
  if (supabaseOutageBackoffUntil > now) {
    return supabaseOutageDetail ?? "Supabase is temporarily unavailable; setup checks are backing off.";
  }

  try {
    const health = await probeSupabaseHealth(supabase);
    if (!health.ok) {
      supabaseOutageBackoffUntil = Date.now() + SETUP_STATUS_OUTAGE_CACHE_MS;
      supabaseOutageDetail = health.message;
      return health.message;
    }
    supabaseOutageBackoffUntil = 0;
    supabaseOutageDetail = null;
    return null;
  } catch (error) {
    if (!isSupabaseUnavailableError(error)) return null;
    const message = formatSupabaseUnavailableError(error);
    supabaseOutageBackoffUntil = Date.now() + SETUP_STATUS_OUTAGE_CACHE_MS;
    supabaseOutageDetail = message;
    return message;
  }
}

async function readSchemaStatus(supabase: AdminClient | null) {
  if (!requiredSupabaseEnvPresent) {
    return check(
      "schema",
      "supabase/schema.sql applied",
      "unknown",
      "Supabase environment is missing, so schema checks were skipped.",
    );
  }

  if (!supabaseProjectCanBeQueried) {
    return check(
      "schema",
      "supabase/schema.sql applied",
      "unknown",
      "Supabase project mismatch detected, so schema checks were skipped.",
    );
  }

  try {
    if (!supabase) {
      throw new Error("Supabase admin client is unavailable.");
    }
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

type SearchSchemaHealth = {
  ok?: boolean;
  missing?: string[];
  vector_extension_schema?: string | null;
  checked_at?: string;
};

async function readSearchSchemaStatus(supabase: AdminClient | null) {
  const label = "Search RPC and vector indexes";
  if (!requiredSupabaseEnvPresent) {
    return check("search", label, "unknown", "Supabase environment is missing, so search health checks were skipped.");
  }

  if (!supabaseProjectCanBeQueried) {
    return check("search", label, "unknown", "Supabase project mismatch detected, so search checks were skipped.");
  }

  try {
    if (!supabase) throw new Error("Supabase admin client is unavailable.");
    const { data, error } = await supabase.rpc("search_schema_health");
    if (error) {
      return check("search", label, "needs_setup", `Search health RPC is unavailable or failed: ${error.message}`);
    }
    const health = (data ?? {}) as SearchSchemaHealth;
    const missing = Array.isArray(health.missing) ? health.missing : [];
    if (!health.ok || missing.length > 0) {
      return check(
        "search",
        label,
        "needs_setup",
        `Missing or stale search schema items: ${missing.join(", ") || "unknown"}.`,
      );
    }
    return check(
      "search",
      label,
      "ready",
      `Vector RPC signatures and trigram indexes are ready${health.vector_extension_schema ? ` (${health.vector_extension_schema})` : ""}.`,
    );
  } catch {
    return check("search", label, "needs_setup", "Search schema health could not be checked.");
  }
}

async function readWorkerStatus(supabase: AdminClient | null): Promise<WorkerStatus> {
  const label = "npm run worker running";

  if (!requiredSupabaseEnvPresent) {
    return {
      check: check("worker", label, "unknown", "Worker status cannot be inferred until Supabase is configured."),
      activeWork: false,
    };
  }

  if (!supabaseProjectCanBeQueried) {
    return {
      check: check(
        "worker",
        label,
        "unknown",
        "Worker status cannot be inferred while Supabase points at the wrong project.",
      ),
      activeWork: false,
    };
  }

  try {
    if (!supabase) {
      throw new Error("Supabase admin client is unavailable.");
    }
    const [latestResult, activeResult] = await Promise.all([
      supabase.from("ingestion_jobs").select("status,updated_at").order("updated_at", { ascending: false }).limit(1),
      supabase
        .from("ingestion_jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "processing"]),
    ]);

    if (latestResult.error || activeResult.error) {
      return {
        check: check("worker", label, "unknown", "Ingestion jobs could not be checked."),
        activeWork: false,
      };
    }

    const latest = latestResult.data?.[0];
    const activeWork = (activeResult.count ?? 0) > 0;
    if (!latest?.updated_at) {
      return {
        check: check("worker", label, "unknown", "No ingestion activity has been recorded yet."),
        activeWork,
      };
    }

    const updatedAt = new Date(latest.updated_at).getTime();
    const recentWindowMs = Math.max(env.WORKER_POLL_MS * 6, 60_000);
    if (Number.isFinite(updatedAt) && Date.now() - updatedAt <= recentWindowMs) {
      return {
        check: check("worker", label, "ready", "Recent ingestion activity was detected."),
        activeWork,
      };
    }

    if ((activeResult.count ?? 0) === 0 && latest.status === "completed") {
      return {
        check: check("worker", label, "ready", "No queued ingestion work is waiting; the latest job completed."),
        activeWork: false,
      };
    }

    return {
      check: check(
        "worker",
        label,
        "unknown",
        "Queued or processing ingestion work exists, but no recent activity proves the worker is active.",
      ),
      activeWork,
    };
  } catch {
    return {
      check: check("worker", label, "unknown", "Worker status could not be inferred."),
      activeWork: false,
    };
  }
}

function setupStatusCacheTtl(payload: SetupStatusPayload) {
  if (payload.checks.some((item) => item.detail.includes("temporarily unavailable"))) {
    return SETUP_STATUS_OUTAGE_CACHE_MS;
  }
  return payload.indexingActive ? SETUP_STATUS_ACTIVE_CACHE_MS : SETUP_STATUS_IDLE_CACHE_MS;
}

function setupStatusResponse(payload: SetupStatusPayload) {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, max-age=5, stale-while-revalidate=30",
      "X-Poll-After-Ms": String(payload.pollAfterMs ?? ""),
    },
  });
}

async function buildSetupStatusPayload(): Promise<SetupStatusPayload> {
  const supabase = supabaseProjectCanBeQueried ? createAdminClient() : null;
  const unavailable = await readSupabaseAvailability(supabase);
  if (unavailable) {
    const checks = [
      check(
        "env",
        ".env.local configured",
        requiredSupabaseEnvPresent ? "ready" : "needs_setup",
        requiredSupabaseEnvPresent
          ? "Required Supabase server environment variables are present."
          : "Set the required Supabase URL and server key.",
      ),
      check(
        "project",
        "Clinical KB Database target",
        supabaseProjectCheck.status === "ready" ? "ready" : "needs_setup",
        formatSupabaseProjectCheck(supabaseProjectCheck),
      ),
      check(
        "schema",
        "supabase/schema.sql applied",
        "unknown",
        `Supabase is temporarily unavailable; schema fan-out checks are backing off. Last error: ${unavailable}`,
      ),
      check(
        "search",
        "Search RPC and vector indexes",
        "unknown",
        `Supabase is temporarily unavailable; search health checks are backing off. Last error: ${unavailable}`,
      ),
      check(
        "openai",
        "OpenAI API key available",
        env.OPENAI_API_KEY ? "ready" : "needs_setup",
        env.OPENAI_API_KEY
          ? "OPENAI_API_KEY is present for answers, embeddings, and captions."
          : "Set OPENAI_API_KEY before real indexing or answers.",
      ),
      check(
        "worker",
        "npm run worker running",
        "unknown",
        `Supabase is temporarily unavailable; worker fan-out checks are backing off. Last error: ${unavailable}`,
      ),
    ];
    return {
      demoMode: isDemoMode(),
      checks,
      indexingActive: false,
      pollAfterMs: SETUP_STATUS_OUTAGE_CACHE_MS,
      generatedAt: new Date().toISOString(),
    };
  }

  const [schema, search, worker] = await Promise.all([
    readSchemaStatus(supabase),
    readSearchSchemaStatus(supabase),
    readWorkerStatus(supabase),
  ]);

  const checks = [
    check(
      "env",
      ".env.local configured",
      requiredSupabaseEnvPresent ? "ready" : "needs_setup",
      requiredSupabaseEnvPresent
        ? "Required Supabase server environment variables are present."
        : "Set the required Supabase URL and server key.",
    ),
    check(
      "project",
      "Clinical KB Database target",
      supabaseProjectCheck.status === "ready" ? "ready" : "needs_setup",
      formatSupabaseProjectCheck(supabaseProjectCheck),
    ),
    schema,
    search,
    check(
      "openai",
      "OpenAI API key available",
      env.OPENAI_API_KEY ? "ready" : "needs_setup",
      env.OPENAI_API_KEY
        ? "OPENAI_API_KEY is present for answers, embeddings, and captions."
        : "Set OPENAI_API_KEY before real indexing or answers.",
    ),
    worker.check,
  ];
  const setupSettled = checks.every((item) => item.status === "ready");
  const pollAfterMs = worker.activeWork ? ACTIVE_INDEXING_POLL_MS : setupSettled ? null : SETUP_RECHECK_POLL_MS;

  return {
    demoMode: isDemoMode(),
    checks,
    indexingActive: worker.activeWork,
    pollAfterMs,
    generatedAt: new Date().toISOString(),
  };
}

async function readSetupStatusPayload() {
  const now = Date.now();
  if (setupStatusCache && setupStatusCache.expiresAt > now) {
    return setupStatusCache.payload;
  }

  if (setupStatusInFlight) {
    return setupStatusInFlight;
  }

  const promise = buildSetupStatusPayload().then((payload) => {
    setupStatusCache = {
      expiresAt: Date.now() + setupStatusCacheTtl(payload),
      payload,
    };
    return payload;
  });
  setupStatusInFlight = promise;

  try {
    return await promise;
  } finally {
    if (setupStatusInFlight === promise) {
      setupStatusInFlight = null;
    }
  }
}

export async function GET(request: Request) {
  const identity = localProjectRequestIdentityPayload(request);
  if (!identity.localServer.safeLocalOrigin) {
    return unsafeLocalProjectResponse(identity);
  }

  return setupStatusResponse(await readSetupStatusPayload());
}
