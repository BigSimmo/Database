"use client";

import { useDeferredValue, useMemo } from "react";

import { rankFormRecords, type FormSearchMatch } from "@/lib/form-ranker";
import { rankServiceRecords, type ServiceSearchMatch } from "@/lib/service-ranker";
import { useRegistryRecords, type RegistryRequestStatus } from "@/lib/use-registry-records";

export type DeferredRegistrySearchMatch = FormSearchMatch | ServiceSearchMatch;

/**
 * Owner-scoped registry fetch + deferred client ranking for services/forms modes.
 * Input `query` stays live for the composer; ranking uses `useDeferredValue` so
 * keystrokes stay responsive over large catalogues.
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
  const serviceSearchMatches = useMemo(
    () => (searchMode === "services" ? rankServiceRecords(registryRecords.records, deferredQuery) : []),
    [deferredQuery, searchMode, registryRecords.records],
  );
  const formSearchMatches = useMemo(
    () => (searchMode === "forms" ? rankFormRecords(registryRecords.records, deferredQuery) : []),
    [deferredQuery, searchMode, registryRecords.records],
  );
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
