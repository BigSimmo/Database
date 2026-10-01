"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiClientError } from "@/lib/api-client-error";
import { useAuthSession } from "@/lib/supabase/client";
import { teachingGet, teachingLoadFailure, type TeachingLoadFailure } from "@/lib/teaching/client";

/*
 * One read, in memory only. Refetches when the account changes (`authEpoch`)
 * and on `retry`. A late response for an earlier URL or account is dropped by
 * the key check, so one account's sessions never paint under another's.
 * A `retry` of the same URL for the same account keeps the last good data on
 * screen (`refreshing`) instead of dropping the page back to its skeleton, so
 * an open form or a "Saved." line survives the refetch after a write.
 */
export type TeachingResourceStatus = "idle" | "loading" | "ready" | TeachingLoadFailure;
export type TeachingResource<T> = {
  status: TeachingResourceStatus;
  data: T | null;
  code: string | null;
  refreshing: boolean;
  retry: () => void;
};

type Settled<T> = {
  key: string;
  scope: string;
  status: "ready" | TeachingLoadFailure;
  data: T | null;
  code: string | null;
};

export function useTeachingResource<T>(url: string | null): TeachingResource<T> {
  const auth = useAuthSession();
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const scope = url && auth.status !== "loading" ? `${auth.authEpoch}|${url}` : null;
  const key = scope ? `${attempt}|${scope}` : null;

  useEffect(() => {
    if (!key || !scope || !url) return;
    const controller = new AbortController();
    teachingGet<T>(url, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setSettled({ key, scope, status: "ready", data, code: null });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setSettled({
          key,
          scope,
          status: teachingLoadFailure(error),
          data: null,
          code: error instanceof ApiClientError ? error.code : null,
        });
      },
    );
    return () => controller.abort();
  }, [key, scope, url]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  if (!url) return { status: "idle", data: null, code: null, refreshing: false, retry };
  if (key && settled?.key !== key && settled?.scope === scope && settled.status === "ready")
    return { status: "ready", data: settled.data, code: null, refreshing: true, retry };
  if (!key || settled?.key !== key) return { status: "loading", data: null, code: null, refreshing: false, retry };
  return { status: settled.status, data: settled.data, code: settled.code, refreshing: false, retry };
}
