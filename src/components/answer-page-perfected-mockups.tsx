"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Copy,
  ExternalLink,
  FileText,
  Flag,
  Layers,
  Pill,
  Search,
  ShieldAlert,
  Stethoscope,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react";

import { cn } from "@/components/ui-primitives";
import {
  Composer,
  DesktopFrame,
  DetailCard,
  Panel,
  PHONE_WIDTH,
  PhoneFrame,
  PROSE_MEASURE,
  TopBar,
  focusRing,
} from "@/components/answer-chat-perfected-mockups";

/**
 * The answer page, third pass — the page below the prose.
 *
 * /mockups/answer-chat-perfected settled the mark and the drawer, and
 * /mockups/answer-chat-perfected-v2 settled the states. Both stop at the seam
 * where the answer ends. What was built under that seam since — the Key points
 * rail (owner decision 2026-09-03), the status chip row, the horizontal source
 * strip, the collapsed library line and the follow-up rows — was assembled one
 * decision at a time, and a phone photograph of the result on 2026-09-05 shows
 * the join: four uppercase section labels, two amber chips that mean different
 * things, a "Key points" label whose only content is a chip reading
 * "Monitoring 2", and three source cards that all truncate to "Clozapine…".
 *
 * This page draws that photograph as shipped, numbers what is wrong with it,
 * puts three treatments of the key points side by side at reading size, and
 * then draws the whole surface again for phone and desktop with every issue
 * answered. Nothing here is wired to real retrieval. All copy is synthetic,
 * and every clinical figure is illustrative rather than a source of truth.
 */

/* ══════════════════════  data  ══════════════════════ */

const QUESTION = "clozapine ANC monitoring";

type Currency = "current" | "review-due" | "not-recorded";

type StudySource = {
  id: string;
  /** 1-based number as the rail shows it; null for a document that was read but not cited. */
  number: number | null;
  title: string;
  page: number;
  currency: Currency;
  /** The passage the source-only answer is assembled from. */
  passage: string;
};

const SOURCES: StudySource[] = [
  {
    id: "s1",
    number: 1,
    title: "Clozapine Coordinator Antipsychotic Monitoring Guideline",
    page: 4,
    currency: "not-recorded",
    passage:
      "A full blood count with differential is required weekly for the first 18 weeks of treatment and every four weeks thereafter for as long as clozapine continues. A result must be available before each dispensing.",
  },
  {
    id: "s2",
    number: 2,
    title: "Clozapine Prescribing, Administration and Monitoring Policy",
    page: 2,
    currency: "not-recorded",
    passage:
      "An absolute neutrophil count between 1.5 and 2.0 × 10⁹/L is an amber result. Repeat the full blood count twice weekly until the count returns to the green range, and notify the clozapine coordinator.",
  },
  {
    id: "s3",
    number: 3,
    title: "Clozapine Prescribing (NMHS) Clinical Guideline",
    page: 15,
    currency: "not-recorded",
    passage:
      "Stop clozapine immediately if the absolute neutrophil count falls below 1.5 × 10⁹/L. Repeat the full blood count daily until recovery, and do not rechallenge without haematology advice and the coordinator's agreement.",
  },
  {
    id: "s4",
    number: null,
    title: "Clozapine Patient Information Leaflet",
    page: 5,
    currency: "current",
    passage: "",
  },
];

const CITED = SOURCES.filter((source) => source.number !== null);
const UNCITED = SOURCES.filter((source) => source.number === null);

type Tone = "stop" | "act" | "know";

type KeyPoint = {
  id: string;
  kind: string;
  tone: Tone;
  text: string;
  sourceId: string;
};

/** `SafetyFinding` as `groupSafetyFindingsByKind` sees it: a label per kind, the
 *  whole passage as text, and a citation. Two findings of one kind, which is why
 *  the shipped rail shows "Monitoring 2" and nothing else. */
const KEY_POINTS: KeyPoint[] = [
  {
    id: "k1",
    kind: "Monitoring",
    tone: "stop",
    text: "Stop clozapine immediately if the ANC falls below 1.5 × 10⁹/L. Repeat the FBC daily until recovery, and do not rechallenge without haematology advice.",
    sourceId: "s3",
  },
  {
    id: "k2",
    kind: "Monitoring",
    tone: "act",
    text: "ANC 1.5 to 2.0 × 10⁹/L is an amber result. Repeat the FBC twice weekly until it returns to the green range and notify the clozapine coordinator.",
    sourceId: "s2",
  },
];

const FOLLOW_UPS_SHIPPED = [
  "What are the adjacent thresholds or bands for clozapine?",
  "What action is required at each band for clozapine?",
  "What does the indexed guidance not cover for clozapine?",
];

const FOLLOW_UPS = [
  "What counts as a green, amber and red ANC result?",
  "How often is the FBC repeated after week 18?",
  "What happens if a scheduled blood test is missed?",
];

type LibraryLink = { title: string; kind: string; Icon: typeof Pill; accent: "medication" | "differential" };

const LIBRARY: LibraryLink[] = [
  { title: "Clozapine", kind: "Medication", Icon: Pill, accent: "medication" },
  { title: "Clozapine-specific adverse effects", kind: "Differentials", Icon: Stethoscope, accent: "differential" },
];

/** The prose a model-written answer to the same question would carry, with
 *  the mark index each sentence earns. */
const READY_PROSE: Array<{ text: string; marks: number[] }> = [
  {
    text: "A full blood count is required weekly for the first 18 weeks of clozapine and every four weeks after that, with a result on file before each dispensing.",
    marks: [1],
  },
  {
    text: "An ANC between 1.5 and 2.0 × 10⁹/L is an amber result: repeat the count twice weekly until it is back in the green range and tell the clozapine coordinator.",
    marks: [2],
  },
  {
    text: "Below 1.5 × 10⁹/L clozapine is stopped immediately, the count is repeated daily until it recovers, and rechallenge needs haematology advice.",
    marks: [3],
  },
];

