"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { authSessionFingerprint, createAuthRequestLifecycle } from "@/lib/auth-request-lifecycle";
import { medicationToSearchResult, type MedicationRecord, type MedicationSearchResult } from "@/lib/medications";
import { siteContentRecordCacheTtlMs } from "@/lib/site-content/site-content-record-cache";
import { registryCatalogueSlowNoticeMs } from "@/lib/use-registry-records";
import { useAuthSession } from "@/lib/supabase/client";

type MedicationCatalogMatch = {
  medication: MedicationRecord;
  result: MedicationSearchResult;
  score: number;
  reasons: string[];
  /**
   * Whether `medication` (and therefore `result`) carries every field the
   * downstream safety engines (`evaluatePatientAlerts`,
   * `evaluateMedicationInteractions`) read — `sections`/`stats`/`quick` in
   * particular. `false` means the ranked slug had no counterpart in the
   * cached base catalogue when this response was hydrated, so `medication`
   * is still the compact `fields=index` projection (`sections: []`), NOT a
   * genuinely-empty medication. A caller MUST NOT run either safety engine
   * against an unhydrated record: an empty `sections` array reads as "no
   * considerations found" to both engines, when the truth is "not checked
   * yet" — see `mergeMedicationCatalogueResponse` and the F1 fix in
   * `medication-prescribing-workspace.tsx`. Always `true` for a response
   * that was never merged against a cache (the very first, full-fidelity
   * fetch, and any `fields=index` response consumed by an identity-only
   * caller that never reads `sections`).
   */
  hydrated: boolean;
};

export type MedicationCatalogInterpretation = {
  correctedQuery?: string;
  corrections?: Array<{ from: string; to: string }>;
  appliedExpansions?: string[];
};

type MedicationCatalogResponse = {
  records: MedicationRecord[];
  matches?: MedicationCatalogMatch[];
  interpretation?: MedicationCatalogInterpretation;
  total: number;
  governance?: Record<
    string,
    { sourceStatus: string; validationStatus: string; sourceCheckedAt?: string | null; sourcesRecorded?: boolean }
  >;
  demoMode?: boolean;
  /**
   * Set when `readCatalogueWithSeedFallback` served the in-bundle catalogue because the
   * canonical read failed, timed out, or is inside its cooldown. Surfaces as a notice so a
   * possibly stale list is never read as live published content.
   */
  retainedSnapshot?: boolean;
};

type MedicationDetailResponse = {
  record: MedicationRecord;
  governance?: {
    sourceStatus: string;
    validationStatus: string;
    sourceCheckedAt?: string | null;
    sourcesRecorded?: boolean;
  };
  demoMode?: boolean;
};

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export type MedicationCatalogState = AsyncState<MedicationCatalogResponse> & {
  /** The active request has run past `registryCatalogueSlowNoticeMs` with no
   *  response yet. See that constant's doc comment for why the threshold is
   *  shared with the registry (services/forms) catalogue fetch. */
  slow: boolean;
};

/** Match universal typeahead debounce so prescribing keystrokes coalesce. */
const catalogDebounceMs = 250;

/**
 * How long the cached base catalogue (below) is served without question.
 * Kept identical to the server-side catalogue cache's own fresh window
 * (`siteContentRecordCacheTtlMs`) rather than a second, independently-tuned
 * number: past this age the cache is discarded outright (not merely
 * refreshed behind the reader, unlike the server-side cache's two-tier
 * policy) so a stale `total`, a retired medication, or frozen governance can
 * never outlive it silently. Discarding forces the next request through this
 * hook's ordinary full-fidelity path, which both re-seeds the cache and
 * — being a real network round trip — runs through the existing loading/
 * refetching indicators the results header already shows, rather than
 * swapping in fresher numbers with no visible signal at all.
 */
const medicationBaseCatalogueTtlMs = siteContentRecordCacheTtlMs;

