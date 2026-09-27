"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { teachingPost } from "@/lib/teaching/client";

/*
 * One organiser post held for 10 seconds under an Undo bar (v5.2). Sent with
 * `keepalive`, and sent at once if the page is left or unmounted, so leaving
 * never silently drops a change the organiser posted (contract addition A10).
 * Scheduling a second post sends the first straight away. The held post lives
 * in memory only.
 */
export const UNDO_MS = 10_000;

type Job = {
  label: string;
  url: string;
  body: Record<string, unknown>;
  onPosted: () => void;
  onFailed: (error: unknown) => void;
};

export function useDelayedPost(): {
  pending: string | null;
  schedule: (input: Job) => void;
  undo: () => void;
} {
  const held = useRef<{ job: Job; timer: number } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const send = useCallback(() => {
    const current = held.current;
    if (!current) return;
    window.clearTimeout(current.timer);
    held.current = null;
    setPending(null);
    teachingPost(current.job.url, current.job.body, { keepalive: true }).then(
      () => current.job.onPosted(),
      current.job.onFailed,
    );
  }, []);

  const schedule = useCallback(
    (next: Job) => {
      send();
      held.current = { job: next, timer: window.setTimeout(send, UNDO_MS) };
      setPending(next.label);
    },
    [send],
  );

  const undo = useCallback(() => {
    if (held.current) window.clearTimeout(held.current.timer);
    held.current = null;
    setPending(null);
  }, []);

  useEffect(() => {
    window.addEventListener("pagehide", send);
    return () => {
      window.removeEventListener("pagehide", send);
      send();
    };
  }, [send]);

  return { pending, schedule, undo };
}
