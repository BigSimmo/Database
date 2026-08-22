"use client";

import { useEffect, useRef, useState } from "react";
import {
  useClinicalAskSession,
  type useClinicalAskSession as UseClinicalAskSession,
} from "@/components/clinical-dashboard/clinical-ask-session-context";

type ClinicalAskSession = ReturnType<typeof UseClinicalAskSession>;

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
