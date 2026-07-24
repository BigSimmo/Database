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

/** Match universal / medication catalogue debounce so live composer follow coalesces. */
const differentialSearchDebounceMs = 250;

/** Ranked catalogue search for the Differentials search mode: fetches scored
 *  diagnosis and presentation matches in parallel from /api/differentials.
 *  Empty queries resolve immediately without a request. */
export function useDifferentialSearch(query: string): DifferentialSearchState {
  const { authorizationHeader, markSessionExpired, status: authStatus } = useAuthSession();
  const requestKey = query.trim().toLowerCase();
  const [state, setState] = useState<DifferentialSearchState>({
    status: "ready",
    matches: emptyDifferentialMatches,
    demoMode: false,
  });
  // Reset to loading during render when the query changes (repo pattern —
  // avoids react-hooks/set-state-in-effect).
  const [lastRequestKey, setLastRequestKey] = useState(requestKey);
  if (lastRequestKey !== requestKey) {
    setLastRequestKey(requestKey);
    setState({
      status: requestKey ? "loading" : "ready",
      matches: emptyDifferentialMatches,
      demoMode: false,
    });
  }

  useEffect(() => {
    if (!requestKey) return undefined;
    const controller = new AbortController();
    const encoded = encodeURIComponent(requestKey);
    const timer = window.setTimeout(() => {
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
          setState({
            status: "ready",
            matches: {
              diagnoses: diagnosisPayload.matches ?? [],
              presentations: presentationPayload.matches ?? [],
            },
            demoMode: Boolean(diagnosisPayload.demoMode || presentationPayload.demoMode),
          });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
          setState({ status: "error", matches: emptyDifferentialMatches, demoMode: false });
        });
    }, differentialSearchDebounceMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [requestKey, authStatus, authorizationHeader, markSessionExpired]);

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
