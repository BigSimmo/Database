"use client";

import Link from "next/link";
import {
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  Loader2,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";

import { rankFormRecords, type FormSearchMatch } from "@/lib/forms";
import { useRegistryRecords, type RegistryRequestStatus } from "@/lib/use-registry-records";
import { cn, codeText } from "@/components/ui-primitives";
import { SearchResultsEmptyState, SearchResultsHeaderBand } from "@/components/clinical-dashboard/search-results-header-band";
import { useSearchCommand } from "@/components/clinical-dashboard/search-command-context";
import { recordMatchesCommandScopes } from "@/lib/search-command-surface";

type FormsSearchResultsPageProps = {
  query: string;
};

const resultCodes = ["4A", "4B", "3A", "5", "2B", "1A"];
const sourceSnippetCount = 278;
const taskCount = 8;
const pathwayCount = 12;

function resultCode(index: number) {
  return resultCodes[index] ?? String(index + 1);
}

function tagToneClass(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("crisis") || normalized.includes("risk") || normalized.includes("safety")) {
    return "bg-[color:var(--danger-soft)] text-[color:var(--danger)]";
  }
  if (normalized.includes("transport") || normalized.includes("transfer") || normalized.includes("handover")) {
    return "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";
  }
  if (normalized.includes("legal") || normalized.includes("detention") || normalized.includes("capacity")) {
    return "bg-[color:var(--info-soft)] text-[color:var(--info)]";
  }
  return "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";
}

function compactMatchReason(match: FormSearchMatch) {
  if (match.reasons.includes("title")) return `Title or content match for "transport"`;
  if (match.reasons.includes("record fields")) return "Content match in related pathway";
  return "Content match for transfer/transport";
}

function SearchSummary({ query, formsCount }: { query: string; formsCount: number }) {
  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-2 px-1 text-sm font-bold text-[color:var(--text)]">
        <span className="inline-flex min-w-0 items-center gap-2 text-[color:var(--text-heading)]">
          <Search className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" />
          <span className="truncate">Results for {query}</span>
        </span>
        <span className="text-[color:var(--text-soft)]">·</span>
        <span>{formsCount} forms</span>
        <span className="text-[color:var(--text-soft)]">·</span>
        <span>
          {sourceSnippetCount} <span className="font-medium text-[color:var(--text-muted)]">snippets</span>
        </span>
        <span className="text-[color:var(--text-soft)]">·</span>
        <span>
          {taskCount} <span className="font-medium text-[color:var(--text-muted)]">tasks</span>
        </span>
      </div>
    </section>
  );
}

function ResultTabs({ formsCount }: { formsCount: number }) {
  const tabs = [
    ["Results", null],
    ["Forms", formsCount],
    ["Evidence", sourceSnippetCount],
    ["Pathways", pathwayCount],
    ["Tasks", taskCount],
  ] as const;

  return (
    <nav
      aria-label="Forms search sections"
      className="flex min-w-0 items-end gap-7 border-b border-[color:var(--border)] text-sm font-extrabold text-[color:var(--text)]"
    >
      {tabs.map(([label, count], index) => (
        <button
          key={label}
          type="button"
          className={cn(
            "relative -mb-px flex min-h-14 items-center gap-2 whitespace-nowrap rounded-t-md focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--clinical-accent)]/16",
            index === 0 ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text)]",
          )}
        >
          {label}
          {count ? (
            <span className="rounded-full bg-[color:var(--surface-subtle)] px-2 py-0.5 text-xs text-[color:var(--text)]">
              {count}
            </span>
          ) : null}
          {index === 0 ? (
            <span className="absolute bottom-0 left-0 h-1 w-full rounded-t-full bg-[color:var(--clinical-accent)]" />
          ) : null}
        </button>
      ))}
    </nav>
  );
}

