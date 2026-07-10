"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FlaskConical,
  Lock,
  Pill,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { BadgeCluster, clinicalBadgeToneClass } from "@/components/clinical-dashboard/clinical-badge";
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
import { cn } from "@/components/ui-primitives";

const sectionIcons: Record<string, LucideIcon> = {
  dose: CalendarDays,
  risk: ShieldCheck,
  contra: ShieldCheck,
  safe: ShieldCheck,
  mon: Activity,
  inter: FlaskConical,
  src: BadgeCheck,
};

function DetailTile({
  label,
  value,
  meta,
  danger = false,
}: {
  label: string;
  value: string;
  meta?: string;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)]",
        danger ? "border-[color:var(--danger-border)]/60" : "border-[color:var(--border)]",
      )}
    >
      <p className="text-3xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">{label}</p>
      <p
        className={cn(
          "mt-1 text-sm-minus font-semibold leading-5",
          danger ? "text-[color:var(--danger-text)]" : "text-[color:var(--text-heading)]",
        )}
      >
        {value}
      </p>
      {meta ? (
        <p className="mt-0.5 text-3xs font-semibold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
          {meta}
        </p>
      ) : null}
    </div>
  );
}

function SectionCard({ section }: { section: MedicationSection }) {
  const Icon = sectionIcons[section.type] || ClipboardList;

  return (
    <details
      className="group scroll-mt-16 border-b border-[color:var(--border)] last:border-b-0"
      open={section.type === "summary" || section.type === "dose"}
    >
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 text-left text-sm-minus font-semibold text-[color:var(--text-heading)] [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden="true" />
          <span className="truncate">{section.title}</span>
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

function MedicationAccessPanel({ record }: { record: MedicationRecord }) {
  const badges = useMemo(() => medicationAccessBadges(record), [record]);
  const fields = useMemo(() => medicationAccessFields(record), [record]);
  if (!badges.length && !fields.length) return null;

  return (
    <section className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)]">
      <div className="mb-0 flex items-center gap-2 border-b border-[color:var(--border)] px-3 py-2">
        <Lock className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
        <h4 className="text-sm-minus font-semibold text-[color:var(--text-heading)]">Access</h4>
      </div>
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
    </section>
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
  const [activeTab, setActiveTab] = useState<"summary" | "dosing" | "safety" | "more">("summary");

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
    <div className="mx-auto w-full max-w-7xl space-y-3 py-1 sm:py-2">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-3.5">
          <section className="scroll-mt-16 px-1 sm:px-0">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:h-14 sm:w-14">
                <Pill className="h-[54%] w-[54%]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-semibold leading-tight tracking-normal text-[color:var(--text-heading)] sm:text-3xl">
                  {record.name}
                </h1>
                <p className="mt-1 text-sm-minus font-medium leading-5 text-[color:var(--text-muted)] sm:text-sm">
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
            {tiles.map((tile) => (
              <DetailTile
                key={tile.label}
                label={tile.label}
                value={tile.value}
                meta={tile.meta}
                danger={tile.danger}
              />
            ))}
          </section>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["summary", "Summary"],
                ["dosing", "Dosing"],
                ["safety", "Safety"],
                ["more", "More"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "min-h-8 rounded-lg border px-2.5 text-2xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:px-3 sm:text-xs",
                  activeTab === id
                    ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-heading)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <section className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-soft)]">
            {activeSections.length ? (
              activeSections.map((section) => (
                <SectionCard key={`${section.type}-${section.title}`} section={section} />
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-[color:var(--text-muted)]">No sections in this view.</p>
            )}
          </section>
        </div>

        <aside className="hidden space-y-3 lg:sticky lg:top-20 lg:block lg:self-start">
          <section className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)]">
            <div className="border-b border-[color:var(--border)] px-3 py-2 text-sm-minus font-semibold text-[color:var(--text-heading)]">
              Quick reference
            </div>
            <div className="divide-y divide-[color:var(--border)]">
              {record.quick.map((row) => (
                <div key={row.label} className="px-3 py-2.5">
                  <p className="text-3xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                    {row.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">
                    {row.value.replace(/\*\*/g, "")}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <MedicationAccessPanel record={record} />

          {record.stats.length ? (
            <section className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)]">
              <div className="border-b border-[color:var(--border)] px-3 py-2 text-sm-minus font-semibold text-[color:var(--text-heading)]">
                Key stats
              </div>
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
                      <p className="text-3xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                        {stat.label}
                      </p>
                      <p className="mt-1 text-sm-minus font-semibold">{stat.value}</p>
                    </div>
                  );
                })}
              </div>
            </section>
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
          className="inline-flex min-h-9 w-fit items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-sm font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Medication search</span>
          <span className="sm:hidden">Search</span>
        </Link>
      </div>
      <div className="px-3 py-3 sm:px-6 lg:px-8">
        {loading ? (
          <p className="text-sm text-[color:var(--text-muted)]">Loading medication reference…</p>
        ) : error || !data?.record ? (
          <div className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] p-4 text-sm text-[color:var(--danger-text)]">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{error ?? "Medication not found."}</p>
            </div>
          </div>
        ) : (
          <MedicationRecordDetail record={data.record} governance={data.governance} />
        )}
      </div>
      <footer className="mx-auto max-w-7xl px-4 pb-4 text-center text-3xs font-medium text-[color:var(--text-soft)] opacity-70">
        Clinical KB provides evidence summaries, not medical advice. Verify clinical decisions.
      </footer>
    </main>
  );
}
