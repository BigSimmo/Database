"use client";

import { useMemo } from "react";

import type { SessionDetailRead } from "@/components/teaching/teaching-reads";
import { useTeachingResource, type TeachingResource } from "@/components/teaching/use-teaching-resource";
import { demoTeachingSessionDetail } from "@/lib/teaching/demo-programme";

/** One session (`view=session`): Today's join link, and everything on U4's session page. The demo is never fetched. */
export function useSessionDetail(
  occurrenceId: string | null,
  demo: boolean,
  now: Date | null,
): TeachingResource<SessionDetailRead> {
  const resource = useTeachingResource<SessionDetailRead>(
    occurrenceId && !demo ? `/api/teaching?${new URLSearchParams({ view: "session", occurrenceId })}` : null,
  );
  const demoDetail = useMemo(
    () => (demo && occurrenceId && now ? demoTeachingSessionDetail(occurrenceId, now) : null),
    [demo, occurrenceId, now],
  );
  if (!demo) return resource;
  if (!occurrenceId) return { status: "idle", data: null, code: null, retry: resource.retry };
  if (!now) return { status: "loading", data: null, code: null, retry: resource.retry };
  return demoDetail
    ? { status: "ready", data: demoDetail, code: null, retry: resource.retry }
    : { status: "error", data: null, code: "teaching_not_found", retry: resource.retry };
}
