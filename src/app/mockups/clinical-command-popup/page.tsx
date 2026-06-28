"use client";

import {
  Activity,
  Bookmark,
  Check,
  CheckSquare,
  ChevronDown,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  Grid2X2,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  ShieldIcon,
  Square,
  Stethoscope,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

type FindingId = "fbc" | "myocarditis" | "metabolic" | "renal" | "toxicity";
type TabId = "safety" | "monitor" | "table" | "checklist";

const findings: Array<{
  id: FindingId;
  priority: "High" | "Med" | "Low";
  title: string;
  subtitle: string;
  source: string;
  accent: string;
  icon: typeof ShieldIcon;
  detail: string;
  facts: Array<[string, string]>;
}> = [
  {
    id: "fbc",
    priority: "High",
    title: "FBC/ANC",
    subtitle: "Record baseline result",
    source: "Source 2",
    accent: "text-red-600 border-red-200 bg-red-50",
    icon: ShieldIcon,
    detail: "A baseline FBC/ANC should be recorded prior to starting lithium and monitored per protocol.",
    facts: [
      ["Domain", "FBC/ANC"],
      ["Target", "Record baseline result"],
      ["Timing", "Before prescribing"],
    ],
  },
  {
    id: "myocarditis",
    priority: "Med",
    title: "Myocarditis",
    subtitle: "Monitor for signs/symptoms",
    source: "Source 3",
    accent: "text-orange-600 border-orange-200 bg-orange-50",
    icon: Activity,
    detail: "Screen for fever, chest pain, dyspnoea, tachycardia, and unexplained deterioration.",
    facts: [
      ["Domain", "Cardiac symptoms"],
      ["Target", "Escalate concerning signs"],
      ["Timing", "During initiation"],
    ],
  },
  {
    id: "metabolic",
    priority: "Med",
    title: "Metabolic",
    subtitle: "Review weight, lipids, glucose",
    source: "Source 4",
    accent: "text-orange-600 border-orange-200 bg-orange-50",
    icon: ClipboardCheck,
    detail: "Record metabolic baseline and follow the scheduled monitoring pathway.",
    facts: [
      ["Domain", "Weight and labs"],
      ["Target", "Track trend over time"],
      ["Timing", "Baseline and review"],
    ],
  },
  {
    id: "renal",
    priority: "Low",
    title: "Renal function",
    subtitle: "Check eGFR and U&Es",
    source: "Source 6",
    accent: "text-teal-700 border-teal-200 bg-teal-50",
    icon: Stethoscope,
    detail: "Check renal function before prescribing and repeat if toxicity or dehydration risk changes.",
    facts: [
      ["Domain", "Renal"],
      ["Target", "Confirm stable eGFR"],
      ["Timing", "Baseline and periodic"],
    ],
  },
  {
    id: "toxicity",
    priority: "Low",
    title: "Toxicity signs",
    subtitle: "GI upset, tremor, ataxia",
    source: "Source 8",
    accent: "text-teal-700 border-teal-200 bg-teal-50",
    icon: ShieldCheck,
    detail: "Ask about toxicity symptoms when levels, renal function, or interacting medicines change.",
    facts: [
      ["Domain", "Safety-net"],
      ["Target", "Detect early toxicity"],
      ["Timing", "At each review"],
    ],
  },
];

const tabs: Array<{ id: TabId; label: string; icon: typeof ShieldIcon }> = [
  { id: "safety", label: "Safety", icon: ShieldIcon },
  { id: "monitor", label: "Monitor", icon: Activity },
  { id: "table", label: "Table", icon: Grid2X2 },
  { id: "checklist", label: "Checklist", icon: CheckSquare },
];

const tableRows = [
  ["Baseline", "Record baseline result"],
  ["Initiation", "Monitor per protocol"],
  ["Ongoing", "Continue scheduled monitoring"],
] as const;

const checklistItems = [
  ["Baseline level", "Record baseline lithium concentration"],
  ["Renal function", "Check creatinine and eGFR"],
  ["Thyroid", "Check TSH at baseline and periodically"],
  ["Toxicity signs", "Screen for GI upset, tremor, ataxia"],
] as const;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--clinical-chat-teal)]";

function IconButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-heading)] ${focusRing}`}
    >
      {children}
    </button>
  );
}

function AppChrome() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[color:var(--surface)] text-[color:var(--text)]">
      <header className="flex h-[4.5rem] items-center border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-4 shadow-[var(--shadow-tight)]">
        <button type="button" className={`grid h-11 w-11 place-items-center rounded-lg ${focusRing}`} aria-label="Menu">
          <Menu className="h-5 w-5 text-[color:var(--text-muted)]" />
        </button>
        <div className="ml-3 inline-grid h-12 min-w-44 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 shadow-[var(--shadow-inset)]">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--clinical-chat-teal)] text-white">
            <Stethoscope className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
              Mode
            </span>
            <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">Answer</span>
          </span>
          <ChevronDown className="h-4 w-4 text-[color:var(--text-soft)]" />
        </div>
        <div className="ml-auto hidden items-center gap-3 sm:flex">
          <span className="text-sm font-semibold text-[color:var(--text-heading)]">Clinical KB</span>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal)] text-white shadow-[var(--shadow-tight)]"
            aria-label="New"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="grid h-[calc(100%-4.5rem)] grid-cols-[5.25rem_minmax(0,34rem)_minmax(0,1fr)] max-md:grid-cols-1">
        <aside className="hidden border-r border-[color:var(--border)] bg-[color:var(--surface-raised)] md:flex md:flex-col md:items-center md:gap-5 md:py-5">
          {[Search, FileText, ClipboardCheck, Activity, Bookmark].map((Icon, index) => (
            <span
              key={index}
              className={[
                "grid h-11 w-11 place-items-center rounded-lg",
                index === 2
                  ? "bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]"
                  : "text-[color:var(--text-muted)]",
              ].join(" ")}
            >
              <Icon className="h-5 w-5" />
            </span>
          ))}
        </aside>

        <main className="min-w-0 overflow-hidden bg-[color:var(--surface)] px-4 py-6 md:px-8">
          <div className="mx-auto max-w-md space-y-5">
            <div className="ml-auto w-fit rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 shadow-[var(--shadow-inset)]">
              <p className="text-sm font-semibold text-[color:var(--text-heading)]">lithium</p>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">9:14 AM</p>
            </div>
            <article className="flex gap-3">
              <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-chat-teal)]/20 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-base font-medium leading-7 text-[color:var(--text-heading)]">
                  <strong>Lithium Carbonate 250 mg</strong> Tablet - Lithicarb.{" "}
                  <strong>Lithium Carbonate 450 mg</strong> Modified Release Tablet - Quilonum SR. Lithium monitoring
                  baseline tests should be reviewed before prescribing.
                </p>
                <button
                  type="button"
                  className={`mt-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--clinical-chat-teal-soft)] px-3 text-sm font-semibold text-[color:var(--clinical-chat-teal)] ${focusRing}`}
                >
                  12 sources
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </article>

            <div className="space-y-3">
              <button
                type="button"
                className={`grid min-h-16 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-left shadow-[var(--shadow-inset)] ${focusRing}`}
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]">
                  <ClipboardCheck className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-[color:var(--text-heading)]">Clinical notes 5</span>
                  <span className="mt-1 block text-xs text-[color:var(--text-muted)]">
                    Safety - Monitor - Table - Checklist
                  </span>
                </span>
                <ChevronDown className="-rotate-90 h-4 w-4 text-[color:var(--text-soft)]" />
              </button>
              <button
                type="button"
                className={`grid min-h-16 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-left shadow-[var(--shadow-inset)] ${focusRing}`}
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]">
                  <FileText className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-[color:var(--text-heading)]">Evidence</span>
                  <span className="mt-1 block text-xs text-[color:var(--text-muted)]">
                    12 sources - 4 quotes - More
                  </span>
                </span>
                <ChevronDown className="-rotate-90 h-4 w-4 text-[color:var(--text-soft)]" />
              </button>
            </div>
          </div>
        </main>

        <div className="hidden bg-[color:var(--surface-subtle)] md:block" />
      </div>
    </div>
  );
}

function TabButton({ tab, active, onClick }: { tab: (typeof tabs)[number]; active: boolean; onClick: () => void }) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "inline-flex min-h-10 min-w-0 items-center justify-center gap-0.5 rounded-lg border px-1 text-[11px] font-semibold transition sm:w-auto sm:gap-1.5 sm:px-4 sm:text-sm",
        focusRing,
        active
          ? "border-[color:var(--clinical-chat-sand-border)] bg-[color:var(--clinical-chat-sand)] text-[color:var(--warning)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
      ].join(" ")}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="whitespace-nowrap">{tab.label}</span>
    </button>
  );
}

function FindingRow({
  finding,
  expanded,
  onClick,
}: {
  finding: (typeof findings)[number];
  expanded: boolean;
  onClick: () => void;
}) {
  const Icon = finding.icon;
  return (
    <article
      data-expanded={expanded ? "true" : "false"}
      className={[
        "border-b border-[color:var(--border)] last:border-b-0",
        expanded ? "bg-[color:var(--clinical-chat-sand)]/35" : "bg-transparent",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onClick}
        aria-expanded={expanded}
        className={`grid min-h-[4.25rem] w-full grid-cols-[3.2rem_auto_minmax(0,1fr)_auto] items-center gap-2 px-3 text-left transition hover:bg-[color:var(--surface-subtle)] ${focusRing}`}
      >
        <span className={["text-xs font-bold", finding.accent.split(" ").slice(0, 1).join(" ")].join(" ")}>
          {finding.priority}
        </span>
        <span className={["grid h-9 w-9 place-items-center rounded-lg border bg-white", finding.accent].join(" ")}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">{finding.title}</span>
          <span className="mt-0.5 block truncate text-xs text-[color:var(--text-muted)]">{finding.subtitle}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs font-bold text-[color:var(--clinical-chat-teal)] min-[360px]:inline">
            {finding.source}
          </span>
          <ChevronDown
            className={["h-4 w-4 text-[color:var(--text-soft)] transition", expanded ? "rotate-180" : ""].join(" ")}
          />
        </span>
      </button>
      {expanded ? (
        <div className="px-3 pb-3">
          <div className="rounded-lg border border-[color:var(--clinical-chat-sand-border)] bg-white/80 p-3 shadow-[var(--shadow-inset)]">
            <p className="text-sm leading-6 text-[color:var(--text-heading)]">{finding.detail}</p>
            <dl className="mt-3 divide-y divide-[color:var(--border)] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-sm">
              {finding.facts.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[5.25rem_minmax(0,1fr)] gap-2 px-3 py-2">
                  <dt className="text-xs font-semibold text-[color:var(--text-muted)]">{label}</dt>
                  <dd className="min-w-0 font-medium text-[color:var(--text-heading)]">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 overflow-hidden rounded-lg border border-[color:var(--border)]">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]">
                  <tr>
                    <th className="border-r border-[color:var(--border)] px-3 py-2 font-bold uppercase tracking-[0.06em]">
                      Phase
                    </th>
                    <th className="px-3 py-2 font-bold uppercase tracking-[0.06em]">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white text-[color:var(--text-heading)]">
                  {tableRows.map(([phase, action]) => (
                    <tr key={phase} className="border-t border-[color:var(--border)]">
                      <td className="border-r border-[color:var(--border)] px-3 py-2 font-semibold">{phase}</td>
                      <td className="px-3 py-2">{action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Checklist({ checked, onToggle }: { checked: Set<number>; onToggle: (index: number) => void }) {
  return (
    <section className="border-t border-[color:var(--border)] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">Checklist</h3>
        <p className="text-xs font-semibold text-[color:var(--text-muted)]">{checked.size} of 4 selected</p>
      </div>
      <div className="grid gap-1">
        {checklistItems.map(([title, detail], index) => {
          const selected = checked.has(index);
          return (
            <button
              key={title}
              type="button"
              onClick={() => onToggle(index)}
              className={`grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 text-left transition hover:bg-[color:var(--surface-subtle)] ${focusRing}`}
            >
              {selected ? (
                <span className="grid h-5 w-5 place-items-center rounded border border-[color:var(--clinical-chat-teal)] bg-[color:var(--clinical-chat-teal)] text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
              ) : (
                <Square className="h-5 w-5 text-[color:var(--text-muted)]" />
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[color:var(--text-heading)]">{title}</span>
                <span className="block truncate text-xs text-[color:var(--text-muted)]">{detail}</span>
              </span>
              <span className="hidden text-xs font-bold text-[color:var(--clinical-chat-teal)] min-[360px]:inline">
                Source {index + 2}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CommandPopup() {
  const [tab, setTab] = useState<TabId>("safety");
  const [expanded, setExpanded] = useState<FindingId>("fbc");
  const [checked, setChecked] = useState<Set<number>>(new Set([0]));
  const activeFinding = useMemo(() => findings.find((finding) => finding.id === expanded) ?? findings[0], [expanded]);

  function toggleCheck(index: number) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <section
      aria-label="Clinical command popup"
      data-clinical-popup
      className="fixed inset-x-3 bottom-3 z-20 flex h-[72dvh] min-h-[31rem] flex-col overflow-hidden rounded-2xl border border-white/45 bg-[color:var(--surface-lux)] text-[color:var(--text)] shadow-[0_28px_90px_rgb(4_24_35_/_38%)] ring-1 ring-black/5 md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(82vh,46rem)] md:w-[min(42.5rem,calc(100vw-8rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl"
    >
      <div className="mx-auto mt-2 h-1 w-12 shrink-0 rounded-full bg-[color:var(--border-strong)] md:hidden" />
      <header className="sticky top-0 z-10 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)]/96 px-3 pb-2 pt-3 backdrop-blur-xl sm:px-4 md:pt-4">
        <div className="flex min-h-11 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)]">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-lg font-semibold tracking-normal text-[color:var(--text-heading)]">
                Clinical notes
              </h1>
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-1.5 text-xs font-bold text-[color:var(--text-muted)]">
                5
              </span>
            </div>
            <p className="mt-0.5 hidden text-xs font-semibold text-[color:var(--clinical-chat-teal)] min-[360px]:block">
              Source-backed - one item expanded
            </p>
          </div>
          <span className="hidden items-center gap-1.5 text-xs font-bold text-[color:var(--clinical-chat-teal)] sm:inline-flex">
            <ShieldCheck className="h-4 w-4" />
            Source-backed
          </span>
          <IconButton label="Close clinical notes">
            <X className="h-5 w-5" />
          </IconButton>
        </div>
        <nav className="mt-3 grid grid-cols-4 gap-1.5 pb-1 sm:flex sm:overflow-x-auto" aria-label="Clinical note views">
          {tabs.map((item) => (
            <TabButton key={item.id} tab={item} active={tab === item.id} onClick={() => setTab(item.id)} />
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid min-h-full md:grid-cols-[minmax(0,1fr)_4.75rem]">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">
                High-yield safety actions
              </p>
              <button
                type="button"
                className={`hidden min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-[color:var(--clinical-chat-teal)] hover:bg-[color:var(--clinical-chat-teal-soft)] sm:inline-flex ${focusRing}`}
              >
                View all sources
                <ChevronDown className="-rotate-90 h-4 w-4" />
              </button>
            </div>

            <div className="border-y border-[color:var(--border)]">
              {findings.map((finding) => (
                <FindingRow
                  key={finding.id}
                  finding={finding}
                  expanded={finding.id === activeFinding.id}
                  onClick={() => setExpanded(finding.id)}
                />
              ))}
            </div>

            {(tab === "checklist" || tab === "safety") && <Checklist checked={checked} onToggle={toggleCheck} />}
          </div>

          <aside className="hidden border-l border-[color:var(--border)] bg-[color:var(--surface-subtle)]/70 px-2 py-4 md:block">
            <p className="mb-3 text-center text-xs font-semibold text-[color:var(--text-muted)]">Sources</p>
            <div className="grid justify-items-center gap-2">
              {Array.from({ length: 8 }, (_, index) => {
                const selected = index + 1 === Number(activeFinding.source.replace("Source ", ""));
                return (
                  <button
                    key={index}
                    type="button"
                    className={[
                      "grid h-9 w-9 place-items-center rounded-lg border text-sm font-semibold transition",
                      focusRing,
                      selected
                        ? "border-[color:var(--clinical-chat-teal)] bg-[color:var(--clinical-chat-teal)] text-white shadow-[var(--shadow-tight)]"
                        : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-raised)]",
                    ].join(" ")}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </div>

      <footer className="sticky bottom-0 z-10 grid shrink-0 grid-cols-[0.9fr_1.25fr_auto] gap-2 border-t border-[color:var(--border)] bg-[color:var(--surface-lux)]/96 px-3 py-3 backdrop-blur-xl sm:grid-cols-[1fr_1.2fr_1fr] sm:px-4">
        <button
          type="button"
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-xs font-semibold text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-chat-teal)]/35 ${focusRing}`}
        >
          <ExternalLink className="h-4 w-4" />
          <span className="whitespace-nowrap sm:hidden">Source</span>
          <span className="hidden whitespace-nowrap sm:inline">Open source</span>
        </button>
        <button
          type="button"
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-chat-teal)] px-3 text-xs font-semibold text-white shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--primary-strong)] ${focusRing}`}
        >
          <Plus className="h-4 w-4" />
          Add to note
        </button>
        <button
          type="button"
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:text-[color:var(--text-heading)] ${focusRing}`}
        >
          <Copy className="h-4 w-4" />
          <span className="hidden sm:inline">Copy</span>
        </button>
      </footer>
    </section>
  );
}

export default function ClinicalCommandPopupMockupPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--background)] text-[color:var(--text)]">
      <AppChrome />
      <div className="absolute inset-0 z-10 bg-slate-950/36 backdrop-blur-[2px]" aria-hidden />
      <CommandPopup />
    </main>
  );
}
