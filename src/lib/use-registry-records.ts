"use client";

import { useEffect, useState } from "react";

import type { RegistryRecordKind, RegistryValidationStatus } from "@/lib/registry-records";
import type { ServiceRecord } from "@/lib/services";
import { useAuthSession } from "@/lib/supabase/client";

export type RegistryRequestStatus = "loading" | "ready" | "unauthorized" | "not_found" | "error";

export type RegistryRecordsState = {
  status: RegistryRequestStatus;
  records: ServiceRecord[];
  total: number;
  demoMode: boolean;
  /** Authoritative validation status per slug from the API, so callers count
   *  reviewed records from governance rather than the copied fixture JSON. */
  governance: Record<string, RegistryValidationStatus>;
};

export type RegistryRecordState = {
  status: RegistryRequestStatus;
  record: ServiceRecord | null;
  linkedDocuments: Array<{ id: string; title: string; file_name: string; status: string }>;
  demoMode: boolean;
};

const recordLoading: RegistryRecordState = { status: "loading", record: null, linkedDocuments: [], demoMode: false };
type RegistryRecordsKeyedState = RegistryRecordsState & { kind: RegistryRecordKind };

function recordsState(
  status: RegistryRequestStatus,
  kind: RegistryRecordKind,
  extra: Partial<RegistryRecordsState> = {},
): RegistryRecordsKeyedState {
  return { status, records: [], total: 0, demoMode: false, governance: {}, kind, ...extra };
}

/** Count records whose authoritative validation status is reviewed/approved. */
export function countVerifiedRegistryRecords(state: RegistryRecordsState) {
  return state.records.filter((record) => {
    const status = state.governance[record.slug];
    return status === "locally_reviewed" || status === "approved";
  }).length;
}

/** Owner-scoped registry list (Services/Forms home and search surfaces). The
 *  API serves mock fixtures in demo mode, so callers never branch on demo
 *  themselves. Pass enabled:false to skip fetching until the mode is active. */
export function useRegistryRecords(
  kind: RegistryRecordKind,
  options: { enabled?: boolean } = {},
): RegistryRecordsState {
  const enabled = options.enabled ?? true;
  const { authorizationHeader, markSessionExpired, status: authStatus } = useAuthSession();
  const [state, setState] = useState<RegistryRecordsKeyedState>(recordsState("loading", kind));
  const visibleState: RegistryRecordsState = state.kind === kind ? state : recordsState("loading", kind);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    fetch(`/api/registry/records?kind=${kind}`, { headers: authorizationHeader })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) {
          // In real auth deployments the first request can race AuthProvider's
          // session load. Keep loading until the auth status changes and this
          // effect retries with a real header; never expire the session from an
          // auth-loading 401. Demo/local API responses can still resolve fast.
          if (authStatus === "loading") return;
          if (authStatus === "authenticated") markSessionExpired();
          setState(recordsState("unauthorized", kind));
          return;
        }
        if (!response.ok) {
          setState(recordsState("error", kind));
          return;
        }
        const payload = (await response.json()) as {
          records?: ServiceRecord[];
          total?: number;
          demoMode?: boolean;
          governance?: Record<string, { validationStatus?: RegistryValidationStatus }>;
        };
        const governance: Record<string, RegistryValidationStatus> = {};
        for (const [slug, entry] of Object.entries(payload.governance ?? {})) {
          if (entry?.validationStatus) governance[slug] = entry.validationStatus;
        }
        setState(
          recordsState("ready", kind, {
            records: payload.records ?? [],
            total: payload.total ?? payload.records?.length ?? 0,
            demoMode: Boolean(payload.demoMode),
            governance,
          }),
        );
      })
      .catch(() => {
        if (active) setState(recordsState("error", kind));
      });
    return () => {
      active = false;
    };
  }, [enabled, kind, authStatus, authorizationHeader, markSessionExpired]);

  return visibleState;
}

/** Single owner-scoped registry record (detail pages). */
export function useRegistryRecord(kind: RegistryRecordKind, slug: string): RegistryRecordState {
  const { authorizationHeader, markSessionExpired, status: authStatus } = useAuthSession();
  const requestKey = `${kind}:${slug}`;
  const [state, setState] = useState<RegistryRecordState>(recordLoading);
  // Reset to loading during render when the target record changes, instead of
  // synchronously inside the effect (react-hooks/set-state-in-effect).
  const [lastRequestKey, setLastRequestKey] = useState(requestKey);
  if (lastRequestKey !== requestKey) {
    setLastRequestKey(requestKey);
    setState(recordLoading);
  }

  useEffect(() => {
    let active = true;
    fetch(`/api/registry/records/${encodeURIComponent(slug)}?kind=${kind}`, { headers: authorizationHeader })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) {
          if (authStatus === "loading") return;
          if (authStatus === "authenticated") markSessionExpired();
          setState({ status: "unauthorized", record: null, linkedDocuments: [], demoMode: false });
          return;
        }
        if (response.status === 404) {
          setState({ status: "not_found", record: null, linkedDocuments: [], demoMode: false });
          return;
        }
        if (!response.ok) {
          setState({ status: "error", record: null, linkedDocuments: [], demoMode: false });
          return;
        }
        const payload = (await response.json()) as {
          record?: ServiceRecord;
          linkedDocuments?: Array<{ id: string; title: string; file_name: string; status: string }>;
          demoMode?: boolean;
        };
        if (!payload.record) {
          setState({ status: "not_found", record: null, linkedDocuments: [], demoMode: false });
          return;
        }
        setState({
          status: "ready",
          record: payload.record,
          linkedDocuments: payload.linkedDocuments ?? [],
          demoMode: Boolean(payload.demoMode),
        });
      })
      .catch(() => {
        if (active) setState({ status: "error", record: null, linkedDocuments: [], demoMode: false });
      });
    return () => {
      active = false;
    };
  }, [kind, slug, authStatus, authorizationHeader, markSessionExpired]);

  return state;
}
