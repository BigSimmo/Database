"use client";

import Link from "next/link";
import { ArrowRight, GitCompareArrows, HelpCircle, Repeat2, Tags } from "lucide-react";
import { useState } from "react";

import {
  SpecifierBreadcrumbs,
  SpecifierFamilyBadge,
  SpecifierPageShell,
  SpecifierSafetyNote,
  SpecifierSubnav,
  specifierCard,
} from "@/components/specifiers/specifier-ui";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { findSpecifier, specifierRecords } from "@/lib/specifiers";

const comparisonRows = [
  { label: "Clinical focus", key: "focus" as const },
  { label: "Time course", key: "timeCourse" as const },
  { label: "Look for", key: "lookFor" as const },
  { label: "Do not overcall from", key: "caution" as const },
];

function fallbackPair(leftSlug?: string, rightSlug?: string) {
  const left = findSpecifier(leftSlug ?? "") ?? specifierRecords[0];
  const requestedRight = findSpecifier(rightSlug ?? "");
  const right =
    requestedRight && requestedRight.slug !== left.slug
      ? requestedRight
      : specifierRecords.find((item) => item.slug !== left.slug)!;
  return { left, right };
}

function Selector({
  label,
  value,
  otherValue,
  onChange,
}: {
  label: string;
  value: string;
  otherValue: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className={eyebrowText}>{label}</span>
      <span className="relative">
        <Tags
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--clinical-accent)]"
          aria-hidden
        />
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-12 w-full rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] pl-10 pr-9 text-sm font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] outline-none focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/20"
        >
          {specifierRecords.map((record) => (
            <option key={record.slug} value={record.slug} disabled={record.slug === otherValue}>
              {record.shortName}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

export function SpecifierComparePage({ initialLeft, initialRight }: { initialLeft?: string; initialRight?: string }) {
  const initial = fallbackPair(initialLeft, initialRight);
  const [leftSlug, setLeftSlug] = useState(initial.left.slug);
  const [rightSlug, setRightSlug] = useState(initial.right.slug);
  const left = findSpecifier(leftSlug) ?? initial.left;
  const right = findSpecifier(rightSlug) ?? initial.right;

  function chooseLeft(nextSlug: string) {
    setLeftSlug(nextSlug);
    if (nextSlug === rightSlug) {
      setRightSlug(specifierRecords.find((item) => item.slug !== nextSlug)?.slug ?? rightSlug);
    }
  }

  function chooseRight(nextSlug: string) {
    setRightSlug(nextSlug);
    if (nextSlug === leftSlug) {
      setLeftSlug(specifierRecords.find((item) => item.slug !== nextSlug)?.slug ?? leftSlug);
    }
  }

  function swap() {
    setLeftSlug(right.slug);
    setRightSlug(left.slug);
  }

  return (
    <SpecifierPageShell>
      <div className="grid gap-3">
        <SpecifierBreadcrumbs current="Compare" />
        <SpecifierSubnav active="compare" />
      </div>

      <header className="grid gap-2 border-b border-[color:var(--border)] pb-5">
        <p className={eyebrowText}>Close-call reasoning</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
          Compare specifiers
        </h1>
        <p className="max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
          Clarify the deciding signal, chronology, and common overcalls. This comparison changes as you choose either
          specifier.
        </p>
      </header>

      <section
        className={cn(
          specifierCard,
          "grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] sm:items-end sm:p-5",
        )}
      >
        <Selector label="A" value={left.slug} otherValue={right.slug} onChange={chooseLeft} />
        <button
          type="button"
          onClick={swap}
          aria-label="Swap compared specifiers"
          className="grid h-tap w-tap place-items-center justify-self-center rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          <Repeat2 className="h-4 w-4" aria-hidden />
        </button>
        <Selector label="B" value={right.slug} otherValue={left.slug} onChange={chooseRight} />
      </section>

      <section className="rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-4 py-4 text-center sm:px-6">
        <div className="mx-auto flex max-w-4xl items-start justify-center gap-2.5">
          <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
          <div>
            <p className={cn(eyebrowText, "!text-[color:var(--clinical-accent)]")}>Ask this</p>
            <p className="mt-1 text-base font-extrabold leading-6 text-[color:var(--text-heading)]">
              Is the central pattern “{left.comparison.focus.toLowerCase()}” or “{right.comparison.focus.toLowerCase()}
              ”?
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
              <p className="mt-1.5 text-sm font-bold leading-6 text-[color:var(--text-heading)]">{record.wording}</p>
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

      <SpecifierSafetyNote />
    </SpecifierPageShell>
  );
}