const sourceById = (id: string) => SOURCES.find((source) => source.id === id) ?? SOURCES[0];

/* ══════════════════════  the issues  ══════════════════════ */

type Issue = {
  n: number;
  where: string;
  problem: string;
  fix: string;
  severity: "high" | "medium" | "low";
};

/** Numbered to match the callouts drawn on the as-shipped phone. Severity is
 *  about what the reader loses, not about how large the change is. */
const ISSUES: Issue[] = [
  {
    n: 1,
    where: "Key points",
    severity: "high",
    problem:
      'The label promises points and delivers one chip reading "Monitoring 2". The two points themselves are behind a tap, the chip looks like a filter tab rather than a control, and a clinician scanning for the threshold has to open a sheet to find it.',
    fix: "Render the points as full-width lines under the label: tone rule, the finding's first sentence clamped to two lines, and the source number. Keep the sheet behind an “All points” link when there are more than four.",
  },
  {
    n: 2,
    where: "Status chips",
    severity: "high",
    problem:
      '"Review support" and "Source-only · 2 limitations" are two amber chips in the same shape that mean different things: one is evidence strength, the other is provenance plus a count. "Review support" also reads as an instruction. Two identical alarms teach the reader to skip both.',
    fix: "One sentence in words, said once, with the one control that opens the limitations sheet. The governed words “Source-only” stay on that control; the support strength becomes a phrase in the sentence, not a chip.",
  },
  {
    n: 3,
    where: "Fallback prose",
    severity: "high",
    problem:
      'The source-only paragraph apologises into vagueness ("could not be completed just now", "please review them directly") and points at passages the page then hides inside title-only cards. SPEC §10 asks a fallback to name itself and never apologise.',
    fix: "State the fallback in one line, then show the passages. On a source-only answer the passages are the answer, so each cited document draws its matched passage in place, numbered to match the source list.",
  },
  {
    n: 4,
    where: "Cited documents",
    severity: "high",
    problem:
      'Three cards truncate to "Clozapine Coordinator An…", "Clozapine Prescribing, Ad…" and "Clozapine Prescribing (N…", so the part that tells them apart is the part that is cut. "Status unknown" repeats three times and says nothing. The fourth card is clipped off the right edge with only a gradient to say so.',
    fix: "A vertical list. Full title on up to two lines, page number, and currency only when it is known. One footnote covers the documents whose review date is not recorded. The uncited document sits last with a dash and the words “read, not cited”.",
  },
  {
    n: 5,
    where: "Cited count",
    severity: "low",
    problem: '"3 cited · 1 also found" is internal vocabulary; "also found" is never explained on the page.',
    fix: "“3 cited, 1 more read but not cited”, and the uncited row says the same thing in its own words.",
  },
  {
    n: 6,
    where: "How this answer was built",
    severity: "medium",
    problem:
      "A disclosure about how the answer was made sits above the question it describes, orphaned from the answer and from the limitations sheet that already explains the answer's provenance.",
    fix: "Move it into the limitations sheet as its last section. Nothing sits above the question except the thread.",
  },
  {
    n: 7,
    where: "Also in your library",
    severity: "medium",
    problem:
      "The collapsed line names the two matches, then two cards below name them again with ragged widths, a coloured tile that carries no meaning, an internal badge (“SGA / TRS”) and a bare magnifier button whose action is a guess.",
    fix: "One row per match under the sources: name, what it is in words, and a text action “Search” rather than an icon. The tile goes; the mode's icon sits in the row at glyph size.",
  },
  {
    n: 8,
    where: "Section labels",
    severity: "medium",
    problem:
      "KEY POINTS, CITED DOCUMENTS, ALSO IN YOUR LIBRARY and FOLLOW UP are four uppercase eyebrows of one weight in one screen, so the page reads as a form with fields rather than an answer with support.",
    fix: "Two labels at most: “Key points” beside the prose and “Sources” over everything that supports it. The library matches and the follow-ups are rows inside those groups, not sections of their own.",
  },
  {
    n: 9,
    where: "Actions",
    severity: "low",
    problem:
      "Two thumb icons float at the far right of the copy row with no words. A thumb down is the only route to reporting a wrong citation, and nothing says so.",
    fix: "“Copy with sources” left; “Helpful” and “Report a problem” right, each with its word. At 390px the three still fit one row.",
  },
  {
    n: 10,
    where: "Follow up",
    severity: "low",
    problem:
      'Rows are the right shape, but the questions are template output ("adjacent thresholds or bands", "what does the indexed guidance not cover") and read as machine-written.',
    fix: "Layout kept. The generator should phrase each row as a question a clinician would actually ask next; three examples are drawn.",
  },
  {
    n: 11,
    where: "Desktop",
    severity: "medium",
    problem:
      "The answer sits in a narrow column with the right half of the screen empty, while the sources still scroll sideways inside that column as though the screen were a phone.",
    fix: "From 1024px the sources, the library matches and the currency footnote move to a right column beside the answer. The prose keeps its 68ch measure; nothing scrolls sideways.",
  },
];

