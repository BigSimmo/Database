"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { MAX_COMPARE, useTcBindings } from "../bindings";
import { commandControl, outlineControl } from "../controls";
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
    <section data-screen-label="Compare" className="tc-screens-compare-screen-001">
      <div className="tc-screens-compare-screen-002">
        <div>
          <div className="tc-screens-compare-screen-003">
            <h1 className="tc-screens-compare-screen-004">Therapy Comparison</h1>
            <span className="tc-screens-compare-screen-005">{items.length} of 4 selected</span>
          </div>
          <p className="tc-screens-compare-screen-006">
            Compare fit, cautions, delivery and evidence without losing source context.
          </p>
        </div>
        <div className="tc-screens-compare-screen-007">
          <div className="tc-screens-compare-screen-008">
            <button
              type="button"
              className={`tc-btn ${b.segComfortable}`}
              onClick={b.setComfortable}
              aria-pressed={b.density === "comfortable"}
            >
              Comfortable
            </button>
            <button
              type="button"
              className={`tc-btn ${b.segDense}`}
              onClick={b.setDense}
              aria-pressed={b.density === "dense"}
            >
              Dense
            </button>
          </div>
          <button type="button" className={`tc-btn ${outlineControl}`} onClick={copySet} disabled={items.length < 2}>
            {copied === "set" ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            {copied === "set" ? "Copied" : "Copy set"}
          </button>
          <button
            type="button"
            className={`tc-btn ${outlineControl}`}
            onClick={b.clearCompare}
            disabled={items.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="tc-screens-compare-screen-009">
        <AddPicker />
        {items.map((t) => (
          <span key={t.slug} className="tc-screens-compare-screen-010">
            <ScaleIcon size={15} className="tc-screens-compare-screen-011" />
            <span className="tc-screens-compare-screen-012">{t.name}</span>
            <button
              type="button"
              className="tc-btn tc-screens-compare-screen-013"
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
            <button type="button" className={`tc-btn ${commandControl}`} onClick={b.goSearch}>
              <SearchIcon size={16} strokeWidth={1.9} />
              Find therapies to compare
            </button>
          }
        />
      ) : (
        <>
          {/* decision summary */}
          <div className="tc-mobile-stack tc-screens-compare-screen-014">
            <div className="tc-screens-compare-screen-015">
              <div className="tc-screens-compare-screen-016">Decision summary</div>
            </div>
            <SummaryCell label="SHORTEST DELIVERY" value={shortestDelivery(items)?.name ?? "—"} accent />
            <SummaryCell
              label="SOURCE STATUS"
              value={`${needsReviewCount(items)} of ${items.length} need review`}
              warn
            />
          </div>

          {/* tabs */}
          <div className="tc-compare-tabs tc-screens-compare-screen-017" role="group" aria-label="Comparison fields">
            <button
              type="button"
              className={`tc-btn ${b.tabPriorities}`}
              onClick={b.setTabPriorities}
              aria-pressed={b.cmpTab === "priorities"}
            >
              Priorities
            </button>
            <button
              type="button"
              className={`tc-btn ${b.tabDifferences}`}
              onClick={b.setTabDifferences}
              aria-pressed={b.cmpTab === "differences"}
            >
              Differences
            </button>
            <button
              type="button"
              className={`tc-btn ${b.tabAll}`}
              onClick={b.setTabAll}
              aria-pressed={b.cmpTab === "all"}
            >
              All fields
            </button>
          </div>

          {/* table */}
          <div
            className="tc-compare-table tc-scroll-sm tc-screens-compare-screen-018"
            style={{ "--tc-compare-columns": cols, "--tc-compare-cell-padding": cellPad } as CSSProperties}
          >
            <div className="tc-compare-grid tc-compare-header">
              <div className="tc-screens-compare-screen-019">Field</div>
              {items.map((t) => (
                <div key={t.slug} className="tc-screens-compare-screen-020">
                  <div className="tc-screens-compare-screen-021">
                    <ScaleIcon size={15} className="tc-screens-compare-screen-022" />
                    <span className="tc-screens-compare-screen-023">{t.name}</span>
                  </div>
                  <div className={t.reviewStatus === "reviewed" ? "tc-compare-reviewed" : "tc-compare-review-needed"}>
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
                  className={`tc-compare-grid tc-compare-row${warn ? " tc-is-warning" : stripe ? " tc-is-striped" : ""}`}
                >
                  <div className="tc-compare-row-label">
                    <r.icon size={16} strokeWidth={1.7} />
                    {r.label}
                  </div>
                  {items.map((t) => (
                    <div key={t.slug} className="tc-compare-cell">
                      {r.get(t)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="tc-screens-compare-screen-024">
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
    <div className={`tc-summary-cell${accent ? " tc-is-accent" : warn ? " tc-is-warning" : ""}`}>
      <div className="tc-screens-compare-screen-025">{label}</div>
      <div className="tc-summary-cell-value">{value}</div>
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
    <div className="tc-screens-compare-screen-026">
      <label className="tc-screens-compare-screen-027">
        <SearchIcon size={17} strokeWidth={1.8} className="tc-screens-compare-screen-028" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={atLimit}
          placeholder={
            atLimit ? "Maximum of 4 selected — remove one to add another" : "Add a therapy to the comparison…"
          }
          aria-label="Add a therapy to compare"
          className="tc-compare-add-input"
        />
      </label>
      {matches.length ? (
        <div className="tc-screens-compare-screen-029">
          {matches.map((t) => (
            <button
              key={t.slug}
              type="button"
              className="tc-btn tc-row tc-screens-compare-screen-030"
              onClick={() => {
                b.addCompare(t.slug);
                setQ("");
              }}
            >
              <PlusIcon size={15} className="tc-screens-compare-screen-031" />
              <span className="tc-screens-compare-screen-032">{t.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
