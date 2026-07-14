import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/supabase/database.types";

loadEnvConfig(process.cwd());

const PRODUCTION_PROJECT_REF = "sjrfecxgysukkwxsowpy";
const DEFAULT_EVIDENCE_PATH = "artifacts/staging-tenancy-evidence.json";
const REQUEST_TIMEOUT_MS = 90_000;

type JsonRecord = Record<string, unknown>;
type AppClient = SupabaseClient<Database>;

type HarnessConfig = {
  appUrl: string;
  supabaseUrl: string;
  projectRef: string;
  publishableKey: string;
  serviceRoleKey: string;
  userAEmail: string;
  userAPassword: string;
  userBEmail: string;
  userBPassword: string;
  documentBucket: string;
  evidencePath: string;
  commitSha: string | null;
  workflowRunUrl: string | null;
};

type Fixture = {
  documentId: string;
  ownerId: string;
  marker: string;
  storagePath: string;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required ${name}.`);
  return value;
}

function isPlaceholder(value: string) {
  return /(?:^|[._-])(?:your|example|placeholder|replace[-_ ]?with|changeme)(?:$|[._-])|<[^>]+>/i.test(value);
}

function assertUsableSecret(name: string, value: string) {
  if (isPlaceholder(value)) throw new Error(`${name} still contains a placeholder value.`);
}

function parseHttpsOrigin(name: string, value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
  if (parsed.protocol !== "https:") throw new Error(`${name} must use https.`);
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${name} must be a plain HTTPS origin without credentials, query, or fragment.`);
  }
  if (parsed.pathname !== "/") throw new Error(`${name} must not include a path.`);
  return parsed.origin;
}

export function readCrossTenantStagingConfig(): HarnessConfig {
  const projectRef = required("CROSS_TENANT_PROJECT_REF").toLowerCase();
  const supabaseUrl = parseHttpsOrigin("CROSS_TENANT_SUPABASE_URL", required("CROSS_TENANT_SUPABASE_URL"));
  const appUrl = parseHttpsOrigin("CROSS_TENANT_STAGING_APP_URL", required("CROSS_TENANT_STAGING_APP_URL"));
  const publishableKey = required("CROSS_TENANT_PUBLISHABLE_KEY");
  const serviceRoleKey = required("CROSS_TENANT_SERVICE_ROLE_KEY");
  const userAEmail = required("CROSS_TENANT_USER_A_EMAIL");
  const userAPassword = required("CROSS_TENANT_USER_A_PASSWORD");
  const userBEmail = required("CROSS_TENANT_USER_B_EMAIL");
  const userBPassword = required("CROSS_TENANT_USER_B_PASSWORD");
  const documentBucket = process.env.CROSS_TENANT_DOCUMENT_BUCKET?.trim() || "clinical-documents";

  for (const [name, value] of [
    ["CROSS_TENANT_PROJECT_REF", projectRef],
    ["CROSS_TENANT_SUPABASE_URL", supabaseUrl],
    ["CROSS_TENANT_STAGING_APP_URL", appUrl],
    ["CROSS_TENANT_PUBLISHABLE_KEY", publishableKey],
    ["CROSS_TENANT_SERVICE_ROLE_KEY", serviceRoleKey],
    ["CROSS_TENANT_USER_A_EMAIL", userAEmail],
    ["CROSS_TENANT_USER_A_PASSWORD", userAPassword],
    ["CROSS_TENANT_USER_B_EMAIL", userBEmail],
    ["CROSS_TENANT_USER_B_PASSWORD", userBPassword],
    ["CROSS_TENANT_DOCUMENT_BUCKET", documentBucket],
  ] as const) {
    assertUsableSecret(name, value);
  }

  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new Error("CROSS_TENANT_PROJECT_REF must be a 20-character Supabase project ref.");
  }
  if (projectRef === PRODUCTION_PROJECT_REF) {
    throw new Error("Refusing to run the cross-tenant harness against the production Supabase project.");
  }
  if (new URL(supabaseUrl).hostname !== `${projectRef}.supabase.co`) {
    throw new Error("CROSS_TENANT_SUPABASE_URL does not match CROSS_TENANT_PROJECT_REF.");
  }
  if (appUrl === supabaseUrl) throw new Error("CROSS_TENANT_STAGING_APP_URL must be the staging app, not Supabase.");
  if (userAEmail.toLowerCase() === userBEmail.toLowerCase()) {
    throw new Error("CROSS_TENANT_USER_A_EMAIL and CROSS_TENANT_USER_B_EMAIL must identify different users.");
  }
  if (userAPassword === userBPassword) {
    throw new Error("Cross-tenant test users must have distinct passwords.");
  }

  return {
    appUrl,
    supabaseUrl,
    projectRef,
    publishableKey,
    serviceRoleKey,
    userAEmail,
    userAPassword,
    userBEmail,
    userBPassword,
    documentBucket,
    evidencePath: process.env.CROSS_TENANT_EVIDENCE_PATH?.trim() || DEFAULT_EVIDENCE_PATH,
    commitSha: process.env.CROSS_TENANT_COMMIT_SHA?.trim() || null,
    workflowRunUrl: process.env.CROSS_TENANT_WORKFLOW_RUN_URL?.trim() || null,
  };
}

