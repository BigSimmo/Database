"use client";

import { useEffect, useState } from "react";

import type { RegistryRecordKind } from "@/lib/registry-records";
import type { ServiceRecord } from "@/lib/services";
import { useAuthSession } from "@/lib/supabase/client";

export type RegistryRequestStatus = "loading" | "ready" | "unauthorized" | "not_found" | "error";

export type RegistryRecordsState = {
  status: RegistryRequestStatus;
  records: ServiceRecord[];
  total: number;
  demoMode: boolean;
};

export type RegistryRecordState = {
  status: RegistryRequestStatus;
  record: ServiceRecord | null;
  linkedDocuments: Array<{ id: string; title: string; file_name: string; status: string }>;
  demoMode: boolean;
};

const recordsLoading: RegistryRecordsState = { status: "loading", records: [], total: 0, demoMode: false };
const recordLoading: RegistryRecordState = { status: "loading", record: null, linkedDocuments: [], demoMode: false };
type RegistryRecordsKeyedState = RegistryRecordsState & { kind: RegistryRecordKind };

/** Owner-scoped registry list (Services/Forms home and search surfaces). The
 *  API serves mock fixtures in demo mode, so callers never branch on demo
 *  themselves. Pass enabled:false to skip fetching until the mode is active. */
export function useRegistryRecords(
  kind: RegistryRecordKind,
  options: { enabled?: boolean } = {},
): RegistryRecordsState {
  const enabled = options.enabled ?? true;
  const { authorizationHeader, markSessionExpired, status: authStatus } = useAuthSession();
  const [state, setState] = useState<RegistryRecordsKeyedState>({ ...recordsLoading, kind });
  const visibleState: RegistryRecordsState = state.kind === kind ? state : recordsLoading;

  useEffect(() => {
    // Wait for the auth provider to resolve the session before fetching, so a
    // still-loading `authorizationHeader` ({}) does not cause a spurious 401
    // that clobbers a valid session via markSessionExpired().
    if (!enabled || authStatus === "loading") return undefined;
    let active = true;
    fetch(`/api/registry/records?kind=${kind}`, { headers: authorizationHeader })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) {
          if (authStatus === "authenticated") markSessionExpired();
          setState({ status: "unauthorized", records: [], total: 0, demoMode: false, kind });
          return;
        }
        if (!response.ok) {
          setState({ status: "error", records: [], total: 0, demoMode: false, kind });
          return;
        }
        const payload = (await response.json()) as {
          records?: ServiceRecord[];
          total?: number;
          demoMode?: boolean;
        };
        setState({
          status: "ready",
          records: payload.records ?? [],
          total: payload.total ?? payload.records?.length ?? 0,
          demoMode: Boolean(payload.demoMode),
          kind,
        });
      })
      .catch(() => {
        if (active) setState({ status: "error", records: [], total: 0, demoMode: false, kind });
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
    if (authStatus === "loading") return undefined;
    let active = true;
    fetch(`/api/registry/records/${encodeURIComponent(slug)}?kind=${kind}`, { headers: authorizationHeader })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) {
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
