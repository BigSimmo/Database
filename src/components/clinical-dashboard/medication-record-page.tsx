"use client";

import {
  Activity,
  Ban,
  TriangleAlert,
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FlaskConical,
  Gauge,
  Lock,
  Pill,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { BadgeCluster, clinicalBadgeToneClass } from "@/components/clinical-dashboard/clinical-badge";
import { MedicationConsiderations } from "@/components/clinical-dashboard/medication-considerations";
import { PatientProfilePanel } from "@/components/clinical-dashboard/patient-profile-panel";
import { useMedicationDetail } from "@/components/clinical-dashboard/use-medication-catalog";
import {
  medicationAccessBadges,
  medicationAccessFields,
  medicationIdentityBadges,
  medicationRowBadges,
  medicationStatTone,
  type MedicationGovernance,
} from "@/lib/medication-badges";
import { medicationDetailTiles, type MedicationRecord, type MedicationSection } from "@/lib/medications";
import { cn, EmptyState, LoadingPanel, pageContainer, toneDanger } from "@/components/ui-primitives";

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

// Icon + categorical chip per detail tile (index-aligned with medicationDetailTiles:
// Prescribing answer / Dosing / Dose ceiling / Avoid). The danger tile is toned
// separately below.
const detailTileDecor: Array<{ icon: LucideIcon; chip: string }> = [
  {
    icon: Sparkles,
    chip: "border-[color:var(--type-source-border)] bg-[color:var(--type-source-soft)] text-[color:var(--type-source)]",
  },
  {
    icon: CalendarDays,
    chip: "border-[color:var(--type-document-border)] bg-[color:var(--type-document-soft)] text-[color:var(--type-document)]",
  },
  {
    icon: Gauge,
    chip: "border-[color:var(--type-service-border)] bg-[color:var(--type-service-soft)] text-[color:var(--type-service)]",
  },
  { icon: Ban, chip: "border-[color:var(--danger)]/25 bg-[color:var(--danger-soft)] text-[color:var(--danger)]" },
];

function DetailTile({
  label,
  value,
  meta,
  danger = false,
  icon: Icon,
  chip,
}: {
  label: string;
  value: string;
  meta?: string;
  danger?: boolean;
  icon: LucideIcon;
  chip: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 shadow-[var(--shadow-inset)]",
        danger ? toneDanger : "border-[color:var(--border)] bg-[color:var(--surface-raised)]",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-md border",
            danger ? "border-[color:var(--danger)]/25 bg-[color:var(--surface)] text-[color:var(--danger)]" : chip,
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <p
          className={cn(
            "text-2xs font-semibold uppercase tracking-[0.08em]",
            danger ? "text-[color:var(--danger)]" : "text-[color:var(--text-muted)]",
          )}
        >
          {label}
        </p>
      </div>
      <p
        className={cn(
          "mt-1.5 text-sm-minus font-semibold leading-5",
          danger ? "text-[color:var(--danger-text)]" : "text-[color:var(--text-heading)]",
        )}
      >
        {value}
      </p>
      {meta ? (
        <p
          className={cn(
            "mt-0.5 text-2xs font-semibold uppercase tracking-[0.06em]",
            danger ? "text-[color:var(--danger-text)]" : "text-[color:var(--text-muted)]",
          )}
        >
          {meta}
        </p>
      ) : null}
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
  const tiles = useMemo(() => medicationDetailTiles(record), [record]);
  const badges = useMemo(() => medicationIdentityBadges(record, governance), [record, governance]);
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
    <div className={cn(pageContainer, "space-y-3 py-1 sm:py-2")} style={medicationAccentStyle(record.accent)}>
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
                <BadgeCluster items={badges} limit={5} showOverflowCount className="mt-2" />
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
            {tiles.map((tile, index) => {
              const decor = detailTileDecor[index] ?? detailTileDecor[detailTileDecor.length - 1];
              return (
                <DetailTile
                  key={tile.label}
                  label={tile.label}
                  value={tile.value}
                  meta={tile.meta}
                  danger={tile.danger}
                  icon={tile.danger ? Ban : decor.icon}
                  chip={decor.chip}
                />
              );
            })}
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
                <div key={row.label} className="px-3 py-2.5">
                  <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                    {row.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--text-heading)]">
                    {row.value.replace(/\*\*/g, "")}
                  </p>
                </div>
              ))}
            </div>
          </SidebarCard>

          <MedicationAccessPanel record={record} />

          {record.stats.length ? (
            <SidebarCard title="Key stats" icon={Gauge}>
              <div className="grid grid-cols-2 gap-2 p-3">
                {record.stats.map((stat) => {
                  const tone = medicationStatTone(stat);
                  return (
                    <div
                      key={stat.label}
                      className={cn(
                        "rounded-md border bg-[color:var(--surface-subtle)] p-2",
                        clinicalBadgeToneClass(tone),
                      )}
                    >
                      <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                        {stat.label}
                      </p>
                      <p className="mt-1 text-sm-minus font-semibold">{stat.value}</p>
                    </div>
                  );
                })}
              </div>
            </SidebarCard>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

export function MedicationRecordPage({ slug }: { slug: string }) {
  const { data, loading, error } = useMedicationDetail(slug);

  return (
    <main className="min-h-[calc(100dvh-4rem)] text-[color:var(--text)]" data-testid={`medication-page-${slug}`}>
      <div className="mx-auto max-w-7xl px-3 pt-3 sm:px-6 lg:px-8">
        <Link
          href={`/?mode=prescribing&q=${encodeURIComponent(slug)}`}
          className="inline-flex min-h-tap w-fit items-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-semibold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent)] hover:bg-[color:var(--surface-raised)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Back to medication search</span>
          <span className="sm:hidden">Back</span>
        </Link>
      </div>
      <div className="px-3 py-3 sm:px-6 lg:px-8">
        {loading ? (
          <div className="mx-auto max-w-7xl">
            <LoadingPanel label="Loading medication reference…" variant="skeleton" lines={6} />
          </div>
        ) : error || !data?.record ? (
          <div className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] p-4 text-sm text-[color:var(--danger-text)]">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{error ?? "Medication not found."}</p>
            </div>
          </div>
        ) : (
          <MedicationRecordDetail record={data.record} governance={data.governance} />
        )}
      </div>
      <footer className="mx-auto max-w-7xl px-4 pb-4 text-center text-2xs font-medium text-[color:var(--text-muted)]">
        Clinical KB provides evidence summaries, not medical advice. Verify clinical decisions.
      </footer>
    </main>
  );
}
