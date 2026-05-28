import { NextResponse } from "next/server";
import { demoDocuments } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

const DOCUMENT_LIST_COLUMNS = [
  "id",
  "owner_id",
  "title",
  "description",
  "file_name",
  "file_type",
  "file_size",
  "storage_path",
  "content_hash",
  "source_path",
  "import_batch_id",
  "status",
  "page_count",
  "chunk_count",
  "image_count",
  "error_message",
  "metadata",
  "created_at",
  "updated_at",
].join(",");

const LABEL_LIST_COLUMNS = [
  "id",
  "document_id",
  "owner_id",
  "label",
  "label_type",
  "source",
  "confidence",
  "metadata",
  "created_at",
  "updated_at",
].join(",");

const SUMMARY_LIST_COLUMNS = [
  "id",
  "document_id",
  "owner_id",
  "summary",
  "clinical_specifics",
  "source_chunk_ids",
  "source_image_ids",
  "model",
  "metadata",
  "generated_at",
  "created_at",
  "updated_at",
].join(",");

const VALID_STATUSES = new Set(["queued", "processing", "indexed", "failed"]);
type DocumentListRow = Record<string, unknown> & { id: string };
type LabelListRow = Record<string, unknown> & { document_id: string };
type SummaryListRow = Record<string, unknown> & { document_id: string };

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function parseOffset(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function ilikePattern(value: string) {
  return `%${value.replace(/[%_]/g, "\\$&")}%`;
}

function safeSearchTerm(value: string) {
  return value.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

export async function GET(request: Request) {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ documents: demoDocuments, demoMode: true });
    }

    const url = new URL(request.url);
    const limit = parsePositiveInt(url.searchParams.get("limit"), 100, 200);
    const offset = parseOffset(url.searchParams.get("offset"));
    const search = safeSearchTerm(url.searchParams.get("q") ?? "");
    const status = url.searchParams.get("status")?.trim() ?? "";
    const includeMeta = url.searchParams.get("includeMeta") !== "false";

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    let query = supabase
      .from("documents")
      .select(DOCUMENT_LIST_COLUMNS, { count: "exact" })
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && VALID_STATUSES.has(status)) {
      query = query.eq("status", status);
    }
    if (search) {
      const pattern = ilikePattern(search);
      query = query.or(`title.ilike.${pattern},file_name.ilike.${pattern}`);
    }

    const { data, error, count } = await query;

    if (error) throw new Error(error.message);
    const documents = (data ?? []) as unknown as DocumentListRow[];
    const documentIds = documents.map((document) => document.id);

    const pagination = {
      limit,
      offset,
      total: count ?? documents.length,
      nextOffset: offset + documents.length,
      hasMore: count === null ? documents.length === limit : offset + documents.length < count,
    };

    if (documentIds.length === 0 || !includeMeta) {
      return NextResponse.json({ documents, pagination });
    }

    const [labelsResult, summariesResult] = await Promise.all([
      supabase.from("document_labels").select(LABEL_LIST_COLUMNS).in("document_id", documentIds),
      supabase.from("document_summaries").select(SUMMARY_LIST_COLUMNS).in("document_id", documentIds),
    ]);

    if (labelsResult.error) throw new Error(labelsResult.error.message);
    if (summariesResult.error) throw new Error(summariesResult.error.message);

    const labelsByDocument = new Map<string, unknown[]>();
    for (const label of (labelsResult.data ?? []) as unknown as LabelListRow[]) {
      const existing = labelsByDocument.get(label.document_id) ?? [];
      existing.push(label);
      labelsByDocument.set(label.document_id, existing);
    }
    const summariesByDocument = new Map(
      ((summariesResult.data ?? []) as unknown as SummaryListRow[]).map((summary) => [summary.document_id, summary]),
    );

    return NextResponse.json({
      documents: documents.map((document) => ({
        ...document,
        labels: labelsByDocument.get(document.id) ?? [],
        summary: summariesByDocument.get(document.id) ?? null,
      })),
      pagination,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    if (error instanceof Error && error.message.includes("Missing server environment")) {
      return NextResponse.json({
        documents: demoDocuments,
        demoMode: true,
        error: "Server environment is not configured; demo data is being served.",
      });
    }
    return jsonError(error);
  }
}
