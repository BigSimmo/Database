import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeDocumentLabelForStorage } from "@/lib/document-tags";
import { isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError } from "@/lib/http";
import { invalidateRagCachesForOwner } from "@/lib/rag";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";

const nullableText = z.union([z.string().trim().max(240), z.null()]).optional();
const bulkMetadataSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(200),
  metadata: z
    .object({
      sourceStatus: z.enum(["current", "review_due", "outdated", "unknown"]).optional(),
      validationStatus: z.enum(["unverified", "locally_reviewed", "approved"]).optional(),
      extractionQuality: z.enum(["good", "partial", "poor", "unknown"]).optional(),
      reviewDate: nullableText,
      publicationDate: nullableText,
      jurisdiction: nullableText,
      publisher: nullableText,
      sourceType: nullableText,
      collection: nullableText,
      category: nullableText,
    })
    .optional()
    .default({}),
  titleEdit: z
    .object({
      prefix: z.string().trim().max(40).optional(),
      suffix: z.string().trim().max(40).optional(),
      find: z.string().trim().max(80).optional(),
      replace: z.string().trim().max(80).optional(),
    })
    .optional()
    .default({}),
  labels: z
    .object({
      add: z
        .array(
          z.object({
            label: z.string().trim().min(1).max(80),
            label_type: z.enum([
              "site",
              "topic",
              "document_type",
              "medication",
              "risk",
              "setting",
              "workflow",
              "population",
              "service",
              "clinical_action",
              "care_phase",
              "document_intent",
              "content_feature",
              "custom",
            ]),
            confidence: z.number().min(0).max(1).optional(),
          }),
        )
        .max(50)
        .optional()
        .default([]),
      remove: z
        .array(
          z.object({
            label: z.string().trim().min(1).max(80),
            label_type: z.enum([
              "site",
              "topic",
              "document_type",
              "medication",
              "risk",
              "setting",
              "workflow",
              "population",
              "service",
              "clinical_action",
              "care_phase",
              "document_intent",
              "content_feature",
              "custom",
            ]),
          }),
        )
        .max(50)
        .optional()
        .default([]),
    })
    .optional()
    .default({ add: [], remove: [] }),
});

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function setMetadataValue(metadata: Record<string, unknown>, key: string, value: unknown) {
  if (value === undefined) return;
  if (value === null || (typeof value === "string" && value.trim() === "")) {
    delete metadata[key];
    return;
  }
  metadata[key] = typeof value === "string" ? value.trim() : value;
}

function editTitle(title: string, edit: z.infer<typeof bulkMetadataSchema>["titleEdit"]) {
  let next = title;
  if (edit.find) next = next.replaceAll(edit.find, edit.replace ?? "");
  if (edit.prefix && !next.startsWith(edit.prefix)) next = `${edit.prefix}${next}`;
  if (edit.suffix && !next.endsWith(edit.suffix)) next = `${next}${edit.suffix}`;
  return next.trim().slice(0, 180);
}

export async function POST(request: Request) {
  try {
    if (isDemoMode()) return NextResponse.json({ error: "Bulk edits are unavailable in demo mode." }, { status: 400 });

    const parsed = await parseJsonBody(request, bulkMetadataSchema, "Bulk edit payload is invalid.");

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const ids = Array.from(new Set(parsed.documentIds));

    const { data: documents, error: documentsError } = await supabase
      .from("documents")
      .select("id,title,metadata")
      .eq("owner_id", user.id)
      .in("id", ids);
    if (documentsError) throw new Error(documentsError.message);
    if (!documents?.length) return NextResponse.json({ error: "No selected documents were found." }, { status: 404 });

    const foundIds = new Set(documents.map((document) => document.id));
    const missingDocumentIds = ids.filter((id) => !foundIds.has(id));
    const results: Array<{ documentId: string; updated: boolean; error?: string }> = [];
    const now = new Date().toISOString();

    for (const document of documents) {
      try {
        const metadata = metadataRecord(document.metadata);
        setMetadataValue(metadata, "document_status", parsed.metadata.sourceStatus);
        setMetadataValue(metadata, "clinical_validation_status", parsed.metadata.validationStatus);
        setMetadataValue(metadata, "extraction_quality", parsed.metadata.extractionQuality);
        setMetadataValue(metadata, "review_date", parsed.metadata.reviewDate);
        setMetadataValue(metadata, "publication_date", parsed.metadata.publicationDate);
        setMetadataValue(metadata, "jurisdiction", parsed.metadata.jurisdiction);
        setMetadataValue(metadata, "publisher", parsed.metadata.publisher);
        setMetadataValue(metadata, "source_type", parsed.metadata.sourceType);
        setMetadataValue(metadata, "collection", parsed.metadata.collection);
        setMetadataValue(metadata, "category", parsed.metadata.category);
        metadata.bulk_metadata_updated_at = now;
        metadata.bulk_metadata_updated_by = user.id;

        const nextTitle = editTitle(document.title, parsed.titleEdit);
        const updatePayload = nextTitle && nextTitle !== document.title ? { metadata, title: nextTitle } : { metadata };

        const { error: updateError } = await supabase
          .from("documents")
          .update(updatePayload)
          .eq("id", document.id)
          .eq("owner_id", user.id);
        if (updateError) throw new Error(updateError.message);
        results.push({ documentId: document.id, updated: true });
      } catch (error) {
        results.push({
          documentId: document.id,
          updated: false,
          error: error instanceof Error ? error.message : "Bulk edit failed.",
        });
      }
    }

    const labelsToAdd = parsed.labels.add
      .map((label) => normalizeDocumentLabelForStorage({ ...label, source: "manual" }))
      .filter((label): label is NonNullable<typeof label> => Boolean(label));
    if (labelsToAdd.length) {
      const labelRows = documents.flatMap((document) =>
        labelsToAdd.map((label) => ({
          owner_id: user.id,
          document_id: document.id,
          label: label.label,
          label_type: label.label_type,
          confidence: label.confidence,
          source: "manual",
          metadata: { added_by_bulk_edit: true, updated_at: now },
        })),
      );
      const { error: labelError } = await supabase.from("document_labels").upsert(labelRows, {
        onConflict: "document_id,label_type,label,source",
      });
      if (labelError) throw new Error(labelError.message);
    }

    for (const label of parsed.labels.remove) {
      const normalized = normalizeDocumentLabelForStorage({ ...label, source: "manual" });
      if (!normalized) continue;
      const { error: removeError } = await supabase
        .from("document_labels")
        .delete()
        .eq("owner_id", user.id)
        .in(
          "document_id",
          documents.map((document) => document.id),
        )
        .eq("label", normalized.label)
        .eq("label_type", normalized.label_type);
      if (removeError) throw new Error(removeError.message);
    }

    invalidateRagCachesForOwner(user.id);
    return NextResponse.json({
      ok: results.every((result) => result.updated),
      updatedCount: results.filter((result) => result.updated).length,
      missingDocumentIds,
      results,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    if (error instanceof PublicApiError) return jsonError(error, error.status);
    return jsonError(error, 500);
  }
}
