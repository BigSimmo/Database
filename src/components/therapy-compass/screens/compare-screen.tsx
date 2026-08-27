"use client";

import { useMemo } from "react";
import {
  Check,
  CirclePlay,
  Clock,
  Copy,
  Info,
  Scale,
  Shield,
  Target,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { cardSurface } from "@/components/card-recipes";
import { PageHeader } from "@/components/ui/page-header";
import { cn, pageContainer } from "@/components/ui-primitives";
import { CompareIdsChrome, type CompareCatalogItem, type CompareStarterChip } from "@/components/compare";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tabs } from "@/components/ui/tabs";
import { THERAPY_MAX_COMPARE, therapyScreenHref } from "@/lib/therapy-compass-navigation";

import { useTcBindings } from "../bindings";
import { needsReviewCount, parseSteps, shortestDelivery, summarise } from "../data/select";
import type { Therapy } from "../data/types";
import { useClipboard } from "../use-clipboard";

const CBT_SLUG = "cognitive-behavioural-therapy-cbt";
const ACT_SLUG = "acceptance-and-commitment-therapy-act";

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
  const catalogItems: CompareCatalogItem[] = useMemo(
    () =>
      b.therapies.map((therapy) => ({
        id: therapy.slug,
        title: therapy.name,
        snippet: therapy.clinicalSummary ?? undefined,
        tag: therapy.category,
      })),
    [b.therapies],
  );
  const starterChips: CompareStarterChip[] = [
    {
      id: "cbt-act",
      label: "CBT vs ACT",
      href: b.workspaceHref(therapyScreenHref("compare"), { compareSlugs: [CBT_SLUG, ACT_SLUG] }),
    },
  ];

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
      <PageHeader
        className="mb-1.5"
        title="Therapy Comparison"
        description="Compare fit, cautions, delivery and evidence without losing source context."
        // The selection count moves from beside the title to `meta`, the slot
        // documented for exactly this. It was baseline-aligned with the `<h1>`,
        // which is not something `PageHeader` offers — and should not, since a
        // count that grows cannot share a line with a title that wraps.
        meta={
          <span className="text-sm-minus font-semibold text-[color:var(--clinical-accent-hover)] bg-[color:var(--clinical-accent-soft)] py-0.5 px-2.5 rounded-md">
            {items.length} of {THERAPY_MAX_COMPARE} selected
          </span>
        }
        actions={
          items.length >= 2 ? (
            <>
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
            </>
          ) : (
            <Button variant="secondary" onClick={b.clearCompare} disabled={items.length === 0}>
              Clear
            </Button>
          )
        }
      />

      <CompareIdsChrome
        selectedIds={b.compareSlugs}
        maxCount={THERAPY_MAX_COMPARE}
        items={catalogItems}
        starters={starterChips}
        emptyTitle="Add therapies to compare"
        emptyDescription="Search the therapy catalogue, or start from CBT vs ACT. You can still add from search results or a therapy record."
        actionLabel="Add therapies"
        searchPlaceholder="Search therapy"
        pickerTitle="Add therapies to compare"
        pickerDescription="Assign up to four therapies. Duplicates are blocked."
        pickerId="therapy-compare-picker"
        pickerTestId="therapy-compare-picker"
        changeLabel="Change therapies"
        slotPlaceholder="Choose therapy"
        icon={Scale}
        phoneLayout="hybrid"
        slotSummaryLabel={`Up to ${THERAPY_MAX_COMPARE} therapies`}
        onCommit={(ids) => b.replaceCompareSlugs(ids.filter((id): id is string => Boolean(id)))}
      />

      {items.length < 2 ? null : (
        <>
          {/* decision summary */}
          <div className={cn(cardSurface, "grid grid-cols-1 sm:grid-cols-[1.1fr_1fr_1fr] overflow-hidden mb-5")}>
            <div className="py-5 px-5.5">
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
            {/* Phones read the same rows stacked; see TherapyCompareStack below. */}
            <div
              data-testid="therapy-compare-table"
              role="region"
              aria-label="Therapy comparison table"
              tabIndex={0}
              className="hidden overflow-x-auto rounded-xs border border-[color:var(--border)] shadow-[var(--e2)] md:block"
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
                        <div className="flex items-center gap-2">
                          <Scale aria-hidden="true" className="size-icon-sm text-[color:var(--decoration-soft)]" />
                          <span className="text-sm-minus font-semibold text-[color:var(--text-heading)]">{t.name}</span>
                        </div>
                        <div
                          className={
                            t.reviewStatus === "reviewed"
                              ? "mt-0.5 text-2xs font-semibold text-[color:var(--success-text)]"
                              : "mt-0.5 text-2xs font-semibold text-[color:var(--warning-text)]"
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
                            <r.icon strokeWidth={1.7} className="size-icon-md" />
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
            <TherapyCompareStack items={items} rows={rows} dense={dense} />
            <div className="flex items-center gap-2 mt-4 text-xs text-[color:var(--text-muted)]">
              <Info aria-hidden="true" strokeWidth={1.8} className="size-icon-sm text-[color:var(--decoration-soft)]" />
              Comparisons are source-grounded. Review status reflects the latest source checks.
            </div>
          </Tabs>
        </>
      )}
    </section>
  );
}

