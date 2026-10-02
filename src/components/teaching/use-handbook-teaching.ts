"use client";

import { useEffect, useState } from "react";

import type { ServiceDetail } from "@/lib/on-call/service-model";
import { useAuthSession } from "@/lib/supabase/client";

/*
 * A handbook's published "teaching" entries, read through On Call's service
 * read. Read only, into React state only. Refetches when the account changes,
 * drops a late response by key, and reads nothing while signed out.
 */
export type HandbookTeachingItem = {
  id: string;
  serviceName: string;
  title: string;
  source: { label: string; url: string } | null;
};
export type HandbookTeaching = { items: readonly HandbookTeachingItem[]; failed: boolean };
const MAX_SERVICES = 10;
const NONE: HandbookTeaching = { items: [], failed: false };

/** A reader without On Call access gets 401/403/404: that is "no handbook", not a failure. */
function brokenResponse(response: Response): boolean {
  return response.status >= 500;
}

function items(detail: Pick<ServiceDetail, "service" | "entries">): HandbookTeachingItem[] {
  return detail.entries.flatMap((entry) => {
    const content = entry.publishedContent;
    if (!content || content.section !== "teaching" || entry.status === "withdrawn") return [];
    return [
      { id: entry.id, serviceName: detail.service.name, title: content.title, source: content.sources[0] ?? null },
    ];
  });
}

async function readHandbooks(signal: AbortSignal): Promise<HandbookTeaching> {
  const list = await fetch("/api/on-call/services", { cache: "no-store", signal });
  if (!list.ok) return { items: [], failed: brokenResponse(list) };
  const { services } = (await list.json()) as { services?: { id: string }[] };
  let failed = false;
  const details = await Promise.all(
    (services ?? []).slice(0, MAX_SERVICES).map(async ({ id }) => {
      const response = await fetch(`/api/on-call/services/${encodeURIComponent(id)}`, { cache: "no-store", signal });
      if (!response.ok) {
        failed ||= brokenResponse(response);
        return [];
      }
      return items((await response.json()) as ServiceDetail);
    }),
  );
  return { items: details.flat(), failed };
}

/** The entries that loaded, and whether any handbook read failed (network or server error). */
export function useHandbookTeaching(enabled: boolean): HandbookTeaching {
  const auth = useAuthSession();
  const [loaded, setLoaded] = useState<{ key: string; result: HandbookTeaching } | null>(null);
  const key = enabled && auth.status === "authenticated" ? String(auth.authEpoch) : null;
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    readHandbooks(controller.signal)
      .catch((): HandbookTeaching => ({ items: [], failed: true }))
      .then((result) => {
        if (!controller.signal.aborted) setLoaded({ key, result });
      });
    return () => controller.abort();
  }, [key]);
  return loaded?.key === key ? loaded.result : NONE;
}
