import { NextResponse } from "next/server";
import { z } from "zod";

import { consumeSubjectApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { publicAccessContext } from "@/lib/public-api-access";
import { rankFormRecords, formRecords } from "@/lib/forms";
import {
  deriveGovernanceColumns,
  rowGovernance,
  rowToServiceRecord,
  type RegistryRecordKind,
  type RegistryRecordRow,
} from "@/lib/registry-records";
import { ensureRegistrySeeded } from "@/lib/registry-seed";
import { rankServiceRecords, serviceRecords, type ServiceRecord, type ServiceSearchMatch } from "@/lib/services";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
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

function publicRegistryPayload(kind: RegistryRecordKind, q: string | undefined, limit: number) {
  const records = kind === "form" ? formRecords : serviceRecords;
  const governance = Object.fromEntries(
    records.map((record) => {
      const derived = deriveGovernanceColumns(record);
      return [record.slug, { sourceStatus: derived.source_status, validationStatus: derived.validation_status }];
    }),
  );
  return {
    records,
    matches: q ? matchesPayload(rankRecords(kind, records, q, limit)) : undefined,
    total: records.length,
    governance,
  };
}

export async function GET(request: Request) {
  try {
    const { kind, q, limit } = parseRequestQuery(request, registryListQuerySchema, "Invalid registry query.");

    if (isDemoMode() || isLocalNoAuthMode()) {
      return registryResponse({
        ...publicRegistryPayload(kind, q, limit),
        demoMode: true,
      });
    }

    const supabase = createAdminClient();
    const access = await publicAccessContext(request, supabase);

    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: access.rateLimitSubject,
      bucket: "registry",
      allowInMemoryFallbackOnUnavailable: isLocalNoAuthMode(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("Registry requests are rate limited. Try again shortly.", rateLimit);
    }

    if (!access.ownerId) {
      return registryResponse({
        ...publicRegistryPayload(kind, q, limit),
        publicAccess: true,
      });
    }

    const fetchRecords = async () => {
      const { data, error } = await supabase
        .from("clinical_registry_records")
        .select("*")
        .eq("owner_id", access.ownerId)
        .eq("kind", kind)
        .order("title")
        .limit(REGISTRY_MAX_RECORDS);
      if (error) throw new Error(error.message);
      return (data ?? []) as RegistryRecordRow[];
    };

    let rows = await fetchRecords();
    if (rows.length === 0) {
      // First visit for this owner: lazily seed the curated defaults so new
      // accounts get populated Services/Forms instead of the empty state. Only
      // the seed write is best-effort (a failure falls back to the empty set);
      // the re-read stays outside the try so a genuine read failure still
      // surfaces as an error rather than a misleading empty registry.
      try {
        await ensureRegistrySeeded(supabase, access.ownerId, kind);
      } catch (seedError) {
        console.error(`[registry] auto-seed failed for owner ${access.ownerId} (${kind})`, seedError);
      }
      rows = await fetchRecords();
    }

    const records = rows.map(rowToServiceRecord);
    const governanceBySlug = Object.fromEntries(rows.map((row) => [row.slug, rowGovernance(row)]));

    return registryResponse({
      records,
      matches: q ? matchesPayload(rankRecords(kind, records, q, limit)) : undefined,
      total: rows.length,
      governance: governanceBySlug,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
