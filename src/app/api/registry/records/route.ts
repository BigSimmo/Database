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
  catalogueListFallbackBudgetMs,
  catalogueListScope,
  readCatalogueWithSeedFallback,
} from "@/lib/site-content/catalogue-seed-fallback";
import {
  canonicalSiteContentGovernance,
  readCanonicalSiteContentRecords,
} from "@/lib/site-content/site-content-publication";
import { preferBundledFormRecord, siteContentSnapshotReleaseId } from "@/lib/site-content/prefer-bundled-form-record";
import {
  bundledServiceGovernance,
  bundledServicesMissingFrom,
  preferBundledServiceRecord,
} from "@/lib/site-content/bundled-service-catalogue";
import { rankServiceRecords, serviceRecords, type ServiceRecord } from "@/lib/services";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseRequestQuery, queryInteger } from "@/lib/validation/query";

export const runtime = "nodejs";

// Full/search views return the entire curated owner set so client-side result
// ranking cannot hide rows past an arbitrary cap. Summary views return counts
// only. This ceiling is a defensive bound above realistic registry sizes;
// `limit` only bounds ranked `matches` for an explicit `q` query.
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
  return kind === "form"
    ? rankFormRecords(records, query, limit, [], true)
    : rankServiceRecords(records, query, limit, [], true);
}

function acceptsGzip(request: Request | undefined) {
  const header = request?.headers.get("accept-encoding");
  if (!header) return false;

  const encodings = header.split(",").map((entry) => {
    const [encoding, ...parameters] = entry.trim().toLowerCase().split(";");
    return { encoding, parameters };
  });
  const allows = ({ parameters }: { parameters: string[] }) =>
    !parameters.some((parameter) => /^q=0(?:\.0+)?$/.test(parameter.trim()));

  // A client can exclude gzip explicitly while accepting other encodings via
  // `*`. Resolve that explicit preference before the wildcard fallback.
  const gzip = encodings.find((entry) => entry.encoding === "gzip");
  if (gzip) return allows(gzip);

  return encodings.some((entry) => entry.encoding === "*" && allows(entry));
}

async function registryResponse(
  payload: Record<string, unknown>,
  options: { request?: Request; fixture?: boolean } = {},
) {
  const json = JSON.stringify(payload);
  const jsonBytes = Buffer.from(json);
  const shouldVaryByEncoding = jsonBytes.byteLength >= REGISTRY_COMPRESSION_THRESHOLD_BYTES;
  const headers = fixtureResponseHeaders(options.request, {
    ...options,
    headers: shouldVaryByEncoding ? { Vary: "Accept-Encoding" } : undefined,
  });
  if (!shouldVaryByEncoding || !acceptsGzip(options.request)) {
    return NextResponse.json(payload, { headers });
  }

  // Next's documented `compress` default did not produce Content-Encoding on
  // the live registry route. Compress this catalogue response explicitly and
  // vary the CDN/browser cache by encoding so the full search payload is not a
  // megabyte-scale transfer on first use.
  const compressed = await gzipAsync(jsonBytes);
  headers.set("Content-Encoding", "gzip");
  headers.set("Content-Length", String(compressed.byteLength));
  headers.set("Content-Type", "application/json; charset=utf-8");
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

    const seedRecords = kind === "form" ? formRecords : serviceRecords;
    const seeds = seedRecords.map((record) => {
      const derived = deriveGovernanceColumns(record);
      return {
        record,
        governance: { sourceStatus: derived.source_status, validationStatus: derived.validation_status },
      };
    });
    // Bounded, and degrades to the in-bundle catalogue rather than hanging. Before this the read
    // had no budget at all: during the 2026-09-09 outage this route simply waited for a canonical
    // read that was never going to finish in time, which is why Forms sat on "Searching…" instead
    // of showing anything. The response says `degraded` so the surface can tell the reader the
    // list may lag what was published.
    // A holder, not a `let`: the assignment happens inside the read callback, which control-flow
    // analysis cannot see, so a plain local would narrow to its initialiser and the comparison
    // below would be flagged as impossible.
    const observed: { source: "canonical_public" | "seed_uninitialized" } = { source: "canonical_public" };
    const canonical = await readCatalogueWithSeedFallback({
      kind,
      // Its own cooldown scope. Sharing one with search meant a search giving up at 1200 ms sent
      // this route straight to seeds for thirty seconds without ever trying the longer read it is
      // budgeted for.
      scope: catalogueListScope,
      seeds,
      budgetMs: catalogueListFallbackBudgetMs,
      read: async (signal) => {
        const result = await readCanonicalSiteContentRecords({
          supabase,
          kind,
          slug: null,
          seeds,
          signal,
          cache: true,
          mapRecord: ({ canonicalRecord, finalRenderPayload }) => ({
            record: finalRenderPayload as unknown as ServiceRecord,
            governance: canonicalSiteContentGovernance(canonicalRecord),
          }),
        });
        observed.source = result.source;
        const activeReleaseId = siteContentSnapshotReleaseId(result.snapshot);
        const refreshed = result.records.map((entry) =>
          kind === "form"
            ? preferBundledFormRecord(kind, entry, { activeReleaseId })
            : preferBundledServiceRecord(entry, { activeReleaseId }),
        );
        if (kind === "form") return refreshed;
        // Services only. The served release is still the 2026-08-24 freeze, which predates the 17
        // records added by #2814, so the list is topped up with them under their own conservative
        // governance -- never the release's sign-off. Empty once a real release is active.
        return [
          ...refreshed,
          ...bundledServicesMissingFrom(
            refreshed.map((entry) => entry.record),
            { activeReleaseId },
          ).map((record) => ({ record, governance: bundledServiceGovernance(record) })),
        ];
      },
    });
    const records = canonical.records.map((entry) => entry.record);
    const governanceBySlug = Object.fromEntries(
      canonical.records.map((entry) => [entry.record.slug, entry.governance]),
    );
    return await registryResponse(
      {
        ...registryListPayload(kind, records, governanceBySlug, q, limit, view),
        publicAccess: true,
      },
      {
        request,
        // Deliberately NOT widened to cover `canonical.degraded`. `fixture` makes the response
        // publicly cacheable for longer, which is right for the uninitialised corpus and exactly
        // wrong for a degraded read: it would pin the stale seed list in front of a database that
        // may recover in thirty seconds.
        fixture: observed.source === "seed_uninitialized",
      },
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
