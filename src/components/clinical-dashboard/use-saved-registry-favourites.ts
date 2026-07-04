"use client";

import { ClipboardList } from "lucide-react";
import { appModeIcons } from "@/lib/app-mode-icons";
import { useEffect, useMemo, useState } from "react";

import type { FavouriteItem } from "@/components/clinical-dashboard/favourites-prototype-data";
import type { ServiceRecord } from "@/lib/services";
import {
  readSavedRegistrySlugs,
  savedFormsStorageKey,
  savedServicesStorageKey,
  subscribeSavedRegistrySlugs,
} from "@/lib/saved-registry-storage";
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

export function useSavedRegistryFavourites(): FavouriteItem[] {
  const [savedServices, setSavedServices] = useState<string[]>([]);
  const [savedForms, setSavedForms] = useState<string[]>([]);

  useEffect(() => {
    const refresh = () => {
      setSavedServices(readSavedRegistrySlugs(savedServicesStorageKey));
      setSavedForms(readSavedRegistrySlugs(savedFormsStorageKey));
    };
    refresh();
    return subscribeSavedRegistrySlugs(refresh);
  }, []);

  const services = useRegistryRecords("service", { enabled: savedServices.length > 0 });
  const forms = useRegistryRecords("form", { enabled: savedForms.length > 0 });

  return useMemo(() => {
    const savedServiceSet = new Set(savedServices);
    const savedFormSet = new Set(savedForms);
    const serviceItems = services.records
      .filter((record) => savedServiceSet.has(record.slug))
      .map((record) => recordToFavourite(record, "services"));
    const formItems = forms.records
      .filter((record) => savedFormSet.has(record.slug))
      .map((record) => recordToFavourite(record, "forms"));
    return [...serviceItems, ...formItems];
  }, [services.records, forms.records, savedServices, savedForms]);
}