function asRecord(value: unknown, context: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} did not return a JSON object.`);
  }
  return value as JsonRecord;
}

function asRecords(value: unknown, context: string): JsonRecord[] {
  if (!Array.isArray(value)) throw new Error(`${context} did not return a JSON array.`);
  return value.map((item, index) => asRecord(item, `${context}[${index}]`));
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function requestJson(
  config: HarnessConfig,
  token: string,
  path: string,
  init: RequestInit = {},
  expectedStatuses: number[] = [200],
) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(`${config.appUrl}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const bodyText = await response.text();
  let body: unknown = null;
  if (bodyText) {
    try {
      body = JSON.parse(bodyText) as unknown;
    } catch {
      body = bodyText;
    }
  }
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `${init.method ?? "GET"} ${path} returned ${response.status}; expected ${expectedStatuses.join("/")}. ` +
        `Body: ${typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`,
    );
  }
  return body;
}

async function signIn(client: AppClient, email: string, password: string, label: string) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${label} sign-in failed: ${error.message}`);
  if (!data.user || !data.session?.access_token) throw new Error(`${label} sign-in returned no active session.`);
  return { userId: data.user.id, token: data.session.access_token };
}

async function requireNoError<T>(
  operation: PromiseLike<{ data: T; error: { message: string } | null }>,
  context: string,
) {
  const result = await operation;
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data;
}

async function createFixture(
  admin: AppClient,
  config: HarnessConfig,
  runId: string,
  ownerId: string,
  tenant: "a" | "b",
  register: (fixture: Fixture) => void,
): Promise<Fixture> {
  const documentId = randomUUID();
  const marker = `tenancyprobe${runId.replace(/-/g, "").slice(0, 12)}${tenant}`;
  const storagePath = `${ownerId}/cross-tenant/${runId}/${tenant}-${documentId}.pdf`;
  const fixture = { documentId, ownerId, marker, storagePath };
  // Register before the first write so finally cleanup covers partial provisioning.
  register(fixture);
  const content = [
    marker,
    "Cross tenant isolation evidence for a synthetic staging-only clinical fixture.",
    "This document exists only to verify private lexical retrieval and source-only answers.",
  ].join(" ");
  const pdf = Buffer.from(`%PDF-1.4\n% ${content}\n%%EOF\n`, "utf8");

  const { error: uploadError } = await admin.storage.from(config.documentBucket).upload(storagePath, pdf, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) throw new Error(`upload fixture ${tenant}: ${uploadError.message}`);

  const now = new Date().toISOString();
  await requireNoError(
    admin.from("documents").insert({
      id: documentId,
      owner_id: ownerId,
      title: `${marker} private staging document`,
      file_name: `${marker}.pdf`,
      file_type: "application/pdf",
      file_size: pdf.byteLength,
      storage_path: storagePath,
      status: "indexed",
      page_count: 1,
      chunk_count: 1,
      image_count: 0,
      metadata: {
        cross_tenant_run_id: runId,
        synthetic_fixture: true,
        source_kind: "document",
        publisher: "Clinical KB staging tenancy harness",
        jurisdiction: "Western Australia",
        publication_date: now.slice(0, 10),
        review_date: now.slice(0, 10),
        indexed_at: now,
        document_status: "current",
        clinical_validation_status: "approved",
        extraction_quality: "good",
      },
    }),
    `insert document fixture ${tenant}`,
  );
  await requireNoError(
    admin.from("document_pages").insert({
      document_id: documentId,
      page_number: 1,
      text: content,
      ocr_used: false,
      metadata: { cross_tenant_run_id: runId },
    }),
    `insert page fixture ${tenant}`,
  );
  await requireNoError(
    admin.from("document_chunks").insert({
      document_id: documentId,
      chunk_index: 0,
      page_number: 1,
      content,
      embedding: `[${Array.from({ length: 1536 }, () => "0").join(",")}]`,
      metadata: { cross_tenant_run_id: runId },
    }),
    `insert chunk fixture ${tenant}`,
  );

  return fixture;
}

function documentIds(value: unknown, context: string) {
  return asRecords(value, context).map((record) => String(record.id ?? record.document_id ?? ""));
}

function stringIds(value: unknown, context: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${context} did not return a string array.`);
  }
  return value;
}

