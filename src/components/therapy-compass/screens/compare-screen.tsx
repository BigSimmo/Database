"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { MAX_COMPARE, useTcBindings } from "../bindings";
import { commandControl, outlineControl, therapyBtn } from "../controls";
import { needsReviewCount, parseSteps, searchTherapies, shortestDelivery, summarise } from "../data/select";
import type { Therapy } from "../data/types";
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  CrosshairIcon,
  InfoIcon,
  PlayIcon,
  PlusIcon,
  ScaleIcon,
  SearchIcon,
  ShieldIcon,
  XIcon,
} from "../icons";
import { EmptyState } from "../ui";
import { useClipboard } from "../use-clipboard";

type Row = {
  key: string;
  label: string;
  icon: (p: { size?: number; strokeWidth?: number }) => ReactNode;
  tone?: "warning";
  priority?: boolean;
  get: (t: Therapy) => string;
};

const ROWS: Row[] = [
  {
    key: "avoid",
    label: "When not to use",
    icon: AlertIcon,
    tone: "warning",
    priority: true,
    get: (t) => summarise(t.contraindicationsOrCautions, 1) || "Check source before use.",
  },
  {
    key: "fit",
    label: "Best fit",
    icon: CrosshairIcon,
    priority: true,
    get: (t) => t.bestUsedFor || t.targetSymptoms || "—",
  },
  {
    key: "first",
    label: "What to do first",
    icon: PlayIcon,
    get: (t) => parseSteps(t.deliverySteps)[0] || summarise(t.mechanism, 1) || "—",
  },
  { key: "time", label: "Time required", icon: ClockIcon, get: (t) => t.timeRequired || t.sessionLength || "—" },
  { key: "setting", label: "Setting", icon: ShieldIcon, get: (t) => t.setting || t.patientPopulation || "—" },
  { key: "complexity", label: "Clinician skill / complexity", icon: ScaleIcon, get: (t) => t.complexity || "—" },
  {
    key: "evidence",
    label: "Evidence level",
    icon: ShieldIcon,
    tone: "warning",
    priority: true,
    get: (t) => t.evidenceLevel || (t.reviewStatus === "reviewed" ? "Reviewed" : "Source review required"),
  },
];

