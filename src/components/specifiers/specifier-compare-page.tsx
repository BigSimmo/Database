"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, GitCompareArrows, HelpCircle, Tags } from "lucide-react";

import {
  CompareIdsChrome,
  pairCompareHref,
  type CompareCatalogItem,
  type CompareStarterChip,
} from "@/components/compare";
import {
  SpecifierFamilyBadge,
  SpecifierPageShell,
  SpecifierSafetyNote,
  specifierCard,
} from "@/components/specifiers/specifier-ui";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { findSpecifier, specifierRecords } from "@/lib/specifiers";

const COMPARE_PATH = "/specifiers/compare";

const comparisonRows = [
  { label: "Clinical focus", key: "focus" as const },
  { label: "Time course", key: "timeCourse" as const },
  { label: "Look for", key: "lookFor" as const },
  { label: "Do not overcall from", key: "caution" as const },
];

const catalogItems: CompareCatalogItem[] = specifierRecords.map((record) => ({
  id: record.slug,
  title: record.shortName,
  snippet: record.summary,
  tag: record.familyLabel,
}));

const starterChips: CompareStarterChip[] = [
  {
    id: "anxious-mixed",
    label: "Anxious distress vs mixed features",
    href: pairCompareHref(COMPARE_PATH, "with-anxious-distress", "with-mixed-features"),
  },
  {
    id: "melancholic-atypical",
    label: "Melancholic vs atypical features",
    href: pairCompareHref(COMPARE_PATH, "with-melancholic-features", "with-atypical-features"),
  },
];

export function SpecifierComparePage({ initialLeft, initialRight }: { initialLeft?: string; initialRight?: string }) {
  const router = useRouter();
  const left = initialLeft ? (findSpecifier(initialLeft) ?? null) : null;
  const right = initialRight && initialRight !== left?.slug ? (findSpecifier(initialRight) ?? null) : null;
  const ready = Boolean(left && right);

  return (
    <SpecifierPageShell>
      <header className="grid gap-1.5 border-b border-[color:var(--border)] pb-4 sm:pb-5">
        <h1 className="text-balance text-2xl font-extrabold leading-tight tracking-tight text-[color:var(--text-heading)] sm:text-3xl">
          Compare two specifiers
        </h1>
        <p className="max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
          Find the deciding clinical difference.
        </p>
      </header>

      <CompareIdsChrome
        selectedIds={[left?.slug, right?.slug]}
        maxCount={2}
        items={catalogItems}
        starters={starterChips}
        emptyTitle="Choose two specifiers"
        emptyDescription="Search the specifier catalogue, or start from a common pair."
        actionLabel="Choose specifiers"
        searchPlaceholder="Search specifier"
        pickerTitle="Choose two specifiers"
        pickerDescription="Assign a specifier to A or B. Duplicates are blocked."
        pickerId="specifier-compare-picker"
        pickerTestId="specifier-compare-picker"
        changeLabel="Change specifiers"
        slotPlaceholder="Choose specifier"
        icon={Tags}
        onCommit={(ids) => router.push(pairCompareHref(COMPARE_PATH, ids[0], ids[1]))}
      />

      {ready && left && right ? (
        <>
          <section className="rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-4 py-4 text-center sm:px-6">
            <div className="mx-auto flex max-w-4xl items-start justify-center gap-2.5">
              <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
              <div>
                <p className={cn(eyebrowText, "!text-[color:var(--clinical-accent)]")}>Ask this</p>
                <p className="mt-1 text-base font-extrabold leading-6 text-[color:var(--text-heading)]">
                  Is the central pattern “{left.comparison.focus.toLowerCase()}” or “
                  {right.comparison.focus.toLowerCase()}”?
                </p>
              </div>
            </div>
          </section>

          <section
            className={cn(specifierCard, "overflow-hidden")}
            aria-label={`${left.shortName} compared with ${right.shortName}`}
          >
            <div className="grid sm:grid-cols-2">
              {[left, right].map((record, index) => (
                <div
                  key={record.slug}
                  className={cn(
                    "grid gap-3 px-4 py-4 sm:px-5",
                    index === 1 && "border-t border-[color:var(--border)] sm:border-l sm:border-t-0",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-xs font-extrabold text-[color:var(--clinical-accent-contrast)]">
                      {index === 0 ? "A" : "B"}
                    </span>
                    <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">{record.shortName}</h2>
                  </div>
                  <p className="text-sm font-medium leading-6 text-[color:var(--text-muted)]">{record.summary}</p>
                  <SpecifierFamilyBadge record={record} />
                </div>
              ))}
            </div>

            <div className="border-t border-[color:var(--border)]">
              {comparisonRows.map((row) => (
                <div
                  key={row.key}
                  className="grid border-b border-[color:var(--border)] last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)]"
                >
                  <div className="bg-[color:var(--surface-subtle)] px-4 py-3 text-xs font-extrabold text-[color:var(--text-heading)] sm:flex sm:items-center">
                    {row.label}
                  </div>
                  <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 px-4 py-3 text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-xs font-extrabold text-[color:var(--clinical-accent)]">
                      A
                    </span>
                    <span>{left.comparison[row.key]}</span>
                  </div>
                  <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 border-t border-[color:var(--border)] px-4 py-3 text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:border-l sm:border-t-0">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-xs font-extrabold text-[color:var(--clinical-accent)]">
                      B
                    </span>
                    <span>{right.comparison[row.key]}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] sm:grid-cols-2">
              {[left, right].map((record, index) => (
                <div
                  key={record.slug}
                  className={cn(
                    "p-4 sm:p-5",
                    index === 1 && "border-t border-[color:var(--border)] sm:border-l sm:border-t-0",
                  )}
                >
                  <p className={eyebrowText}>Example wording</p>
                  <p className="mt-1.5 text-sm font-bold leading-6 text-[color:var(--text-heading)]">
                    {record.wording}
                  </p>
                  <Link
                    href={`/specifiers/${record.slug}`}
                    className="mt-3 inline-flex min-h-tap items-center gap-2 rounded-md px-1 text-sm font-bold text-[color:var(--clinical-accent)] hover:underline"
                  >
                    Open full guide
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-2">
            <Link
              href="/specifiers/map"
              className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--text)]"
            >
              <GitCompareArrows className="h-4 w-4" aria-hidden />
              Browse the map
            </Link>
            <Link
              href={`/specifiers/builder?specifier=${left.slug}&specifier=${right.slug}`}
              className="inline-flex min-h-tap items-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm font-bold text-[color:var(--command-contrast)]"
            >
              Build diagnostic wording
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </>
      ) : null}

      <SpecifierSafetyNote />
    </SpecifierPageShell>
  );
}
