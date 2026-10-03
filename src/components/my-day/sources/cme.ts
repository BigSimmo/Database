"use client";

import { useCallback, useEffect, useState } from "react";

import { useAppPreferences } from "@/components/clinical-dashboard/use-app-preferences";
import { cmeRoutineLogHref } from "@/components/cme/cme-route-navigation";
import { cpdYearOf } from "@/lib/cme/cpd-year";
import { groupDrafts, type CmeDraft } from "@/lib/cme/drafts";
import { routineLogPrefill, routinesDueOn, type CmeRoutine } from "@/lib/cme/routines";
import { myDaySeverityForDue } from "@/lib/my-day/merge";
import type { MyDayItem, MyDaySourceResult } from "@/lib/my-day/model";
import { perthDateKey, showsReminderInApp, type ReminderSettings } from "@/lib/reminders/settings";

/**
 * CPD for My Day: routines due today or earlier (when the reader's own
 * "CPD routines due" reminder is showing) and a count of drafts waiting on the
 * reader. Routine titles are the reader's own labels, already on the CPD page;
 * draft titles and reflections are never read here.
 */
export function cmeMyDayItems(
  input: { routines: readonly CmeRoutine[]; drafts: readonly CmeDraft[]; year: number | string },
  now: Date,
  reminders: ReminderSettings,
): MyDayItem[] {
  const items: MyDayItem[] = [];
  if (showsReminderInApp(reminders, "cpd-routines", perthDateKey(now))) {
    for (const routine of routinesDueOn(input.routines, now)) {
      items.push({
        id: `cme:routine:${routine.id}`,
        mode: "cme",
        title: routine.title,
        detail: "Routine due",
        due: routine.nextDue,
        severity: myDaySeverityForDue(routine.nextDue, now),
        href: cmeRoutineLogHref(routineLogPrefill(routine, now)),
      });
    }
  }
  const waiting = groupDrafts(input.drafts).nextAction.length;
  if (waiting > 0) {
    items.push({
      id: "cme:drafts",
      mode: "cme",
      title: `Finish ${waiting} CPD draft${waiting === 1 ? "" : "s"}`,
      due: null,
      severity: "info",
      href: `/cme/log?year=${encodeURIComponent(String(input.year))}&tab=finish#cme-drafts`,
    });
  }
  return items;
}

const signedOut: MyDaySourceResult = { mode: "cme", status: "signed-out", items: [] };
const loading: MyDaySourceResult = { mode: "cme", status: "loading", items: [] };

type Loaded =
  | { status: "ready"; routines: CmeRoutine[]; drafts: CmeDraft[]; sample: boolean }
  | { status: "signed-out" | "failed" };

type Read<T> = { ok: true; data: T; demo: boolean } | { ok: false; unauthorized: boolean } | null;

async function readList<T>(url: string, key: "routines" | "drafts", signal: AbortSignal): Promise<Read<T[]>> {
  try {
    const response = await fetch(url, { cache: "no-store", signal });
    if (response.status === 401) return { ok: false, unauthorized: true };
    if (!response.ok) return { ok: false, unauthorized: false };
    const body = (await response.json().catch(() => null)) as ({ demoMode?: boolean } & Record<string, unknown>) | null;
    const list = body?.[key];
    if (!Array.isArray(list)) return { ok: false, unauthorized: false };
    return { ok: true, data: list as T[], demo: body?.demoMode === true };
  } catch {
    return signal.aborted ? null : { ok: false, unauthorized: false };
  }
}

async function loadCme(signal: AbortSignal): Promise<Loaded | null> {
  const [routines, drafts] = await Promise.all([
    readList<CmeRoutine>("/api/cme/routines", "routines", signal),
    readList<CmeDraft>("/api/cme/drafts", "drafts", signal),
  ]);
  if (signal.aborted || !routines || !drafts) return null;
  if ((!routines.ok && routines.unauthorized) || (!drafts.ok && drafts.unauthorized)) return { status: "signed-out" };
  if (!routines.ok || !drafts.ok) return { status: "failed" };
  return { status: "ready", routines: routines.data, drafts: drafts.data, sample: routines.demo || drafts.demo };
}

export function useCmeMyDaySource({ enabled, now }: { enabled: boolean; now: Date }): {
  result: MyDaySourceResult;
  retry: () => void;
} {
  const reminders = useAppPreferences().preferences.reminders;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [generation, setGeneration] = useState(0);
  const retry = useCallback(() => setGeneration((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void loadCme(controller.signal).then((next) => {
      if (next && !controller.signal.aborted) setLoaded(next);
    });
    return () => controller.abort();
  }, [enabled, generation]);

  if (!enabled) return { result: signedOut, retry };
  if (!loaded) return { result: loading, retry };
  if (loaded.status !== "ready") return { result: { mode: "cme", status: loaded.status, items: [] }, retry };
  return {
    result: {
      mode: "cme",
      status: "ready",
      items: cmeMyDayItems({ routines: loaded.routines, drafts: loaded.drafts, year: cpdYearOf(now) }, now, reminders),
      ...(loaded.sample ? { sample: true } : {}),
    },
    retry,
  };
}