function ResultsTable({ matches }: { matches: FormSearchMatch[] }) {
  return (
    <section
      data-testid="form-search-results"
      aria-label="Form record matches"
      className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]"
    >
      <div className="p-5 pb-2">
        <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">Best matches</h2>
      </div>
      <div className="hidden grid-cols-[86px_minmax(180px,1fr)_170px_minmax(180px,1fr)_86px] border-b border-[color:var(--border)] px-5 py-3 text-2xs font-bold uppercase text-[color:var(--text-muted)] md:grid">
        <span>Form</span>
        <span>Title</span>
        <span>Tags</span>
        <span>Matched because</span>
        <span className="text-right">Open</span>
      </div>
      <div>
        {matches.map((match, index) => {
          const form = match.service;
          return (
            <article
              key={form.slug}
              data-testid={`form-search-result-${form.slug}`}
              className="grid gap-4 border-b border-[color:var(--border)] px-5 py-4 transition last:border-b-0 hover:bg-[color:var(--surface-subtle)]/55 md:grid-cols-[86px_minmax(180px,1fr)_170px_minmax(180px,1fr)_86px] md:items-center"
            >
              <div className="grid h-12 w-14 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-3xl font-black text-[color:var(--clinical-accent)]">
                {resultCode(index)}
              </div>
              <div>
                <h3 className="max-w-[21rem] text-sm font-extrabold leading-snug text-[color:var(--text-heading)]">
                  {form.title}
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {(form.statusChips ?? []).slice(0, 2).map((chip, chipIndex) => {
                  const chipLabel = chip.label?.trim() || "Form";
                  return (
                    <span
                      key={`${chipLabel}-${chipIndex}`}
                      className={cn("rounded-full px-2 py-1 text-3xs font-black uppercase", tagToneClass(chipLabel))}
                    >
                      {chipLabel}
                    </span>
                  );
                })}
              </div>
              <p className="text-sm font-medium leading-relaxed text-[color:var(--text-muted)]">
                {compactMatchReason(match)}
              </p>
              <Link
                href={`/forms/${form.slug}`}
                aria-label={`Open ${form.title}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] px-4 text-sm font-extrabold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--clinical-accent)]/16 md:justify-self-end"
              >
                Open
                <ExternalLink className="h-4 w-4" />
              </Link>
            </article>
          );
        })}
      </div>
      <div className="flex justify-center border-t border-[color:var(--border)] p-4">
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-2 rounded-md px-2 text-sm font-extrabold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--clinical-accent)]/16"
        >
          View all forms ({matches.length})
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function ToggleRow({
  icon: Icon,
  title,
  subtitle,
  enabled,
  danger,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  enabled: boolean;
  danger?: boolean;
}) {
  return (
    <div className="grid grid-cols-[34px_1fr_42px] items-center gap-3 border-b border-[color:var(--border)] py-4 last:border-b-0">
      <Icon className={cn("h-6 w-6", danger ? "text-[color:var(--danger)]" : "text-[color:var(--clinical-accent)]")} />
      <div>
        <p className="text-sm font-extrabold text-[color:var(--text-heading)]">{title}</p>
        <p className="mt-0.5 text-xs font-medium text-[color:var(--text-muted)]">{subtitle}</p>
      </div>
      <span
        className={cn(
          "relative h-6 w-10 rounded-full transition",
          enabled ? "bg-[color:var(--clinical-accent)]" : "bg-[color:var(--border-strong)]",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-4 w-4 rounded-full bg-[color:var(--surface)] shadow-sm transition",
            enabled ? "right-1" : "left-1",
          )}
        />
      </span>
    </div>
  );
}

function RefineRail() {
  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">Refine</h2>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs font-extrabold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--clinical-accent)]/16"
        >
          Reset
        </button>
      </div>
      <div className="mt-4">
        <ToggleRow icon={Shield} title="High risk only" subtitle="Show high risk forms" enabled={false} danger />
        <ToggleRow icon={FileText} title="Official forms" subtitle="Limit to official forms" enabled />
        <ToggleRow icon={Workflow} title="Pathway linked" subtitle="Show pathway-linked" enabled />
        <ToggleRow icon={Search} title="Source matches" subtitle="Require source match" enabled={false} />
      </div>
    </section>
  );
}

function NextSteps() {
  const steps = [
    { icon: FileText, title: "Open Form 4A", subtitle: "View the Transport order form" },
    { icon: Workflow, title: "View transport pathway", subtitle: "Explore before, current, parallel, after" },
    { icon: FileText, title: "Check source evidence", subtitle: "See matching sections and snippets" },
  ];
  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-soft)] lg:p-5">
      <h2 className="text-base font-extrabold text-[color:var(--text-heading)] lg:text-lg">Next steps</h2>
      <div className="mt-2 lg:mt-3">
        {steps.map(({ icon: Icon, title, subtitle }) => (
          <button
            key={title}
            type="button"
            className="grid w-full grid-cols-[28px_1fr_18px] items-center gap-3 rounded-lg border-b border-[color:var(--border)] py-3 text-left transition last:border-b-0 hover:bg-[color:var(--surface-subtle)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--clinical-accent)]/16 lg:grid-cols-[32px_1fr_18px] lg:px-2 lg:py-4"
          >
            <Icon className="h-5 w-5 text-[color:var(--clinical-accent)] lg:h-6 lg:w-6" />
            <span>
              <span className="block text-sm font-extrabold text-[color:var(--text-heading)]">{title}</span>
              <span className="mt-0.5 block text-xs font-medium text-[color:var(--text-muted)]">{subtitle}</span>
            </span>
            <ChevronRight className="h-5 w-5 text-[color:var(--text-heading)]" />
          </button>
        ))}
      </div>
    </section>
  );
}

function SourceSnapshot() {
  const rows = [
    ["Source snippets", String(sourceSnippetCount)],
    ["Source", "Official source"],
    ["Act sections", "29, 63, 67, 92, 112, 129, 133, 148, 154"],
    ["Review due", "01 May 2026"],
  ];
  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">Source snapshot</h2>
      <div className="mt-3">
        {rows.map(([label, value], index) => {
          const Icon = index === 3 ? Clock3 : index === 1 ? ShieldCheck : FileText;
          return (
            <div
              key={label}
              className="grid grid-cols-[28px_1fr_1fr] gap-3 border-b border-[color:var(--border)] py-4 text-sm last:border-b-0"
            >
              <Icon className="h-5 w-5 text-[color:var(--clinical-accent)]" />
              <span className="font-extrabold text-[color:var(--text-heading)]">{label}</span>
              <span className="text-right font-medium text-[color:var(--text-muted)]">{value}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PathwayPanel() {
  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">
        Related pathway{" "}
        <span className="ml-2 text-sm font-medium text-[color:var(--text-muted)]">( PSOLIS Transport Pathway )</span>
      </h2>
      <div className="mt-5 grid grid-cols-[1fr_24px_1fr_24px_1.4fr_24px_1fr] items-center gap-3">
        <PathwayNode label="Before" code="1A" title="Referral for examination" />
        <ChevronRight className="h-5 w-5 text-[color:var(--text-muted)]" />
        <PathwayNode label="Current" code="4A" title="Transport order" active />
        <ChevronRight className="h-5 w-5 text-[color:var(--text-muted)]" />
        <PathwayNode
          label="Parallel"
          code="3A"
          title="Detention to enable examination"
          secondaryCode="4B"
          secondaryTitle="Extension of Transport Order"
        />
        <ChevronRight className="h-5 w-5 text-[color:var(--text-muted)]" />
        <PathwayNode label="After" code="" title="Examination at destination" />
      </div>
      <div className="mt-5 flex justify-center">
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-3 rounded-md px-2 text-sm font-extrabold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--clinical-accent)]/16"
        >
          <Workflow className="h-5 w-5" />
          View full pathway
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function PathwayNode({
  label,
  code,
  title,
  active,
  secondaryCode,
  secondaryTitle,
}: {
  label: string;
  code: string;
  title: string;
  active?: boolean;
  secondaryCode?: string;
  secondaryTitle?: string;
}) {
  return (
    <div>
      <p className="mb-3 text-2xs font-bold uppercase text-[color:var(--text-muted)]">{label}</p>
      <div
        className={cn(
          "min-h-[112px] rounded-lg border p-4",
          active
            ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]"
            : "border-[color:var(--border)] bg-[color:var(--surface)]",
        )}
      >
        {code ? (
          <p className={cn("text-2xl font-black text-[color:var(--clinical-accent)]", codeText)}>{code}</p>
        ) : null}
        <p className="mt-2 text-sm font-extrabold leading-snug text-[color:var(--text-heading)]">{title}</p>
        {active ? (
          <span className="mt-3 inline-flex rounded-full bg-[color:var(--clinical-accent-soft)] px-3 py-1 text-2xs font-extrabold text-[color:var(--clinical-accent)]">
            You are here
          </span>
        ) : null}
        {secondaryCode && secondaryTitle ? (
          <div className="mt-3 grid gap-2 text-sm">
            <p>
              <span className="mr-2 text-xl font-black text-[color:var(--clinical-accent)]">{secondaryCode}</span>
              <span className="text-xs font-medium text-[color:var(--text-muted)]">{secondaryTitle}</span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function VerifiedFooter() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-5 text-xs text-[color:var(--text-muted)] lg:py-6 lg:text-sm">
      <span className="inline-flex items-center gap-2 font-extrabold text-[color:var(--clinical-accent)]">
        <ShieldCheck className="h-5 w-5" />
        Source verified
      </span>
      <span>·</span>
      <span>Official source</span>
      <span>·</span>
      <span>Aligned to MHA 2014</span>
    </div>
  );
}

function MobileCards({ matches }: { matches: FormSearchMatch[] }) {
  return (
    <section
      data-testid="form-search-mobile-results"
      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-1.5 shadow-[var(--shadow-tight)]"
    >
      <h2 className="px-1 pb-1 text-sm font-extrabold text-[color:var(--text-heading)]">Top forms</h2>
      <div className="grid gap-1">
        {matches.map((match, index) => {
          const form = match.service;
          return (
            <article
              key={form.slug}
              data-testid={`form-search-mobile-result-${form.slug}`}
              className="grid grid-cols-[38px_minmax(0,1fr)] gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-[0_1px_2px_rgb(12_24_34_/_5%)]"
            >
              <div className="grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-lg font-black leading-none text-[color:var(--clinical-accent)]">
                {resultCode(index)}
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <h3 className="min-w-0 text-xs font-extrabold leading-[1.15] text-[color:var(--text-heading)]">
                    {form.title}
                  </h3>
                  <Link
                    href={`/forms/${form.slug}`}
                    aria-label={`Open ${form.title}`}
                    className="relative inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-[color:var(--border)] px-2 text-3xs font-extrabold text-[color:var(--clinical-accent)] transition before:absolute before:-inset-2 before:rounded-lg before:content-[''] hover:bg-[color:var(--clinical-accent-soft)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--clinical-accent)]/16"
                  >
                    Open
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {(form.statusChips ?? []).slice(0, 2).map((chip, chipIndex) => {
                    const chipLabel = chip.label?.trim() || "Form";
                    return (
                      <span
                        key={`${chipLabel}-${chipIndex}`}
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-4xs font-black uppercase leading-none",
                          tagToneClass(chipLabel),
                        )}
                      >
                        {chipLabel}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-0.5 truncate text-3xs font-medium leading-3 text-[color:var(--text-muted)]">
                  {compactMatchReason(match)}
                </p>
              </div>
            </article>
          );
        })}
      </div>
      <button
        type="button"
        className="mx-auto mt-1.5 flex min-h-8 items-center gap-2 rounded-md px-2 text-sm font-extrabold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--clinical-accent)]/16"
      >
        View all forms ({matches.length})
        <ChevronRight className="h-4 w-4" />
      </button>
    </section>
  );
}

function MobilePathway() {
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2 shadow-[var(--shadow-tight)]">
      <h2 className="text-sm-minus font-extrabold text-[color:var(--text-heading)]">
        Related pathway <span className="font-medium text-[color:var(--text-muted)]">( PSOLIS Transport )</span>
      </h2>
      <div className="mt-1.5 flex items-center gap-1 overflow-x-auto pb-0.5">
        {[
          ["1A", "Referral"],
          ["4A", "Transport order"],
          ["3A/4B", "Parallel"],
          ["", "Destination Examination"],
        ].map(([code, label], index) => (
          <div key={`${code}-${label}`} className="flex items-center gap-1">
            <div
              className={cn(
                "min-w-[55px] rounded-md border p-1 text-center",
                index === 1
                  ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface)]",
              )}
            >
              {code ? (
                <p className={cn("text-sm font-black leading-none text-[color:var(--clinical-accent)]", codeText)}>
                  {code}
                </p>
              ) : null}
              <p className="mt-0.5 text-4xs font-bold leading-[10px] text-[color:var(--text-muted)]">{label}</p>
              {index === 1 ? (
                <p className="mt-0.5 rounded-full bg-[color:var(--clinical-accent-soft)] px-1 py-0.5 text-4xs font-black leading-[10px] text-[color:var(--clinical-accent)]">
                  You are here
                </p>
              ) : null}
            </div>
            {index < 3 ? <ChevronRight className="h-3.5 w-3.5 text-[color:var(--text-muted)]" /> : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mx-auto mt-1 flex min-h-8 items-center gap-2 rounded-md px-2 text-sm-minus font-extrabold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--clinical-accent)]/16"
      >
        <Workflow className="h-4 w-4" />
        View full pathway
      </button>
    </section>
  );
}

function RegistryStatusNotice({ status }: { status: RegistryRequestStatus }) {
  if (status === "ready") return null;
  const notice =
    status === "loading"
      ? { icon: Loader2, spin: true, tone: "info", text: "Loading your forms registry...", action: null }
      : status === "unauthorized"
        ? {
            icon: Shield,
            spin: false,
            tone: "warning",
            text: "Sign in to search your forms registry.",
            action: { href: "/", label: "Go to sign in" },
          }
        : {
            icon: ShieldAlert,
            spin: false,
            tone: "danger",
            text: "Couldn't load the forms registry. Try again shortly.",
            action: null,
          };
  const Icon = notice.icon;
  const toneClass =
    notice.tone === "danger"
      ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)]/50 text-[color:var(--danger)]"
      : notice.tone === "warning"
        ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/50 text-[color:var(--warning)]"
        : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]";
  return (
    <div
      data-testid="forms-registry-status-notice"
      className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${toneClass}`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${notice.spin ? "animate-spin" : ""}`} aria-hidden />
      <span className="min-w-0 flex-1">{notice.text}</span>
      {notice.action ? (
        <Link
          href={notice.action.href}
          className="inline-flex min-h-8 items-center justify-center rounded-md bg-[color:var(--command)] px-3 text-xs font-bold text-[color:var(--command-contrast)] hover:bg-[color:var(--command-hover)]"
        >
          {notice.action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function FormsSearchResultsPage(props: FormsSearchResultsPageProps) {
  return <FormsSearchResultsPageContent key={props.query} {...props} />;
}

function FormsSearchResultsPageContent({ query }: FormsSearchResultsPageProps) {
  const command = useSearchCommand();
  const registry = useRegistryRecords("form");
  const registryReady = registry.status === "ready";
  const matches = useMemo(
    () => (registryReady ? rankFormRecords(registry.records, query) : []),
    [registryReady, registry.records, query],
  );
  const scopedMatches = useMemo(() => {
    const scopes = command?.commandScopes ?? [];
    if (!scopes.length) return matches;
    return matches.filter((match) => recordMatchesCommandScopes(match.service, scopes, "forms"));
  }, [command?.commandScopes, matches]);

  return (
    <div className="overflow-x-hidden bg-[color:var(--surface-subtle)] text-[color:var(--text-heading)]">
      <main className="mx-auto grid w-full max-w-7xl gap-3 px-4 pt-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-5 lg:px-8 lg:pb-8 lg:pt-6">
        <div className="grid gap-3 lg:gap-5">
          <RegistryStatusNotice status={registry.status} />
          {registryReady ? (
            <>
              <div className="hidden lg:block">
                <SearchResultsHeaderBand modeId="forms" query={query} matchCount={scopedMatches.length} />
              </div>
              <div className="hidden lg:block">
                <SearchSummary query={query} formsCount={scopedMatches.length} />
              </div>
              {query.trim() && scopedMatches.length === 0 ? (
                <SearchResultsEmptyState
                  modeId="forms"
                  query={query}
                  onClearScopes={command?.onClearScopes}
                />
              ) : (
              <>
              <div className="overflow-x-auto">
                <ResultTabs formsCount={scopedMatches.length} />
              </div>
              <div className="hidden lg:block">
                <ResultsTable matches={scopedMatches} />
              </div>
              <div className="lg:hidden">
                <MobileCards matches={scopedMatches} />
              </div>
              </>
              )}
            </>
          ) : null}
          <div className="hidden lg:block">
            <PathwayPanel />
          </div>
          <div className="lg:hidden">
            <MobilePathway />
          </div>
          <div className="hidden lg:block">
            <VerifiedFooter />
          </div>
        </div>

        <aside className="hidden gap-5 lg:grid">
          <RefineRail />
          <NextSteps />
          <SourceSnapshot />
        </aside>

        <div className="grid gap-3 lg:hidden">
          <NextSteps />
          <button
            type="button"
            className="mx-auto inline-flex h-10 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-8 text-sm font-extrabold text-[color:var(--clinical-accent)] shadow-sm transition hover:bg-[color:var(--clinical-accent-soft)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--clinical-accent)]/16"
          >
            <SlidersHorizontal className="h-5 w-5" />
            Filters
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[color:var(--clinical-accent)] px-1 text-3xs text-[color:var(--clinical-accent-contrast)]">
              3
            </span>
          </button>
          <VerifiedFooter />
        </div>
      </main>
    </div>
  );
}
