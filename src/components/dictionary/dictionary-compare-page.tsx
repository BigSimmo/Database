"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowRightLeft,
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  GitCompareArrows,
  Link2,
  Printer,
  Search,
  Share2,
  Target,
  Users,
} from "lucide-react";

import { InformationPageFooter, InformationPageShell } from "@/components/information-page-shell";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/components/ui-primitives";
import {
  dictionaryComparisonPair,
  dictionaryEntrySources,
  dictionaryKindLabel,
  findDictionaryEntry,
  searchDictionary,
} from "@/lib/dictionary";
import { dictionarySource, type DictionaryEntry } from "@/lib/dictionary-data";
import { type DictionarySearchHit } from "@/lib/dictionary";

type TargetSide = "a" | "b";

const comparisonSections = [
  { id: "meaning", label: "Meaning", icon: BookOpen },
  { id: "purpose", label: "Purpose and scope", icon: Target },
  { id: "context", label: "Clinical context", icon: Users },
  { id: "relationships", label: "Names and relationships", icon: Link2 },
  { id: "sources", label: "Sources", icon: FileText },
] as const;

export function DictionaryComparePage({ a, b }: { a: DictionaryEntry | null; b: DictionaryEntry | null }) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(!a || !b);
  const [target, setTarget] = useState<TargetSide>(a ? "b" : "a");
  const [query, setQuery] = useState("");
  const [isPhone, setIsPhone] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setIsPhone(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const pair = a && b ? dictionaryComparisonPair(a.slug, b.slug) : null;
  const pairSources = (pair?.sourceRefs ?? []).flatMap((reference) => {
    const source = dictionarySource(reference.sourceId);
    return source ? [source] : [];
  });
  const pickerHits = useMemo(
    () =>
      searchDictionary({
        q: query,
        view: "definitions",
        topics: [],
        kinds: [],
        sources: [],
        sort: query ? "relevance" : "az",
      })
        .filter((hit): hit is Extract<DictionarySearchHit, { type: "entry" }> => hit.type === "entry")
        .slice(0, 12),
    [query],
  );
  const choose = (entry: DictionaryEntry) => {
    const params = new URLSearchParams();
    const nextA = target === "a" ? entry.slug : a?.slug;
    const nextB = target === "b" ? entry.slug : b?.slug;
    if (nextA) params.set("a", nextA);
    if (nextB && nextB !== nextA) params.set("b", nextB);
    router.push(`/dictionary/compare?${params.toString()}`);
    setQuery("");
    if ((target === "a" && b) || (target === "b" && a)) setPickerOpen(false);
    else setTarget(target === "a" ? "b" : "a");
  };
  const openPicker = (side: TargetSide) => {
    setTarget(side);
    setPickerOpen(true);
  };
  const picker = (
    <PickerContent
      a={a}
      b={b}
      target={target}
      setTarget={setTarget}
      query={query}
      setQuery={setQuery}
      hits={pickerHits.map((hit) => hit.entry)}
      choose={choose}
    />
  );

  return (
    <>
      <InformationPageShell width="bleed" gap={false} testId="dictionary-compare-main">
        <div className="mx-auto w-full max-w-[78rem] px-4 py-5 sm:px-6 sm:py-7">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--border)] pb-5">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
                Dictionary comparison
              </p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
                Compare terms
              </h1>
            </div>
            <div className="hidden flex-wrap gap-2 sm:flex">
              <button
                type="button"
                onClick={() => openPicker(a ? "b" : "a")}
                className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 text-sm font-bold sm:min-h-10"
              >
                <GitCompareArrows className="size-icon-sm" aria-hidden="true" />
                Change terms
              </button>
              {a && b ? (
                <Link
                  href={`/dictionary/compare?a=${b.slug}&b=${a.slug}`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 text-sm font-bold"
                >
                  <ArrowRightLeft className="size-icon-sm" aria-hidden="true" />
                  Swap
                </Link>
              ) : null}
              {a || b ? (
                <Link
                  href="/dictionary/compare"
                  className="inline-flex min-h-10 items-center rounded-lg border border-[color:var(--border)] px-3 text-sm font-bold"
                >
                  Clear
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 text-sm font-bold sm:min-h-10"
              >
                <Printer className="size-icon-sm" aria-hidden="true" />
                Print
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const canShare = typeof navigator.share === "function";
                    if (canShare) await navigator.share({ title: "Dictionary comparison", url: window.location.href });
                    else await navigator.clipboard.writeText(window.location.href);
                    setShareStatus(canShare ? "Share opened" : "Link copied");
                  } catch {
                    setShareStatus("Share cancelled");
                  }
                }}
                className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 text-sm font-bold sm:min-h-10"
              >
                <Share2 className="size-icon-sm" aria-hidden="true" />
                Share
              </button>
              <span className="sr-only" aria-live="polite">
                {shareStatus}
              </span>
            </div>
          </header>

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] items-stretch gap-2">
            <TermIdentity label="A" entry={a} onChange={() => openPicker("a")} tone="blue" />
            <div className="grid place-items-center">
              <ArrowRightLeft className="h-5 w-5 text-[color:var(--text-muted)]" aria-hidden="true" />
            </div>
            <TermIdentity label="B" entry={b} onChange={() => openPicker("b")} tone="teal" />
          </div>
          <button
            type="button"
            onClick={() => openPicker(a ? "b" : "a")}
            className="mt-3 inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] text-sm font-bold sm:hidden"
          >
            <GitCompareArrows className="size-icon-sm" aria-hidden="true" />
            Change terms
          </button>

          {pickerOpen && !isPhone ? (
            <div className="mt-4 hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--e2)] sm:block">
              {picker}
            </div>
          ) : null}

          {a && b ? (
            <div className="mt-5">
              <section
                aria-label="Comparison at a glance"
                className="grid gap-3 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/35 p-4 sm:grid-cols-[9rem_1fr_1fr] sm:items-start"
              >
                <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">At a glance</h2>
                <p className="text-sm leading-5">
                  <strong className="text-[color:var(--clinical-accent)]">A · {shortName(a)}</strong>
                  <span className="mt-1 block">{a.comparison.purpose}.</span>
                </p>
                <p className="text-sm leading-5">
                  <strong className="text-[color:var(--info)]">B · {shortName(b)}</strong>
                  <span className="mt-1 block">{b.comparison.purpose}.</span>
                </p>
                <div className="sm:col-start-2 sm:col-span-2">
                  <p className="text-xs font-semibold text-[color:var(--text-muted)]">
                    {pair?.summary ??
                      "No curated relationship summary is published for this pair; the stored fields below are aligned without interpretation."}
                  </p>
                  {pairSources.length ? (
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[color:var(--text-muted)]">
                      <span className="font-semibold">Relationship source{pairSources.length === 1 ? "" : "s"}:</span>
                      {pairSources.map((source) => (
                        <Link
                          key={source.id}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-dotted underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                        >
                          {source.title}
                        </Link>
                      ))}
                    </p>
                  ) : null}
                </div>
              </section>

              <div className="mt-4 hidden sm:block">
                {comparisonSections.map((section) => (
                  <DesktopComparisonSection key={section.id} section={section} a={a} b={b} />
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:hidden">
                {comparisonSections.map((section, index) => (
                  <PhoneComparisonSection key={section.id} section={section} a={a} b={b} defaultOpen={index === 0} />
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[color:var(--border)] pt-4 text-xs font-semibold text-[color:var(--text-muted)]">
                <span className="inline-flex items-center gap-1 text-[color:var(--success)]">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Both source linked
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {
                    new Set(
                      [...a.sourceRefs, ...b.sourceRefs, ...(pair?.sourceRefs ?? [])].map(
                        (reference) => reference.sourceId,
                      ),
                    ).size
                  }{" "}
                  covered sources
                </span>
              </div>
            </div>
          ) : (
            <section className="mt-5 grid justify-items-center rounded-xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] px-4 py-12 text-center">
              <BookOpen className="size-icon-xl text-[color:var(--decoration-soft)]" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-extrabold text-[color:var(--text-heading)]">
                {a || b ? "Choose the second term" : "Choose two terms"}
              </h2>
              <p className="mt-1 max-w-lg text-sm text-[color:var(--text-muted)]">
                Definitions stay separate and only stored catalogue fields are aligned.
              </p>
              <button
                type="button"
                onClick={() => openPicker(a ? "b" : "a")}
                className="mt-4 inline-flex min-h-tap items-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm font-extrabold text-[color:var(--command-contrast)]"
              >
                <Search className="size-icon-sm" aria-hidden="true" />
                Choose terms
              </button>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link
                  href="/dictionary/compare?a=mental-state-examination&b=mini-mental-state-examination"
                  className="inline-flex min-h-10 items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold"
                >
                  MSE vs MMSE
                </Link>
                <Link
                  href="/dictionary/compare?a=delirium&b=dementia"
                  className="inline-flex min-h-10 items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold"
                >
                  Delirium vs dementia
                </Link>
                <Link
                  href="/dictionary/compare?a=mood&b=affect"
                  className="inline-flex min-h-10 items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold"
                >
                  Mood vs affect
                </Link>
              </div>
            </section>
          )}
        </div>
        <InformationPageFooter>
          Comparison aligns governed catalogue fields only · It does not create clinical guidance
        </InformationPageFooter>
      </InformationPageShell>

      {isPhone ? (
        <Sheet
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          title="Change comparison"
          description="Choose two source-linked entries"
          portal
          placement="responsive-right"
          id="dictionary-compare-picker"
          testId="dictionary-compare-picker"
          footer={
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/dictionary/compare"
                className="inline-flex min-h-tap items-center px-3 text-sm font-bold text-[color:var(--clinical-accent)]"
              >
                Reset
              </Link>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="min-h-tap flex-1 rounded-lg bg-[color:var(--command)] px-4 text-sm font-extrabold text-[color:var(--command-contrast)]"
              >
                {a && b ? `Compare ${shortName(a)} and ${shortName(b)}` : "Done"}
              </button>
            </div>
          }
        >
          {picker}
        </Sheet>
      ) : null}
    </>
  );
}

function shortName(entry: DictionaryEntry) {
  return entry.aliases.find((alias) => alias.kind === "abbreviation")?.value ?? entry.term;
}

function TermIdentity({
  label,
  entry,
  onChange,
  tone,
}: {
  label: string;
  entry: DictionaryEntry | null;
  onChange: () => void;
  tone: "blue" | "teal";
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "grid min-h-[5.5rem] min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
        tone === "blue"
          ? "border-l-[3px] border-l-[color:var(--clinical-accent)]"
          : "border-l-[3px] border-l-[color:var(--info)]",
      )}
    >
      <span
        className={cn(
          "grid h-8 w-8 place-items-center rounded-md text-sm font-extrabold text-[color:var(--command-contrast)]",
          tone === "blue" ? "bg-[color:var(--clinical-accent)]" : "bg-[color:var(--info)]",
        )}
      >
        {label}
      </span>
      <span className="min-w-0">
        <strong className="block truncate text-base text-[color:var(--text-heading)]">
          {entry ? shortName(entry) : "Choose term"}
        </strong>
        <span className="mt-1 block text-xs leading-4 text-[color:var(--text-muted)]">
          {entry?.term ?? "Search the governed dictionary"}
        </span>
      </span>
    </button>
  );
}

function PickerContent({
  a,
  b,
  target,
  setTarget,
  query,
  setQuery,
  hits,
  choose,
}: {
  a: DictionaryEntry | null;
  b: DictionaryEntry | null;
  target: TargetSide;
  setTarget: (target: TargetSide) => void;
  query: string;
  setQuery: (query: string) => void;
  hits: DictionaryEntry[];
  choose: (entry: DictionaryEntry) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-[1fr_2.5rem_1fr] items-center gap-2">
        <button
          type="button"
          onClick={() => setTarget("a")}
          aria-pressed={target === "a"}
          className={cn(
            "min-h-tap rounded-lg border px-3 text-left text-xs font-bold",
            target === "a"
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)]"
              : "border-[color:var(--border)]",
          )}
        >
          <span className="block text-3xs text-[color:var(--text-muted)]">First term</span>
          {a ? shortName(a) : "Choose"}
        </button>
        <ArrowRightLeft className="mx-auto h-4 w-4 text-[color:var(--text-muted)]" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setTarget("b")}
          aria-pressed={target === "b"}
          className={cn(
            "min-h-tap rounded-lg border px-3 text-left text-xs font-bold",
            target === "b"
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)]"
              : "border-[color:var(--border)]",
          )}
        >
          <span className="block text-3xs text-[color:var(--text-muted)]">Second term</span>
          {b ? shortName(b) : "Choose"}
        </button>
      </div>
      <label className="flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border)] px-3">
        <Search className="size-icon-sm text-[color:var(--decoration-soft)]" aria-hidden="true" />
        <span className="sr-only">Search term or abbreviation</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search term or abbreviation"
          className="min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm"
        />
      </label>
      <div className="max-h-[24rem] overflow-y-auto border-y border-[color:var(--border)]">
        {hits.map((entry) => {
          const duplicate = target === "a" ? b?.slug === entry.slug : a?.slug === entry.slug;
          return (
            <button
              key={entry.slug}
              type="button"
              onClick={() => choose(entry)}
              disabled={duplicate}
              className="grid min-h-[4.5rem] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-[color:var(--border)] px-2 py-2.5 text-left last:border-b-0 hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span>
                <strong className="block text-sm text-[color:var(--text-heading)]">{entry.term}</strong>
                <span className="mt-0.5 line-clamp-2 block text-xs leading-4 text-[color:var(--text-muted)]">
                  {entry.definition}
                </span>
                <span className="mt-1 block text-3xs font-bold text-[color:var(--clinical-accent)]">
                  {dictionaryKindLabel(entry.kind)}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function sectionValue(sectionId: string, entry: DictionaryEntry) {
  if (sectionId === "meaning") return entry.meaning;
  if (sectionId === "purpose") return `${entry.comparison.purpose}. ${entry.comparison.scope}`;
  if (sectionId === "context") return entry.comparison.clinicalContext;
  if (sectionId === "relationships")
    return `${entry.aliases.map((alias) => alias.value).join(", ") || "No governed aliases"}. Related: ${entry.relatedSlugs.map((slug) => findDictionaryEntry(slug)?.term ?? slug).join(", ")}.`;
  return `${dictionaryEntrySources(entry).length} covered ${dictionaryEntrySources(entry).length === 1 ? "source" : "sources"}; source linked ${entry.review.checkedOn}.`;
}

function DesktopComparisonSection({
  section,
  a,
  b,
}: {
  section: (typeof comparisonSections)[number];
  a: DictionaryEntry;
  b: DictionaryEntry;
}) {
  const Icon = section.icon;
  return (
    <section className="grid grid-cols-[13rem_1fr_1fr] border-t border-[color:var(--border)] py-4">
      <h2 className="flex items-start gap-2 pr-4 text-base font-extrabold text-[color:var(--text-heading)]">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[color:var(--border)]">
          <Icon className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
        </span>
        {section.label}
      </h2>
      <p className="border-l border-[color:var(--border)] px-5 text-sm leading-6">
        <strong className="mb-1 block text-xs text-[color:var(--clinical-accent)]">A · {shortName(a)}</strong>
        {sectionValue(section.id, a)}
      </p>
      <p className="border-l border-[color:var(--border)] px-5 text-sm leading-6">
        <strong className="mb-1 block text-xs text-[color:var(--info)]">B · {shortName(b)}</strong>
        {sectionValue(section.id, b)}
      </p>
    </section>
  );
}

function PhoneComparisonSection({
  section,
  a,
  b,
  defaultOpen,
}: {
  section: (typeof comparisonSections)[number];
  a: DictionaryEntry;
  b: DictionaryEntry;
  defaultOpen: boolean;
}) {
  const Icon = section.icon;
  return (
    <details
      open={defaultOpen}
      className="source-print rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]"
    >
      <summary className="flex min-h-tap cursor-pointer list-none items-center gap-2 px-3 text-sm font-extrabold">
        <Icon className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
        <span className="flex-1">{section.label}</span>
        <ChevronDown className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden="true" />
      </summary>
      <div className="grid gap-3 border-t border-[color:var(--border)] p-3">
        <p className="border-l-2 border-[color:var(--clinical-accent)] pl-3 text-sm leading-5">
          <strong className="mb-1 block text-xs text-[color:var(--clinical-accent)]">A · {shortName(a)}</strong>
          {sectionValue(section.id, a)}
        </p>
        <p className="border-l-2 border-[color:var(--info)] pl-3 text-sm leading-5">
          <strong className="mb-1 block text-xs text-[color:var(--info)]">B · {shortName(b)}</strong>
          {sectionValue(section.id, b)}
        </p>
      </div>
    </details>
  );
}