async function exerciseTenancyBoundary(args: {
  config: HarnessConfig;
  fixtureA: Fixture;
  fixtureB: Fixture;
  tokenA: string;
  tokenB: string;
  checkpoints: string[];
}) {
  const { config, fixtureA, fixtureB, tokenA, tokenB, checkpoints } = args;

  const listA = asRecord(
    await requestJson(config, tokenA, `/api/documents?q=${encodeURIComponent(fixtureA.marker)}&includeMeta=true`),
    "user A document list",
  );
  assertCondition(
    documentIds(listA.documents, "user A documents").includes(fixtureA.documentId),
    "User A could not list its own private fixture.",
  );
  const listB = asRecord(
    await requestJson(config, tokenB, `/api/documents?q=${encodeURIComponent(fixtureA.marker)}&includeMeta=true`),
    "user B document list",
  );
  assertCondition(
    !documentIds(listB.documents, "user B documents").includes(fixtureA.documentId),
    "User B listed user A's private fixture.",
  );
  const ownListB = asRecord(
    await requestJson(config, tokenB, `/api/documents?q=${encodeURIComponent(fixtureB.marker)}`),
    "user B own document list",
  );
  assertCondition(
    documentIds(ownListB.documents, "user B own documents").includes(fixtureB.documentId),
    "User B could not list its own private fixture.",
  );
  checkpoints.push("list");

  const detailA = asRecord(
    await requestJson(config, tokenA, `/api/documents/${fixtureA.documentId}`),
    "user A document detail",
  );
  assertCondition(asRecord(detailA.document, "user A detail document").id === fixtureA.documentId, "Wrong detail row.");
  await requestJson(config, tokenB, `/api/documents/${fixtureA.documentId}`, {}, [404]);
  checkpoints.push("detail");

  const signedA = asRecord(
    await requestJson(config, tokenA, `/api/documents/${fixtureA.documentId}/signed-url`),
    "user A signed URL",
  );
  assertCondition(typeof signedA.url === "string" && signedA.url.length > 0, "User A received no signed URL.");
  await requestJson(config, tokenB, `/api/documents/${fixtureA.documentId}/signed-url`, {}, [404]);
  checkpoints.push("signed-url");

  const labelBody = JSON.stringify({ label: `isolation-${fixtureA.marker.slice(-8)}`, label_type: "custom" });
  await requestJson(
    config,
    tokenA,
    `/api/documents/${fixtureA.documentId}/labels`,
    { method: "POST", body: labelBody },
    [201],
  );
  await requestJson(
    config,
    tokenB,
    `/api/documents/${fixtureA.documentId}/labels`,
    { method: "POST", body: labelBody },
    [404],
  );
  checkpoints.push("labels");

  const renamedTitle = `${fixtureA.marker} owner mutation verified`;
  await requestJson(
    config,
    tokenB,
    `/api/documents/${fixtureA.documentId}`,
    { method: "PATCH", body: JSON.stringify({ title: "cross tenant mutation must fail" }) },
    [404],
  );
  const mutationA = asRecord(
    await requestJson(config, tokenA, `/api/documents/${fixtureA.documentId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: renamedTitle }),
    }),
    "user A document mutation",
  );
  assertCondition(
    asRecord(mutationA.document, "mutated document").title === renamedTitle,
    "User A's document mutation did not persist.",
  );
  checkpoints.push("mutation");

  const universalA = asRecord(
    await requestJson(
      config,
      tokenA,
      `/api/search/universal?q=${encodeURIComponent(fixtureA.marker)}&domains=documents&limit=10`,
    ),
    "user A universal search",
  );
  const universalB = asRecord(
    await requestJson(
      config,
      tokenB,
      `/api/search/universal?q=${encodeURIComponent(fixtureA.marker)}&domains=documents&limit=10`,
    ),
    "user B universal search",
  );
  const universalIds = (payload: JsonRecord) =>
    asRecords(payload.groups, "universal groups").flatMap((group) =>
      group.kind === "documents" ? documentIds(group.items, "universal document items") : [],
    );
  assertCondition(
    universalIds(universalA).includes(fixtureA.documentId),
    "User A universal search missed its fixture.",
  );
  assertCondition(
    !universalIds(universalB).includes(fixtureA.documentId),
    "User B universal search exposed user A's fixture.",
  );
  checkpoints.push("universal-search");

  const searchBody = JSON.stringify({
    query: fixtureA.marker,
    documentId: fixtureA.documentId,
    topK: 8,
    mode: "answer",
    includeRelatedDocuments: false,
  });
  const searchA = asRecord(
    await requestJson(config, tokenA, "/api/search", { method: "POST", body: searchBody }),
    "user A offline search",
  );
  const searchB = asRecord(
    await requestJson(config, tokenB, "/api/search", { method: "POST", body: searchBody }),
    "user B offline search",
  );
  assertCondition(
    documentIds(searchA.results, "user A search results").includes(fixtureA.documentId),
    "User A offline retrieval missed its fixture.",
  );
  assertCondition(
    documentIds(searchB.results, "user B search results").length === 0,
    "User B retrieved user A's chunks.",
  );
  assertCondition(
    stringIds(asRecord(searchB.scope, "user B search scope").documentIds ?? [], "user B scope").length === 0,
    "User B's requested scope retained user A's document.",
  );
  checkpoints.push("offline-retrieval");

  const answerBody = JSON.stringify({ query: fixtureA.marker, documentId: fixtureA.documentId });
  const answerA = asRecord(
    await requestJson(config, tokenA, "/api/answer", { method: "POST", body: answerBody }),
    "user A source-only answer",
  );
  const answerB = asRecord(
    await requestJson(config, tokenB, "/api/answer", { method: "POST", body: answerBody }),
    "user B source-only answer",
  );
  assertCondition(answerA.answerQualityTier === "source_only", "Staging app is not returning a source-only answer.");
  assertCondition(
    answerA.fallbackReason === "source_only_offline_mode",
    "Staging app must run with RAG_PROVIDER_MODE=offline for this harness.",
  );
  assertCondition(
    documentIds(answerA.sources, "user A answer sources").includes(fixtureA.documentId),
    "User A source-only answer did not cite its private fixture.",
  );
  assertCondition(
    asRecords(answerB.sources, "user B answer sources").length === 0,
    "User B answer exposed user A sources.",
  );
  assertCondition(
    asRecords(answerB.citations, "user B answer citations").length === 0,
    "User B answer exposed citations.",
  );
  assertCondition(answerB.confidence === "unsupported", "User B's inaccessible scope did not fail closed.");
  checkpoints.push("source-only-answer");

  await requestJson(
    config,
    tokenB,
    `/api/documents/${fixtureA.documentId}/reindex`,
    { method: "POST", body: JSON.stringify({ mode: "full" }) },
    [404],
  );
  await requestJson(
    config,
    tokenA,
    `/api/documents/${fixtureA.documentId}/reindex`,
    { method: "POST", body: JSON.stringify({ mode: "full" }) },
    [201],
  );
  checkpoints.push("reindex");
}

async function cleanup(
  admin: AppClient | null,
  config: HarnessConfig | null,
  fixtures: Fixture[],
  userIds: string[],
  startedAt: string,
) {
  if (!admin || !config) return [];
  const errors: string[] = [];
  const ids = fixtures.map((fixture) => fixture.documentId);

  async function attempt(label: string, operation: PromiseLike<{ error: { message: string } | null }>) {
    try {
      const result = await operation;
      if (result.error) errors.push(`${label}: ${result.error.message}`);
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (userIds.length > 0) {
    for (const table of ["rag_response_cache", "rag_queries", "rag_query_misses", "rag_retrieval_logs"] as const) {
      await attempt(`delete ${table}`, admin.from(table).delete().in("owner_id", userIds).gte("created_at", startedAt));
    }
  }
  if (ids.length > 0) {
    const jobs = await admin.from("ingestion_jobs").select("id").in("document_id", ids);
    if (jobs.error) {
      errors.push(`select ingestion_jobs: ${jobs.error.message}`);
    } else {
      const jobIds = (jobs.data ?? []).map((job) => job.id);
      if (jobIds.length > 0)
        await attempt("delete ingestion_job_stages", admin.from("ingestion_job_stages").delete().in("job_id", jobIds));
    }
    await attempt("delete ingestion_jobs", admin.from("ingestion_jobs").delete().in("document_id", ids));
    await attempt("delete document_labels", admin.from("document_labels").delete().in("document_id", ids));
    await attempt("delete document_chunks", admin.from("document_chunks").delete().in("document_id", ids));
    await attempt("delete document_pages", admin.from("document_pages").delete().in("document_id", ids));
    await attempt("delete documents", admin.from("documents").delete().in("id", ids));
  }
  const storagePaths = fixtures.map((fixture) => fixture.storagePath);
  if (storagePaths.length > 0) {
    await attempt("delete storage fixtures", admin.storage.from(config.documentBucket).remove(storagePaths));
  }
  return errors;
}

function writeEvidence(args: {
  config: HarnessConfig | null;
  runId: string;
  startedAt: string;
  checkpoints: string[];
  cleanupErrors: string[];
  error: unknown;
}) {
  const evidencePath = resolve(
    args.config?.evidencePath ?? process.env.CROSS_TENANT_EVIDENCE_PATH ?? DEFAULT_EVIDENCE_PATH,
  );
  const completedAt = new Date().toISOString();
  const errorMessage = args.error instanceof Error ? args.error.message : args.error ? String(args.error) : null;
  const payload = {
    schemaVersion: 1,
    check: "cross-tenant-staging",
    status: errorMessage || args.cleanupErrors.length > 0 ? "failed" : "passed",
    runId: args.runId,
    startedAt: args.startedAt,
    completedAt,
    projectRef: args.config?.projectRef ?? null,
    projectRefSha256: args.config ? createHash("sha256").update(args.config.projectRef).digest("hex") : null,
    appOrigin: args.config?.appUrl ?? null,
    commitSha: args.config?.commitSha ?? null,
    workflowRunUrl: args.config?.workflowRunUrl ?? null,
    checkpoints: args.checkpoints,
    cleanup: args.cleanupErrors.length === 0 ? "passed" : "failed",
    cleanupErrors: args.cleanupErrors,
    error: errorMessage,
  };
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return evidencePath;
}

async function main() {
  const startedAt = new Date().toISOString();
  const runId = randomUUID();
  const checkpoints: string[] = [];
  const fixtures: Fixture[] = [];
  const userIds: string[] = [];
  let config: HarnessConfig | null = null;
  let clientA: AppClient | null = null;
  let clientB: AppClient | null = null;
  let admin: AppClient | null = null;
  let failure: unknown = null;

  try {
    // All project/credential safety validation happens before a Supabase client is created.
    config = readCrossTenantStagingConfig();
    checkpoints.push("configuration-safety");

    clientA = createClient<Database>(config.supabaseUrl, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    clientB = createClient<Database>(config.supabaseUrl, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const sessionA = await signIn(clientA, config.userAEmail, config.userAPassword, "User A");
    const sessionB = await signIn(clientB, config.userBEmail, config.userBPassword, "User B");
    if (sessionA.userId === sessionB.userId) {
      throw new Error("User A and user B authenticated as the same Supabase user; refusing fixture writes.");
    }
    userIds.push(sessionA.userId, sessionB.userId);
    checkpoints.push("distinct-users");

    // The service-role client is created only after the production/ref/URL/placeholder
    // guards and the distinct-user assertion have passed.
    admin = createClient<Database>(config.supabaseUrl, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const fixtureA = await createFixture(admin, config, runId, sessionA.userId, "a", (fixture) =>
      fixtures.push(fixture),
    );
    const fixtureB = await createFixture(admin, config, runId, sessionB.userId, "b", (fixture) =>
      fixtures.push(fixture),
    );
    checkpoints.push("private-fixtures");

    await exerciseTenancyBoundary({
      config,
      fixtureA,
      fixtureB,
      tokenA: sessionA.token,
      tokenB: sessionB.token,
      checkpoints,
    });
  } catch (error) {
    failure = error;
  }

  const cleanupErrors = await cleanup(admin, config, fixtures, userIds, startedAt);
  await Promise.allSettled([
    clientA?.auth.signOut() ?? Promise.resolve(),
    clientB?.auth.signOut() ?? Promise.resolve(),
  ]);
  const evidencePath = writeEvidence({ config, runId, startedAt, checkpoints, cleanupErrors, error: failure });

  if (failure) throw failure;
  if (cleanupErrors.length > 0)
    throw new Error(`Cross-tenant checks passed but cleanup failed: ${cleanupErrors.join("; ")}`);
  console.log(`Cross-tenant staging checks passed. Evidence: ${evidencePath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
