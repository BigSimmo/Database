"use client";

import type { ReactNode } from "react";

import { ClinicalAskSessionProvider } from "@/components/clinical-dashboard/clinical-ask-session-context";
import { useClinicalAskRunner } from "@/components/clinical-dashboard/use-clinical-ask-runner";
import { useClinicalAskShellState } from "@/components/clinical-dashboard/use-clinical-ask-shell-state";
import type { ClinicalAskModeId } from "@/lib/clinical-ask/contracts";

export type ClinicalAskShellBindings = {
  clinicalAskSession: ReturnType<typeof useClinicalAskShellState>["clinicalAskSession"];
  clinicalAskOnline: boolean;
  runModeClinicalAsk: (queryOverride?: string) => void;
};

export function ClinicalAskShellBindingsLayer({
  accountId,
  clinicalAskMode,
  query,
  children,
}: {
  accountId: string | undefined;
  clinicalAskMode: ClinicalAskModeId;
  query: string;
  children: (bindings: ClinicalAskShellBindings) => ReactNode;
}) {
  return (
    <ClinicalAskSessionProvider accountId={accountId}>
      <ClinicalAskShellBindingsInner accountId={accountId} clinicalAskMode={clinicalAskMode} query={query}>
        {children}
      </ClinicalAskShellBindingsInner>
    </ClinicalAskSessionProvider>
  );
}

function ClinicalAskShellBindingsInner({
  accountId,
  clinicalAskMode,
  query,
  children,
}: {
  accountId: string | undefined;
  clinicalAskMode: ClinicalAskModeId;
  query: string;
  children: (bindings: ClinicalAskShellBindings) => ReactNode;
}) {
  const { clinicalAskSession, clinicalAskOnline } = useClinicalAskShellState(accountId, clinicalAskMode);
  const runModeClinicalAsk = useClinicalAskRunner({
    clinicalAskMode,
    clinicalAskOnline,
    clinicalAskSession,
    query,
  });

  return children({
    clinicalAskSession,
    clinicalAskOnline,
    runModeClinicalAsk,
  });
}
