"use client";

import { useCallback, useEffect, useState } from "react";

import { onCallEntrySchema, type OnCallEntry } from "@/lib/on-call/entry-model";
import { useAuthSession } from "@/lib/supabase/client";

/*
 * The reader's On Call education entries, so Week can open one in On Call's
 * own editor. The rows themselves come from the week read. Read into React
 * state only, never through `useOnCallEntries`, whose device cache Teaching may
 * not use. Refetches when the account changes, drops a late response by key,
 * and reads nothing while signed out.
 */
export type RelocatedTeaching = { entries: ReadonlyMap<string, OnCallEntry>; reload: () => void };
const NONE: ReadonlyMap<string, OnCallEntry> = new Map();

async function readEntries(signal: AbortSignal): Promise<ReadonlyMap<string, OnCallEntry>> {
  const response = await fetch("/api/on-call/entries?section=education", { cache: "no-store", signal });
  if (!response.ok) return NONE;
  const entries = new Map<string, OnCallEntry>();
  for (const raw of ((await response.json()) as { entries?: unknown[] }).entries ?? []) {
    const parsed = onCallEntrySchema.safeParse(raw);
    if (parsed.success && parsed.data.section === "education") entries.set(parsed.data.id, parsed.data);
  }
  return entries;
}

export function useRelocatedTeaching(enabled: boolean): RelocatedTeaching {
  const auth = useAuthSession();
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; entries: ReadonlyMap<string, OnCallEntry> } | null>(null);
  const key = enabled && auth.status === "authenticated" ? `${auth.authEpoch}|${attempt}` : null;
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    readEntries(controller.signal)
      .catch(() => NONE)
      .then((entries) => {
        if (!controller.signal.aborted) setLoaded({ key, entries });
      });
    return () => controller.abort();
  }, [key]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { entries: loaded?.key === key ? loaded.entries : NONE, reload };
}
