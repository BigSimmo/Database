import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  CircleHelp,
  FileCheck2,
  Layers,
  ListChecks,
  ShieldAlert,
  Stethoscope,
  Tags,
} from "lucide-react";

import {
  CategoryTag,
  DiagnosisChips,
  DsmBadge,
  QuickTile,
  ReviewStatusBadge,
  SectionHeading,
  SpecifierBreadcrumbs,
  SpecifierPageShell,
  SpecifierSafetyNote,
  SpecifierSubnav,
  categoryShortName,
  specifierCard,
} from "@/components/specifiers/specifier-ui";
import { cn, eyebrowText } from "@/components/ui-primitives";
import {
  curatedEnrichmentFor,
  relatedCatalogItems,
  type SpecifierCatalogItem,
  type SpecifierDefinitionStatus,
  type SpecifierSourceStatus,
} from "@/lib/specifiers-content";

const definitionStatusLabel: Record<SpecifierDefinitionStatus, string> = {
  defined: "Generated clinical anchor",
  "obvious-no-definition": "Self-explanatory label",
  "needs-manual-or-clinician-verification": "Needs manual verification",
};

const sourceStatusLabel: Record<SpecifierSourceStatus, string> = {
  "source-verified": "Source verified",
  "source-needs-formal-review": "Needs formal source review",
  "source-not-applicable": "Source not applicable",
};

// The dataset spans DSM-5-TR and ICD-11/WHO material. Label the source badge from
// the item's own provenance rather than always claiming DSM-5-TR: the "ICD-11
// Specifics" category, an ICD-11/WHO source family, or an "(ICD-11)" disorder name
// all indicate ICD-11 content.
function sourceManualLabel(item: SpecifierCatalogItem): string {
  const family = item.definition?.sourceFamily ?? item.review.sourceFamily ?? "";
  if (item.categoryId === "icd" || /icd-11|who/i.test(family) || /\(icd-11\)/i.test(item.disorderName)) {
    return "ICD-11";
  }
  return "DSM-5-TR";
}

