"use client";

import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  ExternalLink,
  FileSearch,
  Grid2X2,
  HelpCircle,
  Library,
  ListChecks,
  LockKeyhole,
  PlayCircle,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useRef, useState, type RefObject, type UIEvent } from "react";

import {
  guideQuickTasks,
  guideTopicById,
  guideTopics,
  guideTourSteps,
  searchGuideTopics,
  type GuideTopic,
  type GuideTopicId,
  type GuideView,
} from "@/components/clinical-dashboard/guide-content";
import {
  clearGuideProgress,
  completeGuideStep,
  emptyGuideProgress,
  firstIncompleteGuideStep,
  loadGuideProgress,
  saveGuideProgress,
  type GuideProgress,
} from "@/components/clinical-dashboard/guide-progress";
import { readChromeCollapseMetrics, useScrollHideReporter } from "@/components/clinical-dashboard/use-hide-on-scroll";
import { Sheet } from "@/components/ui/sheet";
import {
  chatComposerIconButton,
  chatComposerInput,
  chatComposerShellBase,
  chatSendButton,
  cn,
  eyebrowText,
  floatingControl,
  primaryControl,
  textMuted,
} from "@/components/ui-primitives";

const guideAccessibleNameId = "clinical-kb-guide-accessible-name";

const topicIcons: Record<GuideTopicId, LucideIcon> = {
  "getting-started": BookOpen,
  "ask-better-questions": HelpCircle,
  "document-scope": SlidersHorizontal,
  "answer-anatomy": ListChecks,
  "sources-citations": Library,
  "uploads-indexing": FileSearch,
  "privacy-safe-use": ShieldCheck,
  "keyboard-shortcuts": Grid2X2,
};

const quickTaskIcons: readonly LucideIcon[] = [HelpCircle, SlidersHorizontal, ShieldCheck, LockKeyhole];

function GuideSearch({
  query,
  inputRef,
  onFocusChange,
  onQueryChange,
}: {
  query: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onFocusChange: (focused: boolean) => void;
  onQueryChange: (query: string) => void;
}) {
  return (
    <form
      role="search"
      aria-label="Search guide content"
      onSubmit={(event) => {
        event.preventDefault();
        inputRef.current?.blur();
      }}
      data-guide-universal-search
      className="mx-auto w-full max-w-3xl"
    >
      <div
        className={cn(
          chatComposerShellBase,
          "answer-footer-search-pill relative z-10 w-full bg-[color:var(--surface-raised)]",
        )}
      >
        <span className="grid size-tap shrink-0 place-items-center text-[color:var(--text-muted)]" aria-hidden="true">
          <Search aria-hidden="true" className="size-icon-lg" />
        </span>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search the guide</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onFocus={() => onFocusChange(true)}
            onBlur={() => onFocusChange(false)}
            placeholder="Search the guide"
            className={cn(chatComposerInput, "answer-footer-search-input w-full min-w-0")}
            autoComplete="off"
            data-testid="guide-search-input"
          />
        </label>
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className={chatComposerIconButton}
            aria-label="Clear guide search"
          >
            <X aria-hidden="true" className="size-icon-md" />
          </button>
        ) : null}
        <span className="answer-footer-search-divider" aria-hidden="true" />
        <button
          type="submit"
          className={cn(chatSendButton, "answer-footer-search-send")}
          aria-label="Submit guide search"
        >
          <Send aria-hidden="true" className="size-icon-lg" />
        </button>
      </div>
    </form>
  );
}

/**
 * The tour action is a dock ADDON on phones, so it takes the shared addon-pill
 * treatment the other two dock addons use — `Patient details`
 * (`patient-details-fab__button`) and Compare's quiet state
 * (`differentials-mobile-compare-fab__button--empty`): a rounded pill on
 * `--border-strong` over a translucent `--surface`, never a filled slab.
 *
 * A filled control there defeats the dock. The band behind it is deliberately
 * transparent so page content reads through the scrim; dropping an opaque
 * primary button on top puts back a smaller version of the exact cover this
 * footer was converted to a dock to remove.
 *
 * From `sm` the footer is a real Sheet band again, the addon framing no longer
 * applies, and the primary treatment is the correct one for the guide's main
 * call to action — so every override here is `max-sm:`.
 */
