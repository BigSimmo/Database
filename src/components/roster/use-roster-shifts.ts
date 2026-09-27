"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  OnCallManualShiftRequest,
  OnCallShift,
  OnCallShiftImportRequest,
  OnCallShiftImportSummary,
} from "@/lib/roster/shifts/model";

/**
 * The signed-in doctor's own shifts, fetched from `/api/roster/shifts`.
 *
 * Nothing here is written to the device: the shifts live in React state only
 * and are fetched again on the next visit (Josh's offline rule).
 *
 * `signed-out` is a resting state, not an error: a roster is personal, so a
 * signed-out reader simply has none to show.
 */
export type RosterShiftsStatus = "loading" | "ready" | "signed-out" | "error";

export type RosterShiftsState = {
  readonly status: RosterShiftsStatus;
  readonly shifts: readonly OnCallShift[];
  readonly latestImport: OnCallShiftImportSummary | null;
  readonly demoMode: boolean;
  /** Save an imported roster. Resolves to an error sentence, or null on success. */
  readonly save: (request: OnCallShiftImportRequest) => Promise<string | null>;
  /** Add a shift by hand, optionally repeating weekly. */
  readonly addManual: (request: OnCallManualShiftRequest) => Promise<string | null>;
  /** Remove a hand-added shift and its weekly repeats. */
  readonly removeSeries: (seriesId: string) => Promise<string | null>;
  /**
   * Delete every shift. `keepalive` lets the request outlive a closing page,
   * which is how a pending "Delete my data" still happens on `pagehide`.
   */
  readonly deleteAll: (options?: { keepalive?: boolean }) => Promise<string | null>;
  /** Remove one workplace's imported shifts and its calendar links. No import is recorded. */
  readonly removeWorkplace: (workplace: string) => Promise<string | null>;
  /** Fetch the shifts again, e.g. after a calendar link refresh brought new ones. */
  readonly reload: () => Promise<void>;
  readonly dismissChanges: () => Promise<void>;
};

type Payload = {
  shifts?: OnCallShift[];
  latestImport?: OnCallShiftImportSummary | null;
  demoMode?: boolean;
  error?: unknown;
};

export const ROSTER_SHIFTS_URL = "/api/roster/shifts";
const ROSTER_WORKPLACES_URL = "/api/roster/workplaces";

async function readPayload(response: Response): Promise<Payload> {
  return ((await response.json().catch(() => null)) as Payload | null) ?? {};
}

function errorText(payload: Payload, fallback: string): string {
  return typeof payload.error === "string" && payload.error ? payload.error : fallback;
}

type Loaded = Payload | "signed-out" | "error" | "aborted";

async function fetchShifts(signal?: AbortSignal): Promise<Loaded> {
  try {
    const response = await fetch(ROSTER_SHIFTS_URL, { cache: "no-store", signal });
    if (response.status === 401) return "signed-out";
    if (!response.ok) return "error";
    return await readPayload(response);
  } catch (error) {
    return (error as { name?: string })?.name === "AbortError" ? "aborted" : "error";
  }
}

export function useRosterShifts(): RosterShiftsState {
  const [status, setStatus] = useState<RosterShiftsStatus>("loading");
  const [shifts, setShifts] = useState<readonly OnCallShift[]>([]);
  const [latestImport, setLatestImport] = useState<OnCallShiftImportSummary | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  const accept = useCallback((payload: Payload) => {
    setShifts(payload.shifts ?? []);
    setLatestImport(payload.latestImport ?? null);
    setDemoMode(Boolean(payload.demoMode));
    setStatus("ready");
  }, []);

  const apply = useCallback(
    (result: Loaded) => {
      if (result === "aborted") return;
      if (result === "signed-out" || result === "error") setStatus(result);
      else accept(result);
    },
    [accept],
  );

  const load = useCallback(async () => apply(await fetchShifts()), [apply]);

  useEffect(() => {
    const controller = new AbortController();
    fetchShifts(controller.signal).then(apply, () => undefined);
    return () => controller.abort();
  }, [apply]);

  const save = useCallback(
    async (request: OnCallShiftImportRequest) => {
      try {
        const response = await fetch(ROSTER_SHIFTS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });
        const payload = await readPayload(response);
        if (response.status === 401) return "Sign in to save your roster.";
        if (!response.ok) return errorText(payload, "Your roster could not be saved. Try again.");
        accept(payload);
        return null;
      } catch {
        return "Your roster could not be saved. Check your connection and try again.";
      }
    },
    [accept],
  );

  const addManual = useCallback(
    async (request: OnCallManualShiftRequest) => {
      try {
        const response = await fetch(`${ROSTER_SHIFTS_URL}/manual`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });
        const payload = await readPayload(response);
        if (response.status === 401) return "Sign in to add a shift.";
        if (!response.ok) return errorText(payload, "That shift could not be saved. Try again.");
        await load();
        return null;
      } catch {
        return "That shift could not be saved. Check your connection and try again.";
      }
    },
    [load],
  );

  const removeSeries = useCallback(async (seriesId: string) => {
    try {
      const response = await fetch(`${ROSTER_SHIFTS_URL}/manual/${encodeURIComponent(seriesId)}`, {
        method: "DELETE",
      });
      if (!response.ok) return errorText(await readPayload(response), "That shift could not be removed. Try again.");
      setShifts((current) => current.filter((shift) => shift.seriesId !== seriesId));
      return null;
    } catch {
      return "That shift could not be removed. Check your connection and try again.";
    }
  }, []);

  const deleteAll = useCallback(
    async (options?: { keepalive?: boolean }) => {
      try {
        const response = await fetch(ROSTER_SHIFTS_URL, { method: "DELETE", keepalive: options?.keepalive ?? false });
        const payload = await readPayload(response);
        if (!response.ok) return errorText(payload, "Your data could not be deleted. Try again.");
        accept(payload);
        return null;
      } catch {
        return "Your data could not be deleted. Check your connection and try again.";
      }
    },
    [accept],
  );

  const removeWorkplace = useCallback(async (workplace: string) => {
    try {
      const response = await fetch(ROSTER_WORKPLACES_URL, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workplace }),
      });
      if (!response.ok) {
        return errorText(await readPayload(response), "That workplace could not be removed. Try again.");
      }
      setShifts((current) => current.filter((shift) => !(shift.source === "import" && shift.workplace === workplace)));
      return null;
    } catch {
      return "That workplace could not be removed. Check your connection and try again.";
    }
  }, []);

  const dismissChanges = useCallback(async () => {
    const current = latestImport;
    if (!current || current.seenAt) return;
    setLatestImport({ ...current, seenAt: new Date().toISOString() });
    await fetch(`${ROSTER_SHIFTS_URL}/imports/${current.id}`, { method: "PATCH" }).catch(() => undefined);
  }, [latestImport]);

  return {
    status,
    shifts,
    latestImport,
    demoMode,
    save,
    addManual,
    removeSeries,
    deleteAll,
    removeWorkplace,
    reload: load,
    dismissChanges,
  };
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