export function CompareScreen() {
  const b = useTcBindings();
  const items = b.compareTherapies;
  const { copied, copy } = useClipboard();

  const rows = useMemo(() => {
    if (b.cmpTab === "priorities") return ROWS.filter((r) => r.priority);
    if (b.cmpTab === "differences") {
      return ROWS.filter((r) => new Set(items.map((t) => r.get(t))).size > 1 || items.length < 2);
    }
    return ROWS;
  }, [b.cmpTab, items]);

  const copySet = () =>
    copy(
      [
        `Therapy comparison — ${items.map((t) => t.name).join(" vs ")}`,
        "",
        ...ROWS.map((r) => `${r.label}: ${items.map((t) => r.get(t)).join("  |  ")}`),
      ].join("\n"),
      "set",
    );

  const cols = `minmax(180px,1.1fr) ${items.map(() => "minmax(160px,1fr)").join(" ")}`;
  const dense = b.density === "dense";
  const cellPad = dense ? "11px 16px" : "15px 20px";

  return (
    <section data-screen-label="Compare" className="max-w-[1240px] my-0 mx-auto">
      <div className="flex items-start justify-between gap-5 mb-1.5 flex-wrap">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="m-0 text-3xl-minus font-semibold text-[color:var(--text-heading)] tracking-tight">
              Therapy Comparison
            </h1>
            <span className="text-sm-minus font-semibold text-[color:var(--clinical-accent-hover)] bg-[color:var(--clinical-accent-soft)] py-[3px] px-2.5 rounded-md">
              {items.length} of 4 selected
            </span>
          </div>
          <p className="mt-1.5 mx-0 mb-0 text-sm text-[color:var(--text-muted)]">
            Compare fit, cautions, delivery and evidence without losing source context.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex gap-0.5 p-[3px] bg-[color:var(--surface-inset)] rounded-lg">
            <button
              type="button"
              className={`${therapyBtn} ${b.segComfortable}`}
              onClick={b.setComfortable}
              aria-pressed={b.density === "comfortable"}
            >
              Comfortable
            </button>
            <button
              type="button"
              className={`${therapyBtn} ${b.segDense}`}
              onClick={b.setDense}
              aria-pressed={b.density === "dense"}
            >
              Dense
            </button>
          </div>
          <button
            type="button"
            className={`${therapyBtn} ${outlineControl}`}
            onClick={copySet}
            disabled={items.length < 2}
          >
            {copied === "set" ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            {copied === "set" ? "Copied" : "Copy set"}
          </button>
          <button
            type="button"
            className={`${therapyBtn} ${outlineControl}`}
            onClick={b.clearCompare}
            disabled={items.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex gap-3 my-[18px] mx-0 flex-wrap items-center">
        <AddPicker />
        {items.map((t) => (
          <span
            key={t.slug}
            className="flex items-center gap-2 h-[46px] pt-0 pr-2 pb-0 pl-3.5 border border-[color:var(--border)] rounded-lg bg-[color:var(--surface)] shadow-[var(--shadow-tight)]"
          >
            <ScaleIcon size={15} className="text-[color:var(--text-soft)]" />
            <span className="text-sm-minus font-semibold text-[color:var(--text-heading)] max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap">
              {t.name}
            </span>
            <button
              type="button"
              className={`${therapyBtn} inline-flex items-center justify-center w-tap h-tap border-0 bg-transparent text-[color:var(--text-soft)] cursor-pointer rounded-sm`}
              onClick={() => b.removeCompare(t.slug)}
              title={`Remove ${t.name}`}
            >
              <XIcon size={15} strokeWidth={1.9} />
            </button>
          </span>
        ))}
      </div>

      {items.length < 2 ? (
        <EmptyState
          icon={ScaleIcon}
          title={items.length === 0 ? "Add therapies to compare" : "Add one more therapy"}
          body="Pick two to four therapies — from search results, a therapy record, or the add box above — to compare fit, cautions, delivery and evidence side by side."
          action={
            <button type="button" className={`${therapyBtn} ${commandControl}`} onClick={b.goSearch}>
              <SearchIcon size={16} strokeWidth={1.9} />
              Find therapies to compare
            </button>
          }
        />
      ) : (
        <>
          {/* decision summary */}
          <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_1fr_1fr] bg-[color:var(--surface)] border border-[color:var(--border)] rounded-xl shadow-[var(--shadow-soft)] overflow-hidden mb-5">
            <div className="py-5 px-[22px]">
              <div className="text-base-minus font-semibold text-[color:var(--text-heading)]">Decision summary</div>
            </div>
            <SummaryCell label="SHORTEST DELIVERY" value={shortestDelivery(items)?.name ?? "—"} accent />
            <SummaryCell
              label="SOURCE STATUS"
              value={`${needsReviewCount(items)} of ${items.length} need review`}
              warn
            />
          </div>

          {/* tabs */}
          <div
            className="therapy-compare-tabs flex gap-[26px] border-b border-[color:var(--border)] mb-0.5"
            role="group"
            aria-label="Comparison fields"
          >
            <button
              type="button"
              className={`${therapyBtn} ${b.tabPriorities}`}
              onClick={b.setTabPriorities}
              aria-pressed={b.cmpTab === "priorities"}
            >
              Priorities
            </button>
            <button
              type="button"
              className={`${therapyBtn} ${b.tabDifferences}`}
              onClick={b.setTabDifferences}
              aria-pressed={b.cmpTab === "differences"}
            >
              Differences
            </button>
            <button
              type="button"
              className={`${therapyBtn} ${b.tabAll}`}
              onClick={b.setTabAll}
              aria-pressed={b.cmpTab === "all"}
            >
              All fields
            </button>
          </div>

          {/* table */}
          <div
            data-therapy-scroll-sm
            className="therapy-compare-table bg-[color:var(--surface)] border border-[color:var(--border)] border-t-0 rounded-xs shadow-[var(--shadow-soft)] overflow-hidden"
            style={{ "--tc-compare-columns": cols, "--tc-compare-cell-padding": cellPad } as CSSProperties}
          >
            <div className="therapy-compare-grid bg-[color:var(--surface-subtle)]">
              <div className="py-4 px-5 text-sm-minus font-semibold text-[color:var(--text-soft)]">Field</div>
              {items.map((t) => (
                <div key={t.slug} className="py-3.5 px-5 border-l border-[color:var(--border)]">
                  <div className="flex items-center gap-[7px]">
                    <ScaleIcon size={15} className="text-[color:var(--text-soft)]" />
                    <span className="text-sm-minus font-semibold text-[color:var(--text-heading)]">{t.name}</span>
                  </div>
                  <div
                    className={
                      t.reviewStatus === "reviewed"
                        ? "mt-[3px] text-2xs font-semibold text-[color:var(--success-text)]"
                        : "mt-[3px] text-2xs font-semibold text-[color:var(--warning-text)]"
                    }
                  >
                    {t.reviewStatus === "reviewed" ? "Reviewed" : "Needs review"}
                  </div>
                </div>
              ))}
            </div>
            {rows.map((r, ri) => {
              const warn = r.tone === "warning";
              const stripe = ri % 2 === 1;
              return (
                <div
                  key={r.key}
                  className={`therapy-compare-grid bg-[color:var(--surface)]${warn ? " bg-[color:var(--warning-bg)] text-[color:var(--warning-text)]" : stripe ? " bg-[color:var(--surface-subtle)]" : ""}`}
                >
                  <div className="therapy-compare-row-label flex items-center">
                    <r.icon size={16} strokeWidth={1.7} />
                    {r.label}
                  </div>
                  {items.map((t) => (
                    <div key={t.slug} className="therapy-compare-cell border-l border-[color:var(--border)]">
                      {r.get(t)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-4 text-xs text-[color:var(--text-soft)]">
            <InfoIcon size={15} strokeWidth={1.8} />
            Comparisons are source-grounded. Review status reflects the latest source checks.
          </div>
        </>
      )}
    </section>
  );
}

function SummaryCell({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`border-l border-[color:var(--border)] px-[22px] py-5${accent ? " border-l-[3px] border-l-[color:var(--clinical-accent)]" : warn ? " bg-[color:var(--warning-bg)] text-[color:var(--warning-text)]" : ""}`}
    >
      <div className="text-3xs font-bold tracking-eyebrow text-[color:var(--text-soft)] mb-1.5">{label}</div>
      <div className="text-sm font-semibold text-[color:var(--text-heading)]">{value}</div>
    </div>
  );
}

function AddPicker() {
  const b = useTcBindings();
  const [q, setQ] = useState("");
  const atLimit = b.compareSlugs.length >= MAX_COMPARE;
  const matches = useMemo(() => {
    if (atLimit || !q.trim()) return [];
    return searchTherapies(b.therapies, { query: q, tags: [], briefOnly: false, sheetOnly: false, reviewedOnly: false })
      .filter((t) => !b.isInCompare(t.slug))
      .slice(0, 6);
  }, [q, b, atLimit]);

  return (
    <div className="relative flex-1 min-w-[260px]">
      <label className="relative flex items-center">
        <SearchIcon size={17} strokeWidth={1.8} className="absolute left-[14px] text-[color:var(--text-soft)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={atLimit}
          placeholder={
            atLimit ? "Maximum of 4 selected — remove one to add another" : "Add a therapy to the comparison…"
          }
          aria-label="Add a therapy to compare"
          className="h-[46px] w-full rounded-md border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface)] pl-10 pr-3 text-sm"
        />
      </label>
      {matches.length ? (
        <div className="absolute z-[30] top-[52px] left-0 right-0 bg-[color:var(--surface)] border border-[color:var(--border)] rounded-lg shadow-[var(--shadow-hover)] overflow-hidden">
          {matches.map((t) => (
            <button
              key={t.slug}
              type="button"
              className={`${therapyBtn} transition-colors duration-100 hover:bg-[color:var(--surface-subtle)] flex items-center gap-2.5 w-full py-[11px] px-3.5 border-0 border-b border-[color:var(--border)] bg-transparent text-left cursor-pointer`}
              onClick={() => {
                b.addCompare(t.slug);
                setQ("");
              }}
            >
              <PlusIcon size={15} className="text-[color:var(--clinical-accent)] flex-none" />
              <span className="text-sm-minus font-semibold text-[color:var(--text-heading)]">{t.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
