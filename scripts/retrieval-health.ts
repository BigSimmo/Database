import { loadEnvConfig } from "@next/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireServerEnv } from "@/lib/env";

loadEnvConfig(process.cwd());

type RetrievalLogRow = {
  query: string;
  query_class: string | null;
  retrieval_strategy: string | null;
  total_latency_ms: number | null;
  vector_candidate_count: number | null;
  candidate_count: number | null;
  selected_document_ids: string[] | null;
  is_miss: boolean;
  miss_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function argValue(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function numberArg(name: string, fallback: number) {
  const parsed = Number.parseInt(argValue(name, String(fallback)), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

async function main() {
  requireServerEnv();
  const supabase = createAdminClient();
  const limit = numberArg("--limit", 200);
  const ownerId = argValue("--owner-id", process.env.RAG_EVAL_OWNER_ID ?? process.env.LOCAL_NO_AUTH_OWNER_ID ?? "");

  let logsQuery = supabase
    .from("rag_retrieval_logs")
    .select(
      "query,query_class,retrieval_strategy,total_latency_ms,vector_candidate_count,candidate_count,selected_document_ids,is_miss,miss_reason,metadata,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (ownerId) logsQuery = logsQuery.eq("owner_id", ownerId);

  const [{ data: logsData, error: logsError }, { data: qualityData, error: qualityError }, { data: visualUnitsData, error: visualUnitsError }] =
    await Promise.all([
      logsQuery,
      supabase.from("document_index_quality").select("document_id,metrics,issues").limit(5000),
      supabase
        .from("document_index_units")
        .select("document_id,unit_type,source_image_id")
        .in("unit_type", [
          "visual_summary",
          "flowchart_step",
          "diagram_decision",
          "risk_matrix_cell",
          "medication_chart_row",
          "chart_finding",
          "visual_askable_question",
          "table_threshold",
        ])
        .limit(5000),
    ]);

  if (logsError) throw new Error(logsError.message);
  if (qualityError) throw new Error(qualityError.message);
  if (visualUnitsError) throw new Error(visualUnitsError.message);

  const logs = (logsData ?? []) as RetrievalLogRow[];
  const latencies = logs.map((row) => row.total_latency_ms ?? 0).filter((value) => value > 0);
  const slowestQueries = [...logs]
    .sort((left, right) => (right.total_latency_ms ?? 0) - (left.total_latency_ms ?? 0))
    .slice(0, 10)
    .map((row) => ({
      query: row.query,
      query_class: row.query_class,
      strategy: row.retrieval_strategy,
      total_latency_ms: row.total_latency_ms,
      vector_candidate_count: row.vector_candidate_count,
      layer_latencies_ms: row.metadata?.retrieval_layer_latencies_ms ?? null,
      coverage_gate_reason: row.metadata?.coverage_gate_reason ?? null,
    }));
  const failedQueries = logs
    .filter((row) => row.is_miss)
    .slice(0, 10)
    .map((row) => ({
      query: row.query,
      query_class: row.query_class,
      strategy: row.retrieval_strategy,
      miss_reason: row.miss_reason,
      created_at: row.created_at,
    }));
  const missingSourceImageCount = logs.filter(
    (row) => row.metadata?.source_image_required === true && row.metadata?.source_image_satisfied !== true,
  ).length;
  const documentDiversity = logs
    .map((row) => row.selected_document_ids?.length ?? 0)
    .filter((count) => count > 0);
  const visualUnitTypes = countBy((visualUnitsData ?? []).map((row) => String(row.unit_type)));
  const sparseVisualDocs = (qualityData ?? []).filter((row) => {
    const issues = Array.isArray(row.issues) ? row.issues.map(String) : [];
    const metrics = row.metrics && typeof row.metrics === "object" ? (row.metrics as Record<string, unknown>) : {};
    return issues.includes("low visual unit coverage") || Number(metrics.visual_unit_coverage ?? 1) < 0.45;
  });

  console.log(
    JSON.stringify(
      {
        checked_at: new Date().toISOString(),
        owner_id: ownerId || null,
        sample_size: logs.length,
        average_latency_ms: Math.round(average(latencies)),
        fallback_rate: logs.length
          ? Number((logs.filter((row) => row.retrieval_strategy === "vector_fallback").length / logs.length).toFixed(4))
          : 0,
        vector_fallback_count: logs.filter((row) => row.retrieval_strategy === "vector_fallback").length,
        miss_count: logs.filter((row) => row.is_miss).length,
        missing_source_image_count: missingSourceImageCount,
        average_topk_document_diversity: Number(average(documentDiversity).toFixed(2)),
        strategy_counts: countBy(logs.map((row) => row.retrieval_strategy ?? "none")),
        query_class_counts: countBy(logs.map((row) => row.query_class ?? "none")),
        visual_unit_types: visualUnitTypes,
        sparse_visual_unit_documents: sparseVisualDocs.length,
        slowest_queries: slowestQueries,
        failed_queries: failedQueries,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