/** What this page changes that already has an owner decision on record. */
const DECISIONS: Array<[string, string, string]> = [
  [
    "Key points rail at the seam",
    "Owner decision 2026-09-03: findings render below the prose, one pill per kind, opening the sheet.",
    "Place kept. Form changed from pills to lines, because a pill per kind cannot show a point; the sheet stays for the overflow.",
  ],
  [
    "Status line = support chip + limitations control",
    "answer-result-surface.tsx: two chips of one shape so they read as one status line.",
    "One sentence and one control. The limitations chip keeps its exact label so the tests that pin “Source-only” and “Review due” still hold.",
  ],
  [
    "Library links as one collapsed line",
    "Owner decision 2026-08-26: the answer thread shows the line variant, opened on demand.",
    "Still one tap from the answer, but the opened state is rows under the sources, not a second panel that repeats the line.",
  ],
  [
    "Follow-up questions as rows",
    "Owner decision 2026-08-26: one question per full-width row, never chips.",
    "Unchanged. Only the copy is questioned.",
  ],
  [
    "Horizontal source rail",
    "PR #2362: cards in a snap-scrolling strip.",
    "Replaced by a list on every width. The strip was chosen for a three-source model-written answer; on a source-only answer the list is the whole reference system and cannot be the thing that truncates.",
  ],
];

/* ══════════════════════  shared pieces  ══════════════════════ */

const eyebrow = "text-3xs font-semibold uppercase tracking-eyebrow text-[color:var(--text-muted)]";
const sectionLabel = "text-2xs font-semibold text-[color:var(--text-muted)]";

function UserTurn({ text = QUESTION }: { text?: string }) {
  return (
    <div className="flex justify-end">
      <p
        style={{ maxWidth: "85%", borderBottomRightRadius: 6 }}
        className="rounded-2xl bg-[color:var(--clinical-accent-soft)] px-3.5 py-2 text-sm leading-6 text-[color:var(--text-heading)]"
      >
        {text}
      </p>
    </div>
  );
}

function currencyLabel(currency: Currency) {
  if (currency === "current") return "Current";
  if (currency === "review-due") return "Review due";
  return null;
}

function NumberBadge({ number, tone = "accent" }: { number: number | null; tone?: "accent" | "warning" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "nums grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-[var(--radius-sm)] border px-1 text-2xs font-bold",
        number === null
          ? "border-dashed border-[color:var(--border-strong)] text-[color:var(--text-muted)]"
          : tone === "warning"
            ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
            : "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
      )}
    >
      {number ?? "—"}
    </span>
  );
}

function ToneIcon({ tone, className }: { tone: Tone; className?: string }) {
  if (tone === "stop")
    return <ShieldAlert aria-hidden="true" className={cn("text-[color:var(--danger)]", className)} />;
  if (tone === "act")
    return <TriangleAlert aria-hidden="true" className={cn("text-[color:var(--warning)]", className)} />;
  return <CircleAlert aria-hidden="true" className={cn("text-[color:var(--text-muted)]", className)} />;
}

/** A numbered red callout, drawn on the as-shipped frame only. */
function Callout({ n }: { n: number }) {
  return (
    <span
      aria-label={`Issue ${n}`}
      className="absolute -right-1 -top-2 z-10 grid h-5 w-5 place-items-center rounded-full bg-[color:var(--danger-solid)] text-3xs font-bold text-[color:var(--danger-solid-contrast)] shadow-[var(--e1)]"
    >
      {n}
    </span>
  );
}

/* ══════════════════════  as shipped  ══════════════════════ */

/** The 2026-09-05 photograph, redrawn at the same size with the same data, so
 *  the perfected frame beside it is judged against the real thing rather than a
 *  memory of it. Every region carries the number of its issue above. */
