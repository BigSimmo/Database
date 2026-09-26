"use client";

import { useCallback, useEffect, useState } from "react";

import type { OnCallShift, OnCallShiftImportRequest, OnCallShiftImportSummary } from "@/lib/on-call/shifts/model";

/**
 * The signed-in doctor's own shifts, fetched from `/api/on-call/shifts`.
 *
 * `signed-out` is a resting state, not an error: a roster is personal, so a
 * signed-out reader simply has none to show.
 */
export type OnCallShiftsStatus = "loading" | "ready" | "signed-out" | "error";

export type OnCallShiftsState = {
  readonly status: OnCallShiftsStatus;
  readonly shifts: readonly OnCallShift[];
  readonly latestImport: OnCallShiftImportSummary | null;
  readonly demoMode: boolean;
  /** Save an imported roster. Resolves to an error sentence, or null on success. */
  readonly save: (request: OnCallShiftImportRequest) => Promise<string | null>;
  readonly deleteAll: () => Promise<string | null>;
  readonly dismissChanges: () => Promise<void>;
};

type Payload = {
  shifts?: OnCallShift[];
  latestImport?: OnCallShiftImportSummary | null;
  demoMode?: boolean;
  error?: string;
};

async function readPayload(response: Response): Promise<Payload> {
  return ((await response.json().catch(() => null)) as Payload | null) ?? {};
}

export function useOnCallShifts(): OnCallShiftsState {
  const [status, setStatus] = useState<OnCallShiftsStatus>("loading");
  const [shifts, setShifts] = useState<readonly OnCallShift[]>([]);
  const [latestImport, setLatestImport] = useState<OnCallShiftImportSummary | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  const accept = useCallback((payload: Payload) => {
    setShifts(payload.shifts ?? []);
    setLatestImport(payload.latestImport ?? null);
    setDemoMode(Boolean(payload.demoMode));
    setStatus("ready");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/on-call/shifts", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          setStatus("signed-out");
          return;
        }
        if (!response.ok) throw new Error(`status ${response.status}`);
        accept(await readPayload(response));
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, [accept]);

  const save = useCallback(
    async (request: OnCallShiftImportRequest) => {
      try {
        const response = await fetch("/api/on-call/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });
        const payload = await readPayload(response);
        if (response.status === 401) return "Sign in to save your roster.";
        if (!response.ok) return payload.error ?? "Your roster could not be saved. Try again.";
        accept(payload);
        return null;
      } catch {
        return "Your roster could not be saved. Check your connection and try again.";
      }
    },
    [accept],
  );

  const deleteAll = useCallback(async () => {
    try {
      const response = await fetch("/api/on-call/shifts", { method: "DELETE" });
      const payload = await readPayload(response);
      if (!response.ok) return payload.error ?? "Your shifts could not be deleted. Try again.";
      accept(payload);
      return null;
    } catch {
      return "Your shifts could not be deleted. Check your connection and try again.";
    }
  }, [accept]);

  const dismissChanges = useCallback(async () => {
    const current = latestImport;
    if (!current || current.seenAt) return;
    setLatestImport({ ...current, seenAt: new Date().toISOString() });
    await fetch(`/api/on-call/shifts/imports/${current.id}`, { method: "PATCH" }).catch(() => undefined);
  }, [latestImport]);

  return { status, shifts, latestImport, demoMode, save, deleteAll, dismissChanges };
}

/** "2 added, 1 moved, 1 removed", leaving out the zeros. */
export function describeRosterChangeCounts(summary: Pick<OnCallShiftImportSummary, "added" | "changed" | "removed">) {
  const parts = [
    summary.added ? `${summary.added} added` : null,
    summary.changed ? `${summary.changed} moved` : null,
    summary.removed ? `${summary.removed} removed` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "no changes";
}
