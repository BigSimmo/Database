"use client";

import { useMemo, useState } from "react";
import {
  Check,
  CirclePlay,
  Clock,
  Copy,
  Info,
  Plus,
  Scale,
  Search,
  Shield,
  Target,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";

import { cardSurface } from "@/components/card-recipes";
import { pageContainer } from "@/components/ui-primitives";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tabs } from "@/components/ui/tabs";

import { THERAPY_MAX_COMPARE } from "@/lib/therapy-compass-navigation";

import { useTcBindings } from "../bindings";
import { therapyBtn } from "../controls";
import { needsReviewCount, parseSteps, searchTherapies, shortestDelivery, summarise } from "../data/select";
import type { Therapy } from "../data/types";
import { EmptyState } from "../ui";
import { useClipboard } from "../use-clipboard";

type Row = {
  key: string;
  label: string;
  icon: LucideIcon;
  tone?: "warning";
  priority?: boolean;
  get: (t: Therapy) => string;
};

const ROWS: Row[] = [
  {
    key: "avoid",
    label: "When not to use",
    icon: TriangleAlert,
    tone: "warning",
    priority: true,
    get: (t) => summarise(t.contraindicationsOrCautions, 1) || "Check source before use.",
  },
  {
    key: "fit",
    label: "Best fit",
    icon: Target,
    priority: true,
    get: (t) => t.bestUsedFor || t.targetSymptoms || "—",
  },
  {
    key: "first",
    label: "What to do first",
    icon: CirclePlay,
    get: (t) => parseSteps(t.deliverySteps)[0] || summarise(t.mechanism, 1) || "—",
  },
  { key: "time", label: "Time required", icon: Clock, get: (t) => t.timeRequired || t.sessionLength || "—" },
  { key: "setting", label: "Setting", icon: Shield, get: (t) => t.setting || t.patientPopulation || "—" },
  { key: "complexity", label: "Clinician skill / complexity", icon: Scale, get: (t) => t.complexity || "—" },
  {
    key: "evidence",
    label: "Evidence level",
    icon: Shield,
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

  const dense = b.density === "dense";

  return (
    <section data-screen-label="Compare" className={pageContainer}>
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
          <SegmentedControl
            label="Comparison density"
            value={b.density}
            onChange={(value) => (value === "dense" ? b.setDense() : b.setComfortable())}
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "dense", label: "Dense" },
            ]}
            className="w-auto"
          />
          <Button
            variant="secondary"
            icon={copied === "set" ? Check : Copy}
            onClick={copySet}
            disabled={items.length < 2}
          >
            {copied === "set" ? "Copied" : "Copy set"}
          </Button>
          <Button variant="secondary" onClick={b.clearCompare} disabled={items.length === 0}>
            Clear
          </Button>
        </div>
      </div>

      <div className="flex gap-3 my-[18px] mx-0 flex-wrap items-center">
        <AddPicker />
        {items.map((t) => (
          <span
            key={t.slug}
            className="flex items-center gap-2 h-[46px] pt-0 pr-2 pb-0 pl-3.5 border border-[color:var(--border)] rounded-lg bg-[color:var(--surface)] shadow-[var(--e1)]"
          >
            <Scale aria-hidden="true" size={15} className="text-[color:var(--decoration-soft)]" />
            <span className="text-sm-minus font-semibold text-[color:var(--text-heading)] max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap">
              {t.name}
            </span>
            <button
              type="button"
              className={`${therapyBtn} inline-flex items-center justify-center w-tap h-tap border-0 bg-transparent text-[color:var(--decoration-soft)] cursor-pointer rounded-sm`}
              onClick={() => b.removeCompare(t.slug)}
              title={`Remove ${t.name}`}
            >
              <X aria-hidden="true" size={15} strokeWidth={1.9} />
            </button>
          </span>
        ))}
      </div>

      {items.length < 2 ? (
        <EmptyState
          icon={Scale}
          title={items.length === 0 ? "Add therapies to compare" : "Add one more therapy"}
          body="Pick two to four therapies — from search results, a therapy record, or the add box above — to compare fit, cautions, delivery and evidence side by side."
          action={
            <Button variant="primary" icon={Search} onClick={b.goSearch}>
              Find therapies to compare
            </Button>
          }
        />
      ) : (
        <>
          {/* decision summary */}
          <div className={`${cardSurface} grid grid-cols-1 sm:grid-cols-[1.1fr_1fr_1fr] overflow-hidden mb-5`}>
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
          <Tabs
            label="Comparison fields"
            value={b.cmpTab}
            onChange={(value) => {
              if (value === "priorities") b.setTabPriorities();
              else if (value === "differences") b.setTabDifferences();
              else b.setTabAll();
            }}
            items={[
              { id: "priorities", label: "Priorities" },
              { id: "differences", label: "Differences" },
              { id: "all", label: "All fields" },
            ]}
          >
            {/* table */}
            <div
              data-therapy-scroll-sm
              role="region"
              aria-label="Therapy comparison table"
              tabIndex={0}
              className="overflow-x-auto rounded-xs border border-[color:var(--border)] shadow-[var(--shadow-soft)]"
            >
              <table className="w-full min-w-[720px] border-collapse bg-[color:var(--surface)] text-left">
                <caption className="sr-only">Therapy comparison by clinical field</caption>
                <thead className="bg-[color:var(--surface-subtle)]">
                  <tr>
                    <th
                      scope="col"
                      className="min-w-[180px] px-5 py-4 text-sm-minus font-semibold text-[color:var(--text-muted)]"
                    >
                      Field
                    </th>
                    {items.map((t) => (
                      <th
                        key={t.slug}
                        scope="col"
                        className="min-w-[160px] border-l border-[color:var(--border)] px-5 py-3.5 align-top"
                      >
                        <div className="flex items-center gap-[7px]">
                          <Scale aria-hidden="true" size={15} className="text-[color:var(--decoration-soft)]" />
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
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, ri) => {
                    const warn = r.tone === "warning";
                    const stripe = ri % 2 === 1;
                    const rowTone = warn
                      ? "bg-[color:var(--warning-bg)] text-[color:var(--warning-text)]"
                      : stripe
                        ? "bg-[color:var(--surface-subtle)]"
                        : "bg-[color:var(--surface)]";
                    return (
                      <tr key={r.key} className={rowTone}>
                        <th
                          scope="row"
                          className={`border-t border-[color:var(--border)] font-semibold ${dense ? "px-4 py-3" : "px-5 py-4"}`}
                        >
                          <span className="flex items-center gap-2.5">
                            <r.icon size={16} strokeWidth={1.7} />
                            {r.label}
                          </span>
                        </th>
                        {items.map((t) => (
                          <td
                            key={t.slug}
                            className={`border-l border-t border-[color:var(--border)] align-top text-sm-minus leading-normal ${dense ? "px-4 py-3" : "px-5 py-4"}`}
                          >
                            {r.get(t)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 mt-4 text-xs text-[color:var(--text-muted)]">
              <Info aria-hidden="true" size={15} strokeWidth={1.8} className="text-[color:var(--decoration-soft)]" />
              Comparisons are source-grounded. Review status reflects the latest source checks.
            </div>
          </Tabs>
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
      <div className="text-3xs font-bold tracking-eyebrow text-[color:var(--text-muted)] mb-1.5">{label}</div>
      <div className="text-sm font-semibold text-[color:var(--text-heading)]">{value}</div>
    </div>
  );
}

function AddPicker() {
  const b = useTcBindings();
  const [q, setQ] = useState("");
  const atLimit = b.compareSlugs.length >= THERAPY_MAX_COMPARE;
  const matches = useMemo(() => {
    if (atLimit || !q.trim()) return [];
    return searchTherapies(b.therapies, { query: q, tags: [], briefOnly: false, sheetOnly: false, reviewedOnly: false })
      .filter((t) => !b.isInCompare(t.slug))
      .slice(0, 6);
  }, [q, b, atLimit]);

  return (
    <div className="relative flex-1 min-w-[260px]">
      <label className="relative flex items-center">
        <Search
          aria-hidden="true"
          size={17}
          strokeWidth={1.8}
          className="absolute left-[14px] text-[color:var(--decoration-soft)]"
        />
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
              className={`${therapyBtn} transition-colors duration-[var(--duration-instant)] hover:bg-[color:var(--surface-subtle)] flex items-center gap-2.5 w-full py-[11px] px-3.5 border-0 border-b border-[color:var(--border)] bg-transparent text-left cursor-pointer`}
              onClick={() => {
                b.addCompare(t.slug);
                setQ("");
              }}
            >
              <Plus aria-hidden="true" size={15} className="text-[color:var(--clinical-accent)] flex-none" />
              <span className="text-sm-minus font-semibold text-[color:var(--text-heading)]">{t.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