function ShippedScreen() {
  const chip =
    "inline-flex min-h-6 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/60 text-[color:var(--text-heading)]";
  return (
    <>
      <TopBar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-3 px-3 py-3">
          <div className="relative">
            <Callout n={6} />
            <p className="flex items-center gap-1 text-2xs font-medium text-[color:var(--text-muted)]">
              <ChevronRight aria-hidden="true" className="h-3 w-3" />
              How this answer was built
            </p>
          </div>
          <UserTurn />
          <div className="relative flex flex-wrap gap-1.5 pt-1">
            <Callout n={2} />
            <span className={chip}>
              <TriangleAlert aria-hidden="true" className="h-3 w-3 text-[color:var(--warning)]" />
              Review support
            </span>
            <span className={cn(chip, "border-[color:var(--border)] bg-[color:var(--surface-wash)]")}>
              <CircleAlert aria-hidden="true" className="h-3 w-3 text-[color:var(--warning)]" />
              Source-only · 2 limitations
            </span>
          </div>
          <div className="relative">
            <Callout n={3} />
            <p className="text-base-minus leading-prose text-[color:var(--text-heading)]">
              The uploaded documents contain relevant guidance on clozapine ANC monitoring, but a full written answer
              could not be completed just now. Relevant document passages are cited below — please review them directly.
            </p>
          </div>
          <div className="relative flex items-center gap-2">
            <Callout n={1} />
            <span className={eyebrow}>Key points</span>
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-wash)] px-2.5 text-2xs font-medium text-[color:var(--text)]">
              <CircleAlert aria-hidden="true" className="h-3 w-3 text-[color:var(--text-muted)]" />
              Monitoring <span className="nums text-[color:var(--text-muted)]">2</span>
            </span>
          </div>
          <div className="relative">
            <Callout n={4} />
            <p className={cn("mb-1.5 flex items-baseline justify-between", eyebrow)}>
              <span>Cited documents</span>
              <span className="relative mr-4 nums font-normal normal-case tracking-normal">
                <Callout n={5} />3 cited · 1 also found
              </span>
            </p>
            <div className="relative overflow-hidden">
              <div className="flex gap-1.5">
                {SOURCES.map((source) => (
                  <span
                    key={source.id}
                    className="inline-flex min-h-12 shrink-0 items-center gap-2.5 rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-1.5"
                  >
                    <NumberBadge number={source.number} />
                    <span className="grid gap-0.5">
                      <span className="block max-w-[158px] truncate text-xs font-semibold text-[color:var(--text-heading)]">
                        {source.title}
                      </span>
                      <span className="text-2xs text-[color:var(--text-muted)]">
                        p. {source.page} · {source.currency === "current" ? "Current" : "Status unknown"}
                      </span>
                    </span>
                  </span>
                ))}
              </div>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[color:var(--background)] to-transparent"
              />
            </div>
          </div>
          <div className="relative flex items-center justify-between pt-1">
            <Callout n={9} />
            <span className="inline-flex items-center gap-1.5 text-2xs font-semibold text-[color:var(--text-muted)]">
              <Copy aria-hidden="true" className="h-3.5 w-3.5" />
              Copy with sources
            </span>
            <span className="flex items-center gap-4 pr-3 text-[color:var(--text-muted)]">
              <ThumbsUp aria-hidden="true" className="h-3.5 w-3.5" />
              <ThumbsDown aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="relative space-y-2">
            <Callout n={7} />
            <div className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-2.5">
              <span className={cn(eyebrow, "shrink-0")}>Also in your library</span>
              <span className="min-w-0 flex-1 truncate text-2xs text-[color:var(--text-muted)]">
                Clozapine · Clozapine-specific adverse effects
              </span>
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)]" />
            </div>
            {LIBRARY.map((link) => (
              <div
                key={link.title}
                className="flex w-fit max-w-full items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2.5 py-1.5"
              >
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full border",
                    link.accent === "medication"
                      ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
                      : "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
                  )}
                >
                  <link.Icon aria-hidden="true" className="h-3.5 w-3.5" />
                </span>
                <span className="truncate text-sm font-semibold text-[color:var(--text-heading)]">{link.title}</span>
                <span className="inline-flex min-h-6 shrink-0 items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-wash)] px-2 text-2xs font-semibold text-[color:var(--text-muted)]">
                  {link.kind}
                </span>
                {link.accent === "medication" ? (
                  <span className="inline-flex min-h-6 shrink-0 items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-wash)] px-2 text-2xs font-semibold text-[color:var(--text-muted)]">
                    SGA / TRS
                  </span>
                ) : null}
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[color:var(--border)] text-[color:var(--text-muted)]">
                  <Search aria-hidden="true" className="h-4 w-4" />
                </span>
              </div>
            ))}
          </div>
          <div className="relative">
            <Callout n={10} />
            <p className={cn("mb-1.5", eyebrow)}>Follow up</p>
            <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)]">
              {FOLLOW_UPS_SHIPPED.map((item, index) => (
                <span
                  key={item}
                  className={cn(
                    "flex min-h-12 items-center gap-2 px-3 text-xs font-medium text-[color:var(--text-heading)]",
                    index > 0 && "border-t border-[color:var(--border)]",
                  )}
                >
                  <span className="min-w-0 flex-1">{item}</span>
                  <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)]" />
                </span>
              ))}
            </div>
          </div>
          <div className="relative pt-2">
            <Callout n={8} />
            <p className="text-2xs leading-5 text-[color:var(--text-muted)]">
              Four uppercase labels in one screen: Key points, Cited documents, Also in your library, Follow up.
            </p>
          </div>
        </div>
      </div>
      <Composer />
    </>
  );
}

/* ══════════════════════  perfected pieces  ══════════════════════ */

type AnswerKind = "source_only" | "ready";

/**
 * One sentence, said once. The support strength is a phrase inside it rather
 * than a chip beside it, and the only control is the one that opens the
 * limitations sheet — carrying the governed label the tests pin.
 */
function StatusLine({ kind, onOpenLimitations }: { kind: AnswerKind; onOpenLimitations: () => void }) {
  const sourceOnly = kind === "source_only";
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs leading-5 text-[color:var(--text)]">
      <span className="inline-flex min-w-0 items-center gap-1.5">
        {sourceOnly ? (
          <CircleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--warning)]" />
        ) : (
          <FileText aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--clinical-accent)]" />
        )}
        <span>
          {sourceOnly
            ? "Passages from your documents, not written by AI. Evidence support not assessed."
            : "AI-written from 3 cited documents. Verify each claim at the cited page before acting."}
        </span>
      </span>
      <button
        type="button"
        onClick={onOpenLimitations}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex min-h-8 items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-wash)] px-2.5 text-2xs font-semibold text-[color:var(--text-heading)] transition hover:bg-[color:var(--surface-subtle)]",
          focusRing,
        )}
      >
        {sourceOnly ? "Source-only · 2 limitations" : "1 limitation"}
      </button>
    </div>
  );
}

/** Reading-size lines, not pills. The tone rule and icon carry severity, the
 *  words carry the point, and the number carries the route to its source. */
function KeyPointsLines({
  points,
  onOpenSource,
  activeId,
}: {
  points: KeyPoint[];
  onOpenSource: (id: string) => void;
  activeId: string | null;
}) {
  return (
    <section aria-label={`Key points, ${points.length}`} className="min-w-0">
      <p className={cn("mb-1", sectionLabel)}>Key points</p>
      <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)]">
        {points.map((point, index) => {
          const source = sourceById(point.sourceId);
          return (
            <button
              key={point.id}
              type="button"
              onClick={() => onOpenSource(point.sourceId)}
              aria-pressed={activeId === point.sourceId}
              aria-label={`${point.kind}: ${point.text} Open source ${source.number}, page ${source.page}`}
              className={cn(
                "flex min-h-12 w-full items-start gap-2.5 border-l-2 px-3 py-2 text-left transition hover:bg-[color:var(--surface-subtle)]",
                index > 0 && "border-t border-t-[color:var(--border)]",
                point.tone === "stop"
                  ? "border-l-[color:var(--danger)]"
                  : point.tone === "act"
                    ? "border-l-[color:var(--warning)]"
                    : "border-l-[color:var(--border-strong)]",
                focusRing,
              )}
            >
              <ToneIcon tone={point.tone} className="mt-1 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-xs leading-5 text-[color:var(--text-heading)]">
                  <span className="font-semibold">{point.kind}. </span>
                  {point.text}
                </span>
              </span>
              <span className="mt-0.5">
                <NumberBadge number={source.number} />
              </span>
            </button>
          );
        })}
        {points.length > 4 ? (
          <span className="flex min-h-10 items-center border-t border-[color:var(--border)] px-3 text-2xs font-semibold text-[color:var(--clinical-accent)]">
            All {points.length} points
          </span>
        ) : null}
      </div>
    </section>
  );
}

