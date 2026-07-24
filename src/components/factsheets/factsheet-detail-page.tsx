"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronRight,
  Clock,
  Download,
  HeartHandshake,
  Printer,
  Share2,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  categoryTheme,
  FACTSHEET_DEMO_NOTICE,
  printBlocks,
  relatedFactsheets,
  sameTopicFactsheets,
  tocFor,
  type Factsheet,
} from "@/components/factsheets/factsheets-data";
import { factsheetGlyph } from "@/components/factsheets/factsheets-icons";
import { InformationPageBreadcrumbs, InformationPageShell } from "@/components/information-page-shell";
import { cn, toneDanger, toneWarning } from "@/components/ui-primitives";
import {
  readSavedRegistrySlugs,
  savedFactsheetsStorageKey,
  subscribeSavedRegistrySlugs,
  writeSavedRegistrySlugs,
} from "@/lib/saved-registry-storage";

function accentBorder(accent: string) {
  return `color-mix(in srgb, ${accent} 35%, var(--surface))`;
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="text-xl font-bold tracking-tight text-[color:var(--text-heading)]">{children}</h2>;
}

export function FactsheetDetailPage({ factsheet }: { factsheet: Factsheet }) {
  const theme = categoryTheme(factsheet.category);
  const [readingLevel, setReadingLevel] = useState<"easy" | "standard">("easy");
  const [saved, setSaved] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [copied, setCopied] = useState(false);
  // The print sheet is portaled to <body> so print can isolate it from the shell
  // chrome; the portal is client-only, gated behind a mount flag. useSyncExternalStore
  // is the lint-safe way to flip false→true on hydration without setState-in-effect.
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const related = relatedFactsheets(factsheet.slug);
  const moreInTopic = sameTopicFactsheets(factsheet.slug);
  const toc = tocFor(factsheet);
  const blocks = printBlocks(factsheet, readingLevel);

  useEffect(() => {
    const refresh = () => setSaved(readSavedRegistrySlugs(savedFactsheetsStorageKey).includes(factsheet.slug));
    refresh();
    return subscribeSavedRegistrySlugs(refresh);
  }, [factsheet.slug]);

  function toggleSaved() {
    const current = readSavedRegistrySlugs(savedFactsheetsStorageKey);
    const next = current.includes(factsheet.slug)
      ? current.filter((slug) => slug !== factsheet.slug)
      : [factsheet.slug, ...current];
    if (!writeSavedRegistrySlugs(savedFactsheetsStorageKey, next)) {
      setSaveNotice("Save failed. Check browser storage permissions and try again.");
      return;
    }
    const nowSaved = next.includes(factsheet.slug);
    setSaved(nowSaved);
    setSaveNotice(nowSaved ? "Factsheet saved." : "Factsheet removed from saved items.");
  }

  function downloadPdf() {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.add("factsheets-printing");
    const cleanup = () => root.classList.remove("factsheets-printing");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <InformationPageShell testId="factsheet-detail-page" width="bleed" className="factsheet-screen">
        {/* action bar */}
        <div className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
          <div className="mx-auto flex max-w-[64rem] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
            <InformationPageBreadcrumbs
              home={{ label: "All factsheets", href: "/factsheets/search" }}
              current={factsheet.title}
            />
            <div className="flex flex-wrap items-center gap-2">
              {factsheet.kind === "medRich" ? (
                <div
                  role="group"
                  aria-label="Reading level"
                  className="inline-flex gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-1"
                >
                  {(["easy", "standard"] as const).map((level) => {
                    const isActive = readingLevel === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setReadingLevel(level)}
                        aria-pressed={isActive}
                        className={cn(
                          "inline-flex min-h-8 items-center rounded-md px-2.5 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                          isActive
                            ? "bg-[color:var(--surface)] text-[color:var(--text-heading)] shadow-[var(--shadow-tight)]"
                            : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
                        )}
                      >
                        {level === "easy" ? "Easy read" : "Standard"}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <button
                type="button"
                onClick={toggleSaved}
                aria-pressed={saved}
                className={cn(
                  "inline-flex min-h-tap items-center gap-1.5 rounded-lg border px-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                  saved
                    ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] hover:border-[color:var(--border-strong)]",
                )}
              >
                <Bookmark className="h-4 w-4" aria-hidden="true" fill={saved ? "currentColor" : "none"} />
                {saved ? "Saved" : "Save"}
              </button>
              <span aria-live="polite" className="sr-only">
                {saveNotice}
              </span>
              <button
                type="button"
                onClick={downloadPdf}
                className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--command-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download PDF
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-[64rem] gap-8 px-4 py-6 pb-4 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_16.5rem] lg:items-start lg:px-8">
          <article className="min-w-0">
            {/* hero band */}
            <div className="rounded-2xl border border-[color:var(--border)] p-6" style={{ background: theme.hero }}>
              <div className="flex items-center gap-3">
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl shadow-[var(--shadow-inset)]"
                  style={{ backgroundColor: theme.soft, color: theme.accent }}
                >
                  {factsheetGlyph(factsheet.icon, "h-6 w-6")}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-2xs font-bold uppercase tracking-[0.06em]" style={{ color: theme.accent }}>
                    {factsheet.category}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--text-muted)]">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      Updated {factsheet.reviewedOn}
                    </span>
                    <span className="text-xs text-[color:var(--text-soft)]">· {factsheet.readTime}</span>
                  </div>
                </div>
              </div>
              <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[color:var(--text-heading)]">
                {factsheet.title}
                {factsheet.brand ? (
                  <span className="font-medium text-[color:var(--text-muted)]"> {factsheet.brand}</span>
                ) : null}
              </h1>
              <p className="mt-3 max-w-2xl text-pretty text-base leading-7 text-[color:var(--text-muted)]">
                {factsheet.summary}
              </p>
            </div>

            {/* kind-specific body */}
            <div className="mt-6">
              <FactsheetBody factsheet={factsheet} readingLevel={readingLevel} theme={theme} />
            </div>

            {/* sources */}
            <section className="mt-7">
              <Heading>Where this information comes from</Heading>
              <div className="mt-3 grid gap-2">
                {factsheet.sources.map((source) => {
                  const rowClass =
                    "flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3.5 py-3";
                  const inner = (
                    <>
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] font-mono text-xs font-bold text-[color:var(--text-muted)]">
                        {source.n}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[color:var(--text-heading)]">{source.title}</p>
                        <p className="text-xs text-[color:var(--text-soft)]">
                          {source.org} · {source.year}
                        </p>
                      </div>
                      <span className="rounded-md bg-[color:var(--surface-inset)] px-2 py-0.5 text-2xs font-bold text-[color:var(--text-muted)]">
                        {source.tag}
                      </span>
                      {/* Only advertise an outbound link when a verifiable URL exists. */}
                      {source.url ? (
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" aria-hidden="true" />
                      ) : null}
                    </>
                  );
                  return source.url ? (
                    <a
                      key={source.n}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        rowClass,
                        "transition hover:border-[color:var(--border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                      )}
                    >
                      {inner}
                    </a>
                  ) : (
                    <div key={source.n} className={rowClass}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* more in topic */}
            {moreInTopic.length ? (
              <section className="mt-7 border-t border-[color:var(--border)] pt-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Heading>More in {factsheet.category}</Heading>
                  <Link
                    href={`/factsheets/search?category=${encodeURIComponent(factsheet.category)}`}
                    className="text-sm font-bold text-[color:var(--clinical-accent)] transition hover:text-[color:var(--clinical-accent-hover)]"
                  >
                    See all
                  </Link>
                </div>
                <div className="grid gap-2.5">
                  {moreInTopic.map((sheet) => {
                    const sheetTheme = categoryTheme(sheet.category);
                    return (
                      <Link
                        key={sheet.slug}
                        href={`/factsheets/${sheet.slug}`}
                        className="group flex items-center gap-3.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-3 transition hover:border-[color:var(--border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                      >
                        <span
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
                          style={{ backgroundColor: sheetTheme.soft, color: sheetTheme.accent }}
                        >
                          {factsheetGlyph(sheet.icon, "h-5 w-5")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-[color:var(--text-heading)] group-hover:text-[color:var(--clinical-accent)]">
                            {sheet.title}
                          </span>
                          <span className="block truncate text-xs text-[color:var(--text-soft)]">{sheet.summary}</span>
                        </span>
                        <span className="shrink-0 text-xs font-bold text-[color:var(--text-soft)]">
                          {sheet.readTime}
                        </span>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-[color:var(--text-soft)] transition group-hover:text-[color:var(--clinical-accent)]"
                          aria-hidden="true"
                        />
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* related */}
            <section className="mt-7 border-t border-[color:var(--border)] pt-6">
              <Heading>Related sheets</Heading>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((sheet) => {
                  const sheetTheme = categoryTheme(sheet.category);
                  return (
                    <Link
                      key={sheet.slug}
                      href={`/factsheets/${sheet.slug}`}
                      className="group flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3.5 transition hover:border-[color:var(--border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                    >
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                        style={{ backgroundColor: sheetTheme.soft, color: sheetTheme.accent }}
                      >
                        {factsheetGlyph(sheet.icon, "h-5 w-5")}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-[color:var(--text-heading)] group-hover:text-[color:var(--clinical-accent)]">
                          {sheet.title}
                        </span>
                        <span className="block text-xs text-[color:var(--text-soft)]">{sheet.category}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>

            <div className="mt-6 border-t border-[color:var(--border)] pt-3.5">
              <p className="text-xs font-bold text-[color:var(--warning)]">{FACTSHEET_DEMO_NOTICE}</p>
              <p className="mt-1.5 text-xs leading-5 text-[color:var(--text-soft)]">
                This sheet is general information, not personal medical advice. Always follow the instructions from your
                own doctor or pharmacist.
              </p>
            </div>
          </article>

          {/* sidebar */}
          <aside className="grid gap-0 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)] lg:sticky lg:top-4">
            <div className="p-4">
              <p className="text-2xs font-bold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">For</p>
              <p className="mt-1 text-sm font-bold text-[color:var(--text-heading)]">{factsheet.audience}</p>
            </div>
            <div className="border-t border-[color:var(--border)] p-4">
              <p className="text-2xs font-bold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
                Last updated
              </p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--text-heading)]">
                <Clock className="h-3.5 w-3.5 text-[color:var(--text-muted)]" aria-hidden="true" />
                {factsheet.reviewedOn}
              </p>
            </div>
            <div className="border-t border-[color:var(--border)] p-4">
              <p className="text-2xs font-bold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
                On this page
              </p>
              <ul className="mt-2 grid gap-1.5">
                {toc.map((item) => (
                  <li key={item} className="text-sm text-[color:var(--text-muted)]">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-2 border-t border-[color:var(--border)] p-4">
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex min-h-tap items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)] transition hover:bg-[color:var(--command-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                )}
                {copied ? "Link copied" : "Share sheet"}
              </button>
              <button
                type="button"
                onClick={downloadPdf}
                className="inline-flex min-h-tap items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text)] transition hover:border-[color:var(--border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Print
              </button>
              <span aria-live="polite" className="sr-only">
                {copied ? "Link copied to clipboard" : ""}
              </span>
            </div>
          </aside>
        </div>
      </InformationPageShell>

      {/* Print-only clean A4 sheet, portaled to <body> so print can remove every
          other body subtree from layout flow (see globals.css factsheets-printing
          rules) — otherwise the hidden shell chrome paginates into blank pages. */}
      {mounted
        ? createPortal(
            <div className="factsheet-print-portal">
              <FactsheetPrintSheet factsheet={factsheet} blocks={blocks} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function FactsheetBody({
  factsheet,
  readingLevel,
  theme,
}: {
  factsheet: Factsheet;
  readingLevel: "easy" | "standard";
  theme: ReturnType<typeof categoryTheme>;
}) {
  switch (factsheet.kind) {
    case "medRich":
      return (
        <div className="flex flex-col gap-6">
          <div
            className="rounded-2xl border p-5"
            style={{ backgroundColor: theme.soft, borderColor: accentBorder(theme.accent) }}
          >
            <p className="text-2xs font-bold uppercase tracking-[0.06em]" style={{ color: theme.accent }}>
              At a glance
            </p>
            <div className="mt-3.5 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
              {factsheet.keyFacts.map((fact) => (
                <div key={fact.k} className="flex flex-col gap-0.5">
                  <span className="text-xs text-[color:var(--text-muted)]">{fact.k}</span>
                  <span className="text-base-minus font-bold text-[color:var(--text-heading)]">{fact.v}</span>
                </div>
              ))}
            </div>
          </div>
          <section>
            <Heading>What is {factsheet.title.toLowerCase()}?</Heading>
            <p className="mt-2 max-w-[66ch] text-pretty text-base leading-7 text-[color:var(--text)]">
              {readingLevel === "easy" ? factsheet.whatEasy : factsheet.whatStandard}
            </p>
          </section>
          <section>
            <Heading>How to take it</Heading>
            <div className="mt-3 flex flex-col gap-3">
              {factsheet.howto.map((step) => (
                <div key={step.n} className="flex items-start gap-3.5">
                  <span
                    className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[color:var(--surface-inset)] font-mono text-xs font-bold"
                    style={{ color: theme.accent }}
                  >
                    {step.n}
                  </span>
                  <span className="max-w-[64ch] text-pretty text-base-minus leading-6 text-[color:var(--text)]">
                    {step.t}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section>
            <Heading>Side effects</Heading>
            <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[color:var(--warning)]" aria-hidden="true" />
                  <span className="text-sm font-bold text-[color:var(--text-heading)]">
                    Common — often ease in weeks
                  </span>
                </div>
                <ul className="grid gap-2">
                  {factsheet.sideCommon.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm leading-5 text-[color:var(--text)]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--text-soft)]" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={cn("rounded-2xl border p-4", toneDanger)}>
                <div className="mb-3 flex items-center gap-2">
                  <TriangleAlert className="h-4 w-4 shrink-0 text-[color:var(--danger)]" aria-hidden="true" />
                  <span className="text-sm font-bold text-[color:var(--danger)]">Serious — tell your doctor</span>
                </div>
                <ul className="grid gap-2">
                  {factsheet.sideSerious.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm leading-5 text-[color:var(--danger)]">
                      <span
                        className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[color:var(--danger)]"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
          <div className="flex gap-3.5 rounded-2xl border border-[color:var(--danger-border)] bg-[color:var(--surface)] p-5">
            <span className="grid h-tap w-tap shrink-0 place-items-center rounded-xl bg-[color:var(--danger-solid)] text-[color:var(--danger-solid-contrast)]">
              <Zap className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-base font-bold text-[color:var(--danger)]">When to get urgent help</p>
              <p className="mt-1.5 max-w-[60ch] text-pretty text-sm leading-6 text-[color:var(--text)]">
                {factsheet.urgentHelp}
              </p>
            </div>
          </div>
        </div>
      );
    case "medLite":
      return (
        <div className="flex flex-col gap-5">
          <div
            className="flex gap-3.5 rounded-2xl border p-4"
            style={{ backgroundColor: theme.soft, borderColor: accentBorder(theme.accent) }}
          >
            <Clock className="mt-0.5 h-5 w-5 shrink-0" style={{ color: theme.accent }} aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-[color:var(--text-heading)]">How long it takes</p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">{factsheet.timing}</p>
            </div>
          </div>
          {factsheet.sections.map((section) => (
            <section key={section.heading} className="border-l-[3px] pl-4" style={{ borderColor: theme.accent }}>
              <h2 className="text-lg-minus font-bold text-[color:var(--text-heading)]">{section.heading}</h2>
              <p className="mt-1.5 max-w-[64ch] text-pretty text-base-minus leading-7 text-[color:var(--text)]">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      );
    case "condition":
      return (
        <div className="flex flex-col gap-6">
          <section>
            <Heading>In plain terms</Heading>
            <p className="mt-2 max-w-[66ch] text-pretty text-base leading-7 text-[color:var(--text)]">
              {factsheet.intro}
            </p>
          </section>
          <section>
            <Heading>Signs to look for</Heading>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {factsheet.signs.map((sign) => (
                <div
                  key={sign}
                  className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-3"
                >
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
                    style={{ backgroundColor: theme.soft, color: theme.accent }}
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="text-sm leading-5 text-[color:var(--text)]">{sign}</span>
                </div>
              ))}
            </div>
          </section>
          <section>
            <Heading>Why it happens</Heading>
            <p className="mt-2 max-w-[66ch] text-pretty text-base leading-7 text-[color:var(--text)]">
              {factsheet.why}
            </p>
          </section>
          <section>
            <Heading>What helps</Heading>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {factsheet.helps.map((help) => (
                <div
                  key={help.title}
                  className="flex flex-col gap-2.5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
                >
                  <span
                    className="grid h-10 w-10 place-items-center rounded-lg"
                    style={{ backgroundColor: theme.soft, color: theme.accent }}
                  >
                    {factsheetGlyph(help.icon, "h-5 w-5")}
                  </span>
                  <p className="text-sm font-bold text-[color:var(--text-heading)]">{help.title}</p>
                  <p className="text-pretty text-xs leading-5 text-[color:var(--text-muted)]">{help.body}</p>
                </div>
              ))}
            </div>
          </section>
          <div
            className="flex gap-3.5 rounded-2xl border p-5"
            style={{ backgroundColor: theme.soft, borderColor: accentBorder(theme.accent) }}
          >
            <span
              className="grid h-tap w-tap shrink-0 place-items-center rounded-xl text-[color:var(--clinical-accent-contrast)]"
              style={{ backgroundColor: theme.accent }}
            >
              <HeartHandshake className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-base font-bold text-[color:var(--text-heading)]">You’re not alone</p>
              <p className="mt-1.5 max-w-[60ch] text-pretty text-sm leading-6 text-[color:var(--text)]">
                {factsheet.support} In Australia you can call{" "}
                <strong className="font-bold">Beyond Blue 1300 22 4636</strong>,{" "}
                <strong className="font-bold">Lifeline 13 11 14</strong>, or <strong className="font-mono">000</strong>{" "}
                in an emergency.
              </p>
            </div>
          </div>
        </div>
      );
    case "therapy":
      return (
        <div className="flex flex-col gap-6">
          <section>
            <Heading>What it is</Heading>
            <p className="mt-2 max-w-[66ch] text-pretty text-base leading-7 text-[color:var(--text)]">
              {factsheet.intro}
            </p>
          </section>
          <section>
            <Heading>How it works</Heading>
            <div className="mt-3.5">
              {factsheet.steps.map((step, index) => (
                <div key={step.n} className="flex gap-3.5">
                  <div className="flex flex-col items-center">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono text-sm font-bold"
                      style={{ backgroundColor: theme.soft, color: theme.accent }}
                    >
                      {step.n}
                    </span>
                    {index < factsheet.steps.length - 1 ? (
                      <span className="my-1 w-0.5 flex-1 bg-[color:var(--border)]" aria-hidden="true" />
                    ) : null}
                  </div>
                  <div className="pb-5">
                    <p className="text-base-minus font-bold text-[color:var(--text-heading)]">{step.h}</p>
                    <p className="mt-1 max-w-[60ch] text-pretty text-sm leading-6 text-[color:var(--text-muted)]">
                      {step.t}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <Heading>What to expect</Heading>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {factsheet.expect.map((item) => (
                <div
                  key={item.k}
                  className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3.5"
                >
                  <p className="text-xs text-[color:var(--text-muted)]">{item.k}</p>
                  <p className="mt-1 text-base-minus font-bold text-[color:var(--text-heading)]">{item.v}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      );
    case "procedure":
      return (
        <div className="flex flex-col gap-6">
          <section>
            <Heading>Why it matters</Heading>
            <p className="mt-2 max-w-[66ch] text-pretty text-base leading-7 text-[color:var(--text)]">
              {factsheet.why}
            </p>
          </section>
          <section>
            <Heading>How to prepare</Heading>
            <div className="mt-3 flex flex-col gap-2.5">
              {factsheet.prepare.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-3"
                >
                  <span
                    className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-[1.5px]"
                    style={{ borderColor: theme.accent, color: theme.accent }}
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                  <span className="text-sm leading-6 text-[color:var(--text)]">{item}</span>
                </div>
              ))}
            </div>
          </section>
          <section>
            <Heading>Step by step</Heading>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {factsheet.timeline.map((step) => (
                <div
                  key={step.t}
                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
                >
                  <p className="text-2xs font-bold uppercase tracking-[0.06em]" style={{ color: theme.accent }}>
                    {step.t}
                  </p>
                  <p className="mt-2 text-pretty text-sm leading-6 text-[color:var(--text)]">{step.d}</p>
                </div>
              ))}
            </div>
          </section>
          <div className={cn("flex gap-3.5 rounded-2xl border p-5", toneWarning)}>
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--warning)]" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-[color:var(--warning)]">Staying safe between tests</p>
              <p className="mt-1.5 max-w-[60ch] text-pretty text-sm leading-6 text-[color:var(--text)]">
                {factsheet.safe}
              </p>
            </div>
          </div>
        </div>
      );
  }
}

function FactsheetPrintSheet({ factsheet, blocks }: { factsheet: Factsheet; blocks: ReturnType<typeof printBlocks> }) {
  return (
    <div
      className="factsheet-print-sheet"
      style={{ maxWidth: "720px", margin: "0 auto", padding: "8px", color: "#111", fontFamily: "var(--font-sans)" }}
    >
      <div
        style={{
          border: "1.5px solid #b42318",
          background: "#fef3f2",
          color: "#b42318",
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          padding: "6px 10px",
          borderRadius: "6px",
          marginBottom: "12px",
        }}
      >
        Sample — not for clinical use
      </div>
      <div style={{ borderBottom: "2px solid var(--clinical-accent)", paddingBottom: "12px", marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--clinical-accent)",
            }}
          >
            {factsheet.category} · Patient information
          </span>
          <span style={{ fontSize: "11px", color: "#555" }}>
            Updated {factsheet.reviewedOn} · {factsheet.readTime}
          </span>
        </div>
        <h1 style={{ margin: "10px 0 6px", fontSize: "26px", fontWeight: 700, color: "#111" }}>
          {factsheet.title}
          {factsheet.brand ? <span style={{ color: "#555", fontWeight: 500 }}> {factsheet.brand}</span> : null}
        </h1>
        <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.55, color: "#333" }}>{factsheet.summary}</p>
      </div>
      {blocks.map((block, index) => (
        <div key={`${block.heading}-${index}`} style={{ marginBottom: "16px", breakInside: "avoid" }}>
          {block.kind === "prose" ? (
            <>
              <h2 style={{ margin: "0 0 5px", fontSize: "16px", fontWeight: 700, color: "#111" }}>{block.heading}</h2>
              <p style={{ margin: 0, fontSize: "13.5px", lineHeight: 1.6, color: "#222" }}>{block.body}</p>
            </>
          ) : null}
          {block.kind === "list" ? (
            <>
              <h2 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700, color: "#111" }}>{block.heading}</h2>
              <ul style={{ margin: 0, paddingLeft: "18px" }}>
                {block.items.map((item, itemIndex) => (
                  <li
                    key={itemIndex}
                    style={{ fontSize: "13.5px", lineHeight: 1.5, color: "#222", marginBottom: "3px" }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {block.kind === "facts" ? (
            <>
              <h2 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700, color: "#111" }}>{block.heading}</h2>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <tbody>
                  {block.items.map((fact) => (
                    <tr key={fact.k}>
                      <td style={{ padding: "5px 8px", border: "1px solid #ddd", color: "#555", width: "40%" }}>
                        {fact.k}
                      </td>
                      <td style={{ padding: "5px 8px", border: "1px solid #ddd", fontWeight: 600, color: "#111" }}>
                        {fact.v}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
          {block.kind === "sources" ? (
            <>
              <h2 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700, color: "#111" }}>Sources</h2>
              {block.items.map((source) => (
                <div key={source.n} style={{ fontSize: "12px", color: "#333", marginBottom: "2px" }}>
                  {source.n}. {source.title} — {source.org} ({source.year})
                  {source.url ? (
                    <>
                      {" "}
                      — <span style={{ color: "#555", wordBreak: "break-all" }}>{source.url}</span>
                    </>
                  ) : null}
                </div>
              ))}
            </>
          ) : null}
        </div>
      ))}
      <p
        style={{
          marginTop: "18px",
          paddingTop: "10px",
          borderTop: "1px solid #ddd",
          fontSize: "11px",
          color: "#666",
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: "#b42318" }}>{FACTSHEET_DEMO_NOTICE}</strong> This sheet is general information, not
        personal medical advice. Always follow the instructions from your own doctor or pharmacist. In an emergency call
        000.
      </p>
    </div>
  );
}
