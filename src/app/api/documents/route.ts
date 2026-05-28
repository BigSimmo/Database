import { NextResponse } from "next/server";
import { demoDocuments } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ documents: demoDocuments, demoMode: true });
    }

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    const documents = data ?? [];
    const documentIds = documents.map((document) => document.id);

    if (documentIds.length === 0) return NextResponse.json({ documents });

    const [labelsResult, summariesResult] = await Promise.all([
      supabase.from("document_labels").select("*").in("document_id", documentIds),
      supabase.from("document_summaries").select("*").in("document_id", documentIds),
    ]);

    if (labelsResult.error) throw new Error(labelsResult.error.message);
    if (summariesResult.error) throw new Error(summariesResult.error.message);

    const labelsByDocument = new Map<string, unknown[]>();
    for (const label of labelsResult.data ?? []) {
      const existing = labelsByDocument.get(label.document_id) ?? [];
      existing.push(label);
      labelsByDocument.set(label.document_id, existing);
    }
    const summariesByDocument = new Map((summariesResult.data ?? []).map((summary) => [summary.document_id, summary]));

    return NextResponse.json({
      documents: documents.map((document) => ({
        ...document,
        labels: labelsByDocument.get(document.id) ?? [],
        summary: summariesByDocument.get(document.id) ?? null,
      })),
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
