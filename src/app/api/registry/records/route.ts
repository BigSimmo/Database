import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode, isLocalNoAuthMode } from "@/lib/env";
import { fixtureResponseHeaders } from "@/lib/fixture-response-cache";
import { jsonError } from "@/lib/http";
import { publicAccessContext } from "@/lib/public-api-access";
import { rankFormRecords, formRecords } from "@/lib/forms";
import { deriveGovernanceColumns, type RegistryRecordKind } from "@/lib/registry-records";
import {
  fetchOwnerRegistryRows,
  mergeRegistryGovernanceWithDefaults,
  mergeRegistryRecordsWithDefaults,
} from "@/lib/registry-seed";
import { rankServiceRecords, serviceRecords, type ServiceRecord } from "@/lib/services";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseRequestQuery, queryInteger } from "@/lib/validation/query";

export const runtime = "nodejs";

// Full/search views return the entire curated owner set so client-side result
// ranking cannot hide rows past an arbitrary cap. Summary views return counts
// only. This ceiling is a defensive bound above realistic registry sizes;
// `limit` only bounds ranked `matches` for an explicit `q` query.
const REGISTRY_MAX_RECORDS = 500;
const REGISTRY_COMPRESSION_THRESHOLD_BYTES = 1_024;
const gzipAsync = promisify(gzip);

type RegistryListView = "full" | "search" | "summary";

const registryListQuerySchema = z.object({
  kind: z.enum(["service", "form"]),
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => (value ? value : undefined)),
  limit: queryInteger({ fallback: 100, min: 1, max: 200 }),
  view: z.enum(["full", "search", "summary"]).default("full"),
});

function rankRecords(kind: RegistryRecordKind, records: ServiceRecord[], query: string, limit: number) {
  return kind === "form" ? rankFormRecords(records, query, limit) : rankServiceRecords(records, query, limit);
}

function acceptsGzip(request: Request | undefined) {
  const header = request?.headers.get("accept-encoding");
  if (!header) return false;
  return header.split(",").some((entry) => {
    const [encoding, ...parameters] = entry.trim().toLowerCase().split(";");
    if (encoding !== "gzip" && encoding !== "*") return false;
    return !parameters.some((parameter) => /^q=0(?:\.0+)?$/.test(parameter.trim()));
  });
}

async function registryResponse(
  payload: Record<string, unknown>,
  options: { request?: Request; fixture?: boolean } = {},
) {
  const json = JSON.stringify(payload);
  if (json.length < REGISTRY_COMPRESSION_THRESHOLD_BYTES || !acceptsGzip(options.request)) {
    return NextResponse.json(payload, { headers: fixtureResponseHeaders(options.request, options) });
  }

  // Next's documented `compress` default did not produce Content-Encoding on
  // the live registry route. Compress this catalogue response explicitly and
  // vary the CDN/browser cache by encoding so the full search payload is not a
  // megabyte-scale transfer on first use.
  const compressed = await gzipAsync(Buffer.from(json));
  const headers = fixtureResponseHeaders(options.request, {
    ...options,
    headers: {
      "Content-Encoding": "gzip",
      "Content-Length": String(compressed.byteLength),
      "Content-Type": "application/json; charset=utf-8",
      Vary: "Accept-Encoding",
    },
  });
  return new NextResponse(new Uint8Array(compressed), { headers });
}

function compactRegistryRecord(record: ServiceRecord): ServiceRecord {
  return {
    slug: record.slug,
    title: record.title,
    subtitle: record.subtitle,
    route: record.route,
    statusChips: record.statusChips,
    primaryContact: record.primaryContact,
    tags: record.tags,
    catchments: record.catchments,
  };
}

function verifiedCount(governance: Record<string, { validationStatus: string }>) {
  return Object.values(governance).filter(
    (entry) => entry.validationStatus === "locally_reviewed" || entry.validationStatus === "approved",
  ).length;
}

function registryListPayload(
  kind: RegistryRecordKind,
  records: ServiceRecord[],
  governance: Record<string, { validationStatus: string }>,
  q: string | undefined,
  limit: number,
  view: RegistryListView,
) {
  const total = records.length;
  const reviewed = verifiedCount(governance);
  if (view === "summary") return { total, verifiedCount: reviewed };

  const responseRecords = view === "search" ? records.map(compactRegistryRecord) : records;
  const matches = q ? rankRecords(kind, records, q, limit) : undefined;
  return {
    records: responseRecords,
    matches: matches?.map((match) => ({
      record: view === "search" ? compactRegistryRecord(match.service) : match.service,
      score: match.score,
      reasons: match.reasons,
    })),
    total,
    verifiedCount: reviewed,
    governance: view === "full" ? governance : undefined,
  };
}

function publicRegistryPayload(kind: RegistryRecordKind, q: string | undefined, limit: number, view: RegistryListView) {
  const records = kind === "form" ? formRecords : serviceRecords;
  const governance = Object.fromEntries(
    records.map((record) => {
      const derived = deriveGovernanceColumns(record);
      return [record.slug, { sourceStatus: derived.source_status, validationStatus: derived.validation_status }];
    }),
  );
  return registryListPayload(kind, records, governance, q, limit, view);
}

export async function GET(request: Request) {
  try {
    const { kind, q, limit, view } = parseRequestQuery(request, registryListQuerySchema, "Invalid registry query.");

    if (isDemoMode() || isLocalNoAuthMode()) {
      return await registryResponse(
        {
          ...publicRegistryPayload(kind, q, limit, view),
          demoMode: true,
        },
        { request, fixture: true },
      );
    }

    // Anonymous callers still resolve access + rate limit: publicAccessContext skips the
    // Supabase auth round-trip for requests with no session cookie/bearer, but every caller
    // (authenticated or not) must pass the registry limiter before we serve the full catalog.
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
      return await registryResponse(
        {
          ...publicRegistryPayload(kind, q, limit, view),
          publicAccess: true,
        },
        { request, fixture: true },
      );
    }

    const rows = await fetchOwnerRegistryRows(supabase, access.ownerId, kind, REGISTRY_MAX_RECORDS);
    const records = mergeRegistryRecordsWithDefaults(kind, rows);
    const governanceBySlug = mergeRegistryGovernanceWithDefaults(kind, rows);

    return await registryResponse(registryListPayload(kind, records, governanceBySlug, q, limit, view), { request });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