function InfoCard({
  icon: Icon,
  eyebrow,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(specifierCard, "grid gap-3 p-4 sm:p-5")}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className={eyebrowText}>{eyebrow}</p>
          <h2 className="mt-1 text-lg font-extrabold text-[color:var(--text-heading)]">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function ReasoningList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "success" | "warning" | "default";
}) {
  const dot =
    tone === "success"
      ? "bg-[color:var(--success)]"
      : tone === "warning"
        ? "bg-[color:var(--warning)]"
        : "bg-[color:var(--clinical-accent)]";
  return (
    <div className="grid gap-2">
      <p className="text-xs font-extrabold text-[color:var(--text-heading)]">{title}</p>
      <ul className="grid gap-2 text-sm font-medium leading-6 text-[color:var(--text-muted)]">
        {items.map((entry) => (
          <li key={entry} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2">
            <span className={cn("mt-2 h-1.5 w-1.5 rounded-full", dot)} aria-hidden />
            <span>{entry}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SpecifierReferencePage({ item }: { item: SpecifierCatalogItem }) {
  const enrichment = curatedEnrichmentFor(item);
  const related = relatedCatalogItems(item);
  // Only source-verified definitions are trusted for display. Unverified generated
  // text was systematically mis-templated in the source export, so it is withheld
  // pending clinician review (see the verification gate in the data build).
  const trusted = item.review.sourceVerificationStatus === "source-verified" && Boolean(item.definition);
  const pendingVerification = item.definitionStatus === "needs-manual-or-clinician-verification";
  const sourceManual = sourceManualLabel(item);
  const description = trusted
    ? item.definition!.meaning
    : pendingVerification
      ? `“${item.label}” is recorded for ${item.disorderName}; its generated definition is pending clinician verification — confirm against the current DSM-5-TR / ICD-11 text.`
      : `“${item.label}” is recorded for ${item.disorderName} without a separate definition — read it against the current DSM-5-TR text.`;

  return (
    <SpecifierPageShell>
      <div className="grid gap-3">
        <SpecifierBreadcrumbs current={item.label} />
        <SpecifierSubnav active="search" />
      </div>

      {/* Hero */}
      <section className="grid gap-5 border-b border-[color:var(--border)] pb-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="grid gap-4 sm:grid-cols-[4rem_minmax(0,1fr)] sm:items-start">
          <span className="grid h-14 w-14 place-items-center rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:h-16 sm:w-16">
            <Tags className="h-7 w-7" aria-hidden />
          </span>
          <div className="grid gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <DsmBadge label={sourceManual} />
              <span className="inline-flex min-h-6 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-inset)] px-2 text-2xs font-bold text-[color:var(--text-muted)]">
                {item.groupLabel}
              </span>
              <ReviewStatusBadge status={item.review.sourceVerificationStatus} />
            </div>
            <div>
              <p className={eyebrowText}>{categoryShortName(item.categoryName)} specifier</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
                {item.label}
              </h1>
            </div>
            <p className="max-w-3xl text-base font-medium leading-7 text-[color:var(--text-muted)]">{description}</p>
            <div className="flex flex-wrap items-center gap-2">
              <CategoryTag categoryId={item.categoryId} name={item.categoryName} />
              <DiagnosisChips values={[item.disorderName]} />
            </div>
          </div>
        </div>

        {enrichment ? (
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Link
              href={`/specifiers/${enrichment.slug}`}
              className="inline-flex min-h-tap items-center justify-center gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              <BookOpenCheck className="h-4 w-4" aria-hidden />
              Deep guide
            </Link>
            <Link
              href={`/specifiers/builder?specifier=${enrichment.slug}`}
              className="inline-flex min-h-tap items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--command-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              <ListChecks className="h-4 w-4" aria-hidden />
              Build wording
            </Link>
          </div>
        ) : null}
      </section>

      {/* Quick tiles */}
      <section aria-label="At a glance" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QuickTile icon={Stethoscope} label="Applies to" body={item.disorderName} tone="accent" />
        <QuickTile icon={Layers} label="Specifier group" body={item.groupLabel} />
        <QuickTile
          icon={FileCheck2}
          label="Definition"
          body={definitionStatusLabel[item.definitionStatus]}
          tone="info"
        />
        <QuickTile
          icon={item.review.sourceVerificationStatus === "source-verified" ? Check : ShieldAlert}
          label="Source status"
          body={sourceStatusLabel[item.review.sourceVerificationStatus]}
          tone={item.review.sourceVerificationStatus === "source-verified" ? "success" : "default"}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="grid min-w-0 gap-5">
          <SectionHeading
            eyebrow="Reference"
            title="What this specifier records"
            body="Aide-memoire content for the specifier and how it sits within its diagnosis. Confirm against current DSM-5-TR / ICD-11 materials before documenting."
          />

          {trusted ? (
            <InfoCard icon={BookOpenCheck} eyebrow="At a glance" title="Meaning">
              <p className="text-sm font-medium leading-6 text-[color:var(--text-muted)]">{item.definition!.meaning}</p>
            </InfoCard>
          ) : pendingVerification ? (
            <InfoCard icon={ShieldAlert} eyebrow="At a glance" title="Definition pending verification">
              <p className="text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                The generated definition for this specifier is withheld pending qualified clinician review. Confirm the
                specifier against current DSM-5-TR / ICD-11 materials before documenting.
              </p>
            </InfoCard>
          ) : null}

          {trusted && item.definition?.clinicalNote ? (
            <InfoCard icon={CircleHelp} eyebrow="Clinical note" title="How to use it">
              <p className="text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                {item.definition.clinicalNote}
              </p>
            </InfoCard>
          ) : null}

          {enrichment ? (
            <section className={cn(specifierCard, "grid gap-4 p-4 sm:p-5")}>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                  <Check className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className={eyebrowText}>Curated clinical reasoning</p>
                  <h2 className="mt-1 text-lg font-extrabold text-[color:var(--text-heading)]">Fit and exclusions</h2>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ReasoningList title="When this fits" items={enrichment.fit} tone="success" />
                <ReasoningList title="When this may not fit" items={enrichment.notFit} tone="warning" />
              </div>
              {enrichment.checks.length ? (
                <ReasoningList title="Focused checks" items={enrichment.checks} tone="default" />
              ) : null}
            </section>
          ) : null}

          {item.icd11Context ? (
            <InfoCard icon={BookOpenCheck} eyebrow="Coding context" title="ICD-11 context">
              <p className="text-sm font-medium leading-6 text-[color:var(--text-muted)]">{item.icd11Context}</p>
            </InfoCard>
          ) : null}
        </div>

        <aside className="grid content-start gap-4 xl:sticky xl:top-20">
          <section className={cn(specifierCard, "overflow-hidden")}>
            <div className="border-b border-[color:var(--border)] px-4 py-3">
              <p className={eyebrowText}>Review status</p>
            </div>
            <dl className="divide-y divide-[color:var(--border)]">
              {[
                ["Source", sourceStatusLabel[item.review.sourceVerificationStatus]],
                ["Clinician review", "Pending qualified review"],
                ["Source family", item.definition?.sourceFamily ?? item.review.sourceFamily ?? "—"],
                ["Content hash", item.review.contentHash],
              ].map(([label, body]) => (
                <div key={label} className="px-4 py-3">
                  <dt className="text-xs font-extrabold text-[color:var(--text-heading)]">{label}</dt>
                  <dd className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-muted)]">{body}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={cn(specifierCard, "p-4")}>
            <p className={eyebrowText}>Diagnosis</p>
            <p className="mt-2 text-sm font-bold leading-6 text-[color:var(--text-heading)]">{item.disorderName}</p>
            <div className="mt-2">
              <CategoryTag categoryId={item.categoryId} name={item.categoryName} />
            </div>
          </section>

          {related.length ? (
            <section className={cn(specifierCard, "overflow-hidden")}>
              <div className="border-b border-[color:var(--border)] px-4 py-3">
                <p className={eyebrowText}>More in this diagnosis</p>
              </div>
              <div className="divide-y divide-[color:var(--border)]">
                {related.map((entry) => (
                  <Link
                    key={entry.slug}
                    href={`/specifiers/${entry.slug}`}
                    className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 text-sm font-bold text-[color:var(--text-heading)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--clinical-accent)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{entry.label}</span>
                      <span className="block text-2xs font-semibold text-[color:var(--text-soft)]">
                        {entry.groupLabel}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      <SpecifierSafetyNote />
    </SpecifierPageShell>
  );
}
