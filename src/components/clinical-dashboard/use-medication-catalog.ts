"use client";

import { useEffect, useState } from "react";

import { fetchJsonCached } from "@/lib/client-fetch-cache";
import type { MedicationRecord, MedicationSearchResult } from "@/lib/medications";
import { useAuthSession } from "@/lib/supabase/client";

type MedicationCatalogMatch = {
  medication: MedicationRecord;
  result: MedicationSearchResult;
  score: number;
  reasons: string[];
};

type MedicationCatalogResponse = {
  records: MedicationRecord[];
  matches?: MedicationCatalogMatch[];
  total: number;
  demoMode?: boolean;
};

type MedicationDetailResponse = {
  record: MedicationRecord;
  governance?: {
    sourceStatus: string;
    validationStatus: string;
  };
  demoMode?: boolean;
};

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

// Cached + deduped (short TTL): the prescribing workspace, cross-mode links,
// and detail pages request the same catalog concurrently on mount.
async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const result = await fetchJsonCached(url, { headers });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Request failed (${result.status})`);
  }
  return result.payload as T;
}

export function useMedicationCatalog(
  query?: string,
  options: { enabled?: boolean; fields?: "index" } = {},
): AsyncState<MedicationCatalogResponse> {
  const enabled = options.enabled ?? true;
  const fields = options.fields;
  const trimmed = query?.trim() ?? "";
  // Auth-aware like use-registry-records: without the header an authenticated owner was
  // silently served the public fixture catalogue instead of their seeded records.
  const { authorizationHeader } = useAuthSession();
  const [prevQuery, setPrevQuery] = useState(trimmed);
  const [prevEnabled, setPrevEnabled] = useState(enabled);
  const [state, setState] = useState<AsyncState<MedicationCatalogResponse>>({
    data: null,
    loading: enabled,
    error: null,
  });

  if (trimmed !== prevQuery || enabled !== prevEnabled) {
    setPrevQuery(trimmed);
    setPrevEnabled(enabled);
    setState({
      data: null,
      loading: enabled,
      error: null,
    });
  }

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    if (fields) params.set("fields", fields);
    const suffix = params.toString();
    const url = suffix ? `/api/medications?${suffix}` : "/api/medications";
    fetchJson<MedicationCatalogResponse>(url, authorizationHeader)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : "Could not load medications.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [trimmed, enabled, fields, authorizationHeader]);

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
    let cancelled = false;
    fetchJson<MedicationDetailResponse>(`/api/medications/${encodeURIComponent(normalized)}`, authorizationHeader)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : "Could not load medication.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [normalized, authorizationHeader]);

  return state;
}
