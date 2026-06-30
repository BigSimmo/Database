import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoMode } from "@/lib/env";
import { jsonError, PublicApiError } from "@/lib/http";
import { normalizeDocumentLabelForStorage } from "@/lib/document-tags";
import { invalidateRagCachesForDocumentMutation } from "@/lib/rag";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import type { DocumentLabel, DocumentLabelType } from "@/lib/types";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";

const labelTypeSchema = z.enum([
  "site",
  "topic",
  "document_type",
  "medication",
  "risk",
  "setting",
  "workflow",
  "population",
  "service",
  "custom",
] satisfies [DocumentLabelType, ...DocumentLabelType[]]);

const manualLabelSchema = z.object({
  label: z.string().trim().min(2).max(64),
  label_type: labelTypeSchema,
});

const manualLabelUpdateSchema = manualLabelSchema.extend({
  labelId: z.string().uuid(),
});

const manualLabelDeleteSchema = z.object({
  labelId: z.string().uuid(),
});

function parseManualLabel(input: z.infer<typeof manualLabelSchema>) {
  const normalized = normalizeDocumentLabelForStorage({
    label: input.label,
    label_type: input.label_type,
    confidence: 1,
    source: "generated",
  });
  if (!normalized) {
    throw new PublicApiError("Enter a short, specific clinical tag. Generic document-control tags are not allowed.");
  }
  return normalized;
}

async function requireOwnedDocument(
  supabase: ReturnType<typeof createAdminClient>,
  documentId: string,
  ownerId: string,
) {
  const { data, error } = await supabase
    .from("documents")
    .select("id,owner_id")
    .eq("id", documentId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new PublicApiError("Document not found.", 404);
}

async function selectLabels(supabase: ReturnType<typeof createAdminClient>, documentId: string) {
  const { data, error } = await supabase
    .from("document_labels")
    .select("*")
    .eq("document_id", documentId)
    .order("confidence", { ascending: false })
    .order("label", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentLabel[];
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (isDemoMode()) {
      return NextResponse.json({ error: "Demo documents cannot be curated." }, { status: 400 });
    }

    const parsed = await parseJsonBody(request, manualLabelSchema, "Enter a manual tag between 2 and 64 characters.");
    const normalized = parseManualLabel(parsed);

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    await requireOwnedDocument(supabase, id, user.id);

    const { data: existing, error: existingError } = await supabase
      .from("document_labels")
      .select("*")
      .eq("document_id", id)
      .eq("owner_id", user.id)
      .eq("source", "manual")
      .eq("label_type", normalized.label_type)
      .eq("label", normalized.label)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);
    if (existing) {
      return NextResponse.json({ label: existing, labels: await selectLabels(supabase, id), duplicate: true });
    }

    const { data: label, error } = await supabase
      .from("document_labels")
      .insert({
        document_id: id,
        owner_id: user.id,
        label: normalized.label,
        label_type: normalized.label_type,
        source: "manual",
        confidence: 1,
        metadata: {
          curated_at: new Date().toISOString(),
          curated_by: "document-viewer",
        },
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    invalidateRagCachesForDocumentMutation(user.id);
    return NextResponse.json({ label, labels: await selectLabels(supabase, id) }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (isDemoMode()) {
      return NextResponse.json({ error: "Demo documents cannot be curated." }, { status: 400 });
    }

    const parsed = await parseJsonBody(
      request,
      manualLabelUpdateSchema,
      "Enter a manual tag between 2 and 64 characters.",
    );
    const normalized = parseManualLabel(parsed);

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    await requireOwnedDocument(supabase, id, user.id);

    const { data: existing, error: existingError } = await supabase
      .from("document_labels")
      .select("id,metadata")
      .eq("id", parsed.labelId)
      .eq("document_id", id)
      .eq("owner_id", user.id)
      .eq("source", "manual")
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new PublicApiError("Manual tag not found.", 404);

    const metadata =
      existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
        ? existing.metadata
        : {};
    const { data: label, error } = await supabase
      .from("document_labels")
      .update({
        label: normalized.label,
        label_type: normalized.label_type,
        source: "manual",
        confidence: 1,
        metadata: {
          ...metadata,
          curated_at: new Date().toISOString(),
          curated_by: "document-viewer",
        },
      })
      .eq("id", parsed.labelId)
      .eq("document_id", id)
      .eq("owner_id", user.id)
      .eq("source", "manual")
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    invalidateRagCachesForDocumentMutation(user.id);
    return NextResponse.json({ label, labels: await selectLabels(supabase, id) });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (isDemoMode()) {
      return NextResponse.json({ error: "Demo documents cannot be curated." }, { status: 400 });
    }

    const parsed = await parseJsonBody(request, manualLabelDeleteSchema, "Choose a manual tag to remove.");

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    await requireOwnedDocument(supabase, id, user.id);

    const { data: existing, error: existingError } = await supabase
      .from("document_labels")
      .select("id")
      .eq("id", parsed.labelId)
      .eq("document_id", id)
      .eq("owner_id", user.id)
      .eq("source", "manual")
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new PublicApiError("Manual tag not found.", 404);

    const { error } = await supabase
      .from("document_labels")
      .delete()
      .eq("id", parsed.labelId)
      .eq("document_id", id)
      .eq("owner_id", user.id)
      .eq("source", "manual");

    if (error) throw new Error(error.message);
    invalidateRagCachesForDocumentMutation(user.id);
    return NextResponse.json({ deleted: true, labelId: parsed.labelId, labels: await selectLabels(supabase, id) });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
