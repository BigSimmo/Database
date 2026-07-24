"use client";

import { useEffect, useState } from "react";

import type { DifferentialDetailContext } from "@/lib/differential-detail";
import type { DifferentialSourceStatus, DifferentialValidationStatus } from "@/lib/differential-records";
import type { DifferentialPresentationWorkflow, DifferentialRecord } from "@/lib/differentials";
import { useAuthSession } from "@/lib/supabase/client";

export type DifferentialSearchMatches = {
  diagnoses: Array<{ record: DifferentialRecord; score: number; reasons: string[] }>;
  presentations: Array<{ workflow: DifferentialPresentationWorkflow; score: number; reasons: string[] }>;
};

export type DifferentialSearchState = {
  status: "loading" | "ready" | "unauthorized" | "error";
  matches: DifferentialSearchMatches;
  demoMode: boolean;
};

const emptyDifferentialMatches: DifferentialSearchMatches = { diagnoses: [], presentations: [] };

export type DifferentialRecordGovernance = {
  sourceStatus: DifferentialSourceStatus;
  validationStatus: DifferentialValidationStatus;
};

export type DifferentialRequestStatus = "loading" | "ready" | "unauthorized" | "not_found" | "error";

export type DifferentialRecordState = {
  status: DifferentialRequestStatus;
  record: DifferentialRecord | null;
  /** Catalog context computed server-side for the returned record (may lag
   *  older API deployments, so consumers keep an SSR fallback). */
  detailContext: DifferentialDetailContext | null;
  demoMode: boolean;
  governance: DifferentialRecordGovernance | null;
};

export type DifferentialPresentationState = {
  status: DifferentialRequestStatus;
  workflow: DifferentialPresentationWorkflow | null;
  demoMode: boolean;
  governance: DifferentialRecordGovernance | null;
};

const debounceMs = 250;
const resultCacheMax = 50;
const resultCacheTtlMs = 5 * 60 * 1000;

type DifferentialSearchCacheEntry = {
  matches: DifferentialSearchMatches;
  demoMode: boolean;
  expiresAt: number;
};

// Module-scoped LRU so backspace/retype resolves instantly. Auth signature is part of
// the key so one identity's cached results are never served to another.
const differentialSearchCache = new Map<string, DifferentialSearchCacheEntry>();

function differentialCacheKey(requestKey: string, authSignature: string) {
  return JSON.stringify([authSignature, requestKey]);
}

function peekDifferentialCache(key: string): DifferentialSearchCacheEntry | undefined {
  const cached = differentialSearchCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    differentialSearchCache.delete(key);
    return undefined;
  }
  return cached;
}

function touchDifferentialCache(key: string) {
  const cached = differentialSearchCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    if (cached) differentialSearchCache.delete(key);
    return;
  }
  differentialSearchCache.delete(key);
  differentialSearchCache.set(key, cached);
}

function writeDifferentialCache(key: string, value: Omit<DifferentialSearchCacheEntry, "expiresAt">) {
  differentialSearchCache.delete(key);
  differentialSearchCache.set(key, { ...value, expiresAt: Date.now() + resultCacheTtlMs });
  if (differentialSearchCache.size > resultCacheMax) {
    const oldest = differentialSearchCache.keys().next().value;
    if (oldest !== undefined) differentialSearchCache.delete(oldest);
  }
}

/** Test-only: clear the module-scoped differential search LRU between cases. */
export function clearDifferentialSearchCacheForTests() {
  differentialSearchCache.clear();
}

/** Ranked catalogue search for the Differentials search mode: fetches scored
 *  diagnosis and presentation matches in parallel from /api/differentials.
 *  Empty queries resolve immediately without a request. Debounced + abortable
 *  with an auth-keyed client LRU (parity with useUniversalSearch). */