async function fetchJson<T>(url: string, headers: HeadersInit | undefined, signal: AbortSignal): Promise<T> {
  // Use the default cache mode (not `no-store`) so public responses honor the
  // API's `public, max-age=300, s-maxage=3600, stale-while-revalidate` headers.
  // Owner responses are served `private, no-store` with `Vary: Authorization`,
  // so the browser never caches them across auth states — matching the sibling
  // registry/differential hooks, which also fetch with the default cache mode.
  const response = await fetch(url, { headers, signal });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

/** The query-independent slice of a full-fidelity `/api/medications` response —
 *  identical on every request regardless of `q` (2026-09 latency audit: 2.47 MB,
 *  resent on every debounced keystroke for no reason). Cached once per identity
 *  and reused; see `useMedicationCatalog`. */
type MedicationBaseCatalogue = {
  records: MedicationRecord[];
  governance?: MedicationCatalogResponse["governance"];
  total: number;
  demoMode?: boolean;
  retainedSnapshot?: boolean;
  /** `Date.now()` when this was stored, so `isBaseCatalogueFresh` can retire it. */
  storedAt: number;
};

function isBaseCatalogueFresh(entry: MedicationBaseCatalogue, now: number): boolean {
  return now - entry.storedAt < medicationBaseCatalogueTtlMs;
}

/**
 * Attaches the `hydrated` flag (see `MedicationCatalogMatch`) to every match in
 * a response, optionally hydrating `medication`/`result` back to full detail
 * from `fullRecordBySlug` first.
 *
 * `fullRecordBySlug: null` means the response IS the full-fidelity answer
 * (nothing to merge) — used for the very first fetch and for `fields=index`
 * responses served to identity-only callers — so every match is marked
 * hydrated unconditionally.
 *
 * Only `dose`/`ceiling`/`action`/`indication`/`name`/`id`/`href` are replaced —
 * none of those depend on the ranking score. `match` and `tone` are left
 * exactly as the server computed them: the route zeroes the score behind those
 * two fields for a smart-alias-only hit so it is never read as a real clinical
 * fit (`queryIncludesMedicationIdentity` in `medications/route.ts`), and that
 * decision was made against the query that actually ran. Recomputing it here
 * from the full record and the raw score would silently drop that safety
 * behaviour, so this never touches either field.
 */
function markMatchesHydrated(
  matches: MedicationCatalogResponse["matches"],
  fullRecordBySlug: Map<string, MedicationRecord> | null,
): { matches: MedicationCatalogMatch[] | undefined; hasUnhydratedMatch: boolean } {
  let hasUnhydratedMatch = false;
  const mapped = matches?.map((match) => {
    if (!fullRecordBySlug) return { ...match, hydrated: true };
    const full = fullRecordBySlug.get(match.medication.slug);
    if (!full) {
      // Not in the cached catalogue (e.g. published mid-session). Keep the
      // compact projection rather than fabricate one, but mark it unhydrated
      // so no caller ever runs a safety engine against its empty
      // `sections`/`stats`/`quick` and reads that as an all-clear.
      hasUnhydratedMatch = true;
      return { ...match, hydrated: false };
    }
    const rich = medicationToSearchResult({ medication: full, score: match.score, reasons: match.reasons });
    return {
      ...match,
      medication: full,
      result: { ...rich, match: match.result.match, tone: match.result.tone },
      hydrated: true,
    };
  });
  return { matches: mapped, hasUnhydratedMatch };
}

function mergeMedicationCatalogueResponse(
  response: MedicationCatalogResponse,
  base: MedicationBaseCatalogue,
): { response: MedicationCatalogResponse; hasUnhydratedMatch: boolean } {
  const fullRecordBySlug = new Map(base.records.map((record) => [record.slug, record]));
  const { matches, hasUnhydratedMatch } = markMatchesHydrated(response.matches, fullRecordBySlug);
  return {
    response: {
      ...response,
      records: base.records,
      governance: base.governance,
      total: base.total,
      demoMode: base.demoMode,
      matches,
      ...(base.retainedSnapshot ? { retainedSnapshot: true as const } : {}),
    },
    hasUnhydratedMatch,
  };
}

export function useMedicationCatalog(
  query?: string,
  options: { enabled?: boolean; fields?: "index"; debounceMs?: number } = {},
): MedicationCatalogState {
  const enabled = options.enabled ?? true;
  const fields = options.fields;
  const debounceMs = options.debounceMs ?? catalogDebounceMs;
  const trimmed = query?.trim() ?? "";
  // Auth-aware like use-registry-records: without the header an authenticated owner was
  // silently served the public fixture catalogue instead of their seeded records.
  const { authorizationHeader, session, status: authStatus } = useAuthSession();
  const authIdentity = authSessionFingerprint(authStatus, session?.user.id);
  const [prevQuery, setPrevQuery] = useState(trimmed);
  const [prevEnabled, setPrevEnabled] = useState(enabled);
  const [prevAuthIdentity, setPrevAuthIdentity] = useState(authIdentity);
  const [prevAuthorizationHeader, setPrevAuthorizationHeader] = useState(authorizationHeader);
  const [requestLifecycle] = useState(() => createAuthRequestLifecycle());
  // Bumped only to force a re-run of the fetch effect below when a merge finds
  // a ranked slug missing from the cache (see the `.then` handler). Not itself
  // read for anything else — its sole job is to make that repair transient
  // rather than sticky, by making the next run ask for the full catalogue.
  const [hydrationMissToken, setHydrationMissToken] = useState(0);
  const [state, setState] = useState<MedicationCatalogState>({
    data: null,
    loading: enabled,
    error: null,
    slow: false,
  });
  // Not React state on purpose: this must never itself retrigger the fetch
  // effect (a `records`/`matches`-shaped keystroke fetch already runs on every
  // `trimmed` change; adding this as a dependency would fire a second,
  // now-redundant request the instant it populates). Only an identity change
  // may invalidate it — a different signed-in owner must never see ranked rows
  // hydrated against a catalogue fetched under someone else's session.
  const baseCatalogueRef = useRef<MedicationBaseCatalogue | null>(null);

  const resourceChanged = trimmed !== prevQuery || enabled !== prevEnabled;
  const identityChanged = authIdentity !== prevAuthIdentity;
  const credentialChanged = authorizationHeader !== prevAuthorizationHeader;
  if (resourceChanged || identityChanged || credentialChanged) {
    setPrevQuery(trimmed);
    setPrevEnabled(enabled);
    setPrevAuthIdentity(authIdentity);
    setPrevAuthorizationHeader(authorizationHeader);
    setState((current) =>
      !resourceChanged && !identityChanged && credentialChanged && current.data
        ? { ...current, loading: true, error: null, slow: false }
        : { data: null, loading: enabled, error: null, slow: false },
    );
  }

  useLayoutEffect(() => {
    requestLifecycle.invalidate();
  }, [authIdentity, authorizationHeader, enabled, fields, requestLifecycle, trimmed]);

  useLayoutEffect(() => {
    baseCatalogueRef.current = null;
  }, [authIdentity]);

  useEffect(() => {
    if (!enabled) return;

    // Rich mode (the default — no `fields` requested) is the one caller that
    // needs full sections/stats/quick on every row: Safety/Monitoring chips and
    // patient alerts read them for both the ranked matches and the trailing
    // catalogue-only rows. `fields=index` callers (identity-only consumers, e.g.
    // cross-mode links) never populate or read the cache below.
    const richMode = fields !== "index";
    const cachedBase = richMode ? baseCatalogueRef.current : null;
    // A cache past its TTL is treated as no cache at all, not merely reused
    // with a caveat: `total`, governance ageing and list membership must never
    // outlive `medicationBaseCatalogueTtlMs` in silence (F3). Dropping the ref
    // here, rather than only ignoring it locally, also stops it resurrecting on
    // the very next render before this effect's own fetch has a chance to
    // replace it.
    if (cachedBase && !isBaseCatalogueFresh(cachedBase, Date.now())) {
      baseCatalogueRef.current = null;
    }
    const base = richMode ? baseCatalogueRef.current : null;

    // The empty-query view is exactly the cached catalogue in its own order,
    // no ranking involved — nothing to fetch. Without this, clearing the
    // composer re-requests the full 2.47 MB catalogue for content already held.
    if (richMode && !trimmed && base) {
      setState({
        data: {
          records: base.records,
          matches: undefined,
          interpretation: undefined,
          total: base.total,
          governance: base.governance,
          demoMode: base.demoMode,
          ...(base.retainedSnapshot ? { retainedSnapshot: true as const } : {}),
        },
        loading: false,
        error: null,
        slow: false,
      });
      return;
    }

    const controller = new AbortController();
    const registration = requestLifecycle.register(controller);
    const isCurrentRequest = () => requestLifecycle.isCurrent(registration.epoch);
    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    // Once the full catalogue is cached, every further keystroke asks for the
    // compact projection (76 KB vs 2.47 MB) — see `mergeMedicationCatalogueResponse`
    // for how the ranked rows are hydrated back to full detail rather than shown
    // degraded. The very first request (no cache yet) always asks in full, which
    // both answers it correctly and seeds the cache for every request after it.
    if (fields === "index" || base) params.set("fields", "index");
    const suffix = params.toString();
    const url = suffix ? `/api/medications?${suffix}` : "/api/medications";

    // Mirrors the registry catalogue's slow notice (`use-registry-records.ts`) at
    // the same threshold: a long wait here is the server's seed-fallback budget
    // running, not a hang, and the reader deserves to be told that rather than
    // watch an unchanging spinner for the whole 4.5-6.5s this route can take.
    let slowTimer: ReturnType<typeof setTimeout> | undefined;

    const timer = window.setTimeout(() => {
      slowTimer = setTimeout(() => {
        if (!isCurrentRequest()) return;
        setState((current) => (current.loading ? { ...current, slow: true } : current));
      }, registryCatalogueSlowNoticeMs);

      fetchJson<MedicationCatalogResponse>(url, authorizationHeader, controller.signal)
        .then((data) => {
          if (slowTimer !== undefined) clearTimeout(slowTimer);
          if (controller.signal.aborted || !isCurrentRequest()) return;

          if (richMode && !base) {
            // Full-fidelity by construction (fields=index was not requested):
            // cache it as the reusable base for every later keystroke, tagged
            // with the moment it was stored so the TTL check above can retire
            // it.
            baseCatalogueRef.current = {
              records: data.records,
              governance: data.governance,
              total: data.total,
              demoMode: data.demoMode,
              retainedSnapshot: data.retainedSnapshot,
              storedAt: Date.now(),
            };
          }

          if (richMode && base) {
            const { response: merged, hasUnhydratedMatch } = mergeMedicationCatalogueResponse(data, base);
            setState({ data: merged, loading: false, error: null, slow: false });
            if (hasUnhydratedMatch) {
              // A ranked slug had no counterpart in the cached catalogue. The
              // row has already been rendered degraded (unhydrated, never a
              // confident verdict — see `MedicationCatalogMatch.hydrated`);
              // this makes that state transient rather than sticky by
              // dropping the stale cache and forcing the next run of this
              // effect to ask for the full catalogue again.
              baseCatalogueRef.current = null;
              setHydrationMissToken((value) => value + 1);
            }
            return;
          }

          // No merge to perform: either this response IS the full catalogue
          // (just cached above, if applicable) or it is a `fields=index`
          // response for an identity-only caller that never reads hydration
          // at all. Either way every match here reflects exactly what was
          // requested, so mark it hydrated.
          const { matches } = markMatchesHydrated(data.matches, null);
          setState({ data: { ...data, matches }, loading: false, error: null, slow: false });
        })
        .catch((error) => {
          if (slowTimer !== undefined) clearTimeout(slowTimer);
          if (
            controller.signal.aborted ||
            !isCurrentRequest() ||
            (error instanceof DOMException && error.name === "AbortError")
          )
            return;
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : "Could not load medications.",
            slow: false,
          });
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      if (slowTimer !== undefined) clearTimeout(slowTimer);
      controller.abort();
      registration.release();
    };
  }, [trimmed, enabled, fields, debounceMs, authIdentity, authorizationHeader, requestLifecycle, hydrationMissToken]);

  return state;
}

export function useMedicationDetail(slug?: string): AsyncState<MedicationDetailResponse> {
  const normalized = slug?.trim().toLowerCase() ?? "";
  const { authorizationHeader } = useAuthSession();
  const [prevSlug, setPrevSlug] = useState(normalized);
  const [state, setState] = useState<AsyncState<MedicationDetailResponse>>(() => ({
    data: null,
    loading: !!normalized,
    error: null,
  }));

  if (normalized !== prevSlug) {
    setPrevSlug(normalized);
    setState({
      data: null,
      loading: !!normalized,
      error: null,
    });
  }

  useEffect(() => {
    if (!normalized) {
      return;
    }
    const controller = new AbortController();
    fetchJson<MedicationDetailResponse>(
      `/api/medications/${encodeURIComponent(normalized)}`,
      authorizationHeader,
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : "Could not load medication.",
        });
      });
    return () => {
      controller.abort();
    };
  }, [normalized, authorizationHeader]);

  return state;
}