const guideTourAction = cn(
  primaryControl,
  "max-sm:rounded-full max-sm:border max-sm:border-[color:var(--border-strong)]",
  "max-sm:bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] max-sm:text-[color:var(--text-heading)]",
  "max-sm:font-extrabold max-sm:shadow-[var(--e3)]",
  "max-sm:hover:bg-[color-mix(in_srgb,var(--surface-subtle)_92%,transparent)] max-sm:hover:shadow-[var(--e3)]",
);

function GuideTopNavigation({ view, onNavigate }: { view: GuideView; onNavigate: (view: GuideView) => void }) {
  const items: ReadonlyArray<{ view: GuideView; label: string; icon: LucideIcon }> = [
    { view: "home", label: "Guide home", icon: BookOpen },
    { view: "tour", label: "Guided tour", icon: PlayCircle },
    { view: "topics", label: "All topics", icon: Grid2X2 },
  ];
  return (
    <nav
      aria-label="Guide views"
      className="grid grid-cols-3 border-t border-[color:var(--border)] bg-[color:var(--surface-raised)]"
    >
      {items.map((item) => {
        const active = view === item.view || (view === "topic" && item.view === "topics");
        const Icon = item.icon;
        return (
          <button
            key={item.view}
            type="button"
            onClick={() => onNavigate(item.view)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex min-h-tap items-center justify-center gap-1.5 px-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)] sm:gap-2 sm:px-2 sm:text-sm",
              active
                ? "text-[color:var(--clinical-accent)] after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:bg-[color:var(--clinical-accent)]"
                : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
            )}
          >
            <Icon aria-hidden="true" className="size-icon-md shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function GuideContents({
  activeTopicId,
  onSelect,
}: {
  activeTopicId?: GuideTopicId;
  onSelect: (id: GuideTopicId) => void;
}) {
  return (
    <nav aria-label="Guide contents" className="space-y-1">
      {guideTopics.map((topic) => {
        const Icon = topicIcons[topic.id];
        const active = activeTopicId === topic.id;
        return (
          <button
            key={topic.id}
            type="button"
            onClick={() => onSelect(topic.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-tap w-full items-center gap-2 rounded-lg border-l-2 px-2.5 text-left text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
              active
                ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "border-transparent text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
            )}
          >
            <Icon aria-hidden="true" className="size-icon-md shrink-0" />
            <span>{topic.navLabel}</span>
          </button>
        );
      })}
    </nav>
  );
}

function CompactContents({
  activeTopicId,
  onSelect,
}: {
  activeTopicId?: GuideTopicId;
  onSelect: (id: GuideTopicId) => void;
}) {
  return (
    <details className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] lg:hidden">
      <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] [&::-webkit-details-marker]:hidden">
        <span>{activeTopicId ? guideTopicById[activeTopicId].navLabel : "Guide contents"}</span>
        <ChevronDown aria-hidden="true" className="size-icon-md" />
      </summary>
      <div className="border-t border-[color:var(--border)] p-2">
        <GuideContents activeTopicId={activeTopicId} onSelect={onSelect} />
      </div>
    </details>
  );
}

function ProgressCard({ progress, onResume }: { progress: GuideProgress; onResume: () => void }) {
  const count = progress.completedStepIds.length;
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)]">
      <p className="text-sm font-semibold text-[color:var(--text-heading)]">Guide progress · {count} of 5</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-subtle)]" aria-hidden="true">
        <div className="h-full bg-[color:var(--clinical-accent)]" style={{ width: `${count * 20}%` }} />
      </div>
      <button
        type="button"
        onClick={onResume}
        className="mt-2 inline-flex min-h-tap items-center gap-1 rounded-md text-sm font-semibold text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        {count === 0 ? "Start learning" : "Continue learning"}
        <ChevronRight aria-hidden="true" className="size-icon-sm" />
      </button>
    </div>
  );
}