export function useDifferentialSearch(query: string): DifferentialSearchState {
  const { authorizationHeader, markSessionExpired, status: authStatus } = useAuthSession();
  const requestKey = query.trim().toLowerCase();
  const authSignature = JSON.stringify(authorizationHeader ?? {});
  const cacheKey = requestKey ? differentialCacheKey(requestKey, authSignature) : null;
  const cached = cacheKey ? peekDifferentialCache(cacheKey) : undefined;

  const [state, setState] = useState<DifferentialSearchState>(() =>
    cached
      ? { status: "ready", matches: cached.matches, demoMode: cached.demoMode }
      : {
          status: requestKey ? "loading" : "ready",
          matches: emptyDifferentialMatches,
          demoMode: false,
        },
  );
  // Reset to loading during render when the query changes (repo pattern —
  // avoids react-hooks/set-state-in-effect). Prefer a warm cache hit.
  const [lastRequestKey, setLastRequestKey] = useState(requestKey);
  if (lastRequestKey !== requestKey) {
    setLastRequestKey(requestKey);
    if (!requestKey) {
      setState({ status: "ready", matches: emptyDifferentialMatches, demoMode: false });
    } else if (cached) {
      setState({ status: "ready", matches: cached.matches, demoMode: cached.demoMode });
    } else {
      setState({ status: "loading", matches: emptyDifferentialMatches, demoMode: false });
    }
  }

  useEffect(() => {
    if (!requestKey || !cacheKey) return undefined;

    if (peekDifferentialCache(cacheKey)) {
      touchDifferentialCache(cacheKey);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const encoded = encodeURIComponent(requestKey);
      Promise.all([
        fetch(`/api/differentials?kind=diagnosis&q=${encoded}&limit=20`, {
          headers: authorizationHeader,
          signal: controller.signal,
        }),
        fetch(`/api/differentials?kind=presentation&q=${encoded}&limit=10`, {
          headers: authorizationHeader,
          signal: controller.signal,
        }),
      ])
        .then(async ([diagnosisResponse, presentationResponse]) => {
          if (controller.signal.aborted) return;
          if (diagnosisResponse.status === 401 || presentationResponse.status === 401) {
            if (authStatus === "loading") return;
            if (authStatus === "authenticated") markSessionExpired();
            setState({ status: "unauthorized", matches: emptyDifferentialMatches, demoMode: false });
            return;
          }
          if (!diagnosisResponse.ok || !presentationResponse.ok) {
            setState({ status: "error", matches: emptyDifferentialMatches, demoMode: false });
            return;
          }
          const diagnosisPayload = (await diagnosisResponse.json()) as {
            matches?: DifferentialSearchMatches["diagnoses"];
            demoMode?: boolean;
          };
          const presentationPayload = (await presentationResponse.json()) as {
            matches?: DifferentialSearchMatches["presentations"];
            demoMode?: boolean;
          };
          if (controller.signal.aborted) return;
          const matches: DifferentialSearchMatches = {
            diagnoses: diagnosisPayload.matches ?? [],
            presentations: presentationPayload.matches ?? [],
          };
          const demoMode = Boolean(diagnosisPayload.demoMode || presentationPayload.demoMode);
          writeDifferentialCache(cacheKey, { matches, demoMode });
          setState({ status: "ready", matches, demoMode });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
          setState({ status: "error", matches: emptyDifferentialMatches, demoMode: false });
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [requestKey, cacheKey, authStatus, authorizationHeader, markSessionExpired]);

  if (!requestKey) {
    return { status: "ready", matches: emptyDifferentialMatches, demoMode: false };
  }
  if (cached && state.status !== "unauthorized" && state.status !== "error") {
    return { status: "ready", matches: cached.matches, demoMode: cached.demoMode };
  }
  return state;
}

export function useDifferentialRecord(slug: string): DifferentialRecordState {
  const { authorizationHeader, markSessionExpired, status: authStatus } = useAuthSession();
  const requestKey = slug.trim().toLowerCase();
  const [state, setState] = useState<DifferentialRecordState>({
    status: "loading",
    record: null,
    detailContext: null,
    demoMode: false,
    governance: null,
  });

  useEffect(() => {
    let active = true;
    fetch(`/api/differentials/${encodeURIComponent(requestKey)}?kind=diagnosis`, { headers: authorizationHeader })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) {
          if (authStatus === "loading") return;
          if (authStatus === "authenticated") markSessionExpired();
          setState({ status: "unauthorized", record: null, detailContext: null, demoMode: false, governance: null });
          return;
        }
        if (response.status === 404) {
          setState({ status: "not_found", record: null, detailContext: null, demoMode: false, governance: null });
          return;
        }
        if (!response.ok) {
          setState({ status: "error", record: null, detailContext: null, demoMode: false, governance: null });
          return;
        }
        const payload = (await response.json()) as {
          record?: DifferentialRecord;
          detailContext?: DifferentialDetailContext;
          demoMode?: boolean;
          governance?: DifferentialRecordGovernance;
        };
        setState({
          status: payload.record ? "ready" : "not_found",
          record: payload.record ?? null,
          detailContext: payload.detailContext ?? null,
          demoMode: Boolean(payload.demoMode),
          governance: payload.governance ?? null,
        });
      })
      .catch(() => {
        if (active) {
          setState({ status: "error", record: null, detailContext: null, demoMode: false, governance: null });
        }
      });
    return () => {
      active = false;
    };
  }, [requestKey, authStatus, authorizationHeader, markSessionExpired]);

  return state;
}

export function useDifferentialPresentation(slug: string): DifferentialPresentationState {
  const { authorizationHeader, markSessionExpired, status: authStatus } = useAuthSession();
  const requestKey = slug.trim().toLowerCase();
  const [state, setState] = useState<DifferentialPresentationState>({
    status: "loading",
    workflow: null,
    demoMode: false,
    governance: null,
  });

  useEffect(() => {
    let active = true;
    fetch(`/api/differentials/${encodeURIComponent(requestKey)}?kind=presentation`, { headers: authorizationHeader })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) {
          if (authStatus === "loading") return;
          if (authStatus === "authenticated") markSessionExpired();
          setState({ status: "unauthorized", workflow: null, demoMode: false, governance: null });
          return;
        }
        if (response.status === 404) {
          setState({ status: "not_found", workflow: null, demoMode: false, governance: null });
          return;
        }
        if (!response.ok) {
          setState({ status: "error", workflow: null, demoMode: false, governance: null });
          return;
        }
        const payload = (await response.json()) as {
          workflow?: DifferentialPresentationWorkflow;
          demoMode?: boolean;
          governance?: DifferentialRecordGovernance;
        };
        setState({
          status: payload.workflow ? "ready" : "not_found",
          workflow: payload.workflow ?? null,
          demoMode: Boolean(payload.demoMode),
          governance: payload.governance ?? null,
        });
      })
      .catch(() => {
        if (active) setState({ status: "error", workflow: null, demoMode: false, governance: null });
      });
    return () => {
      active = false;
    };
  }, [requestKey, authStatus, authorizationHeader, markSessionExpired]);

  return state;
}
