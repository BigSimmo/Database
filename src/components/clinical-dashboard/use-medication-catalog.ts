"use client";

import { useEffect, useState } from "react";

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
  governance?: Record<string, { sourceStatus: string; validationStatus: string }>;
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

/** Match universal typeahead debounce so prescribing keystrokes coalesce. */
const catalogDebounceMs = 250;

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

export function useMedicationCatalog(
  query?: string,
  options: { enabled?: boolean; fields?: "index"; debounceMs?: number } = {},
): AsyncState<MedicationCatalogResponse> {
  const enabled = options.enabled ?? true;
  const fields = options.fields;
  const debounceMs = options.debounceMs ?? catalogDebounceMs;
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
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    if (fields) params.set("fields", fields);
    const suffix = params.toString();
    const url = suffix ? `/api/medications?${suffix}` : "/api/medications";

    const timer = window.setTimeout(() => {
      fetchJson<MedicationCatalogResponse>(url, authorizationHeader, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setState({ data, loading: false, error: null });
        })
        .catch((error) => {
          if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : "Could not load medications.",
          });
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, enabled, fields, debounceMs, authorizationHeader]);

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
