"use client";

import { useEffect, useState } from "react";

import type { DifferentialSourceStatus, DifferentialValidationStatus } from "@/lib/differential-records";
import type { DifferentialPresentationWorkflow, DifferentialRecord } from "@/lib/differentials";
import { useAuthSession } from "@/lib/supabase/client";

export type DifferentialRecordGovernance = {
  sourceStatus: DifferentialSourceStatus;
  validationStatus: DifferentialValidationStatus;
};

export type DifferentialRequestStatus = "loading" | "ready" | "unauthorized" | "not_found" | "error";

export type DifferentialRecordState = {
  status: DifferentialRequestStatus;
  record: DifferentialRecord | null;
  demoMode: boolean;
  governance: DifferentialRecordGovernance | null;
};

export type DifferentialPresentationState = {
  status: DifferentialRequestStatus;
  workflow: DifferentialPresentationWorkflow | null;
  demoMode: boolean;
  governance: DifferentialRecordGovernance | null;
};

export function useDifferentialRecord(slug: string): DifferentialRecordState {
  const { authorizationHeader, markSessionExpired, status: authStatus } = useAuthSession();
  const requestKey = slug.trim().toLowerCase();
  const [state, setState] = useState<DifferentialRecordState>({
    status: "loading",
    record: null,
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
          setState({ status: "unauthorized", record: null, demoMode: false, governance: null });
          return;
        }
        if (response.status === 404) {
          setState({ status: "not_found", record: null, demoMode: false, governance: null });
          return;
        }
        if (!response.ok) {
          setState({ status: "error", record: null, demoMode: false, governance: null });
          return;
        }
        const payload = (await response.json()) as {
          record?: DifferentialRecord;
          demoMode?: boolean;
          governance?: DifferentialRecordGovernance;
        };
        setState({
          status: payload.record ? "ready" : "not_found",
          record: payload.record ?? null,
          demoMode: Boolean(payload.demoMode),
          governance: payload.governance ?? null,
        });
      })
      .catch(() => {
        if (active) setState({ status: "error", record: null, demoMode: false, governance: null });
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
