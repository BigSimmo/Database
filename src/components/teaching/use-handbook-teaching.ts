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
const MAX_SERVICES = 10;
const NONE: readonly HandbookTeachingItem[] = [];

function items(detail: Pick<ServiceDetail, "service" | "entries">): HandbookTeachingItem[] {
  return detail.entries.flatMap((entry) => {
    const content = entry.publishedContent;
    if (!content || content.section !== "teaching" || entry.status === "withdrawn") return [];
    return [
      { id: entry.id, serviceName: detail.service.name, title: content.title, source: content.sources[0] ?? null },
    ];
  });
}

async function readHandbooks(signal: AbortSignal): Promise<HandbookTeachingItem[]> {
  const list = await fetch("/api/on-call/services", { cache: "no-store", signal });
  if (!list.ok) return [];
  const { services } = (await list.json()) as { services?: { id: string }[] };
  const details = await Promise.all(
    (services ?? []).slice(0, MAX_SERVICES).map(async ({ id }) => {
      const response = await fetch(`/api/on-call/services/${encodeURIComponent(id)}`, { cache: "no-store", signal });
      return response.ok ? items((await response.json()) as ServiceDetail) : [];
    }),
  );
  return details.flat();
}

export function useHandbookTeaching(enabled: boolean): readonly HandbookTeachingItem[] {
  const auth = useAuthSession();
  const [loaded, setLoaded] = useState<{ key: string; items: readonly HandbookTeachingItem[] } | null>(null);
  const key = enabled && auth.status === "authenticated" ? String(auth.authEpoch) : null;
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    readHandbooks(controller.signal)
      .catch(() => NONE)
      .then((found) => {
        if (!controller.signal.aborted) setLoaded({ key, items: found });
      });
    return () => controller.abort();
  }, [key]);
  return loaded?.key === key ? loaded.items : NONE;
}
