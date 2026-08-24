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
};

type ClinicalAskSession = ReturnType<typeof UseClinicalAskSession>;

export function clinicalAskWorkspaceVisible(session: {
  mode: ClinicalAskModeId | null;
  response: unknown;
  submitted: boolean;
}) {
  return Boolean(session.mode || session.response || session.submitted);
}

/** Ask / Dictate composer chrome. Therapy keeps the backend mode but never mounts the rail. */
export function clinicalAskComposerChromeEnabled(mode: AppModeId | null): boolean {
  return mode !== null && isClinicalAskModeId(mode) && mode !== "therapy-compass";
}

export function useClinicalAskShellState(accountId: string | undefined): {
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
  useEffect(() => {
    if (previousClinicalAskAccountRef.current !== accountId) {
      previousClinicalAskAccountRef.current = accountId;
      clinicalAskSession.clear();
    }
  }, [accountId, clinicalAskSession]);
  return { clinicalAskSession, clinicalAskOnline };
}

export function useClinicalAskDashboardChrome({
  accountId,
  searchMode,
  query,
}: {
  accountId: string | undefined;
  searchMode: AppModeId;
  query: string;
}) {
  const { clinicalAskSession, clinicalAskOnline } = useClinicalAskShellState(accountId);
  const clinicalAskMode = isClinicalAskModeId(searchMode) ? searchMode : null;
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