/**
 * The phone comparison.
 *
 * The table above is `min-w-[720px]` inside a horizontal scroller, which on a
 * 390px phone shows about two thirds of one column at a time and — worse —
 * scrolls the field labels away from the values they label. Below `md` the same
 * `rows` are turned inside out instead: one card per field, every therapy listed
 * against it, so the label never leaves the value and nothing scrolls sideways.
 *
 * The fork is `md` (768px), not `sm` (640px): at 640–767px the 720px table would
 * still scroll sideways, which is the exact defect being fixed.
 *
 * One `rows` memo, two presentations — deliberately in this file rather than
 * extracted, because moving the table out has twice silently dropped the
 * responsive-stack count that `tests/therapy-compass-responsive-contract.test.ts`
 * measures.
 */
function TherapyCompareStack({
  items,
  rows,
  dense,
}: {
  items: readonly Therapy[];
  rows: readonly Row[];
  dense: boolean;
}) {
  return (
    <div data-testid="therapy-compare-stack" className="flex flex-col gap-2.5 md:hidden">
      {rows.map((r) => {
        const warn = r.tone === "warning";
        return (
          <section
            key={r.key}
            aria-label={r.label}
            className={cn(
              "rounded-xs border",
              dense ? "p-3" : "p-4",
              warn
                ? "border-[color:var(--border-strong)] bg-[color:var(--warning-bg)]"
                : "border-[color:var(--border)] bg-[color:var(--surface)]",
            )}
          >
            <h3
              className={cn(
                "m-0 flex items-center gap-2 text-2xs font-bold tracking-eyebrow uppercase",
                warn ? "text-[color:var(--warning-text)]" : "text-[color:var(--text-muted)]",
              )}
            >
              <r.icon aria-hidden="true" strokeWidth={1.8} className="size-icon-sm" />
              {r.label}
            </h3>
            <dl className={cn("m-0 grid gap-x-3", dense ? "mt-2 gap-y-1.5" : "mt-2.5 gap-y-2")}>
              {items.map((t) => (
                <div key={t.slug} className="grid grid-cols-1 gap-0.5">
                  <dt className="text-2xs font-bold text-[color:var(--text-heading)]">{t.name}</dt>
                  <dd
                    className={cn(
                      "m-0 text-sm-minus leading-normal",
                      warn ? "text-[color:var(--warning-text)]" : "text-[color:var(--text)]",
                    )}
                  >
                    {r.get(t)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
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
      className={`border-l border-[color:var(--border)] px-5.5 py-5${accent ? " border-l-[3px] border-l-[color:var(--clinical-accent)]" : warn ? " bg-[color:var(--warning-bg)] text-[color:var(--warning-text)]" : ""}`}
    >
      <div className="text-3xs font-bold tracking-eyebrow text-[color:var(--text-muted)] mb-1.5">{label}</div>
      <div className="text-sm font-semibold text-[color:var(--text-heading)]">{value}</div>
    </div>
  );
}
