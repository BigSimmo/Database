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

/** Owner-scoped registry list (Services/Forms home and search surfaces). The
 *  API serves mock fixtures in demo mode, so callers never branch on demo
 *  themselves. Pass enabled:false to skip fetching until the mode is active. */
export function useRegistryRecords(
  kind: RegistryRecordKind,
  options: { enabled?: boolean } = {},
): RegistryRecordsState {
  const enabled = options.enabled ?? true;
  const { authorizationHeader, markSessionExpired } = useAuthSession();
  const [state, setState] = useState<RegistryRecordsState>({
    status: "loading",
    records: [],
    total: 0,
    demoMode: false,
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    fetch(`/api/registry/records?kind=${kind}`, { headers: authorizationHeader })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) {
          markSessionExpired();
          setState({ status: "unauthorized", records: [], total: 0, demoMode: false });
          return;
        }
        if (!response.ok) {
          setState({ status: "error", records: [], total: 0, demoMode: false });
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
        });
      })
      .catch(() => {
        if (active) setState({ status: "error", records: [], total: 0, demoMode: false });
      });
    return () => {
      active = false;
    };
  }, [enabled, kind, authorizationHeader, markSessionExpired]);

  return state;
}

/** Single owner-scoped registry record (detail pages). */
export function useRegistryRecord(kind: RegistryRecordKind, slug: string): RegistryRecordState {
  const { authorizationHeader, markSessionExpired } = useAuthSession();
  const requestKey = `${kind}:${slug}`;
  const [state, setState] = useState<RegistryRecordState>({
    status: "loading",
    record: null,
    linkedDocuments: [],
    demoMode: false,
  });
  // Reset to loading during render when the target record changes, instead of
  // synchronously inside the effect (react-hooks/set-state-in-effect).
  const [lastRequestKey, setLastRequestKey] = useState(requestKey);
  if (lastRequestKey !== requestKey) {
    setLastRequestKey(requestKey);
    setState({ status: "loading", record: null, linkedDocuments: [], demoMode: false });
  }

  useEffect(() => {
    let active = true;
    fetch(`/api/registry/records/${encodeURIComponent(slug)}?kind=${kind}`, { headers: authorizationHeader })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) {
          markSessionExpired();
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
  }, [kind, slug, authorizationHeader, markSessionExpired]);

  return state;
}
