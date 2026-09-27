"use client";

import { useEffect, useMemo } from "react";

import { useTeachingResource, type TeachingResourceStatus } from "@/components/teaching/use-teaching-resource";
import { demoTeachingWeek } from "@/lib/teaching/demo-programme";
import type { TeachingWeekResponse } from "@/lib/teaching/model";
import { setTeachingRoles } from "@/lib/teaching/page-visibility";

/*
 * One stretch of the programme. Demo mode never calls the API. A signed-out
 * reader sees the demo only after "Open the demo" (`signedOutDemo`). A real
 * read also publishes the reader's roles for the pages sheet (U2), and a
 * signed-out read clears them.
 */
export type TeachingDemo = "off" | "demo-mode" | "signed-out";
export type TeachingWeekState = {
  status: TeachingResourceStatus;
  week: TeachingWeekResponse | null;
  demo: TeachingDemo;
  retry: () => void;
};

export function useTeachingWeek(
  range: { from: string; to: string } | null,
  options: { demoMode: boolean; signedOutDemo: boolean },
  now: Date | null,
): TeachingWeekState {
  const { from, to } = range ?? { from: null, to: null };
  const url =
    from && to && !options.demoMode ? `/api/teaching?${new URLSearchParams({ view: "week", from, to })}` : null;
  const resource = useTeachingResource<TeachingWeekResponse>(url);
  const wantsDemo = options.demoMode || (resource.status === "signed-out" && options.signedOutDemo);
  const demoWeek = useMemo<TeachingWeekResponse | null>(
    () =>
      wantsDemo && from && to && now
        ? { ...demoTeachingWeek({ from, to }, now), relocated: [], relocatedUnavailable: false }
        : null,
    [wantsDemo, from, to, now],
  );

  useEffect(() => {
    if (resource.status === "ready" && resource.data) setTeachingRoles(resource.data.teams.map((team) => team.role));
    if (resource.status === "signed-out") setTeachingRoles([]);
  }, [resource.status, resource.data]);

  if (wantsDemo) {
    return {
      status: demoWeek ? "ready" : "loading",
      week: demoWeek,
      demo: options.demoMode ? "demo-mode" : "signed-out",
      retry: resource.retry,
    };
  }
  return { status: resource.status, week: resource.data, demo: "off", retry: resource.retry };
}
