"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { postRosterAction } from "@/components/roster/use-roster-team";
import type { RosterAction, RosterCommandResult } from "@/lib/roster/team/model";
import { useAuthSession } from "@/lib/supabase/client";

/*
 * One roster action held for 10 seconds under an Undo bar, then sent with
 * `keepalive`. Same contract as Teaching's `useDelayedPost`: leaving the page
 * (`pagehide`) or changing accounts cancels unsent work, so a swap is never
 * sent by someone who walked away, and another account can never submit it.
 * Only one action can be held at a time.
 */
export const UNDO_MS = 10_000;

type Job = {
  label: string;
  serviceId: string;
  action: RosterAction;
  onDone: (result: RosterCommandResult) => void;
  onFailed: (message: string) => void;
};

export function useDelayedRosterAction(): {
  pending: string | null;
  schedule: (job: Job) => void;
  undo: () => void;
} {
  const auth = useAuthSession();
  const held = useRef<{ job: Job; timer: number } | null>(null);
  const [pending, setPending] = useState<{ label: string; authEpoch: number } | null>(null);

  const send = useCallback(() => {
    const current = held.current;
    if (!current) return;
    window.clearTimeout(current.timer);
    held.current = null;
    setPending(null);
    void postRosterAction(current.job.serviceId, current.job.action, { keepalive: true }).then((result) => {
      if (result.ok) current.job.onDone(result.result);
      else current.job.onFailed(result.message);
    });
  }, []);

  const schedule = useCallback(
    (next: Job) => {
      if (held.current || auth.status !== "authenticated") return;
      held.current = { job: next, timer: window.setTimeout(send, UNDO_MS) };
      setPending({ label: next.label, authEpoch: auth.authEpoch });
    },
    [send, auth.authEpoch, auth.status],
  );

  const undo = useCallback(() => {
    if (held.current) window.clearTimeout(held.current.timer);
    held.current = null;
    setPending(null);
  }, []);

  useEffect(() => {
    window.addEventListener("pagehide", undo);
    return () => {
      window.removeEventListener("pagehide", undo);
      if (held.current) window.clearTimeout(held.current.timer);
      held.current = null;
    };
  }, [undo, auth.authEpoch, auth.status]);

  const visiblePending =
    auth.status === "authenticated" && pending?.authEpoch === auth.authEpoch ? pending.label : null;
  return { pending: visiblePending, schedule, undo };
}
