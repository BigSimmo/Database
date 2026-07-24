"use client";

import { useDeferredValue, useMemo } from "react";

import { rankFormRecords, type FormSearchMatch } from "@/lib/form-ranker";
import { rankServiceRecords, type ServiceSearchMatch } from "@/lib/service-ranker";
import { useRegistryRecords, type RegistryRequestStatus } from "@/lib/use-registry-records";

export type DeferredRegistrySearchMatch = FormSearchMatch | ServiceSearchMatch;

/**
 * Owner-scoped registry fetch + deferred client ranking for services/forms modes.
 * Input `query` stays live for the composer; ranking uses `useDeferredValue` so
 * keystrokes stay responsive over large catalogues. A cleared live query drops
 * record matches immediately so deferred lag cannot keep stale hits on screen.
 */
export function useDeferredRegistrySearch(
  searchMode: string,
  query: string,
): {
  recordSearchMatches: DeferredRegistrySearchMatch[];
  recordSearchMode: "forms" | "services";
  recordStatus: RegistryRequestStatus;
} {
  const registryRecords = useRegistryRecords(searchMode === "forms" ? "form" : "service", {
    enabled: searchMode === "services" || searchMode === "forms",
  });
  const deferredQuery = useDeferredValue(query);
  const liveQuery = query.trim();

  const serviceSearchMatches = useMemo(() => {
    if (searchMode !== "services") return [];
    // Cleared composer: drop matches immediately (do not wait on deferred lag).
    if (!liveQuery) return [];
    // First keystrokes may leave deferred empty — avoid empty-query "all records" ranking.
    if (!deferredQuery.trim()) return [];
    return rankServiceRecords(registryRecords.records, deferredQuery);
  }, [deferredQuery, liveQuery, searchMode, registryRecords.records]);

  const formSearchMatches = useMemo(() => {
    if (searchMode !== "forms") return [];
    if (!liveQuery) return [];
    if (!deferredQuery.trim()) return [];
    return rankFormRecords(registryRecords.records, deferredQuery);
  }, [deferredQuery, liveQuery, searchMode, registryRecords.records]);

  const recordSearchMatches = useMemo(
    () => (searchMode === "forms" ? formSearchMatches : searchMode === "services" ? serviceSearchMatches : []),
    [searchMode, formSearchMatches, serviceSearchMatches],
  );
  return {
    recordSearchMatches,
    recordSearchMode: searchMode === "forms" ? "forms" : "services",
    recordStatus: registryRecords.status,
  };
}
