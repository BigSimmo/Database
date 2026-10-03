"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { ApiClientError } from "@/lib/api-client-error";
import { TeachingSignedOutError, teachingErrorMessage, teachingGet } from "@/lib/teaching/client";
import type { RegisterResult } from "@/lib/teaching/model";

/*
 * The live check-in code, for the presenter's screen and the shared screen.
 *
 * Polled every 10 seconds, and again half a second after each 30-second window
 * starts, so the QR changes with the window rather than up to 10 seconds late.
 * A code is shown for its own window plus 20 seconds: the server accepts it for
 * the next window too (plan-contracts §4), so 20 seconds keeps a 10-second
 * margin for a scan already in flight. After that, without a fresh code, the
 * QR comes down (review focus 3): a queue of doctors scanning a dead code is
 * worse than a screen that says it is reconnecting.
 */
export const CHECKIN_WINDOW_MS = 30_000;
export const SHOW_PAST_WINDOW_MS = 20_000;
const POLL_MS = 10_000;

/** Refusals that another poll cannot fix. */
const ENDED_CODES = new Set([
  "teaching_link_expired",
  "teaching_window_closed",
  "teaching_role_denied",
  "teaching_access_denied",
  "teaching_not_found",
]);

export type CodePayload = { token: string; typedCode: string; window: number };
export type LiveCode<T extends CodePayload> = { payload: T; windowStartMs: number; showUntilMs: number };
export type CheckinCodeView<T extends CodePayload> = {
  phase: "loading" | "live" | "reconnecting" | "ended";
  code: LiveCode<T> | null;
  message: string | null;
};

export function nextPollDelay(nowMs: number): number {
  return Math.min(POLL_MS, CHECKIN_WINDOW_MS - (nowMs % CHECKIN_WINDOW_MS) + 500);
}

function live<T extends CodePayload>(payload: T): LiveCode<T> {
  const windowStartMs = payload.window * CHECKIN_WINDOW_MS;
  return { payload, windowStartMs, showUntilMs: windowStartMs + CHECKIN_WINDOW_MS + SHOW_PAST_WINDOW_MS };
}

/*
 * Polling and the 1-second clock both rest while the page is hidden (a phone
 * in a pocket, another tab): nothing on screen to update, and no battery spent.
 * Back in view, the code is fetched at once.
 */
function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== "hidden",
    () => true,
  );
}

/** The time on a 1-second tick that stops while the page is hidden. Null on the server and during hydration. */
export function useCheckinClock(intervalMs = 1000): Date | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      let timer: number | undefined;
      const sync = () => {
        window.clearInterval(timer);
        timer = undefined;
        if (document.visibilityState !== "hidden") timer = window.setInterval(onChange, intervalMs);
        onChange();
      };
      sync();
      document.addEventListener("visibilitychange", sync);
      return () => {
        window.clearInterval(timer);
        document.removeEventListener("visibilitychange", sync);
      };
    },
    [intervalMs],
  );
  const tick = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => null,
  );
  return useMemo(() => (tick === null ? null : new Date(tick)), [tick]);
}

type Held<T extends CodePayload> = { url: string; code: LiveCode<T> | null; message: string | null; ended: boolean };

export function useCheckinCode<T extends CodePayload>(url: string | null, nowMs: number | null): CheckinCodeView<T> {
  const [held, setHeld] = useState<Held<T> | null>(null);
  const visible = usePageVisible();

  useEffect(() => {
    if (!url || !visible) return;
    let stopped = false;
    let timer: number | undefined;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const payload = await teachingGet<T>(url, controller.signal);
        if (stopped) return;
        setHeld({ url, code: live(payload), message: null, ended: false });
      } catch (error) {
        if (stopped) return;
        const ended =
          error instanceof TeachingSignedOutError || (error instanceof ApiClientError && ENDED_CODES.has(error.code));
        // A failed poll keeps the last code; the render below takes it down once its time is up.
        setHeld((current) => ({
          url,
          code: current?.url === url ? current.code : null,
          message: teachingErrorMessage(error),
          ended,
        }));
        if (ended) return;
      }
      timer = window.setTimeout(() => void poll(), nextPollDelay(Date.now()));
    };
    void poll();
    return () => {
      stopped = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [url, visible]);

  const mine = url && held?.url === url ? held : null;
  if (!mine) return { phase: "loading", code: null, message: null };
  if (mine.ended) return { phase: "ended", code: null, message: mine.message };
  if (mine.code && nowMs !== null && nowMs < mine.code.showUntilMs)
    return { phase: "live", code: mine.code, message: null };
  return { phase: "reconnecting", code: null, message: mine.message };
}

export type AttendanceCounts = { code: number; self: number; visitors: number };

/** Organisers get named rows and presenters get counts (plan-contracts §4); the screen shows counts to both. */
export function registerCounts(result: RegisterResult): AttendanceCounts {
  if ("counts" in result) return result.counts;
  return {
    code: result.rows.filter((row) => row.method !== "self").length,
    self: result.rows.filter((row) => row.method === "self").length,
    visitors: result.visitors ?? 0,
  };
}

/** By code and self-reported always; Visitors only when someone came from What's on; Expected only when the server sends it. */
export function attendanceTiles(
  counts: AttendanceCounts,
  expected: number | null | undefined,
): { id: string; label: string; value: string }[] {
  return [
    { id: "code", label: "By code", value: String(counts.code) },
    { id: "self", label: "Self-reported", value: String(counts.self) },
    ...(counts.visitors > 0 ? [{ id: "visitors", label: "Visitors", value: String(counts.visitors) }] : []),
    ...(expected != null ? [{ id: "expected", label: "Expected", value: String(expected) }] : []),
  ];
}

/** Counts every 10 seconds. A failed poll keeps the last counts: they are a comfort, not a record. */
export function useRegisterCounts(url: string | null): AttendanceCounts | null {
  const [held, setHeld] = useState<{ url: string; counts: AttendanceCounts } | null>(null);
  const visible = usePageVisible();

  useEffect(() => {
    if (!url || !visible) return;
    let stopped = false;
    let timer: number | undefined;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const result = await teachingGet<RegisterResult>(url, controller.signal);
        if (!stopped) setHeld({ url, counts: registerCounts(result) });
      } catch {
        // Keep the last counts.
      }
      if (!stopped) timer = window.setTimeout(() => void poll(), POLL_MS);
    };
    void poll();
    return () => {
      stopped = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [url, visible]);

  return held && held.url === url ? held.counts : null;
}
