"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ClinicalAskAnswerSurface } from "@/components/clinical-dashboard/clinical-ask-answer-surface";
import { ClinicalAskWorkspace } from "@/components/clinical-dashboard/clinical-dashboard-lazy";
import type { useClinicalAskSession } from "@/components/clinical-dashboard/clinical-ask-session-context";
import { clinicalAskWorkspaceVisible } from "@/components/clinical-dashboard/use-clinical-ask-shell-state";
import { appModeSelectionHref, type AppModeId } from "@/lib/app-modes";
import type { ClinicalAskModeId } from "@/lib/clinical-ask/contracts";
import type { SearchScopeFilters } from "@/lib/search-scope";
import type { ClinicalQueryMode } from "@/lib/types";

type ClinicalAskSession = ReturnType<typeof useClinicalAskSession>;

export function ModeClinicalAskSurface({
  session,
  activeMode,
  searchMode,
  queryMode,
  scopeFilters,
  setDraft,
  setSearchSubmitted,
  focusSearch,
  onRun,
}: {
  session: ClinicalAskSession;
  activeMode: ClinicalAskModeId | null;
  searchMode: AppModeId;
  queryMode: ClinicalQueryMode;
  scopeFilters: SearchScopeFilters;
  setDraft(draft: string): void;
  setSearchSubmitted(submitted: boolean): void;
  focusSearch(): void;
  onRun(question?: unknown): void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  if (!clinicalAskWorkspaceVisible(session, activeMode)) return null;
  const failedResponse = session.response?.state === "failed" ? session.response : null;
  const question = session.submittedQuestion || session.draft;
  const returnToSearch = () => {
    session.clear();
    setDraft("");
    setSearchSubmitted(false);
    if (searchParams.has("q") || searchParams.has("query") || searchParams.get("run") === "1") {
      router.replace(appModeSelectionHref(searchMode, { queryMode, scopeFilters }));
    }
    focusSearch();
  };

  if (failedResponse)
    return (
      <section className="clinical-ask-workspace" aria-label="Clinical Ask workspace">
        <ClinicalAskAnswerSurface
          response={failedResponse}
          question={question}
          onRetry={() => onRun(question)}
          onReturnToSearch={returnToSearch}
        />
      </section>
    );

  return (
    <ClinicalAskWorkspace
      onDraftChange={(draft) => {
        setDraft(draft);
        focusSearch();
      }}
      onRun={(questionOverride) => onRun(questionOverride)}
      onReturnToSearch={returnToSearch}
    />
  );
}
