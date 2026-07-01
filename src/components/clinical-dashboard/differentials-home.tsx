"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BrainCircuit,
  ChevronRight,
  Clock3,
  FlaskConical,
  Loader2,
  Mic,
  Plus,
  Scale,
  Send,
  ShieldCheck,
  Search,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";

import { cn, chatComposerIconButton, chatComposerInput, chatComposerShell, chatSendButton } from "@/components/ui-primitives";
import { appModeHomeHref } from "@/lib/app-modes";
import type { DocumentMatch } from "@/lib/types";

type DifferentialAction = {
  label: string;
  description: string;
  query: string;
  icon: LucideIcon;
  target: "search" | "presentations" | "diagnoses";
};

type RecentDifferential = {
  label: string;
  query: string;
  icon: LucideIcon;
};

const primaryActions: DifferentialAction[] = [
  {
    label: "Search presentations",
    description: "Explore by symptoms or scenario",
    query: "acute confusion differential diagnosis",
    icon: Search,
    target: "presentations",
  },
  {
    label: "Compare differentials",
    description: "Compare up to 2 differentials side by side",
    query: "delirium vs dementia differential diagnosis",
    icon: Scale,
    target: "diagnoses",
  },
  {
    label: "Recent work",
    description: "Continue where you left off",
    query: "recent differential diagnosis work",
    icon: Clock3,
    target: "search",
  },
];

const recentDifferentials: RecentDifferential[] = [
  { label: "Acute confusion", query: "acute confusion differential diagnosis", icon: BrainCircuit },
  { label: "Delirium", query: "delirium differential diagnosis", icon: FlaskConical },
  { label: "Substance withdrawal", query: "substance withdrawal differential diagnosis", icon: FlaskConical },
  { label: "QT risk", query: "QT prolongation differential diagnosis", icon: Activity },
  { label: "Capacity", query: "capacity assessment differential diagnosis", icon: UserRoundCheck },
];

