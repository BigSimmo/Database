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

async function fetchJson<T>(url: string, headers?: HeadersInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", headers });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export function useMedicationCatalog(query?: string): AsyncState<MedicationCatalogResponse> {
  const trimmed = query?.trim() ?? "";
  // Auth-aware like use-registry-records: without the header an authenticated owner was
  // silently served the public fixture catalogue instead of their seeded records.
  const { authorizationHeader } = useAuthSession();
  const [prevQuery, setPrevQuery] = useState(trimmed);
  const [state, setState] = useState<AsyncState<MedicationCatalogResponse>>({
    data: null,
    loading: true,
    error: null,
  });

  if (trimmed !== prevQuery) {
    setPrevQuery(trimmed);
    setState({
      data: null,
      loading: true,
      error: null,
    });
  }

  useEffect(() => {
    let cancelled = false;
    const url = trimmed ? `/api/medications?q=${encodeURIComponent(trimmed)}` : "/api/medications";
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
  }, [trimmed, authorizationHeader]);

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