function QuickTasks({ onSelect }: { onSelect: (id: GuideTopicId) => void }) {
  return (
    <section aria-labelledby="guide-quick-task-heading" className="space-y-2.5">
      <h2 id="guide-quick-task-heading" className={eyebrowText}>
        What do you need help with?
      </h2>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {guideQuickTasks.map((task, index) => {
          const Icon = quickTaskIcons[index];
          const selected = task.topicId === "answer-anatomy";
          return (
            <button
              key={task.topicId}
              type="button"
              onClick={() => onSelect(task.topicId)}
              className={cn(
                floatingControl,
                "min-w-0 justify-start px-2.5 text-left text-xs sm:px-3 sm:text-sm",
                selected &&
                  "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
              )}
            >
              <Icon aria-hidden="true" className="size-icon-md shrink-0" />
              <span>{task.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function VerificationDemo({ onOpenSourceGuide }: { onOpenSourceGuide: () => void }) {
  return (
    <section aria-labelledby="guide-home-heading" className="min-w-0">
      <p className={cn(eyebrowText, "text-[color:var(--clinical-accent)]")}>Essential workflow</p>
      <h2
        id="guide-home-heading"
        data-guide-page-heading
        tabIndex={-1}
        className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--text-heading)] outline-none sm:text-3xl"
      >
        How to verify an answer
      </h2>
      <p className={cn("mt-2 text-sm leading-6 sm:text-base", textMuted)}>
        Follow each claim to the source before using it in practice.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-[11rem_minmax(0,1fr)]">
        <ol className="grid grid-cols-3 gap-2 md:grid-cols-1 md:gap-3" aria-label="Verification steps">
          {["Check the claim", "Open the citation", "Read the source passage"].map((label, index) => (
            <li
              key={label}
              className="flex min-w-0 flex-col items-center gap-1.5 text-center text-xs font-medium text-[color:var(--text-heading)] md:flex-row md:items-start md:gap-2 md:text-left md:text-sm"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-xs font-bold text-[color:var(--clinical-accent-contrast)]">
                {index + 1}
              </span>
              <span className="leading-4 md:pt-1 md:leading-5">{label}</span>
            </li>
          ))}
        </ol>

        <div className="space-y-3">
          <article className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4 shadow-[var(--shadow-inset)]">
            <p className={cn(eyebrowText, "text-[color:var(--clinical-accent)]")}>Illustrative answer</p>
            <h3 className="mt-1 text-base font-semibold text-[color:var(--text-heading)]">
              Check each claim, not just the summary
            </h3>
            <div
              className="mt-3 space-y-3 text-sm leading-6 text-[color:var(--text)]"
              aria-label="Neutral illustrative answer"
            >
              <p>
                The answer should state a focused claim and place its citation beside the words it supports{" "}
                <span className="inline-flex rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-1.5 py-0.5 font-mono text-xs font-semibold text-[color:var(--clinical-accent)]">
                  [1]
                </span>
                .
              </p>
              <p className="border-l-2 border-[color:var(--clinical-accent)] pl-3 text-[color:var(--text-muted)]">
                Open the citation and compare the source passage with the wording, population, and limits of the claim{" "}
                <span className="inline-flex rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-1.5 py-0.5 font-mono text-xs font-semibold text-[color:var(--clinical-accent)]">
                  [2]
                </span>
                .
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-[color:var(--clinical-accent)]">
              <ShieldCheck aria-hidden="true" className="size-icon-md" /> Top source
            </p>
            <p className="mt-2 text-base font-semibold text-[color:var(--text-heading)]">
              Illustrative guideline · source page
            </p>
            <button type="button" onClick={onOpenSourceGuide} className={cn(floatingControl, "mt-3")}>
              <ExternalLink aria-hidden="true" className="size-icon-md" /> Learn about sources
            </button>
            <p className={cn("mt-3 text-xs", textMuted)}>Updated · Section · Page</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function TourPreview({ progress, onOpen }: { progress: GuideProgress; onOpen: () => void }) {
  const completed = new Set(progress.completedStepIds);
  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)]">
      <h2 className="text-base font-semibold text-[color:var(--text-heading)]">3-minute guided tour</h2>
      <p className={cn("mt-1 text-xs leading-5", textMuted)}>Learn the evidence-first workflow step by step.</p>
      <ol className="mt-3 space-y-1" aria-label="Guided tour progress">
        {guideTourSteps.map((step, index) => {
          const done = completed.has(step.id);
          return (
            <li
              key={step.id}
              className="flex min-h-9 items-center gap-2 text-sm font-medium text-[color:var(--text-heading)]"
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold",
                  done
                    ? "border-[color:var(--success)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
                    : "border-[color:var(--border-strong)] text-[color:var(--text-muted)]",
                )}
              >
                {done ? <Check aria-hidden="true" className="size-icon-sm" /> : index + 1}
              </span>
              {step.label}
            </li>
          );
        })}
      </ol>
      <button type="button" onClick={onOpen} className={cn(primaryControl, "mt-3 w-full px-3")}>
        <PlayCircle aria-hidden="true" className="size-icon-md" />
        {progress.completedStepIds.length === 0
          ? "Start guided tour"
          : progress.completedStepIds.length === 5
            ? "Review guided tour"
            : "Continue guided tour"}
      </button>
    </section>
  );
}

function SafetyChecklist() {
  const items = [
    "Question is focused",
    "Scope matches the task",
    "Claims link to citations",
    "Primary source confirms meaning",
  ];
  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)]">
      <h2 className="text-base font-semibold text-[color:var(--text-heading)]">Before you use an answer</h2>
      <ul className="mt-2 divide-y divide-[color:var(--border)]">
        {items.map((item, index) => (
          <li
            key={item}
            className="flex min-h-10 items-center justify-between gap-2 py-1.5 text-sm font-medium text-[color:var(--text-heading)]"
          >
            <span>{item}</span>
            {index < 3 ? (
              <CheckCircle2 aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--success)]" />
            ) : (
              <Circle aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--clinical-accent)]" />
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-3 py-2 text-xs font-semibold leading-5 text-[color:var(--text-heading)]">
        Keep clinical judgement in the loop.
      </p>
    </section>
  );
}

