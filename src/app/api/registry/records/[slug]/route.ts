import { NextResponse } from "next/server";
import { z } from "zod";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { publicAccessContext } from "@/lib/public-api-access";
import { getFormRecord } from "@/lib/forms";
import {
  deriveGovernanceColumns,
  normalizeRegistrySlug,
  rowGovernance,
  rowToServiceRecord,
  type RegistryRecordRow,
} from "@/lib/registry-records";
import { mergeRegistryRecordsWithDefaults } from "@/lib/registry-seed";
import { getServiceRecord } from "@/lib/services";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseRequestQuery } from "@/lib/validation/query";

export const runtime = "nodejs";

const registryDetailQuerySchema = z.object({
  kind: z.enum(["service", "form"]),
});

function registryResponse(payload: Record<string, unknown>, init?: { status?: number }) {
  return NextResponse.json(payload, {
    status: init?.status ?? 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function notFoundResponse(slug: string) {
  return registryResponse({ error: `No registry record found for "${slug}".` }, { status: 404 });
}

function publicRegistryDetailPayload(kind: "service" | "form", slug: string) {
  const record = kind === "form" ? getFormRecord(slug) : getServiceRecord(slug);
  if (!record) return null;
  const derived = deriveGovernanceColumns(record);
  return {
    record,
    governance: { sourceStatus: derived.source_status, validationStatus: derived.validation_status },
    linkedDocuments: [],
  };
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const normalizedSlug = normalizeRegistrySlug(slug);
    const { kind } = parseRequestQuery(request, registryDetailQuerySchema, "Invalid registry detail query.");

    if (isDemoMode() || isLocalNoAuthMode()) {
      const payload = publicRegistryDetailPayload(kind, normalizedSlug);
      if (!payload) return notFoundResponse(normalizedSlug);
      return registryResponse({
        ...payload,
        demoMode: true,
      });
    }

    // Anonymous callers still resolve access + rate limit before we serve the seed detail:
    // publicAccessContext skips the Supabase auth round-trip when there's no session cookie/bearer,
    // but every caller must pass the registry limiter (M4/C1 — no anonymous bypass).
    const supabase = createAdminClient();
    const access = await publicAccessContext(request, supabase);

    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: access.rateLimitSubject,
      bucket: "registry",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("Registry requests are rate limited. Try again shortly.", rateLimit);
    }

    if (!access.ownerId) {
      const payload = publicRegistryDetailPayload(kind, normalizedSlug);
      if (!payload) return notFoundResponse(normalizedSlug);
      return registryResponse({
        ...payload,
        publicAccess: true,
      });
    }

    const fetchRecord = async () => {
      const { data, error } = await supabase
        .from("clinical_registry_records")
        .select("*")
        .eq("owner_id", access.ownerId)
        .eq("kind", kind)
        .eq("slug", normalizedSlug)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as RegistryRecordRow | null) ?? null;
    };

    const row = await fetchRecord();
    if (!row) {
      const payload = publicRegistryDetailPayload(kind, normalizedSlug);
      if (!payload) return notFoundResponse(normalizedSlug);
      return registryResponse({ ...payload, sharedCatalog: true });
    }

    const { data: links, error: linksError } = await supabase
      .from("clinical_registry_record_sources")
      .select("document_id, note")
      .eq("owner_id", access.ownerId)
      .eq("record_id", row.id);
    if (linksError) throw new Error(linksError.message);

    let linkedDocuments: Array<{ id: string; title: string; file_name: string; status: string }> = [];
    const documentIds = (links ?? []).map((link) => link.document_id);
    if (documentIds.length > 0) {
      const { data: documents, error: documentsError } = await supabase
        .from("documents")
        .select("id, title, file_name, status")
        .eq("owner_id", access.ownerId)
        .in("id", documentIds);
      if (documentsError) throw new Error(documentsError.message);
      linkedDocuments = (documents ?? []) as typeof linkedDocuments;
    }

    const record =
      mergeRegistryRecordsWithDefaults(kind, [row]).find(
        (candidate) => normalizeRegistrySlug(candidate.slug) === normalizedSlug,
      ) ?? rowToServiceRecord(row);

    return registryResponse({
      record,
      governance: rowGovernance(row),
      linkedDocuments,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
