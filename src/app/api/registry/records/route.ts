import { NextResponse } from "next/server";
import { z } from "zod";

import { consumeApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { rankFormRecords, formRecords } from "@/lib/forms";
import {
  rowGovernance,
  rowToServiceRecord,
  type RegistryRecordKind,
  type RegistryRecordRow,
} from "@/lib/registry-records";
import { rankServiceRecords, serviceRecords, type ServiceRecord, type ServiceSearchMatch } from "@/lib/services";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseRequestQuery, queryInteger } from "@/lib/validation/query";

export const runtime = "nodejs";

// The list is a small curated per-owner set that clients fetch in full and
// rank client-side, so the whole set must be returned (never truncated) or
// rows past the cap become invisible to Services/Forms search and undercount
// the home footers. This ceiling is a defensive bound well above realistic
// registry sizes; `limit` only bounds the ranked `matches` for a `q` query.
const REGISTRY_MAX_RECORDS = 500;

const registryListQuerySchema = z.object({
  kind: z.enum(["service", "form"]),
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => (value ? value : undefined)),
  limit: queryInteger({ fallback: 100, min: 1, max: 200 }),
});

function rankRecords(kind: RegistryRecordKind, records: ServiceRecord[], query: string, limit: number) {
  return kind === "form" ? rankFormRecords(records, query, limit) : rankServiceRecords(records, query, limit);
}

function registryResponse(payload: Record<string, unknown>) {
  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
}

function matchesPayload(matches: ServiceSearchMatch[]) {
  return matches.map((match) => ({ record: match.service, score: match.score, reasons: match.reasons }));
}

export async function GET(request: Request) {
  try {
    const { kind, q, limit } = parseRequestQuery(request, registryListQuerySchema, "Invalid registry query.");

    if (isDemoMode()) {
      const records = kind === "form" ? formRecords : serviceRecords;
      return registryResponse({
        records,
        matches: q ? matchesPayload(rankRecords(kind, records, q, limit)) : undefined,
        total: records.length,
        demoMode: true,
      });
    }

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);

    const rateLimit = await consumeApiRateLimit({
      supabase,
      ownerId: user.id,
      bucket: "registry",
      allowInMemoryFallbackOnUnavailable: isLocalNoAuthMode(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("Registry requests are rate limited. Try again shortly.", rateLimit);
    }

    const { data, error } = await supabase
      .from("clinical_registry_records")
      .select("*")
      .eq("owner_id", user.id)
      .eq("kind", kind)
      .order("title")
      .limit(REGISTRY_MAX_RECORDS);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as RegistryRecordRow[];
    const records = rows.map(rowToServiceRecord);
    const governanceBySlug = Object.fromEntries(rows.map((row) => [row.slug, rowGovernance(row)]));

    const recordIds = rows.map((row) => row.id);
    const linkedDocumentIdsByRecordId: Record<string, string[]> = {};
    if (recordIds.length > 0) {
      const { data: links, error: linksError } = await supabase
        .from("clinical_registry_record_sources")
        .select("record_id, document_id")
        .eq("owner_id", user.id)
        .in("record_id", recordIds);
      if (linksError) throw new Error(linksError.message);
      for (const link of links ?? []) {
        const existing = linkedDocumentIdsByRecordId[link.record_id] ?? [];
        existing.push(link.document_id);
        linkedDocumentIdsByRecordId[link.record_id] = existing;
      }
    }
    const linkedDocumentIdsBySlug = Object.fromEntries(
      rows.map((row) => [row.slug, linkedDocumentIdsByRecordId[row.id] ?? []]),
    );

    return registryResponse({
      records,
      matches: q ? matchesPayload(rankRecords(kind, records, q, limit)) : undefined,
      total: rows.length,
      governance: governanceBySlug,
      linkedDocumentIds: linkedDocumentIdsBySlug,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