function routeWithQuery(path: string, query: string) {
  const params = new URLSearchParams();
  const trimmedQuery = query.trim();
  if (trimmedQuery) params.set("q", trimmedQuery);
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export function DifferentialsHome({
  query,
  loading,
  documentMatches,
  onQueryChange,
  onSuggestedSearch,
  onRunSearch,
  onOpenPresentations,
  onOpenDiagnoses,
  desktopComposerSlotId,
  hideLocalComposer = false,
}: {
  query: string;
  loading: boolean;
  documentMatches?: DocumentMatch[];
  documentCount?: number;
  realDataReady?: boolean;
  authUnavailable?: boolean;
  apiUnavailable?: boolean;
  setupWarning?: string | null;
  onQueryChange?: (query: string) => void;
  onSuggestedSearch?: (query: string) => void;
  onRunSearch?: (query: string) => void;
  onOpenPresentations?: (query: string) => void;
  onOpenDiagnoses?: (query: string) => void;
  desktopComposerSlotId?: string;
  hideLocalComposer?: boolean;
}) {
  const router = useRouter();
  const [localQuery, setLocalQuery] = useState(query);
  const controlled = Boolean(onQueryChange);
  const activeQuery = controlled ? query : localQuery;
  const trimmedQuery = activeQuery.trim();
  const hasEvidenceMatches = Boolean(documentMatches?.length);

  function updateQuery(nextQuery: string) {
    if (onQueryChange) onQueryChange(nextQuery);
    else setLocalQuery(nextQuery);
  }

  function runSearch(nextQuery = activeQuery) {
    const searchText = nextQuery.trim();
    if (!searchText) return;
    if (onRunSearch) {
      onRunSearch(searchText);
      return;
    }
    router.push(appModeHomeHref("differentials", { query: searchText, run: true, focus: true }));
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearch();
  }

  function handleSuggestedSearch(nextQuery: string) {
    updateQuery(nextQuery);
    if (onSuggestedSearch) {
      onSuggestedSearch(nextQuery);
      return;
    }
    router.push(appModeHomeHref("differentials", { query: nextQuery, run: true, focus: true }));
  }

  function handleAction(action: DifferentialAction) {
    if (action.target === "presentations") {
      if (onOpenPresentations) onOpenPresentations(action.query);
      else router.push(routeWithQuery("/differentials/presentations", action.query));
      return;
    }
    if (action.target === "diagnoses") {
      if (onOpenDiagnoses) onOpenDiagnoses(action.query);
      else router.push(routeWithQuery("/differentials/diagnoses", action.query));
      return;
    }
    runSearch(action.query);
  }

  return (
    <div
      data-testid="differentials-home"
      className="mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-7xl flex-col overflow-x-hidden px-1 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-4 sm:min-h-[calc(100dvh-10rem)] sm:px-3 sm:pb-8 sm:pt-10 lg:px-6 lg:pt-12"
    >
      <section aria-labelledby="differentials-home-title" className="mx-auto w-full max-w-5xl text-center">
        <div className="mx-auto grid h-18 w-18 place-items-center rounded-[1.35rem] border border-[color:var(--clinical-chat-teal)]/18 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)] sm:h-20 sm:w-20">
          <BrainCircuit className="h-9 w-9 sm:h-10 sm:w-10" aria-hidden />
        </div>
        <h1
          id="differentials-home-title"
          className="mt-4 text-[2rem] font-bold leading-none tracking-normal text-[color:var(--text-heading)] sm:mt-5 sm:text-5xl"
        >
          Differentials
        </h1>
        <p className="mx-auto mt-3 max-w-[42rem] text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
          Find differentials, compare causes, and open reviewed clinical summaries.
        </p>

        {desktopComposerSlotId ? (
          <div id={desktopComposerSlotId} className="mx-auto mt-6 hidden w-full max-w-3xl lg:block" />
        ) : hideLocalComposer ? null : (
          <form
            onSubmit={handleSearchSubmit}
            className={cn(chatComposerShell, "mx-auto mt-7 hidden w-full max-w-3xl sm:flex")}
            role="search"
            aria-label="Search differential presentations"
          >
            <button
              type="button"
              className={chatComposerIconButton}
              aria-label="Add differential context"
              onClick={() => handleSuggestedSearch(trimmedQuery || "acute confusion differential diagnosis")}
            >
              <Plus className="h-5 w-5" aria-hidden />
            </button>
            <label className="relative flex min-w-0 flex-1 items-center overflow-hidden">
              <input
                value={activeQuery}
                onChange={(event) => updateQuery(event.target.value)}
                placeholder="Ask or search a presentation"
                aria-label="Ask or search a differential presentation"
                className={cn(chatComposerInput, "w-full min-w-0 pr-2 text-left")}
              />
            </label>
            <button type="button" className={chatComposerIconButton} aria-label="Voice input" title="Voice input">
              <Mic className="h-4.5 w-4.5" aria-hidden />
            </button>
            <button
              type="submit"
              disabled={loading || !trimmedQuery}
              className={chatSendButton}
              aria-label="Search differential presentations"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
            </button>
          </form>
        )}
      </section>

      <section aria-label="Differential actions" className="mx-auto mt-8 w-full max-w-6xl sm:mt-10">
        <div className="overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft)] sm:grid sm:grid-cols-3 sm:gap-4 sm:border-0 sm:bg-transparent sm:shadow-none">
          {primaryActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => handleAction(action)}
                className={cn(
                  "group grid min-h-[4.9rem] w-full grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3 text-left transition last:border-b-0 hover:bg-[color:var(--surface-raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)] sm:min-h-[8rem] sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:rounded-lg sm:border sm:border-[color:var(--border-lux)] sm:p-5 sm:shadow-[var(--shadow-inset)] sm:hover:-translate-y-0.5 sm:hover:border-[color:var(--clinical-chat-teal)]/35 sm:hover:shadow-[var(--shadow-soft)] motion-reduce:sm:hover:translate-y-0",
                  index === 0 && "sm:ml-0",
                )}
              >
                <span className="grid h-11 w-11 place-items-center rounded-lg border border-[color:var(--clinical-chat-teal)]/14 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)] sm:h-14 sm:w-14">
                  <Icon className="h-5 w-5 sm:h-7 sm:w-7" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-5 text-[color:var(--text-heading)] sm:text-base">
                    {action.label}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium leading-5 text-[color:var(--text-muted)] sm:mt-2 sm:text-sm">
                    {action.description}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-[color:var(--text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--clinical-chat-teal)] motion-reduce:transition-none" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="mx-auto mt-7 w-full max-w-6xl border-t border-[color:var(--border)] pt-5 sm:mt-8 sm:pt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[color:var(--text-heading)] sm:text-lg">
            {hasEvidenceMatches ? "Reviewed matches" : "Recent work"}
          </h2>
          <button
            type="button"
            onClick={() => router.push("/differentials/presentations?q=recent+differential+review")}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-xs font-bold text-[color:var(--clinical-chat-teal)] transition hover:bg-[color:var(--clinical-chat-teal-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:px-3 sm:text-sm"
          >
            View all
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {hasEvidenceMatches ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {documentMatches?.slice(0, 4).map((match) => (
              <article
                key={`${match.document_id}-${match.title}`}
                className="min-h-[4.75rem] rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-inset)]"
              >
                <h3 className="line-clamp-2 text-sm font-bold text-[color:var(--text-heading)]">{match.title}</h3>
                <p className="mt-1 truncate text-xs font-medium text-[color:var(--text-muted)]">{match.file_name}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:grid-cols-[repeat(5,minmax(0,1fr))] sm:overflow-visible sm:px-0 sm:pb-0">
            {recentDifferentials.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleSuggestedSearch(item.query)}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-4 text-xs font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-chat-teal)]/30 hover:bg-[color:var(--surface-raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-w-0 sm:px-3 sm:text-sm"
                >
                  <Icon className="h-4 w-4 shrink-0 text-[color:var(--clinical-chat-teal)]" aria-hidden />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <p className="mx-auto mt-auto flex min-h-14 items-center justify-center gap-2 pt-8 text-center text-xs font-medium text-[color:var(--text-muted)] sm:text-sm">
        <ShieldCheck className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden />
        Clinical decision support only. Review before use.
      </p>
    </div>
  );
}