function TopicArticle({ topic }: { topic: GuideTopic }) {
  const Icon = topicIcons[topic.id];
  return (
    <article className="mx-auto max-w-[70ch]">
      <p className={cn(eyebrowText, "flex items-center gap-2 text-[color:var(--clinical-accent)]")}>
        <Icon aria-hidden="true" className="size-icon-md" /> Guide topic
      </p>
      <h2
        data-guide-page-heading
        tabIndex={-1}
        className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--text-heading)] outline-none sm:text-3xl"
      >
        {topic.title}
      </h2>
      <p className={cn("mt-2 text-base leading-7", textMuted)}>{topic.summary}</p>
      <div className="mt-6 space-y-6">
        {topic.sections.map((section) => (
          <section key={section.heading}>
            <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">{section.heading}</h3>
            <div className="mt-2 space-y-3 text-sm leading-6 text-[color:var(--text)] sm:text-base sm:leading-7">
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets ? (
                <ul className="space-y-2 pl-0">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2.5">
                      <CheckCircle2
                        aria-hidden="true"
                        className="mt-1 size-icon-md shrink-0 text-[color:var(--clinical-accent)]"
                      />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

function AllTopics({ onSelect }: { onSelect: (id: GuideTopicId) => void }) {
  return (
    <section>
      <p className={eyebrowText}>Reference guide</p>
      <h2
        data-guide-page-heading
        tabIndex={-1}
        className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--text-heading)] outline-none sm:text-3xl"
      >
        All guide topics
      </h2>
      <p className={cn("mt-2 text-sm leading-6 sm:text-base", textMuted)}>
        Choose a concise topic or search the guide above.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {guideTopics.map((topic) => {
          const Icon = topicIcons[topic.id];
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => onSelect(topic.id)}
              className="group min-h-tap rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:shadow-[var(--e1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <Icon aria-hidden="true" className="size-icon-md" />
              </span>
              <span className="mt-3 block text-base font-semibold text-[color:var(--text-heading)] group-hover:text-[color:var(--clinical-accent)]">
                {topic.navLabel}
              </span>
              <span className={cn("mt-1 block text-sm leading-6", textMuted)}>{topic.summary}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SearchResults({ query, onSelect }: { query: string; onSelect: (id: GuideTopicId) => void }) {
  const results = useMemo(() => searchGuideTopics(query), [query]);
  return (
    <section aria-labelledby="guide-search-results-heading">
      <p className={eyebrowText}>Guide search</p>
      <h2
        id="guide-search-results-heading"
        data-guide-page-heading
        tabIndex={-1}
        className="mt-1 text-2xl font-semibold text-[color:var(--text-heading)] outline-none"
      >
        Search results
      </h2>
      <p aria-live="polite" className={cn("mt-2 text-sm", textMuted)}>
        {results.length} {results.length === 1 ? "topic" : "topics"} found for “{query.trim()}”.
      </p>
      {results.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {results.map((result) => (
            <button
              key={result.topic.id}
              type="button"
              onClick={() => onSelect(result.topic.id)}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              <span className="text-base font-semibold text-[color:var(--text-heading)]">{result.topic.title}</span>
              <span className={cn("mt-1 line-clamp-3 block text-sm leading-6", textMuted)}>{result.snippet}</span>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--clinical-accent)]">
                Open topic <ChevronRight aria-hidden="true" className="size-icon-sm" />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] p-6 text-center">
          <Search aria-hidden="true" className="mx-auto size-8 text-[color:var(--text-muted)]" />
          <h3 className="mt-3 text-base font-semibold text-[color:var(--text-heading)]">No matching guide topic</h3>
          <p className={cn("mt-1 text-sm leading-6", textMuted)}>
            Try a shorter term such as citation, scope, privacy, upload, or shortcut.
          </p>
        </div>
      )}
    </section>
  );
}

function TourView({
  progress,
  stepIndex,
  complete,
  onReview,
  onRestart,
}: {
  progress: GuideProgress;
  stepIndex: number;
  complete: boolean;
  onReview: () => void;
  onRestart: () => void;
}) {
  if (complete) {
    return (
      <section className="mx-auto max-w-2xl py-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[color:var(--success-soft)] text-[color:var(--success)]">
          <CheckCircle2 aria-hidden="true" className="size-7" />
        </span>
        <h2
          data-guide-page-heading
          tabIndex={-1}
          className="mt-4 text-2xl font-semibold text-[color:var(--text-heading)] outline-none sm:text-3xl"
        >
          Guided tour complete
        </h2>
        <p className={cn("mx-auto mt-2 max-w-xl text-sm leading-6 sm:text-base", textMuted)}>
          You have covered the complete evidence-first workflow. Return whenever you need a quick refresher; your
          completion stays on this browser only.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={onReview} className={primaryControl}>
            <PlayCircle aria-hidden="true" className="size-icon-md" /> Review tour
          </button>
          <button type="button" onClick={onRestart} className={floatingControl}>
            <RotateCcw aria-hidden="true" className="size-icon-md" /> Restart guided tour
          </button>
        </div>
      </section>
    );
  }
  const step = guideTourSteps[stepIndex];
  const topic = guideTopicById[step.topicId];
  return (
    <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3">
        <p className={eyebrowText}>Your learning path</p>
        <ol className="mt-3 space-y-1">
          {guideTourSteps.map((tourStep, index) => {
            const current = index === stepIndex;
            const done = progress.completedStepIds.includes(tourStep.id);
            return (
              <li
                key={tourStep.id}
                className={cn(
                  "flex min-h-tap items-center gap-2 rounded-lg px-2 text-sm font-semibold",
                  current
                    ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "text-[color:var(--text-muted)]",
                )}
                aria-current={current ? "step" : undefined}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full border text-xs",
                    done
                      ? "border-[color:var(--success)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
                      : current
                        ? "border-[color:var(--clinical-accent)]"
                        : "border-[color:var(--border-strong)]",
                  )}
                >
                  {done ? <Check aria-hidden="true" className="size-icon-sm" /> : index + 1}
                </span>
                {tourStep.label}
              </li>
            );
          })}
        </ol>
      </aside>
      <section>
        <p className={cn(eyebrowText, "text-[color:var(--clinical-accent)]")}>Guided tour · Step {stepIndex + 1}</p>
        <h2
          data-guide-page-heading
          tabIndex={-1}
          className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--text-heading)] outline-none sm:text-3xl"
        >
          {step.focusHeading}
        </h2>
        <p className={cn("mt-2 text-base leading-7", textMuted)}>{topic.summary}</p>
        <div className="mt-5 space-y-5">
          {topic.sections.map((section) => (
            <article
              key={section.heading}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4 shadow-[var(--shadow-inset)]"
            >
              <h3 className="text-base font-semibold text-[color:var(--text-heading)]">{section.heading}</h3>
              {section.paragraphs?.slice(0, 1).map((paragraph) => (
                <p key={paragraph} className="mt-2 text-sm leading-6 text-[color:var(--text)]">
                  {paragraph}
                </p>
              ))}
              {section.bullets ? (
                <ul className="mt-3 space-y-2">
                  {section.bullets.slice(0, 3).map((bullet) => (
                    <li key={bullet} className="flex gap-2 text-sm leading-6">
                      <CheckCircle2
                        aria-hidden="true"
                        className="mt-1 size-icon-md shrink-0 text-[color:var(--clinical-accent)]"
                      />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function GuideDialogSession({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<GuideView>("home");
  const [activeTopicId, setActiveTopicId] = useState<GuideTopicId>("answer-anatomy");
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState<GuideProgress>(() => loadGuideProgress());
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourComplete, setTourComplete] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const contentStartRef = useRef<HTMLDivElement | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const chromeScrollHide = useScrollHideReporter(
    searchFocused,
    false,
    `${view}:${activeTopicId}:${tourStepIndex}:${tourComplete}`,
  );
  const chromeHidden = chromeScrollHide.hidden;

  function focusPageStart() {
    window.requestAnimationFrame(() => {
      if (scrollBodyRef.current) scrollBodyRef.current.scrollTop = 0;
      lastScrollTopRef.current = 0;
      chromeScrollHide.reset();
      contentStartRef.current?.querySelector<HTMLElement>("[data-guide-page-heading]")?.focus({ preventScroll: true });
    });
  }

  function handleBodyScroll(event: UIEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    const nextScrollTop = target.scrollTop;
    if (document.activeElement === searchInputRef.current && Math.abs(nextScrollTop - lastScrollTopRef.current) > 4) {
      searchInputRef.current?.blur();
    }
    const collapseMetrics = readChromeCollapseMetrics(target);
    const headerRelease = headerRef.current?.getBoundingClientRect().height ?? 0;
    const reserveRelease = collapseMetrics.collapseBudget ?? 0;
    chromeScrollHide.reportScroll({
      offset: nextScrollTop,
      maxOffset: Math.max(0, target.scrollHeight - target.clientHeight),
      ...collapseMetrics,
      collapseBudget: headerRelease + reserveRelease,
      collapseKind: headerRelease > 0 ? "in-flow" : collapseMetrics.collapseKind,
      combinedChrome: headerRelease > 0 && reserveRelease > 0,
      source: target,
    });
    lastScrollTopRef.current = nextScrollTop;
  }

  function navigate(nextView: GuideView) {
    setQuery("");
    if (nextView === "tour") {
      const complete = progress.completedStepIds.length === guideTourSteps.length;
      setTourComplete(complete);
      const nextId = firstIncompleteGuideStep(progress);
      setTourStepIndex(
        Math.max(
          0,
          guideTourSteps.findIndex((step) => step.id === nextId),
        ),
      );
    }
    setView(nextView);
    focusPageStart();
  }

  function openTopic(topicId: GuideTopicId) {
    setQuery("");
    setActiveTopicId(topicId);
    setView("topic");
    focusPageStart();
  }

  function restartTour() {
    clearGuideProgress();
    setProgress(emptyGuideProgress);
    setTourStepIndex(0);
    setTourComplete(false);
    setView("tour");
    focusPageStart();
  }

  function continueTour() {
    const step = guideTourSteps[tourStepIndex];
    const nextProgress = completeGuideStep(progress, step.id);
    setProgress(nextProgress);
    saveGuideProgress(nextProgress);
    if (tourStepIndex === guideTourSteps.length - 1) {
      setTourComplete(true);
    } else {
      setTourStepIndex((index) => index + 1);
    }
    focusPageStart();
  }

  const tourPrimaryLabel =
    progress.completedStepIds.length === 0
      ? "Start guided tour"
      : progress.completedStepIds.length === guideTourSteps.length
        ? "Review guided tour"
        : "Resume guided tour";
  const footer = (
    <>
      {/* Same localized glass the shared phone dock paints: the footer band itself
          stays transparent and this scrim tints only around the pill, tapering to
          zero at the physical edge. Without it the Sheet's opaque footer surface
          reads as a slab covering the content behind the composer. */}
      <div className="answer-footer-search-backdrop sm:hidden" aria-hidden="true" />
      <div
        data-guide-mobile-footer
        aria-hidden={chromeHidden}
        inert={chromeHidden || undefined}
        className="relative z-10 mx-auto grid w-full max-w-3xl min-w-0 gap-2.5"
      >
        <div data-guide-tour-action-row className="flex min-w-0 items-center justify-center gap-2">
          {view === "tour" && !tourComplete ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setTourStepIndex((index) => Math.max(0, index - 1));
                  focusPageStart();
                }}
                disabled={tourStepIndex === 0}
                className={cn(floatingControl, "hidden px-3 sm:inline-flex")}
              >
                <ChevronLeft aria-hidden="true" className="size-icon-md" /> Previous
              </button>
              <button
                type="button"
                onClick={() => navigate("home")}
                className="hidden min-h-tap rounded-lg px-3 text-sm font-semibold text-[color:var(--text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:inline-flex sm:items-center"
              >
                Exit tour
              </button>
              <button type="button" onClick={continueTour} className={cn(guideTourAction, "px-3 sm:px-5")}>
                {tourStepIndex === guideTourSteps.length - 1 ? "Complete tour" : "Continue"}
                <ChevronRight aria-hidden="true" className="size-icon-md" />
              </button>
            </>
          ) : view === "tour" && tourComplete ? (
            <button type="button" onClick={() => navigate("home")} className={guideTourAction}>
              Return to Guide home
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate("topics")}
                className="hidden min-h-tap rounded-lg px-3 text-sm font-semibold text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:inline-flex sm:items-center"
              >
                Browse all topics
              </button>
              {view === "topic" || view === "topics" ? (
                <button
                  type="button"
                  onClick={() => navigate("home")}
                  className={cn(floatingControl, "hidden sm:inline-flex")}
                >
                  Guide home
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openTopic("ask-better-questions")}
                  className={cn(floatingControl, "hidden sm:inline-flex")}
                >
                  <HelpCircle aria-hidden="true" className="size-icon-md" /> Ask a question
                </button>
              )}
              <button type="button" onClick={() => navigate("tour")} className={cn(guideTourAction, "px-3 sm:px-5")}>
                <PlayCircle aria-hidden="true" className="size-icon-md" />
                {tourPrimaryLabel}
              </button>
            </>
          )}
        </div>
        <GuideSearch
          query={query}
          inputRef={searchInputRef}
          onFocusChange={setSearchFocused}
          onQueryChange={(nextQuery) => {
            setQuery(nextQuery);
            if (nextQuery.trim()) {
              window.requestAnimationFrame(() => {
                if (scrollBodyRef.current) scrollBodyRef.current.scrollTop = 0;
                chromeScrollHide.reset();
              });
            }
          }}
        />
        <p className={cn("hidden items-center justify-center gap-2 text-xs sm:flex", textMuted)}>
          <ShieldCheck aria-hidden="true" className="size-icon-md shrink-0" /> Demo content only · Do not enter PHI
        </p>
      </div>
    </>
  );

  const hasSearch = query.trim().length > 0;

  return (
    <Sheet
      open
      onClose={onClose}
      labelledBy={guideAccessibleNameId}
      title="Clinical KB Guide Centre"
      description="Search, learn, and verify with confidence."
      closeLabel="Close guide"
      headerLeading={
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
          <BookOpen aria-hidden="true" className="size-6" />
        </span>
      }
      contentClassName="relative font-sans sm:max-w-none lg:h-[min(56rem,calc(100dvh-3rem))] lg:max-w-[min(94vw,90rem)]"
      bodyClassName="p-0 sm:p-0"
      bodyRef={scrollBodyRef}
      bodyTabIndex={0}
      onBodyScroll={handleBodyScroll}
      headerRef={headerRef}
      headerHidden={chromeHidden}
      headerBottom={<GuideTopNavigation view={view} onNavigate={navigate} />}
      headerClassName={cn(
        "guide-centre-header max-h-48 overflow-hidden pt-[max(1rem,env(safe-area-inset-top))] transition-[border-color,opacity] duration-[var(--duration-moderate)] motion-reduce:transition-none sm:pt-5",
        chromeHidden &&
          "max-h-0 border-transparent p-0 opacity-0 sm:max-h-48 sm:border-[color:var(--border)] sm:p-5 sm:opacity-100",
      )}
      mobilePlacement="fullscreen"
      footer={footer}
      footerClassName={cn(
        // Phones use the SHARED edge-to-edge dock chrome, not a Sheet footer band:
        // `.answer-footer-search-dock.answer-footer-search-edge` (globals.css) owns
        // the flush left/right/bottom geometry, the safe-area padding and the
        // transparent background, exactly as every other phone composer does. The
        // border/surface/elevation below are therefore sm+ only — on phones they
        // painted an opaque slab across the content behind the composer. The dock
        // stays on the DEFAULT scrim height, not `document-mobile-search-compact`:
        // the tour action row sits above the pill here, the same shape the
        // differentials/patient-details dock addons take.
        "answer-footer-search-dock answer-footer-search-edge",
        "absolute inset-x-0 bottom-0 z-30 border-t-0 bg-transparent p-0 shadow-none transition-[transform,opacity] duration-[var(--duration-moderate)] motion-reduce:transition-none sm:static sm:border-t sm:border-[color:var(--border)] sm:bg-[color:var(--surface-raised)] sm:p-4",
        chromeHidden &&
          "pointer-events-none translate-y-full opacity-0 sm:pointer-events-auto sm:translate-y-0 sm:opacity-100",
      )}
      testId="clinical-kb-guide-centre"
      closeButtonClassName="grid size-tap shrink-0 place-items-center rounded-full border border-[color:var(--clinical-accent-border)] text-[color:var(--text-muted)] transition hover:bg-[color:var(--clinical-accent-soft)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
    >
      <span id={guideAccessibleNameId} className="sr-only">
        Clinical KB guide
      </span>
      <div
        ref={contentStartRef}
        data-guide-content
        data-reserve-owner="guide-search-dock"
        data-reserve-hidden-pad="0"
        className={cn("space-y-4 p-3 sm:p-5", chromeHidden ? "pb-0 sm:pb-5" : "pb-40 sm:pb-5")}
      >
        {hasSearch ? (
          <SearchResults query={query} onSelect={openTopic} />
        ) : (
          <>
            {view === "home" ? <QuickTasks onSelect={openTopic} /> : null}
            {view === "home" ? (
              <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)_19rem]">
                <aside className="hidden space-y-4 lg:block">
                  <p className={eyebrowText}>Guide contents</p>
                  <GuideContents activeTopicId="answer-anatomy" onSelect={openTopic} />
                  <ProgressCard progress={progress} onResume={() => navigate("tour")} />
                </aside>
                <div className="space-y-4">
                  <CompactContents activeTopicId="answer-anatomy" onSelect={openTopic} />
                  <VerificationDemo onOpenSourceGuide={() => openTopic("sources-citations")} />
                </div>
                <aside className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <TourPreview progress={progress} onOpen={() => navigate("tour")} />
                  <SafetyChecklist />
                </aside>
              </div>
            ) : null}
            {view === "topics" ? <AllTopics onSelect={openTopic} /> : null}
            {view === "topic" ? (
              <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)_18rem]">
                <aside className="hidden lg:block">
                  <p className={cn(eyebrowText, "mb-2")}>Guide contents</p>
                  <GuideContents activeTopicId={activeTopicId} onSelect={openTopic} />
                </aside>
                <div className="space-y-4">
                  <CompactContents activeTopicId={activeTopicId} onSelect={openTopic} />
                  <TopicArticle topic={guideTopicById[activeTopicId]} />
                </div>
                <aside className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <TourPreview progress={progress} onOpen={() => navigate("tour")} />
                  <SafetyChecklist />
                </aside>
              </div>
            ) : null}
            {view === "tour" ? (
              <TourView
                progress={progress}
                stepIndex={tourStepIndex}
                complete={tourComplete}
                onReview={() => {
                  setTourComplete(false);
                  setTourStepIndex(0);
                  focusPageStart();
                }}
                onRestart={restartTour}
              />
            ) : null}
          </>
        )}
      </div>
    </Sheet>
  );
}

export function GuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <GuideDialogSession onClose={onClose} /> : null;
}