/** On a source-only answer the passages are the answer, so they are drawn in
 *  place and numbered to match the list below. Two lines each, then the page. */
function PassageList({
  sources,
  onOpenSource,
  activeId,
}: {
  sources: StudySource[];
  onOpenSource: (id: string) => void;
  activeId: string | null;
}) {
  return (
    <ol aria-label="Matching passages" className="grid gap-2">
      {sources.map((source) => (
        <li key={source.id} className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5">
            <NumberBadge number={source.number} />
          </span>
          <div className="min-w-0 flex-1">
            <p style={PROSE_MEASURE} className="text-base-minus leading-prose text-[color:var(--text-heading)]">
              {source.passage}
            </p>
            <button
              type="button"
              onClick={() => onOpenSource(source.id)}
              aria-pressed={activeId === source.id}
              className={cn(
                "mt-0.5 flex max-w-full min-h-8 items-center gap-1 rounded-md text-2xs font-semibold text-[color:var(--clinical-accent)] transition hover:underline",
                focusRing,
              )}
            >
              <span className="min-w-0 truncate">{source.title}</span>
              <span className="nums shrink-0 text-[color:var(--text-muted)]">p. {source.page}</span>
              <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0" />
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ReadyProse({ onOpenSource, activeId }: { onOpenSource: (id: string) => void; activeId: string | null }) {
  return (
    <p style={PROSE_MEASURE} className="text-base-minus leading-prose text-[color:var(--text-heading)]">
      {READY_PROSE.map((sentence, index) => (
        <span key={sentence.text}>
          {index > 0 ? " " : null}
          {sentence.text}
          {sentence.marks.map((mark) => {
            const source = CITED[mark - 1];
            return (
              <button
                key={mark}
                type="button"
                onClick={() => onOpenSource(source.id)}
                aria-pressed={activeId === source.id}
                aria-label={`Source ${mark}, ${source.title}, page ${source.page}`}
                className={cn(
                  "nums ml-0.5 inline-grid h-4 min-w-4 place-items-center rounded-sm border px-0.5 align-super text-[0.6rem] font-bold leading-none",
                  activeId === source.id
                    ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "border-[color:var(--clinical-accent-border)] text-[color:var(--clinical-accent)]",
                  focusRing,
                )}
              >
                {mark}
              </button>
            );
          })}
        </span>
      ))}
    </p>
  );
}

/** The list that replaces the strip. Full title, page, currency only where it
 *  is known, and the uncited document last in its own words. */
function SourceList({
  onOpenSource,
  activeId,
  showLabel = true,
}: {
  onOpenSource: (id: string) => void;
  activeId: string | null;
  showLabel?: boolean;
}) {
  const notRecorded = CITED.filter((source) => source.currency === "not-recorded").length;
  return (
    <section aria-label="Sources behind this answer" className="min-w-0">
      {showLabel ? (
        <p className={cn("mb-1 flex items-baseline justify-between gap-2", sectionLabel)}>
          <span>Sources</span>
          <span className="nums font-normal">
            {CITED.length} cited, {UNCITED.length} more read but not cited
          </span>
        </p>
      ) : null}
      <div
        role="list"
        className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)]"
      >
        {SOURCES.map((source, index) => {
          const currency = currencyLabel(source.currency);
          return (
            <div key={source.id} role="listitem" className={cn(index > 0 && "border-t border-[color:var(--border)]")}>
              <button
                type="button"
                onClick={() => onOpenSource(source.id)}
                aria-pressed={activeId === source.id}
                aria-label={`${source.number === null ? "Read, not cited" : `Source ${source.number}`}: ${source.title}, page ${source.page}${currency ? `, ${currency}` : ""}`}
                className={cn(
                  "flex min-h-12 w-full items-center gap-2.5 px-3 py-1.5 text-left transition hover:bg-[color:var(--surface-subtle)]",
                  activeId === source.id && "bg-[color:var(--clinical-accent-soft)]/40",
                  focusRing,
                )}
              >
                <NumberBadge number={source.number} tone={source.currency === "review-due" ? "warning" : "accent"} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-xs font-semibold leading-tight text-[color:var(--text-heading)]">
                    {source.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-2xs leading-tight text-[color:var(--text-muted)]">
                    <span className="nums">p. {source.page}</span>
                    {source.number === null ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>Read, not cited</span>
                      </>
                    ) : null}
                    {currency ? (
                      <>
                        <span aria-hidden>·</span>
                        <span
                          className={
                            source.currency === "review-due" ? "font-semibold text-[color:var(--warning)]" : undefined
                          }
                        >
                          {currency}
                        </span>
                      </>
                    ) : null}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)]" />
              </button>
            </div>
          );
        })}
      </div>
      {notRecorded > 0 ? (
        <p className="mt-1 text-2xs leading-5 text-[color:var(--text-muted)]">
          Review dates are not recorded for {notRecorded} of the cited documents.
        </p>
      ) : null}
    </section>
  );
}

/** Rows, not cards. The mode's icon at glyph size, the name, what it is in
 *  words, and a text action. No tile, no internal badge, no bare magnifier. */
function LibraryRows({ showLabel = true }: { showLabel?: boolean }) {
  return (
    <section aria-label="Also in your library" className="min-w-0">
      {showLabel ? <p className={cn("mb-1", sectionLabel)}>In your library</p> : null}
      <div
        role="list"
        className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)]"
      >
        {LIBRARY.map((link, index) => (
          <div
            key={link.title}
            role="listitem"
            className={cn(
              "flex min-h-12 items-center gap-2.5 pl-3 pr-1",
              index > 0 && "border-t border-[color:var(--border)]",
            )}
          >
            <link.Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--clinical-accent)]" />
            <button
              type="button"
              onClick={() => undefined}
              className={cn(
                "flex min-h-12 min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-xs font-semibold text-[color:var(--text-heading)] transition hover:text-[color:var(--clinical-accent)]",
                focusRing,
              )}
            >
              <span className="min-w-0">
                <span className="line-clamp-2 leading-tight">{link.title}</span>
                <span className="block text-2xs font-normal leading-tight text-[color:var(--text-muted)]">
                  {link.kind}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => undefined}
              aria-label={`Search ${link.title} in ${link.kind}`}
              className={cn(
                "inline-flex min-h-12 shrink-0 items-center gap-1 rounded-md px-2 text-2xs font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--clinical-accent)]",
                focusRing,
              )}
            >
              <Search aria-hidden="true" className="h-3.5 w-3.5" />
              Search
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function FollowUpRows() {
  return (
    <section aria-label="Follow-up questions" className="min-w-0">
      <p className={cn("mb-1", sectionLabel)}>Ask next</p>
      <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)]">
        {FOLLOW_UPS.map((item, index) => (
          <button
            key={item}
            type="button"
            onClick={() => undefined}
            className={cn(
              "flex min-h-12 w-full items-center gap-2 px-3 text-left text-xs font-medium leading-5 text-[color:var(--text-heading)] transition hover:bg-[color:var(--surface-subtle)]",
              index > 0 && "border-t border-[color:var(--border)]",
              focusRing,
            )}
          >
            <span className="min-w-0 flex-1">{item}</span>
            <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)]" />
          </button>
        ))}
      </div>
    </section>
  );
}

