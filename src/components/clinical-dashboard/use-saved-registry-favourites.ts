"use client";

import { ClipboardList, Stethoscope } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { FavouriteItem } from "@/components/clinical-dashboard/favourites-prototype-data";
import type { ServiceRecord } from "@/lib/services";
import { useRegistryRecords } from "@/lib/use-registry-records";

// localStorage keys written by the service/form detail pages when a record is
// saved (see service-detail-page.tsx / form-detail-page.tsx).
const savedServicesKey = "clinical-kb-saved-services";
const savedFormsKey = "clinical-kb-saved-forms";

function readSavedSlugs(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function recordToFavourite(record: ServiceRecord, type: "services" | "forms"): FavouriteItem {
  return {
    id: `${type}:${record.slug}`,
    title: record.title,
    type,
    set: "",
    meta: record.subtitle ?? (type === "services" ? "Saved service" : "Saved form"),
    sourceMeta: type === "services" ? "Service" : "Form",
    primaryAction: "Open",
    icon: type === "services" ? Stethoscope : ClipboardList,
    keywords: [record.title, record.subtitle, ...(record.tags ?? [])].filter(Boolean).join(" ").toLowerCase(),
  };
}

/**
 * Hydrate the user's saved services/forms into the FavouriteItem shape the hub
 * renders. Slugs live in localStorage; titles/metadata come from the owner's
 * registry via useRegistryRecords (demo mode serves fixtures, so this also
 * works env-less). Fetching is gated on there being saved slugs, so the common
 * "nothing saved" case makes no request.
 */
export function useSavedRegistryFavourites(): FavouriteItem[] {
  const [savedServices, setSavedServices] = useState<string[]>([]);
  const [savedForms, setSavedForms] = useState<string[]>([]);

  useEffect(() => {
    const refresh = () => {
      setSavedServices(readSavedSlugs(savedServicesKey));
      setSavedForms(readSavedSlugs(savedFormsKey));
    };
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
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
