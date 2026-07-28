"use client";

import { BrainCircuit, ClipboardList } from "lucide-react";
import { appModeIcons } from "@/lib/app-mode-icons";
import { useCallback, useMemo } from "react";

import { useAccountData } from "@/components/account-data-provider";
import type { FavouriteItem } from "@/components/clinical-dashboard/favourites-prototype-data";
import {
  foldSavedFavouritesStatus,
  type SavedFavouritesBandStatus,
} from "@/components/clinical-dashboard/saved-registry-favourites-status";
import type { ServiceRecord } from "@/lib/services";
import { useRegistryRecords } from "@/lib/use-registry-records";

function recordToFavourite(record: ServiceRecord, type: "services" | "forms"): FavouriteItem {
  return {
    id: `${type}:${record.slug}`,
    title: record.title,
    type,
    set: type === "services" ? "Saved services" : "Saved forms",
    meta: record.subtitle ?? (type === "services" ? "Saved service" : "Saved form"),
    sourceMeta: type === "services" ? "Service" : "Form",
    primaryAction: "Open",
    href: `/${type}/${record.slug}`,
    icon: type === "services" ? appModeIcons.services : ClipboardList,
    keywords: [record.title, record.subtitle, ...(record.tags ?? [])].filter(Boolean).join(" ").toLowerCase(),
  };
}

export type SavedRegistryFavouritesResult = {
  items: FavouriteItem[];
  /** Combined account + registry status for the band/empty state. When unaffected
      sources already produced items, this stays `ready` so a valid nonzero count
      remains visible — see `registryStatus` for the raw registry fold. */
  status: SavedFavouritesBandStatus;
  /** Raw folded registry status before account/nonempty overrides. */
  registryStatus: SavedFavouritesBandStatus;
  /** Re-runs every registry this hook actually requested. */
  refetch: () => void;
};

export function useSavedRegistryFavourites(): SavedRegistryFavouritesResult {
  const {
    favourites,
    ready: accountReady,
    error: accountError,
    isAuthenticated,
    reload: reloadAccount,
  } = useAccountData();
  const savedServices = favourites.service;
  const savedForms = favourites.form;
  const savedDifferentials = favourites.differential;

  const services = useRegistryRecords("service", { enabled: savedServices.length > 0 });
  const forms = useRegistryRecords("form", { enabled: savedForms.length > 0 });

  const items = useMemo(() => {
    const savedServiceSet = new Set(savedServices);
    const savedFormSet = new Set(savedForms);
    const serviceItems = services.records
      .filter((record) => savedServiceSet.has(record.slug))
      .map((record) => recordToFavourite(record, "services"));
    const formItems = forms.records
      .filter((record) => savedFormSet.has(record.slug))
      .map((record) => recordToFavourite(record, "forms"));
    const differentialItems: FavouriteItem[] = savedDifferentials.map((slug) => ({
      id: `differentials:${slug}`,
      title: slug
        .split("-")
        .filter(Boolean)
        .map((word) => word[0]?.toUpperCase() + word.slice(1))
        .join(" "),
      type: "differentials",
      set: "Saved differentials",
      meta: "Saved diagnosis",
      sourceMeta: "Differential",
      primaryAction: "Open",
      href: `/differentials/diagnoses/${encodeURIComponent(slug)}`,
      icon: BrainCircuit,
      keywords: slug.replaceAll("-", " "),
    }));
    return [...serviceItems, ...formItems, ...differentialItems];
  }, [services.records, forms.records, savedServices, savedForms, savedDifferentials]);

  // Only a registry that was actually requested can report a fault: a disabled
  // hook sits in its initial state forever and must not be read as a failure.
  // Unauthorized outranks error because it is the one the reader can act on.
  const requested = [savedServices.length > 0 ? services.status : null, savedForms.length > 0 ? forms.status : null];
  const rawRegistryStatus: SavedFavouritesBandStatus = requested.includes("unauthorized")
    ? "unauthorized"
    : requested.includes("error") || requested.includes("not_found")
      ? "error"
      : requested.includes("loading")
        ? "loading"
        : "ready";
  const { status, registryStatus } = foldSavedFavouritesStatus({
    isAuthenticated,
    accountReady,
    accountError,
    registryStatus: rawRegistryStatus,
    itemCount: items.length,
  });

  const refetchServices = services.refetch;
  const refetchForms = forms.refetch;
  const refetch = useCallback(() => {
    // The account request must be reissued first. When it is what failed it has
    // already cleared every saved slug, so both registries are disabled and
    // hold nothing to re-request — Retry would be a button that does nothing.
    if (isAuthenticated) reloadAccount();
    if (savedServices.length > 0) refetchServices();
    if (savedForms.length > 0) refetchForms();
  }, [isAuthenticated, reloadAccount, savedServices.length, savedForms.length, refetchServices, refetchForms]);

  return { items, status, registryStatus, refetch };
}
