"use client";

import { useEffect, useRef, useState } from "react";
import {
  useClinicalAskSession,
  type useClinicalAskSession as UseClinicalAskSession,
} from "@/components/clinical-dashboard/clinical-ask-session-context";
import { useClinicalAskRunner } from "@/components/clinical-dashboard/use-clinical-ask-runner";
import type { AppModeId } from "@/lib/app-modes";
import { isClinicalAskModeId, type ClinicalAskModeId } from "@/lib/clinical-ask/contracts";

export type ClinicalDashboardProps = {
  initialSearchMode?: AppModeId;
  initialQuery?: string;
  focusSearch?: boolean;
  autoRunSearch?: boolean;
  clinicalAskAvailableModeIds?: readonly ClinicalAskModeId[];
};

type ClinicalAskSession = ReturnType<typeof UseClinicalAskSession>;

export function clinicalAskWorkspaceVisible(
  session: {
    mode: ClinicalAskModeId | null;
    response: unknown;
    submitted: boolean;
  },
  activeMode?: ClinicalAskModeId | null,
) {
  if (activeMode !== undefined && session.mode !== activeMode) return false;
  return Boolean(session.mode || session.response || session.submitted);
}

export function useClinicalAskShellState(
  accountId: string | undefined,
  clinicalAskMode: ClinicalAskModeId | null = null,
): {
  clinicalAskSession: ClinicalAskSession;
  clinicalAskOnline: boolean;
} {
  const clinicalAskSession = useClinicalAskSession();
  const [clinicalAskOnline, setClinicalAskOnline] = useState(true);
  useEffect(() => {
    const sync = () => setClinicalAskOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  const previousClinicalAskAccountRef = useRef(accountId);
  const previousClinicalAskModeRef = useRef(clinicalAskMode);
  useEffect(() => {
    const accountChanged = previousClinicalAskAccountRef.current !== accountId;
    const modeChanged = previousClinicalAskModeRef.current !== clinicalAskMode;
    if (accountChanged || modeChanged) {
      previousClinicalAskAccountRef.current = accountId;
      previousClinicalAskModeRef.current = clinicalAskMode;
      clinicalAskSession.clear();
    }
  }, [accountId, clinicalAskMode, clinicalAskSession]);
  return { clinicalAskSession, clinicalAskOnline };
}

export function useClinicalAskDashboardChrome({
  accountId,
  searchMode,
  query,
  clinicalAskAvailableModeIds = [],
}: {
  accountId: string | undefined;
  searchMode: AppModeId;
  query: string;
  clinicalAskAvailableModeIds?: readonly ClinicalAskModeId[];
}) {
  const clinicalAskMode =
    isClinicalAskModeId(searchMode) && clinicalAskAvailableModeIds.includes(searchMode) ? searchMode : null;
  const { clinicalAskSession, clinicalAskOnline } = useClinicalAskShellState(accountId, clinicalAskMode);
  const runModeClinicalAsk = useClinicalAskRunner({
    clinicalAskMode,
    clinicalAskOnline,
    clinicalAskSession,
    query,
  });
  return {
    clinicalAskSession,
    clinicalAskOnline,
    clinicalAskMode,
    runModeClinicalAsk,
  };
}