/** Copy left, the two verdicts right, each with its word. Measured at 390px:
 *  the three fit one row with 40px to spare. */
function ActionRow() {
  const action =
    "inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-2xs font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-heading)]";
  return (
    <div className="flex items-center gap-1" aria-label="Answer actions">
      <button type="button" onClick={() => undefined} className={cn(action, "-ml-2", focusRing)}>
        <Copy aria-hidden="true" className="h-3.5 w-3.5" />
        Copy with sources
      </button>
      <span className="ms-auto flex items-center gap-1">
        <button type="button" onClick={() => undefined} className={cn(action, focusRing)}>
          <ThumbsUp aria-hidden="true" className="h-3.5 w-3.5" />
          Helpful
        </button>
        <button type="button" onClick={() => undefined} className={cn(action, "-mr-2", focusRing)}>
          <Flag aria-hidden="true" className="h-3.5 w-3.5" />
          Report a problem
        </button>
      </span>
    </div>
  );
}

/** The limitations sheet, with "How this answer was built" as its last section
 *  rather than a disclosure above the question. */
function LimitationsSheet({ kind, wide, onClose }: { kind: AnswerKind; wide: boolean; onClose: () => void }) {
  const items =
    kind === "source_only"
      ? [
          [
            "Source-only",
            "No model wrote this answer. The passages above are the matching text from your documents, shown as found.",
          ],
          ["Support not assessed", "Evidence strength is only graded on a written answer, so none is shown here."],
          [
            "Review dates not recorded",
            "The three cited documents carry no review date, so their currency is unknown rather than confirmed.",
          ],
        ]
      : [
          [
            "Review date not recorded",
            "One cited document carries no review date, so its currency is unknown rather than confirmed.",
          ],
        ];
  return (
    <div
      role="dialog"
      aria-label="Answer limitations"
      className={cn(
        "absolute bottom-2 z-20 rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-elevated)]",
        // A sheet from the bottom on the phone. On desktop, a panel the width of the prose
        // column, so the source list beside it stays readable while it is open.
        wide ? "left-5 w-[26rem]" : "inset-x-2",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]">
          <CircleAlert aria-hidden="true" className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base-minus font-semibold leading-5 text-[color:var(--text-heading)]">Answer limitations</p>
          <p className="text-2xs text-[color:var(--text-muted)]">What qualifies the evidence behind this answer.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn("min-h-8 rounded-md px-2 text-2xs font-semibold text-[color:var(--text-muted)]", focusRing)}
        >
          Close
        </button>
      </div>
      <dl className="mt-3 grid gap-2">
        {items.map(([title, body]) => (
          <div
            key={title}
            className="rounded-md border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/50 px-2.5 py-2"
          >
            <dt className="text-3xs font-semibold uppercase tracking-eyebrow text-[color:var(--warning)]">{title}</dt>
            <dd className="text-xs leading-5 text-[color:var(--text)]">{body}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 border-t border-[color:var(--border)] pt-2">
        <p className={cn("mb-1", sectionLabel)}>How this answer was built</p>
        <ol className="space-y-0.5 border-l border-[color:var(--border)] pl-3 text-2xs leading-5 text-[color:var(--text-muted)]">
          <li>Read 4 documents, 11 passages</li>
          <li>Checked each passage against your library&rsquo;s governance rules</li>
          {kind === "source_only" ? (
            <li>A written answer was not produced, so the passages are shown as found</li>
          ) : (
            <li>Wrote the answer and checked every claim against its passage</li>
          )}
        </ol>
      </div>
    </div>
  );
}

/* ══════════════════════  the perfected screen  ══════════════════════ */

function PerfectedScreen({
  kind,
  wide,
  initialLimitationsOpen = false,
}: {
  kind: AnswerKind;
  wide: boolean;
  initialLimitationsOpen?: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [limitationsOpen, setLimitationsOpen] = useState(initialLimitationsOpen);
  const openSource = (id: string) => setActiveId((current) => (current === id ? null : id));

  const lead =
    kind === "source_only" ? (
      <p style={PROSE_MEASURE} className="text-base-minus leading-prose text-[color:var(--text-heading)]">
        No written answer was produced for this question. These are the three closest passages in your documents, each
        with the page it comes from.
      </p>
    ) : null;

  const answerColumn = (
    <div className="min-w-0 space-y-3">
      <StatusLine kind={kind} onOpenLimitations={() => setLimitationsOpen(true)} />
      {lead}
      {kind === "source_only" ? (
        <PassageList sources={CITED} onOpenSource={openSource} activeId={activeId} />
      ) : (
        <ReadyProse onOpenSource={openSource} activeId={activeId} />
      )}
      <KeyPointsLines points={KEY_POINTS} onOpenSource={openSource} activeId={activeId} />
      <ActionRow />
    </div>
  );

  const supportColumn = (
    <div className="min-w-0 space-y-3">
      <SourceList onOpenSource={openSource} activeId={activeId} />
      <LibraryRows />
    </div>
  );

  return (
    <>
      <TopBar />
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {wide ? (
          <div className="mx-auto w-full max-w-5xl space-y-4 px-5 py-5">
            <UserTurn />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
              <div className="space-y-4">
                {answerColumn}
                <FollowUpRows />
              </div>
              <aside className="lg:sticky lg:top-0">{supportColumn}</aside>
            </div>
          </div>
        ) : (
          <div className="space-y-3 px-3 py-3">
            <UserTurn />
            {answerColumn}
            {supportColumn}
            <FollowUpRows />
          </div>
        )}
        {limitationsOpen ? (
          <LimitationsSheet kind={kind} wide={wide} onClose={() => setLimitationsOpen(false)} />
        ) : null}
      </div>
      <Composer />
    </>
  );
}

/* ══════════════════════  key-point alternatives  ══════════════════════ */

/** Three treatments at reading size. The first is what ships. */
function KeyPointAlternatives() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const openSource = (id: string) => setActiveId((current) => (current === id ? null : id));
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <DetailCard
        title="A · Chips per kind, as shipped"
        body="One pill per finding kind with a count. Costs one tap to read anything, and two findings of one kind collapse to a number. Rejected: the label says points and shows none."
      >
        <div className="flex items-center gap-2">
          <span className={eyebrow}>Key points</span>
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-wash)] px-2.5 text-2xs font-medium text-[color:var(--text)]">
            <CircleAlert aria-hidden="true" className="h-3 w-3 text-[color:var(--text-muted)]" />
            Monitoring <span className="nums text-[color:var(--text-muted)]">2</span>
          </span>
        </div>
      </DetailCard>
      <DetailCard
        title="B · Lines with a tone rule — recommended"
        body="Each finding as a full-width row: severity rule and icon, the kind as a run-in word, the text clamped to two lines, the source number at the end. Four or fewer render in full; more show four and a link to the sheet."
      >
        <KeyPointsLines points={KEY_POINTS} onOpenSource={openSource} activeId={activeId} />
      </DetailCard>
      <DetailCard
        title="C · Folded into the passages"
        body="No block at all: the sentence that is the finding is emphasised inside its passage and tagged with the tone. Quietest, but the reader has to find the emphasis, and on a written answer there is no passage to fold into. Kept as the print treatment."
      >
        <div className="space-y-2.5">
          {KEY_POINTS.map((point) => {
            const source = sourceById(point.sourceId);
            return (
              <div key={point.id} className="flex items-start gap-2">
                <NumberBadge number={source.number} />
                <p className="text-xs leading-5 text-[color:var(--text-heading)]">
                  <span
                    className={cn(
                      "rounded-sm px-0.5 font-semibold",
                      point.tone === "stop" ? "bg-[color:var(--danger-soft)]" : "bg-[color:var(--warning-soft)]",
                    )}
                  >
                    {point.text.split(". ")[0]}.
                  </span>{" "}
                  {point.text.split(". ").slice(1).join(". ")}
                </p>
              </div>
            );
          })}
        </div>
      </DetailCard>
    </div>
  );
}

