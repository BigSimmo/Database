"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Clock3,
  CopyCheck,
  ExternalLink,
  FileText,
  Home,
  Menu,
  Mic,
  Moon,
  MoreVertical,
  Plus,
  Search,
  Send,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { searchFormRecords, type FormSearchMatch } from "@/lib/forms";
import { cn } from "@/components/ui-primitives";

type FormsSearchResultsPageProps = {
  query: string;
  focusSearch?: boolean;
};

const resultCodes = ["4A", "4B", "3A", "5", "2B", "1A"];
const sourceSnippetCount = 278;
const taskCount = 8;
const pathwayCount = 12;

const navItems: Array<{ label: string; icon: LucideIcon; active?: boolean }> = [
  { label: "Readiness", icon: Home },
  { label: "Find form", icon: Search },
  { label: "Forms", icon: FileText, active: true },
  { label: "Pathways", icon: Workflow },
  { label: "Clocks", icon: Clock3 },
  { label: "Checks", icon: CopyCheck },
  { label: "Sources", icon: Bookmark },
];

function resultCode(index: number) {
  return resultCodes[index] ?? String(index + 1);
}

function tagToneClass(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("crisis") || normalized.includes("risk") || normalized.includes("safety")) {
    return "bg-[#ffe7e6] text-[#d71920]";
  }
  if (normalized.includes("transport") || normalized.includes("transfer") || normalized.includes("handover")) {
    return "bg-[#dff3ef] text-[#006b63]";
  }
  if (normalized.includes("legal") || normalized.includes("detention") || normalized.includes("capacity")) {
    return "bg-[#e5efff] text-[#1261d1]";
  }
  return "bg-[#edf4f2] text-[#006b63]";
}

function compactMatchReason(match: FormSearchMatch) {
  if (match.reasons.includes("title")) return `Title or content match for "transport"`;
  if (match.reasons.includes("record fields")) return "Content match in related pathway";
  return "Content match for transfer/transport";
}

function submitUrl(query: string) {
  const params = new URLSearchParams();
  const trimmed = query.trim();
  if (trimmed) {
    params.set("q", trimmed);
    params.set("focus", "1");
    params.set("run", "1");
  }
  return `/forms${params.size ? `?${params.toString()}` : ""}`;
}

function FormsSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[205px] flex-col bg-[#071f33] text-white shadow-[18px_0_50px_rgba(7,31,51,0.16)] lg:flex">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-[#10b9a7] to-[#00776f] shadow-[0_12px_30px_rgba(0,119,111,0.35)]">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <p className="text-base font-extrabold tracking-[0.01em]">WA MHA FORMS</p>
          <p className="text-sm font-medium text-[#b7cadd]">MHA readiness</p>
        </div>
      </div>

      <nav aria-label="Forms navigation" className="mt-6 grid gap-2 px-4">
        {navItems.map(({ label, icon: Icon, active }) => (
          <button
            key={label}
            type="button"
            className={cn(
              "grid min-h-12 grid-cols-[2rem_1fr] items-center gap-3 rounded-lg px-3 text-left text-sm font-bold transition",
              active
                ? "bg-gradient-to-r from-[#0b9f92] to-[#008276] text-white shadow-[0_14px_28px_rgba(0,130,118,0.28)]"
                : "text-[#eef7fb] hover:bg-white/8",
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="mx-4 mt-5 rounded-lg border border-white/18 bg-white/[0.03] p-3">
        <button type="button" className="flex min-h-10 w-full items-center gap-3 text-sm font-bold text-white">
          <Moon className="h-5 w-5" />
          Dark mode
        </button>
      </div>

      <div className="mt-auto p-4">
        <div className="rounded-lg border border-white/16 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#18e1b5]" />
            <p className="text-sm font-extrabold">Source index ready</p>
          </div>
          <p className="mt-1 text-sm text-[#d5e4ef]">3,022 snippets available</p>
        </div>
      </div>
    </aside>
  );
}

function DesktopTopBar({
  onSearch,
}: {
  onSearch: (query: string) => void;
}) {
  const [headerQuery, setHeaderQuery] = useState("");

  function submitHeaderSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(headerQuery);
  }

  return (
    <header className="hidden h-[92px] items-center border-b border-[#dce5eb] bg-white/96 px-10 lg:flex">
      <div className="text-lg font-extrabold text-[#006b63]">Forms / Search</div>
      <form onSubmit={submitHeaderSearch} className="mx-auto flex w-[560px] items-center gap-4">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Search forms, clocks, sources</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#006b63]" />
          <input
            value={headerQuery}
            onChange={(event) => setHeaderQuery(event.target.value)}
            className="h-12 w-full rounded-lg border border-[#cbd9e1] bg-white pl-12 pr-4 text-sm font-medium text-[#12243d] outline-none transition focus:border-[#007a70] focus:ring-4 focus:ring-[#007a70]/12"
            placeholder="Search forms, clocks, sources..."
          />
        </label>
        <button
          type="submit"
          className="h-12 rounded-lg bg-[#006b63] px-7 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(0,107,99,0.22)]"
        >
          Search
        </button>
      </form>
      <div className="flex items-center gap-8 text-[#061a32]">
        <div className="grid justify-items-center gap-1 text-xs font-bold">
          <ShieldCheck className="h-6 w-6 text-[#061a32]" />
          Verified
        </div>
        <button type="button" className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-[#f1f6f6]">
          <Bell className="h-6 w-6" />
          <span className="absolute right-1 top-0 grid h-5 w-5 place-items-center rounded-full bg-[#007a70] text-[10px] font-extrabold text-white">
            2
          </span>
        </button>
        <button type="button" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full border border-[#cbd9e1] bg-[#f6fbfb] text-base font-extrabold text-[#007a70]">
            JW
          </span>
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#dfe8ed] bg-gradient-to-r from-[#005853] to-[#00796f] px-4 pb-3 pt-[calc(0.8rem+env(safe-area-inset-top))] text-white lg:hidden">
      <div className="flex min-h-12 items-center justify-between">
        <button type="button" className="grid h-11 w-11 place-items-center rounded-full text-white/95" aria-label="Open menu">
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-[#007a70]">
            <Shield className="h-5 w-5" />
          </span>
          <span className="text-base font-extrabold">Forms</span>
          <ChevronDown className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="relative grid h-11 w-11 place-items-center rounded-full" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-1 grid h-5 w-5 place-items-center rounded-full bg-[#12a08f] text-[10px] font-extrabold">
              2
            </span>
          </button>
          <button type="button" className="grid h-11 w-8 place-items-center rounded-full" aria-label="More">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function SearchSummary({
  query,
  formsCount,
  onQueryChange,
  onSubmit,
}: {
  query: string;
  formsCount: number;
  onQueryChange: (query: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="rounded-xl border border-[#d9e4ea] bg-white p-4 shadow-[0_12px_32px_rgba(7,31,51,0.04)]">
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-[1fr_52px]">
        <label className="relative block">
          <span className="sr-only">Current forms query</span>
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#006b63]" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="h-13 w-full rounded-lg border border-[#cfdde4] bg-white pl-12 pr-12 text-xl font-extrabold text-[#061a32] outline-none focus:border-[#007a70] focus:ring-4 focus:ring-[#007a70]/12"
            placeholder="Search forms"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[#5d7088] hover:bg-[#eef5f5]"
              aria-label="Clear forms query"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </label>
        <button
          type="button"
          className="grid h-13 w-full place-items-center rounded-lg border border-[#d6e2e8] text-[#007a70] hover:bg-[#f4fbfa]"
          aria-label="Open filters"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </button>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-x-7 gap-y-2 px-1 text-sm font-bold text-[#10233d]">
        <span>{formsCount} forms</span>
        <span className="text-[#718198]">·</span>
        <span>{sourceSnippetCount} <span className="font-medium text-[#48617c]">snippets</span></span>
        <span className="text-[#718198]">·</span>
        <span>{taskCount} <span className="font-medium text-[#48617c]">tasks</span></span>
        <button
          type="button"
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border border-[#d6e2e8] px-4 text-sm font-bold text-[#10233d]"
        >
          Source: Official
          <ChevronDown className="h-4 w-4" />
        </button>
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
    <nav aria-label="Forms search sections" className="flex min-w-0 items-end gap-7 border-b border-[#dbe5eb] text-sm font-extrabold text-[#10233d]">
      {tabs.map(([label, count], index) => (
        <button
          key={label}
          type="button"
          className={cn(
            "relative -mb-px flex min-h-14 items-center gap-2 whitespace-nowrap",
            index === 0 ? "text-[#007a70]" : "text-[#10233d]",
          )}
        >
          {label}
          {count ? <span className="rounded-full bg-[#eef2f5] px-2 py-0.5 text-xs text-[#10233d]">{count}</span> : null}
          {index === 0 ? <span className="absolute bottom-0 left-0 h-1 w-full rounded-t-full bg-[#007a70]" /> : null}
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
      className="overflow-hidden rounded-xl border border-[#d8e4ea] bg-white shadow-[0_18px_40px_rgba(7,31,51,0.05)]"
    >
      <div className="p-5 pb-2">
        <h2 className="text-lg font-extrabold text-[#071b33]">Best matches</h2>
      </div>
      <div className="hidden grid-cols-[86px_minmax(180px,1fr)_170px_minmax(180px,1fr)_86px] border-b border-[#dbe5eb] px-5 py-3 text-[11px] font-bold uppercase text-[#49617b] md:grid">
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
              className="grid gap-4 border-b border-[#e3ebef] px-5 py-4 last:border-b-0 md:grid-cols-[86px_minmax(180px,1fr)_170px_minmax(180px,1fr)_86px] md:items-center"
            >
              <div className="grid h-12 w-14 place-items-center rounded-lg border border-[#bce4df] bg-[#e8f7f4] text-3xl font-black text-[#007a70]">
                {resultCode(index)}
              </div>
              <div>
                <h3 className="max-w-[21rem] text-sm font-extrabold leading-snug text-[#061a32]">{form.title}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {(form.statusChips ?? []).slice(0, 2).map((chip, chipIndex) => {
                  const chipLabel = chip.label?.trim() || "Form";
                  return (
                    <span
                      key={`${chipLabel}-${chipIndex}`}
                      className={cn(
                        "rounded-full px-2 py-1 text-[10px] font-black uppercase",
                        tagToneClass(chipLabel),
                      )}
                    >
                      {chipLabel}
                    </span>
                  );
                })}
              </div>
              <p className="text-sm font-medium leading-relaxed text-[#48617c]">{compactMatchReason(match)}</p>
              <Link
                href={`/forms/${form.slug}`}
                aria-label={`Open ${form.title}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#d6e2e8] px-4 text-sm font-extrabold text-[#007a70] hover:bg-[#f4fbfa] md:justify-self-end"
              >
                Open
                <ExternalLink className="h-4 w-4" />
              </Link>
            </article>
          );
        })}
      </div>
      <div className="flex justify-center border-t border-[#edf2f5] p-4">
        <button type="button" className="inline-flex items-center gap-2 text-sm font-extrabold text-[#007a70]">
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
    <div className="grid grid-cols-[34px_1fr_42px] items-center gap-3 border-b border-[#e1e9ee] py-4 last:border-b-0">
      <Icon className={cn("h-6 w-6", danger ? "text-[#ff2d2d]" : "text-[#007a70]")} />
      <div>
        <p className="text-sm font-extrabold text-[#071b33]">{title}</p>
        <p className="mt-0.5 text-xs font-medium text-[#526981]">{subtitle}</p>
      </div>
      <span
        className={cn(
          "relative h-6 w-10 rounded-full transition",
          enabled ? "bg-[#007a70]" : "bg-[#c9d2dc]",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition",
            enabled ? "right-1" : "left-1",
          )}
        />
      </span>
    </div>
  );
}

function RefineRail() {
  return (
    <section className="rounded-xl border border-[#d8e4ea] bg-white p-5 shadow-[0_18px_40px_rgba(7,31,51,0.05)]">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-[#071b33]">Refine</h2>
        <button type="button" className="text-xs font-extrabold text-[#007a70]">Reset</button>
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
    <section className="rounded-xl border border-[#d8e4ea] bg-white p-4 shadow-[0_18px_40px_rgba(7,31,51,0.05)] lg:p-5">
      <h2 className="text-base font-extrabold text-[#071b33] lg:text-lg">Next steps</h2>
      <div className="mt-2 lg:mt-3">
        {steps.map(({ icon: Icon, title, subtitle }) => (
          <button
            key={title}
            type="button"
            className="grid w-full grid-cols-[28px_1fr_18px] items-center gap-3 border-b border-[#e1e9ee] py-3 text-left last:border-b-0 lg:grid-cols-[32px_1fr_18px] lg:py-4"
          >
            <Icon className="h-5 w-5 text-[#007a70] lg:h-6 lg:w-6" />
            <span>
              <span className="block text-sm font-extrabold text-[#071b33]">{title}</span>
              <span className="mt-0.5 block text-xs font-medium text-[#526981]">{subtitle}</span>
            </span>
            <ChevronRight className="h-5 w-5 text-[#071b33]" />
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
    <section className="rounded-xl border border-[#d8e4ea] bg-white p-5 shadow-[0_18px_40px_rgba(7,31,51,0.05)]">
      <h2 className="text-lg font-extrabold text-[#071b33]">Source snapshot</h2>
      <div className="mt-3">
        {rows.map(([label, value], index) => {
          const Icon = index === 3 ? Clock3 : index === 1 ? ShieldCheck : FileText;
          return (
            <div key={label} className="grid grid-cols-[28px_1fr_1fr] gap-3 border-b border-[#e1e9ee] py-4 text-sm last:border-b-0">
              <Icon className="h-5 w-5 text-[#007a70]" />
              <span className="font-extrabold text-[#071b33]">{label}</span>
              <span className="text-right font-medium text-[#48617c]">{value}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PathwayPanel() {
  return (
    <section className="rounded-xl border border-[#d8e4ea] bg-white p-5 shadow-[0_18px_40px_rgba(7,31,51,0.05)]">
      <h2 className="text-lg font-extrabold text-[#071b33]">
        Related pathway <span className="ml-2 text-sm font-medium text-[#526981]">( PSOLIS Transport Pathway )</span>
      </h2>
      <div className="mt-5 grid grid-cols-[1fr_24px_1fr_24px_1.4fr_24px_1fr] items-center gap-3">
        <PathwayNode label="Before" code="1A" title="Referral for examination" />
        <ChevronRight className="h-5 w-5 text-[#25435f]" />
        <PathwayNode label="Current" code="4A" title="Transport order" active />
        <ChevronRight className="h-5 w-5 text-[#25435f]" />
        <PathwayNode label="Parallel" code="3A" title="Detention to enable examination" secondaryCode="4B" secondaryTitle="Extension of Transport Order" />
        <ChevronRight className="h-5 w-5 text-[#25435f]" />
        <PathwayNode label="After" code="" title="Examination at destination" />
      </div>
      <div className="mt-5 flex justify-center">
        <button type="button" className="inline-flex items-center gap-3 text-sm font-extrabold text-[#007a70]">
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
      <p className="mb-3 text-[11px] font-bold uppercase text-[#49617b]">{label}</p>
      <div
        className={cn(
          "min-h-[112px] rounded-lg border p-4",
          active ? "border-[#77c9c2] bg-[#e8f7f4]" : "border-[#dbe5eb] bg-white",
        )}
      >
        {code ? <p className="text-2xl font-black text-[#007a70]">{code}</p> : null}
        <p className="mt-2 text-sm font-extrabold leading-snug text-[#071b33]">{title}</p>
        {active ? (
          <span className="mt-3 inline-flex rounded-full bg-[#bfece3] px-3 py-1 text-[11px] font-extrabold text-[#007a70]">
            You are here
          </span>
        ) : null}
        {secondaryCode && secondaryTitle ? (
          <div className="mt-3 grid gap-2 text-sm">
            <p>
              <span className="mr-2 text-xl font-black text-[#007a70]">{secondaryCode}</span>
              <span className="text-xs font-medium text-[#25435f]">{secondaryTitle}</span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function VerifiedFooter() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 py-6 text-sm text-[#48617c]">
      <span className="inline-flex items-center gap-2 font-extrabold text-[#007a70]">
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

function MobileTabs({ formsCount }: { formsCount: number }) {
  const tabs = [
    ["Results", null],
    ["Forms", formsCount],
    ["Evidence", sourceSnippetCount],
    ["Pathways", pathwayCount],
  ] as const;
  return (
    <nav className="sticky top-[76px] z-20 flex max-w-full gap-5 overflow-x-auto border-b border-[#dfe8ed] bg-white px-4 text-sm font-extrabold text-[#10233d] lg:hidden">
      {tabs.map(([label, count], index) => (
        <button key={label} type="button" className={cn("relative flex min-h-11 items-center gap-2 whitespace-nowrap", index === 0 && "text-[#007a70]")}>
          {label}
          {count ? <span className="rounded-full bg-[#eef2f5] px-2 py-0.5 text-xs">{count}</span> : null}
          {index === 0 ? <span className="absolute bottom-0 left-0 h-1 w-full rounded-t-full bg-[#007a70]" /> : null}
        </button>
      ))}
    </nav>
  );
}

function MobileCards({ matches }: { matches: FormSearchMatch[] }) {
  return (
    <section data-testid="form-search-mobile-results" className="rounded-lg border border-[#dbe5eb] bg-white p-2 shadow-[0_14px_30px_rgba(7,31,51,0.05)]">
      <h2 className="px-1 pb-1.5 text-sm font-extrabold text-[#071b33]">Top forms</h2>
      <div className="grid gap-1">
        {matches.map((match, index) => {
          const form = match.service;
          return (
            <article
              key={form.slug}
              data-testid={`form-search-mobile-result-${form.slug}`}
              className="grid grid-cols-[42px_minmax(0,1fr)] gap-1.5 rounded-lg border border-[#dfe8ed] bg-white p-1.5 shadow-[0_8px_18px_rgba(7,31,51,0.04)]"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg border border-[#bce4df] bg-[#e8f7f4] text-xl font-black leading-none text-[#007a70]">
                {resultCode(index)}
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <h3 className="min-w-0 text-[12.5px] font-extrabold leading-[1.15] text-[#071b33]">{form.title}</h3>
                  <Link
                    href={`/forms/${form.slug}`}
                    aria-label={`Open ${form.title}`}
                    className="relative inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-[#d6e2e8] px-2 text-[10.5px] font-extrabold text-[#007a70] before:absolute before:-inset-2 before:rounded-lg before:content-['']"
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
                          "rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase leading-none",
                          tagToneClass(chipLabel),
                        )}
                      >
                        {chipLabel}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-0.5 truncate text-[10.5px] font-medium leading-3 text-[#526981]">{compactMatchReason(match)}</p>
              </div>
            </article>
          );
        })}
      </div>
      <button type="button" className="mx-auto mt-1.5 flex min-h-7 items-center gap-2 text-sm font-extrabold text-[#007a70]">
        View all forms ({matches.length})
        <ChevronRight className="h-4 w-4" />
      </button>
    </section>
  );
}

function MobilePathway() {
  return (
    <section className="rounded-lg border border-[#dbe5eb] bg-white p-2 shadow-[0_14px_30px_rgba(7,31,51,0.05)]">
      <h2 className="text-[13px] font-extrabold text-[#071b33]">
        Related pathway <span className="font-medium text-[#526981]">( PSOLIS Transport )</span>
      </h2>
      <div className="mt-1.5 flex items-center gap-1 overflow-x-auto pb-0.5">
        {[
          ["1A", "Referral"],
          ["4A", "Transport order"],
          ["3A/4B", "Parallel"],
          ["", "Destination Examination"],
        ].map(([code, label], index) => (
          <div key={`${code}-${label}`} className="flex items-center gap-1">
            <div className={cn("min-w-[55px] rounded-md border p-1 text-center", index === 1 ? "border-[#77c9c2] bg-[#e8f7f4]" : "border-[#dbe5eb] bg-white")}>
              {code ? <p className="text-sm font-black leading-none text-[#007a70]">{code}</p> : null}
              <p className="mt-0.5 text-[7.5px] font-bold leading-[10px] text-[#25435f]">{label}</p>
              {index === 1 ? <p className="mt-0.5 rounded-full bg-[#bfece3] px-1 py-0.5 text-[7.5px] font-black leading-[10px] text-[#007a70]">You are here</p> : null}
            </div>
            {index < 3 ? <ChevronRight className="h-3.5 w-3.5 text-[#25435f]" /> : null}
          </div>
        ))}
      </div>
      <button type="button" className="mx-auto mt-1 flex min-h-7 items-center gap-2 text-[13px] font-extrabold text-[#007a70]">
        <Workflow className="h-4 w-4" />
        View full pathway
      </button>
    </section>
  );
}

function BottomSearch({
  query,
  onQueryChange,
  onSubmit,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe8ed] bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_40px_rgba(7,31,51,0.12)] backdrop-blur lg:hidden"
    >
      <div className="grid min-w-0 grid-cols-[42px_minmax(0,1fr)_52px] items-center gap-2">
        <button type="button" className="grid h-11 w-11 place-items-center rounded-full border border-[#d6e2e8] text-[#10233d]" aria-label="Add">
          <Plus className="h-6 w-6" />
        </button>
        <label className="relative block">
          <span className="sr-only">Ask or search forms</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="h-12 w-full rounded-full border border-[#d6e2e8] bg-white px-5 pr-20 text-sm font-medium text-[#10233d] outline-none focus:border-[#007a70] focus:ring-4 focus:ring-[#007a70]/12"
            placeholder="Ask or search forms..."
          />
          <Mic className="absolute right-12 top-1/2 h-5 w-5 -translate-y-1/2 text-[#48617c]" />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-[#48617c] transition hover:bg-[#edf4f7] focus:outline-none focus:ring-2 focus:ring-[#007a70]/30"
              aria-label="Clear forms search"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </label>
        <button type="submit" className="grid h-12 w-12 place-items-center rounded-full bg-[#007a70] text-white shadow-[0_10px_24px_rgba(0,122,112,0.28)]" aria-label="Search forms">
          <Send className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}

export function FormsSearchResultsPage({ query, focusSearch = false }: FormsSearchResultsPageProps) {
  const router = useRouter();
  const [draftQuery, setDraftQuery] = useState(query);
  const [mobileQuery, setMobileQuery] = useState("");
  const matches = useMemo(() => searchFormRecords(query), [query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(submitUrl(draftQuery));
  }

  function submitMobile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(submitUrl(mobileQuery || query));
  }

  function submitQuery(nextQuery: string) {
    router.push(submitUrl(nextQuery));
  }

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#f5f8fb] text-[#061a32]">
      <FormsSidebar />
      <MobileTopBar />
      <MobileTabs formsCount={matches.length} />

      <div className="lg:pl-[205px]">
        <DesktopTopBar onSearch={submitQuery} />
        <main className="grid w-full gap-3 px-4 pb-[calc(6.25rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-5 lg:px-8 lg:pb-8 lg:pt-6">
          <div className="grid gap-3 lg:gap-5">
            <div className="hidden lg:block">
              <SearchSummary query={draftQuery} formsCount={matches.length} onQueryChange={setDraftQuery} onSubmit={submit} />
            </div>
            <div className="hidden lg:block">
              <ResultTabs formsCount={matches.length} />
            </div>
            <div className="hidden lg:block">
              <ResultsTable matches={matches} />
            </div>
            <div className="lg:hidden">
              <MobileCards matches={matches} />
            </div>
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
            <button type="button" className="mx-auto inline-flex h-10 items-center gap-2 rounded-lg border border-[#d6e2e8] bg-white px-8 text-sm font-extrabold text-[#007a70] shadow-sm">
              <SlidersHorizontal className="h-5 w-5" />
              Filters
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#007a70] px-1 text-[10px] text-white">3</span>
            </button>
            <VerifiedFooter />
          </div>
        </main>
      </div>

      <BottomSearch query={mobileQuery} onQueryChange={setMobileQuery} onSubmit={submitMobile} />
      {focusSearch ? null : null}
    </div>
  );
}
