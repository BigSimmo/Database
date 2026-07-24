"use client";

import {
  Activity,
  Ban,
  TriangleAlert,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FlaskConical,
  Gauge,
  Lock,
  Pill,
  ShieldAlert,
  ShieldCheck,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { BadgeCluster } from "@/components/clinical-dashboard/clinical-badge";
import { MedicationConsiderations } from "@/components/clinical-dashboard/medication-considerations";
import { PatientProfilePanel } from "@/components/clinical-dashboard/patient-profile-panel";
import { useMedicationDetail } from "@/components/clinical-dashboard/use-medication-catalog";
import {
  medicationAccessBadges,
  medicationAccessFields,
  medicationIdentityBadges,
  medicationRowBadges,
  type MedicationGovernance,
} from "@/lib/medication-badges";
import {
  medicationHeroMetrics,
  medicationIndication,
  type MedicationHeroMetric,
  type MedicationQuickRow,
  type MedicationRecord,
  type MedicationSection,
} from "@/lib/medications";
import type { SemanticTone } from "@/lib/semantic-tone";
import {
  cn,
  EmptyState,
  LoadingPanel,
  toneDanger,
  toneInfo,
  toneSuccess,
  toneWarning,
} from "@/components/ui-primitives";
import {
  InformationPageBreadcrumbs,
  InformationPageFooter,
  InformationPageShell,
} from "@/components/information-page-shell";
import { appModeHomeHref } from "@/lib/app-modes";

const sectionIcons: Record<string, LucideIcon> = {
  dose: CalendarDays,
  risk: TriangleAlert,
  contra: Ban,
  safe: ShieldCheck,
  mon: Activity,
  inter: FlaskConical,
  src: BadgeCheck,
};

// Per-section toned icon tiles. Semantic tones stay reserved (red = contra/safety,
// amber = risk/caution, green = safe/verified); other sections use the neutral
// categorical --type-* hues so the list reads with colour without misusing meaning.
const sectionToneClass: Record<string, string> = {
  contra: "border-[color:var(--danger)]/25 bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  risk: "border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
  safe: "border-[color:var(--success)]/25 bg-[color:var(--success-soft)] text-[color:var(--success)]",
  src: "border-[color:var(--success)]/25 bg-[color:var(--success-soft)] text-[color:var(--success)]",
  mon: "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]",
  dose: "border-[color:var(--type-document-border)] bg-[color:var(--type-document-soft)] text-[color:var(--type-document)]",
  inter: "border-[color:var(--type-source-border)] bg-[color:var(--type-source-soft)] text-[color:var(--type-source)]",
};
const defaultSectionTone =
  "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";

// Decorative per-medication identity accent (record.accent is keyed to drug
// class). Exposed as CSS custom properties and softened with color-mix so it
// drives washes/rails only — never text — keeping contrast safe in light + dark
// and staying within the colour contract (semantic colour uses the tokens).
function medicationAccentStyle(accent: string | undefined): CSSProperties {
  const base = accent?.trim() || "var(--clinical-accent)";
  return {
    "--med-accent": base,
    "--med-accent-soft": `color-mix(in srgb, ${base} 12%, var(--surface))`,
    "--med-accent-border": `color-mix(in srgb, ${base} 34%, var(--surface))`,
  } as CSSProperties;
}

// Tone-driven hero metric tile. Colour comes only from the metric's semantic tone
// (medicationStatTone, via medicationHeroMetrics) so it honours the #659 contract:
// green = success, amber = caution, red = safety, teal = primary/evidence. The
// value stays in a high-contrast heading colour on every tone so text never sits
// on a same-hue wash (the readability lesson from #659) — the border, soft fill,
// label and icon chip carry the colour.
const heroToneTile: Record<SemanticTone, { card: string; chip: string; label: string; value: string }> = {
  clinical: {
    card: "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]",
    chip: "border-[color:var(--clinical-accent)]/25 bg-[color:var(--surface)] text-[color:var(--clinical-accent)]",
    label: "text-[color:var(--clinical-accent)]",
    value: "text-[color:var(--text-heading)]",
  },
  danger: {
    card: toneDanger,
    chip: "border-[color:var(--danger)]/25 bg-[color:var(--surface)] text-[color:var(--danger)]",
    label: "text-[color:var(--danger)]",
    value: "text-[color:var(--danger-text)]",
  },
  warning: {
    card: toneWarning,
    chip: "border-[color:var(--warning)]/25 bg-[color:var(--surface)] text-[color:var(--warning)]",
    label: "text-[color:var(--warning)]",
    value: "text-[color:var(--text-heading)]",
  },
  success: {
    card: toneSuccess,
    chip: "border-[color:var(--success)]/25 bg-[color:var(--surface)] text-[color:var(--success)]",
    label: "text-[color:var(--success)]",
    value: "text-[color:var(--text-heading)]",
  },
  info: {
    card: toneInfo,
    chip: "border-[color:var(--info-border)] bg-[color:var(--surface)] text-[color:var(--info)]",
    label: "text-[color:var(--info)]",
    value: "text-[color:var(--text-heading)]",
  },
  neutral: {
    card: "border-[color:var(--border)] bg-[color:var(--surface-raised)]",
    chip: "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
    label: "text-[color:var(--text-muted)]",
    value: "text-[color:var(--text-heading)]",
  },
};

// Icon keyed to the metric's meaning: a gauge for the dose ceiling, a timer for
// time-based metrics (half-life / onset / duration), and a tone-appropriate shield
// or alert for everything else (risk & caution flags). Rendered directly (rather
// than assigning the component to a local) so it stays a static component.
function HeroMetricIcon({ metric }: { metric: MedicationHeroMetric }) {
  const label = metric.label.toLowerCase();
  const iconClass = "h-3.5 w-3.5";
  if (/dose|ceiling|\bmax\b/.test(label)) return <Gauge className={iconClass} aria-hidden="true" />;
  if (/half-life|onset|duration|timing|freq/.test(label)) return <Timer className={iconClass} aria-hidden="true" />;
  if (metric.tone === "danger") return <ShieldAlert className={iconClass} aria-hidden="true" />;
  if (metric.tone === "warning") return <TriangleAlert className={iconClass} aria-hidden="true" />;
  if (metric.tone === "success") return <ShieldCheck className={iconClass} aria-hidden="true" />;
  return <Activity className={iconClass} aria-hidden="true" />;
}

function DetailTile({ metric }: { metric: MedicationHeroMetric }) {
  const tone = heroToneTile[metric.tone];
  return (
    <div className={cn("rounded-lg border p-3 shadow-[var(--shadow-inset)]", tone.card)}>
      <div className="flex items-center gap-2">
        <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md border", tone.chip)}>
          <HeroMetricIcon metric={metric} />
        </span>
        <p className={cn("text-2xs font-semibold uppercase leading-tight tracking-[0.08em]", tone.label)}>
          {metric.label}
        </p>
      </div>
      <p className={cn("mt-1.5 text-sm-minus font-semibold leading-5", tone.value)}>{metric.value}</p>
    </div>
  );
}

const detailTabs = [
  ["summary", "Summary"],
  ["dosing", "Dosing"],
  ["safety", "Safety"],
  ["more", "More"],
] as const;
type MedicationTabId = (typeof detailTabs)[number][0];

function SectionTabs({ active, onChange }: { active: MedicationTabId; onChange: (id: MedicationTabId) => void }) {
  const tabRefs = useRef(new Map<MedicationTabId, HTMLButtonElement>());

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    const order = detailTabs.map((tab) => tab[0]);
    const index = order.indexOf(active);
    const next =
      event.key === "ArrowRight"
        ? order[(index + 1) % order.length]
        : event.key === "ArrowLeft"
          ? order[(index - 1 + order.length) % order.length]
          : event.key === "Home"
            ? order[0]
            : event.key === "End"
              ? order[order.length - 1]
              : null;
    if (!next) return;
    event.preventDefault();
    if (next !== active) onChange(next);
    tabRefs.current.get(next)?.focus();
  }

  return (
    <nav
      role="tablist"
      aria-label="Medication sections"
      onKeyDown={handleKeyDown}
      className="flex gap-1 border-b border-[color:var(--border)] text-sm font-semibold text-[color:var(--text-muted)]"
    >
      {detailTabs.map(([id, label]) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            ref={(element) => {
              if (element) tabRefs.current.set(id, element);
              else tabRefs.current.delete(id);
            }}
            type="button"
            role="tab"
            id={`medication-tab-${id}`}
            aria-selected={isActive}
            aria-controls={`medication-panel-${id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(id)}
            className={cn(
              "min-h-tap flex-1 whitespace-nowrap border-b-2 px-1 pb-2.5 pt-1.5 text-center text-2xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:flex-none sm:px-4 sm:text-sm",
              isActive
                ? "border-[color:var(--clinical-accent)] text-[color:var(--clinical-accent)]"
                : "border-transparent hover:text-[color:var(--text-heading)]",
            )}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function SectionCard({ section }: { section: MedicationSection }) {
  const Icon = sectionIcons[section.type] || ClipboardList;
  const toneClass = sectionToneClass[section.type] || defaultSectionTone;

  return (
    <details
      className="group scroll-mt-16 border-b border-[color:var(--border)] last:border-b-0"
      open={section.type === "summary" || section.type === "dose"}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 text-left [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg border", toneClass)}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="truncate text-sm-minus font-semibold text-[color:var(--text-heading)]">{section.title}</span>
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-[color:var(--text-soft)] transition group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-2 px-3 pb-3">
        {section.rows.map((row) => {
          const rowBadges = medicationRowBadges(row, section.type);
          return (
            <div
              key={`${section.title}-${row.key}`}
              className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5"
            >
              <p className="text-xs font-semibold text-[color:var(--text-heading)]">{row.key}</p>
              <BadgeCluster items={rowBadges} compact limit={section.type === "contra" ? 4 : 3} className="mt-2" />
              <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[color:var(--text-muted)]">
                {row.val.replace(/\*\*/g, "")}
              </p>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function SidebarCard({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)]">
      <div className="flex items-center gap-2 border-b border-[color:var(--border)] px-3 py-2">
        <Icon className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
        <h4 className="text-sm-minus font-semibold text-[color:var(--text-heading)]">{title}</h4>
      </div>
      {children}
    </section>
  );
}

// Quick-reference values are the verbose ones (≈164 chars median, up to ~560) and
// would otherwise make the fixed-width sidebar run very tall. Long values collapse
// to two lines with a chevron affordance and expand in place on tap — the same
// clamp-on-collapse pattern the differential sections use (line-clamp-2 +
// group-open:line-clamp-none inside a <details>) — so nothing is removed, just
// tucked one tap away. Short values render as a plain row with no toggle.
function QuickRefRow({ row }: { row: MedicationQuickRow }) {
  const value = row.value.replace(/\*\*/g, "");
  const label = (
    <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">{row.label}</p>
  );

  if (value.length <= 110) {
    return (
      <div className="px-3 py-2.5">
        {label}
        <p className="mt-1 text-xs leading-5 text-[color:var(--text-heading)]">{value}</p>
      </div>
    );
  }

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-col px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          {label}
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)] transition group-open:rotate-180"
            aria-hidden="true"
          />
        </span>
        <span className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--text-heading)] group-open:line-clamp-none">
          {value}
        </span>
      </summary>
    </details>
  );
}

function MedicationAccessPanel({ record }: { record: MedicationRecord }) {
  const badges = useMemo(() => medicationAccessBadges(record), [record]);
  const fields = useMemo(() => medicationAccessFields(record), [record]);
  if (!badges.length && !fields.length) return null;

  return (
    <SidebarCard title="Access" icon={Lock}>
      <div className="p-3">
        <BadgeCluster items={badges} compact limit={3} className="mb-2.5" />
        {fields.length ? (
          <dl className="grid gap-2 text-sm-minus">
            {fields.map((field, index) => (
              <div
                key={field.label}
                className={cn(
                  "flex justify-between gap-3",
                  index < fields.length - 1 && "border-b border-[color:var(--border)] pb-2",
                )}
              >
                <dt className="font-semibold text-[color:var(--text-muted)]">{field.label}</dt>
                <dd className="text-right font-medium text-[color:var(--text-heading)]">{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </SidebarCard>
  );
}

function MedicationRecordDetail({
  record,
  governance,
}: {
  record: MedicationRecord;
  governance?: MedicationGovernance;
}) {
  const metrics = useMemo(() => medicationHeroMetrics(record), [record]);
  const badges = useMemo(() => medicationIdentityBadges(record, governance), [record, governance]);
  const indication = useMemo(() => medicationIndication(record), [record]);
  const [activeTab, setActiveTab] = useState<MedicationTabId>("summary");

  const sectionsByTab = useMemo(() => {
    const summaryTypes = new Set(["summary", "ind", "form"]);
    const dosingTypes = new Set(["dose"]);
    const safetyTypes = new Set(["risk", "contra", "mon", "safe"]);
    const moreTypes = new Set(["inter", "pearl", "evid", "spec", "comp", "sel", "src"]);
    return {
      summary: record.sections.filter((section) => summaryTypes.has(section.type)),
      dosing: record.sections.filter((section) => dosingTypes.has(section.type)),
      safety: record.sections.filter((section) => safetyTypes.has(section.type)),
      more: record.sections.filter((section) => moreTypes.has(section.type)),
    };
  }, [record.sections]);

  const activeSections = sectionsByTab[activeTab];

  return (
    <div className="space-y-3 py-1 sm:py-2" style={medicationAccentStyle(record.accent)}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-3.5">
          <section className="scroll-mt-16 overflow-hidden rounded-xl border border-[color:var(--border)] border-l-4 border-l-[color:var(--med-accent)] bg-[color:var(--surface-raised)] p-3.5 shadow-[var(--shadow-soft)] sm:p-5">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[color:var(--med-accent-border)] bg-[color:var(--surface)] text-[color:var(--med-accent)] shadow-[var(--shadow-inset)] sm:h-14 sm:w-14">
                <Pill className="h-[52%] w-[52%]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-semibold leading-tight tracking-normal text-[color:var(--text-heading)] sm:text-3xl">
                  {record.name}
                </h1>
                <p className="mt-1 text-sm-minus font-medium leading-5 text-[color:var(--text-muted)] sm:text-sm">
                  <span
                    className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[color:var(--med-accent)] align-middle"
                    aria-hidden="true"
                  />
                  {record.subclass || record.class}
                  {record.category ? (
                    <>
                      <span className="mx-1.5 text-[color:var(--text-soft)]">·</span>
                      {record.category}
                    </>
                  ) : null}
                </p>
                {indication ? (
                  <p className="mt-1 line-clamp-1 text-sm-minus leading-5 text-[color:var(--text-muted)]">
                    {indication}
                  </p>
                ) : null}
                <BadgeCluster items={badges} limit={5} showOverflowCount className="mt-2" />
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
            {metrics.map((metric, index) => (
              // Some records repeat a stat label (e.g. adrenaline has two "Route"
              // stats), so the label alone is not a unique key — include the index.
              <DetailTile key={`${metric.label}-${index}`} metric={metric} />
            ))}
          </section>

          <section className="space-y-2.5">
            <PatientProfilePanel defaultOpen={false} />
            <MedicationConsiderations record={record} />
          </section>

          <SectionTabs active={activeTab} onChange={setActiveTab} />

          <section
            role="tabpanel"
            id={`medication-panel-${activeTab}`}
            aria-labelledby={`medication-tab-${activeTab}`}
            className="overflow-hidden rounded-lg border border-[color:var(--border)] border-l-[3px] border-l-[color:var(--med-accent)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-soft)]"
          >
            {activeSections.length ? (
              activeSections.map((section) => (
                <SectionCard key={`${section.type}-${section.title}`} section={section} />
              ))
            ) : (
              <div className="p-3">
                <EmptyState
                  icon={ClipboardList}
                  title="Nothing in this view"
                  body="Switch tabs to see dosing, safety, or more detail for this medication."
                />
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <SidebarCard title="Quick reference" icon={BookOpen}>
            <div className="divide-y divide-[color:var(--border)]">
              {record.quick.map((row) => (
                <QuickRefRow key={row.label} row={row} />
              ))}
            </div>
          </SidebarCard>

          <MedicationAccessPanel record={record} />
        </aside>
      </div>
    </div>
  );
}

export function MedicationRecordPage({
  slug,
  fallbackRecord,
  fallbackGovernance,
}: {
  slug: string;
  fallbackRecord?: MedicationRecord;
  fallbackGovernance?: MedicationGovernance;
}) {
  const { data, loading, error } = useMedicationDetail(slug);
  // Content-first: render the SSR fallback immediately, then swap in the live
  // (owner-aware) record once the hook resolves. Only fall back to the skeleton
  // when there is no server record to show (owner-only slugs) and the fetch is
  // still in flight; the error state applies only when nothing renderable exists.
  const record = data?.record ?? fallbackRecord ?? null;
  // Only trust the SSR fallback governance while the live fetch is still in
  // flight. A failed request means the authoritative status is unknown, so
  // don't keep presenting the fixture-derived guess as if it were confirmed.
  const governance = data?.governance ?? (error ? undefined : fallbackGovernance);

  return (
    <InformationPageShell testId={`medication-page-${slug}`} gap={false}>
      <InformationPageBreadcrumbs
        home={{
          label: "Medications",
          href: appModeHomeHref("prescribing", { query: slug, focus: true }),
        }}
        current={record?.name ?? slug}
      />
      <div className="mt-3">
        {record ? (
          <MedicationRecordDetail record={record} governance={governance} />
        ) : loading ? (
          <LoadingPanel label="Loading medication reference…" variant="skeleton" lines={6} />
        ) : (
          <div className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] p-4 text-sm text-[color:var(--danger-text)]">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{error ?? "Medication not found."}</p>
            </div>
          </div>
        )}
      </div>
      <InformationPageFooter className="mt-4 pb-1">
        Clinical KB provides evidence summaries, not medical advice. Verify clinical decisions.
      </InformationPageFooter>
    </InformationPageShell>
  );
}