/* ══════════════════════  the page  ══════════════════════ */

export function AnswerPagePerfectedMockupsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6">
      <header className="mb-6">
        <p className={eyebrow}>Answer page · third pass</p>
        <h1 className="mt-1 text-2xl font-semibold text-[color:var(--text-heading)]">Below the prose</h1>
        <p style={PROSE_MEASURE} className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
          The first two passes settled the mark and the drawer, and stopped at the seam where the answer ends. This page
          is about everything under that seam, photographed on 2026-09-05: the key points, the status chips, the source
          strip, the library line and the follow-ups. It draws the photograph as shipped with its problems numbered,
          puts three treatments of the key points side by side at reading size, and then draws the whole surface again
          for phone and desktop with every numbered problem answered.
        </p>
        <p className="mt-2 text-2xs text-[color:var(--text-muted)]">
          Synthetic copy throughout. Clinical figures are illustrative and are not a source of truth.
        </p>
      </header>

      <div className="space-y-8">
        <Panel
          step="One"
          title="As shipped, numbered"
          intro="The phone photograph redrawn at the same size with the same data, so the frame beside it is judged against the real thing. Each red number is a row in the table below."
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <div className="lg:shrink-0" style={{ width: "100%", maxWidth: PHONE_WIDTH }}>
              <PhoneFrame caption="Phone · as shipped, 2026-09-05">
                <ShippedScreen />
              </PhoneFrame>
            </div>
            <div className="min-w-0 flex-1 overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[color:var(--border)]">
                    {["#", "Where", "What is wrong", "What changes"].map((heading) => (
                      <th key={heading} scope="col" className={cn("py-1.5 pr-3", eyebrow)}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ISSUES.map((issue) => (
                    <tr key={issue.n} className="border-b border-[color:var(--border)] align-top">
                      <td className="py-2 pr-3">
                        <span
                          className={cn(
                            "nums grid h-5 w-5 place-items-center rounded-full text-3xs font-bold",
                            issue.severity === "high"
                              ? "bg-[color:var(--danger-solid)] text-[color:var(--danger-solid-contrast)]"
                              : issue.severity === "medium"
                                ? "bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
                                : "bg-[color:var(--surface-wash)] text-[color:var(--text-muted)]",
                          )}
                        >
                          {issue.n}
                        </span>
                      </td>
                      <th scope="row" className="py-2 pr-3 text-2xs font-semibold text-[color:var(--text-heading)]">
                        {issue.where}
                      </th>
                      <td className="py-2 pr-3 text-2xs leading-5 text-[color:var(--text-muted)]">{issue.problem}</td>
                      <td className="py-2 text-2xs leading-5 text-[color:var(--text)]">{issue.fix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-2xs text-[color:var(--text-muted)]">
                Red numbers: the reader loses information. Amber: the reader loses time. Grey: wording.
              </p>
            </div>
          </div>
        </Panel>

        <Panel
          step="Two"
          title="Key points, three ways"
          intro="The chip row is the thing that looks wrong first, and it is wrong for a structural reason: a pill per kind cannot hold a point. Three treatments at reading size; B is the one the perfected frames use."
        >
          <KeyPointAlternatives />
        </Panel>

        <Panel
          step="Three"
          title="Perfected · phone"
          intro="The screenshot's own case first: a source-only answer with three cited documents, one more read, and two monitoring findings. Then the same surface when the model did write the answer, to show that nothing under the prose has to change shape between the two."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <PhoneFrame caption="Source-only · the photographed case">
              <PerfectedScreen kind="source_only" wide={false} />
            </PhoneFrame>
            <PhoneFrame caption="AI-written · same question, numbered marks">
              <PerfectedScreen kind="ready" wide={false} />
            </PhoneFrame>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <DetailCard
              title="What the reader sees first"
              body="Order on the phone, top to bottom: the question, one status sentence, the answer (passages or prose), the key points, the actions, then the sources. The support arrives after the thing it supports, and every number in the answer has a row in the list."
            >
              <ol className="list-decimal space-y-1 pl-4 text-2xs leading-5 text-[color:var(--text)]">
                <li>One sentence says who wrote it and how far to trust it. One control opens the detail.</li>
                <li>On a source-only answer the passages are shown, numbered, with the page under each.</li>
                <li>Key points are readable lines. Tapping one lights its source in the list.</li>
                <li>Two section labels in the whole screen, both sentence case.</li>
              </ol>
            </DetailCard>
            <DetailCard
              title="What is deliberately not drawn"
              body="Three things the photograph had that this frame does not, and why."
            >
              <ul className="space-y-1 text-2xs leading-5 text-[color:var(--text)]">
                <li>
                  <span className="font-semibold">A second amber chip.</span> Support strength is a phrase in the
                  sentence. Amber is reserved for the one control that opens the limitations.
                </li>
                <li>
                  <span className="font-semibold">&ldquo;Status unknown&rdquo; three times.</span> A currency is shown
                  only when it is known; one footnote covers the rest.
                </li>
                <li>
                  <span className="font-semibold">A sideways scroll.</span> Nothing on this surface scrolls horizontally
                  at any width.
                </li>
              </ul>
            </DetailCard>
          </div>
        </Panel>

        <Panel
          step="Four"
          title="Perfected · desktop"
          intro="From 1024px the support moves beside the answer rather than under it. The prose keeps its 68ch measure, the sources and library matches sit in an 18rem column that stays put while the answer scrolls, and the follow-ups stay with the answer because they continue it."
        >
          <div className="space-y-4">
            <DesktopFrame caption="Desktop · source-only, sources beside the answer">
              <PerfectedScreen kind="source_only" wide />
            </DesktopFrame>
            <DesktopFrame caption="Desktop · AI-written, limitations open">
              <PerfectedScreen kind="ready" wide initialLimitationsOpen />
            </DesktopFrame>
          </div>
        </Panel>

        <Panel
          step="Five"
          title="What this touches that already has an owner"
          intro="Five decisions on record that this page changes or leans on. Each wants a sentence in the PR that builds it rather than being discovered at review."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-[color:var(--border)]">
                  {["Surface", "On record", "This design"].map((heading) => (
                    <th key={heading} scope="col" className={cn("py-1.5 pr-3", eyebrow)}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DECISIONS.map(([surface, today, now]) => (
                  <tr key={surface} className="border-b border-[color:var(--border)] align-top">
                    <th scope="row" className="py-2 pr-3 text-2xs font-semibold text-[color:var(--text-heading)]">
                      {surface}
                    </th>
                    <td className="py-2 pr-3 text-2xs leading-5 text-[color:var(--text-muted)]">{today}</td>
                    <td className="py-2 text-2xs leading-5 text-[color:var(--text)]">{now}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={PROSE_MEASURE} className="mt-4 text-2xs leading-5 text-[color:var(--text-muted)]">
            Build order if this is approved: the status sentence and the key-point lines first, because they change what
            the reader sees before the first source and touch no data; then the source list, which replaces the strip on
            every answer; then the desktop column. The limitations sheet content, the drawer and the marks are unchanged
            and are not part of this page.
          </p>
        </Panel>
      </div>
      <p className="mt-6 flex items-center gap-1.5 text-2xs text-[color:var(--text-muted)]">
        <Layers aria-hidden="true" className="h-3 w-3" />
        Builds on /mockups/answer-chat-perfected and /mockups/answer-chat-perfected-v2.
        <ExternalLink aria-hidden="true" className="h-3 w-3" />
      </p>
    </main>
  );
}
