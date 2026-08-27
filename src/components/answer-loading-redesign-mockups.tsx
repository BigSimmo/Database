"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Activity, Check, FileText, Loader2, Pause, Play, RotateCcw, Search, Square } from "lucide-react";

import {
  Composer,
  DesktopFrame,
  DetailCard,
  Panel,
  PhoneFrame,
  PROSE_MEASURE,
  TopBar,
  UserTurn,
  focusRing,
  type SourceStatus,
} from "@/components/answer-chat-perfected-mockups";
import { cn } from "@/components/ui-primitives";

/**
 * The wait, redrawn to match the answer it precedes.
 *
 * `/mockups/answer-chat-perfected-v2` and the two PRs that landed from it
 * (#2386, #2388) spent their whole argument on subtraction: the assistant
 * avatar came off the turn because a ~2.75rem column cost every line of a
 * clinical answer on a 390px phone; the safety card lost a warning-coloured
 * rule that spanned two controls carrying no state; the second copies of the
 * follow-up chips and the also-matches panel were deleted. What is left is
 * quiet — muted 2xs status text, one accent, hairlines, and the sources.
 *
 * The loading state was not part of that pass, so `AnswerProgressStepper` went on
 * shipping as written: a filled accent panel carrying an icon tile, a five-circle
 * stepper with connecting rails, a scrolling ECG trace, a per-second elapsed
 * counter and a Processing details disclosure. It was the loudest element on the
 * answer surface, and it occupied that surface for the four to twelve seconds
 * before the answer — so it was the first thing a reader saw and the thing that
 * set their expectation of the answer's register.
 *
 * Direction B below was chosen and applied to the live surface, which is why
 * Panel One is now a redraw: the component it used to import no longer exists.
 * Panels Two and Three hold the three replacements and the argument for the one
 * that won. Panel Four draws the states that are not the happy path, because the
 * wait is where most of them are decided.
 *
 * Nothing here is wired to retrieval. All copy and all counts are synthetic.
 */

/* ══════════════════════  data  ══════════════════════ */

type LoadingSource = {
  id: string;
  index: number;
  short: string;
  origin: string;
  page: number;
  status: SourceStatus;
};

/** Six, because `dedupeSourceLinks` caps primary sources at six and the rail
 *  has to survive its own worst case rather than the three a specimen draws. */
const POOL: LoadingSource[] = [
  {
    id: "s1",
    index: 1,
    short: "Physical health protocol",
    origin: "Statewide mental health · 2025",
    page: 12,
    status: "current",
  },
  {
    id: "s2",
    index: 2,
    short: "Myocarditis surveillance",
    origin: "Local formulary · 2025",
    page: 14,
    status: "current",
  },
  {
    id: "s3",
    index: 3,
    short: "Metabolic monitoring",
    origin: "RANZCP guidance · 2024",
    page: 31,
    status: "current",
  },
  {
    id: "s4",
    index: 4,
    short: "Clozapine titration",
    origin: "Hospital protocol · 2023",
    page: 4,
    status: "review-due",
  },
  {
    id: "s5",
    index: 5,
    short: "Neutropenia thresholds",
    origin: "Haematology pathway · 2025",
    page: 8,
    status: "current",
  },
  {
    id: "s6",
    index: 6,
    short: "Bowel care in clozapine",
    origin: "Statewide mental health · 2025",
    page: 22,
    status: "current",
  },
];

const ANSWER_LINES: Array<{ id: string; text: string; refs: number[] }> = [
  {
    id: "a1",
    text: "Full blood count and absolute neutrophil count at baseline, weekly for the first 18 weeks, fortnightly to week 52, then monthly while treatment continues.",
    refs: [1],
  },
  {
    id: "a2",
    text: "Troponin and CRP at baseline and weekly for the first four weeks, with urgent cardiology review where troponin exceeds twice the upper limit of normal.",
    refs: [2],
  },
  {
    id: "a3",
    text: "Weight, waist circumference, lipids and HbA1c at baseline, at three months, then annually.",
    refs: [3, 5],
  },
];

/* ══════════════════════  the replay clock  ══════════════════════ */

/**
 * A loading state cannot be judged from a still. Every direction below is
 * driven from one shared tick so the three phones move together and can be
 * compared at the same instant, and so a reviewer can stop the clock on the
 * frame they want to argue about.
 *
 * Autoplay is off when the reviewer's OS asks for reduced motion — this page
 * is about restraint, and a page about restraint that ignores the setting
 * would be arguing against itself.
 */
const BEAT_COUNT = 11;

type Phase = "asked" | "searching" | "writing" | "answered";

type Beat = {
  tick: number;
  phase: Phase;
  found: number;
  scanned: number;
  seconds: number;
};

const BEAT_SECONDS = [0, 0.6, 1.1, 1.5, 1.9, 2.3, 2.7, 3.4, 4.6, 6.1, 7.2];

function beatFor(tick: number): Beat {
  const seconds = BEAT_SECONDS[tick] ?? 0;
  if (tick === 0) return { tick, phase: "asked", found: 0, scanned: 0, seconds };
  if (tick <= 6) {
    return { tick, phase: "searching", found: tick, scanned: Math.round((2_140 * tick) / 6), seconds };
  }
  if (tick <= 9) return { tick, phase: "writing", found: 6, scanned: 2_140, seconds };
  return { tick, phase: "answered", found: 6, scanned: 2_140, seconds };
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Subscribed rather than sampled into state, so the preference is read during
 *  render and the server snapshot is a stable `false`. Sampling it in an effect
 *  would mean a first paint that autoplays and then stops. */
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

function useReplayClock(intervalMs = 640) {
  const [tick, setTick] = useState(0);
  // `null` means "follow the OS". Pressing Play or Pause is a deliberate
  // override and is honoured either way — a reviewer who asked for reduced
  // motion may still want to watch this page move once.
  const [override, setOverride] = useState<boolean | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const playing = override ?? !reducedMotion;

  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => setTick((current) => (current + 1) % BEAT_COUNT), intervalMs);
    return () => window.clearInterval(id);
  }, [playing, intervalMs]);

  return {
    beat: beatFor(tick),
    playing,
    toggle: () => setOverride(!playing),
    scrub: (next: number) => {
      setOverride(false);
      setTick(next);
    },
    reset: () => setTick(0),
  };
}

function ReplayControls({
  playing,
  tick,
  onToggle,
  onScrub,
  onReset,
}: {
  playing: boolean;
  tick: number;
  onToggle: () => void;
  onScrub: (next: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={playing}
        className={cn(
          "inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-2xs font-semibold text-[color:var(--text-heading)] transition hover:border-[color:var(--border-strong)]",
          focusRing,
        )}
      >
        {playing ? (
          <Pause aria-hidden="true" className="h-3.5 w-3.5" />
        ) : (
          <Play aria-hidden="true" className="h-3.5 w-3.5" />
        )}
        {playing ? "Pause" : "Play"}
      </button>
      <button
        type="button"
        onClick={onReset}
        className={cn(
          "inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-2xs font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)]",
          focusRing,
        )}
      >
        <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
        Restart
      </button>
      <div role="group" aria-label="Scrub to a moment in the wait" className="flex flex-wrap items-center gap-1">
        {Array.from({ length: BEAT_COUNT }, (_, index) => {
          const label = `${BEAT_SECONDS[index]?.toFixed(1)} seconds in`;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onScrub(index)}
              aria-label={label}
              aria-current={index === tick ? "true" : undefined}
              className={cn(
                "grid h-10 w-5 place-items-center rounded-md transition",
                focusRing,
                index === tick ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--decoration-soft)]",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block rounded-full bg-current transition-all duration-[var(--duration-base)] motion-reduce:transition-none",
                  index === tick ? "h-2 w-2" : "h-1.5 w-1.5",
                )}
              />
            </button>
          );
        })}
      </div>
      <p className="text-3xs tabular-nums text-[color:var(--text-muted)]">t + {BEAT_SECONDS[tick]?.toFixed(1)}s</p>
    </div>
  );
}

/* ══════════════════════  shared parts of the redesign  ══════════════════════ */

/**
 * The whole animation, in one element.
 *
 * A 5px dot at the start of the status line, breathing on a 2.4s cycle. It is
 * the only moving thing in directions A and B, it costs one composited
 * property, and at rest — reduced motion, forced colors, a screenshot — it is
 * still a correct, legible bullet rather than a blank space where a spinner
 * used to be. That last property is what disqualifies a spinner here: a
 * stopped `Loader2` is a fragment of a circle.
 */
function BreathDot({ tone = "accent" }: { tone?: "accent" | "muted" | "success" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mr-1.5 inline-block h-[5px] w-[5px] shrink-0 translate-y-[-1px] rounded-full align-middle motion-safe:animate-pulse motion-reduce:animate-none",
        tone === "accent"
          ? "bg-[color:var(--clinical-accent)]"
          : tone === "success"
            ? "bg-[color:var(--success)]"
            : "bg-[color:var(--text-soft)]",
      )}
      style={{ animationDuration: "2.4s" }}
    />
  );
}

/**
 * One line, at the size the v2 answer surface already uses for provenance.
 *
 * `aria-live="polite"` and not `role="status"` on a wrapper: the text is
 * replaced in place, so the live region has to be the element that persists.
 */
function StatusLine({
  children,
  onStop,
  stopLabel = "Stop",
}: {
  children: ReactNode;
  onStop?: () => void;
  stopLabel?: string;
}) {
  return (
    <p aria-live="polite" className="flex items-center gap-2 text-2xs leading-5 text-[color:var(--text-muted)]">
      <span className="min-w-0 flex-1">{children}</span>
      {onStop ? (
        <button
          type="button"
          onClick={onStop}
          className={cn(
            "-my-2 inline-flex min-h-10 shrink-0 items-center gap-1 rounded-md px-1 text-2xs font-semibold text-[color:var(--text-muted)] transition hover:text-[color:var(--text-heading)]",
            focusRing,
          )}
        >
          <Square aria-hidden="true" className="h-2.5 w-2.5 fill-current" />
          {stopLabel}
        </button>
      ) : null}
    </p>
  );
}

function ProseSkeleton({ widths = [92, 78, 86] }: { widths?: number[] }) {
  return (
    <div aria-hidden="true" className="space-y-1.5">
      {widths.map((width) => (
        <span
          key={width}
          style={{ width: `${width}%`, height: 9, borderRadius: 4 }}
          className="block bg-[color:var(--border)] motion-safe:animate-pulse"
        />
      ))}
    </div>
  );
}

const RAIL_SCROLL_FADE = {
  scrollbarWidth: "none",
  maskImage: "linear-gradient(90deg, black calc(100% - 1.75rem), transparent)",
  WebkitMaskImage: "linear-gradient(90deg, black calc(100% - 1.75rem), transparent)",
} as const;

/**
 * The rail, arriving.
 *
 * Kept from `/mockups/answer-chat-perfected-v2` unchanged, including the rule
 * that decides this whole design: a card that arrives before the answer carries
 * a dot, not a number. The evidence preview is the top slice of retrieval in
 * retrieval order; the final list is rebuilt from what the answer actually
 * cites and re-capped by trust. Different sets, different order — so a number
 * assigned during the wait can end up pointing at a different document once the
 * answer lands. Numbering is what arrival buys.
 *
 * Cards are keyed by source id and appended, so React re-runs the entry
 * animation only on the card that is genuinely new. The ones already on screen
 * do not re-animate, and none of them move.
 */
function ArrivingRail({ found, numbered }: { found: number; numbered: boolean }) {
  const shown = POOL.slice(0, found);
  if (shown.length === 0) return null;
  return (
    <div
      role="group"
      aria-label={numbered ? `Sources behind this answer, ${shown.length}` : `Sources found so far, ${shown.length}`}
      className="flex gap-1.5 overflow-x-auto pb-1"
      style={RAIL_SCROLL_FADE}
    >
      {shown.map((source) => (
        <button
          key={source.id}
          type="button"
          onClick={() => undefined}
          className={cn(
            "inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2.5 text-left transition hover:border-[color:var(--border-strong)] hover:shadow-[var(--e1)] motion-safe:animate-fade-up",
            focusRing,
          )}
        >
          <span
            aria-hidden={numbered ? undefined : "true"}
            className={cn(
              "grid h-5 min-w-5 place-items-center rounded-md border text-3xs font-bold tabular-nums",
              !numbered
                ? "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-soft)]"
                : source.status === "review-due"
                  ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
                  : "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
            )}
          >
            {numbered ? source.index : "•"}
          </span>
          <span className="min-w-0">
            <span
              style={{ maxWidth: 160 }}
              className="block truncate text-2xs font-semibold leading-4 text-[color:var(--text-heading)]"
            >
              {source.short}
            </span>
            <span className="block text-3xs leading-4 text-[color:var(--text-muted)]">
              <span className="font-mono tabular-nums">p.{source.page}</span> ·{" "}
              {source.status === "current" ? "Current" : "Review due"}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function Mark({ n }: { n: number }) {
  return (
    <button
      type="button"
      onClick={() => undefined}
      aria-label={`Source ${n}`}
      className={cn("relative -my-1 inline-flex min-h-6 items-center px-0.5 align-baseline", focusRing)}
    >
      <sup className="text-3xs font-bold tabular-nums text-[color:var(--clinical-accent)]">{n}</sup>
    </button>
  );
}

/** The provenance line from the shipped answer surface, so the frames end where
 *  the real page ends rather than in a skeleton. */
function ArrivedAnswer() {
  return (
    <>
      <p className="text-2xs leading-5 text-[color:var(--text-muted)]">
        <span className="font-semibold text-[color:var(--text-heading)]">Written from 6 of your documents.</span>
        <br />
        Check each claim against the source before acting on it.
      </p>
      <div style={PROSE_MEASURE} className="space-y-2.5">
        {ANSWER_LINES.map((line) => (
          <p key={line.id} className="text-base-minus leading-prose text-[color:var(--text-heading)]">
            {line.text}
            {line.refs.map((ref) => (
              <Mark key={ref} n={ref} />
            ))}
          </p>
        ))}
      </div>
      {/* The rail belongs to the arrived answer in all three directions — they
          differ in what the wait shows, never in what the answer is. Drawing it
          only under the recommended one would flatter it with somebody else's
          work. */}
      <ArrivingRail found={POOL.length} numbered />
    </>
  );
}

/* ══════════════════════  the three directions  ══════════════════════ */

/**
 * Direction A — one line.
 *
 * Exactly what the v2 pending screen drew, held for the whole wait. It is the
 * right register and it is honest. Its weakness is only visible with a clock
 * running: from about t+0.6s to t+3.4s the screen says the same six words and
 * nothing accrues, so a reader with a slow query has no way to tell a working
 * search from a stuck one except by counting seconds themselves.
 */
function DirectionA({ beat }: { beat: Beat }) {
  if (beat.phase === "answered") return <ArrivedAnswer />;
  return (
    <>
      <StatusLine onStop={() => undefined}>
        <BreathDot />
        Searching your documents…
      </StatusLine>
      <ProseSkeleton />
    </>
  );
}

/**
 * Direction B — the sources arrive. Recommended.
 *
 * The same line, plus the one thing that is genuinely happening: documents are
 * being found. Each lands in the rail as a dotted card, the count in the line
 * moves with it, and when the answer arrives the cards take their numbers and
 * the prose writes above them. The rail does not move, is not rebuilt and is
 * not replaced — the reader's eye has already settled on the row it will still
 * be reading in ten seconds.
 *
 * This also fixes the layout jump the stepper causes. Today a tall accent panel
 * occupies the answer's position and then vanishes, so the answer lands
 * somewhere the eye was not. Here the wait is drawn in the answer's own column,
 * at the answer's own size, and only the middle of it changes.
 */
function DirectionB({ beat }: { beat: Beat }) {
  const answered = beat.phase === "answered";
  return (
    <>
      {answered ? (
        <ArrivedAnswer />
      ) : (
        <>
          <StatusLine onStop={() => undefined}>
            <BreathDot />
            {beat.phase === "asked" ? (
              "Reading your question…"
            ) : beat.phase === "searching" ? (
              <>
                Searching your documents · <span className="tabular-nums">{beat.found}</span> found
              </>
            ) : (
              <>
                <span className="tabular-nums">6</span> sources · writing the answer…
              </>
            )}
          </StatusLine>
          {beat.phase === "writing" ? <ProseSkeleton /> : null}
          <ArrivingRail found={beat.found} numbered={false} />
        </>
      )}
    </>
  );
}

/**
 * Direction C — the reading list.
 *
 * Names each document as it is opened, with a hairline that fills while it is
 * being read, then collapses into the rail. It is the most informative of the
 * three and the one people ask for.
 *
 * It is not recommended, for a reason that is specific to this product rather
 * than to taste. Retrieval opens far more documents than the answer cites, and
 * ranking then discards most of them. A reader who has watched six titles
 * scroll past has read six documents into the answer, four of which never
 * support a claim in it — and on this surface a source the reader believes is
 * behind the answer, but is not, is the exact failure the citation design
 * exists to prevent. It is drawn here so the trade is visible, not hidden in a
 * paragraph.
 */
function DirectionC({ beat }: { beat: Beat }) {
  if (beat.phase === "answered") return <ArrivedAnswer />;
  const scanning = POOL.slice(0, Math.max(1, beat.found));
  return (
    <>
      <StatusLine onStop={() => undefined}>
        <BreathDot />
        Reading <span className="tabular-nums">{beat.scanned.toLocaleString("en-AU")}</span> indexed documents
      </StatusLine>
      <ul className="space-y-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5">
        {scanning.map((source, index) => {
          const done = index < scanning.length - 1 || beat.phase !== "searching";
          return (
            <li key={source.id} className="motion-safe:animate-fade-up">
              <p className="flex items-baseline gap-2 text-3xs leading-4">
                <span className="min-w-0 flex-1 truncate text-[color:var(--text-heading)]">{source.short}</span>
                <span className="shrink-0 text-[color:var(--text-muted)]">{done ? "read" : "reading…"}</span>
              </p>
              <span aria-hidden="true" className="mt-1 block h-px w-full bg-[color:var(--border)]">
                <span
                  className="block h-full bg-[color:var(--clinical-accent)] transition-[width] duration-[var(--duration-base)] motion-reduce:transition-none"
                  style={{ width: done ? "100%" : "45%" }}
                />
              </span>
            </li>
          );
        })}
      </ul>
      {beat.phase === "writing" ? <ProseSkeleton /> : null}
    </>
  );
}

/* ══════════════════════  frames  ══════════════════════ */

function LoadingScreen({ beat, direction }: { beat: Beat; direction: "A" | "B" | "C" }) {
  return (
    <>
      <TopBar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-3 px-3 py-3">
          <UserTurn />
          <div className="min-w-0 space-y-3 pt-1.5">
            {direction === "A" ? (
              <DirectionA beat={beat} />
            ) : direction === "B" ? (
              <DirectionB beat={beat} />
            ) : (
              <DirectionC beat={beat} />
            )}
          </div>
        </div>
      </div>
      <Composer />
    </>
  );
}

/** The recommended direction at the desktop reading column, where the answer is
 *  a 68ch measure and the wait has to hold that column without filling it. */
function DesktopScreen({ beat }: { beat: Beat }) {
  return (
    <>
      <TopBar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-5 py-5">
          <UserTurn />
          <div className="min-w-0 space-y-3">
            <DirectionB beat={beat} />
          </div>
        </div>
      </div>
      <Composer />
    </>
  );
}

/** A transcript fragment, unframed, for the states that only need their own
 *  three lines to be judged. */
function Fragment({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <article className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
      <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">{title}</h3>
      <p className="mt-1 text-2xs leading-5 text-[color:var(--text-muted)]">{note}</p>
      <div className="mt-3 space-y-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3">
        {children}
      </div>
    </article>
  );
}

/* ══════════════════════  panel one: what ships  ══════════════════════ */

/**
 * The stepper as it shipped, redrawn.
 *
 * Panel One originally imported the real `AnswerProgressStepper` so the
 * comparison could not be accused of flattering the proposal. Direction B has
 * since been applied to the live surface and that component no longer exists,
 * so what stands here is a faithful redraw kept for the record: same accent
 * panel, same 36px icon tile, same five circles and connecting rail, same
 * counter, same disclosure. The ECG trace is drawn as a static path — its
 * scrolling strip and the CSS that moved it were deleted with the component.
 */
const RETIRED_STEPS = [
  ["Prepare scope", "Interpreting your question"],
  ["Search sources", "Scanning indexed clinical documents"],
  ["Select evidence", "Prioritising relevant passages"],
  ["Draft answer", "Synthesising the response and citations"],
  ["Check answer", "Checking citations and clinical details"],
] as const;

const RETIRED_ECG_PATH =
  "M0 24 H46 L52 23 L57 7 L64 37 L72 24 H122 L128 23 L133 4 L141 40 L149 24 H198 L204 23 L209 9 L216 35 L224 24 H272 L278 23 L283 10 L290 34 L298 24 H320";

function RetiredEcg({ compact }: { compact: boolean }) {
  return (
    <div className={cn("relative w-full overflow-hidden", compact ? "h-5" : "h-10 sm:h-12")}>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 320 44"
        preserveAspectRatio="none"
        className="block size-full"
      >
        <path
          d={RETIRED_ECG_PATH}
          pathLength="320"
          fill="none"
          stroke="currentColor"
          strokeWidth={compact ? 1.75 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="text-[color:var(--clinical-accent)]"
        />
      </svg>
    </div>
  );
}

function TodayStepper({ density }: { density: "expanded" | "compact" }) {
  const compact = density === "compact";
  const currentStep = 3;

  return (
    <section
      className={cn(
        "border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] text-[color:var(--text-heading)]",
        compact ? "rounded-lg px-3 py-2.5" : "rounded-xl p-3 sm:p-4",
      )}
    >
      {compact ? <RetiredEcg compact /> : null}
      <div className={cn("flex", compact ? "mt-1.5 items-start gap-2" : "items-start gap-3")}>
        {compact ? null : (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color:var(--surface-raised)] text-[color:var(--clinical-accent)] shadow-[var(--e1)]">
            <Activity className="size-icon-lg" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-semibold sm:text-base">
              {compact ? "Creating cited answer" : "Creating your cited answer"}
            </p>
            <span className="nums shrink-0 text-xs font-medium text-[color:var(--text-muted)]">7s elapsed</span>
          </div>
          <p className={cn("mt-0.5 text-xs text-[color:var(--text-muted)]", compact ? "leading-snug" : "sm:text-sm")}>
            {compact ? (
              <>
                <span className="font-medium text-[color:var(--text-body)]">Step 4 of 5 · Draft answer</span>
                <span aria-hidden="true"> — </span>
              </>
            ) : null}
            Drafting a cited answer from the selected passages.
          </p>
        </div>
        <span className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] px-3 text-xs font-semibold shadow-[var(--shadow-inset)]">
          <Square className="size-icon-xs shrink-0 fill-current" aria-hidden="true" />
          Stop
        </span>
      </div>

      {compact ? null : (
        <>
          <div className="mt-2">
            <RetiredEcg compact={false} />
          </div>
          <div className="relative mt-3">
            <span
              aria-hidden="true"
              className="absolute inset-x-[10%] top-7 hidden h-px bg-[color:var(--border)] sm:block"
            >
              <span
                className="block h-full origin-left bg-[color:var(--clinical-accent)]"
                style={{ width: `${(currentStep / 4) * 100}%` }}
              />
            </span>
            <ol className="relative grid gap-1 sm:grid-cols-5 sm:gap-2">
              {RETIRED_STEPS.map(([label, description], index) => {
                const complete = index < currentStep;
                const current = index === currentStep;
                return (
                  <li
                    key={label}
                    className={cn(
                      "relative flex min-w-0 items-start gap-3 rounded-lg px-2 py-2 sm:flex-col sm:items-center sm:gap-2 sm:py-3 sm:text-center",
                      current
                        ? "bg-[color:var(--surface-raised)] text-[color:var(--text-heading)] shadow-[var(--e1)]"
                        : complete
                          ? "text-[color:var(--clinical-accent-strong)]"
                          : "text-[color:var(--text-muted)]",
                    )}
                  >
                    <span
                      className={cn(
                        "relative z-5 grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
                        complete
                          ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent-strong)]"
                          : current
                            ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                            : "border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
                      )}
                    >
                      {complete ? (
                        <Check className="size-icon-md" aria-hidden="true" />
                      ) : current ? (
                        <Loader2 className="size-icon-md" aria-hidden="true" />
                      ) : (
                        <span aria-hidden="true">{index + 1}</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1 pt-0.5 sm:pt-0">
                      <span className="block text-xs font-semibold leading-tight sm:text-sm">{label}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-[color:var(--text-muted)] sm:hidden lg:block">
                        {description}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
          <p className="mt-1 inline-flex min-h-tap items-center text-xs font-medium text-[color:var(--text-muted)]">
            Processing details
          </p>
        </>
      )}
    </section>
  );
}

const OBSERVATIONS: Array<{ id: string; heading: string; body: string }> = [
  {
    id: "o1",
    heading: "It is the loudest thing on a surface that just finished getting quiet",
    body: "A filled accent panel, a 36px icon tile, five circles, four connecting rails, a scrolling waveform and a live counter — against an answer page whose own provenance line is 2xs muted text. The two were designed in different years and it shows in the first four seconds of every question.",
  },
  {
    id: "o2",
    heading: "It reports the pipeline, not the search",
    body: "Prepare scope · Search sources · Select evidence · Draft answer · Check answer are the stages of the RAG orchestrator. They are accurate and they are internal. What a clinician waiting on this screen wants to know is which of their documents are being read and how many came back.",
  },
  {
    id: "o3",
    heading: "The waveform is a clinical signal with nothing behind it",
    body: "A scrolling ECG trace on a psychiatry reference tool reads as a physiological readout. It is a decoration on a fixed path — the same 320-unit trace whatever the query does — and it is the one element here that could be mistaken for data.",
  },
  {
    id: "o4",
    heading: "The counter makes the wait the subject",
    body: "'7s elapsed' re-renders every second, in the one position the eye is already resting on. Nothing can be done with the number while the search is healthy, and re-drawing it once a second is what turns a four-second wait into a watched four-second wait.",
  },
  {
    id: "o5",
    heading: "The answer lands somewhere the eye is not",
    body: "The expanded stepper is roughly 210px tall and it is removed, not transformed, when the answer arrives. Everything below it jumps up by that distance at the exact moment the reader is given something to read.",
  },
  {
    id: "o6",
    heading: "It never shows a single source",
    body: "This is the substantive one. The evidence preview already crosses the stream boundary before the prose — trimmed, owner-scoped, governed, and consumed by the client today. The most useful content this surface has arrives early and is currently spent on a five-circle progress bar about the fact that it arrived.",
  },
];

/* ══════════════════════  page  ══════════════════════ */

export function AnswerLoadingRedesignMockupsPage() {
  const phones = useReplayClock();
  const desktop = useReplayClock(720);

  return (
    <main className="min-h-screen bg-[color:var(--background)] px-3 py-4 text-[color:var(--text)] sm:px-6 sm:py-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
            >
              <Search aria-hidden="true" className="h-4 w-4" />
            </span>
            <p className="text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
              Clinical KB · answer page · the wait
            </p>
            <span className="inline-flex min-h-6 items-center rounded-full border border-[color:var(--border)] bg-[color:var(--success-soft)] px-2 text-3xs font-semibold text-[color:var(--success)]">
              Direction B shipped
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-[color:var(--text-heading)] sm:text-3xl">
            Show the sources arriving, not the pipeline running
          </h1>
          <p style={PROSE_MEASURE} className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
            The answer surface was quietened in PRs #2386 and #2388 — the assistant tile off the turn, one number per
            claim, the safety rail&rsquo;s colour moved into its own icon, two panels made one. The loading state was
            not part of that pass, so a filled accent panel with a five-circle stepper, a scrolling ECG trace and a
            per-second counter owned the four to twelve seconds before every answer. Three replacements are drawn below,
            moving, with one recommended — and direction B is the one that was chosen and applied to the live surface.
            This page is kept as the record of that argument.
          </p>
        </header>

        <Panel
          step="One"
          title="What ships today"
          intro="What the answer page rendered until direction B was applied to it. Kept as a faithful redraw for the record — same accent panel, same icon tile, same five circles, same counter, same disclosure. The ECG trace is static here because the scrolling strip and the CSS that moved it were deleted with the component."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <DetailCard
              title="Expanded — the answer page"
              body="Roughly 210px tall on a 390px phone, filled in accent, and removed rather than transformed when the answer arrives."
            >
              <TodayStepper density="expanded" />
            </DetailCard>
            <DetailCard
              title="Compact — the document viewer"
              body="The same panel with the stepper folded away, which is the closest the current design comes to the register the answer page now uses. The waveform and the counter survive the fold."
            >
              <TodayStepper density="compact" />
            </DetailCard>
          </div>

          <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {OBSERVATIONS.map((observation, index) => (
              <li
                key={observation.id}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
              >
                <p className="flex items-baseline gap-2">
                  <span className="shrink-0 text-3xs font-bold tabular-nums text-[color:var(--clinical-accent)]">
                    {index + 1}
                  </span>
                  <span className="text-2xs font-semibold leading-5 text-[color:var(--text-heading)]">
                    {observation.heading}
                  </span>
                </p>
                <p className="mt-1.5 text-2xs leading-5 text-[color:var(--text-muted)]">{observation.body}</p>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel
          step="Two"
          title="Three directions, running"
          intro="Same question, same clock, same eleven beats from the moment of submit to the answer landing. A loading state cannot be judged from a still, so these move together — pause on any beat to argue about that frame. The dots below scrub."
        >
          <ReplayControls
            playing={phones.playing}
            tick={phones.beat.tick}
            onToggle={phones.toggle}
            onScrub={phones.scrub}
            onReset={phones.reset}
          />
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <PhoneFrame caption="A · one line">
              <LoadingScreen beat={phones.beat} direction="A" />
            </PhoneFrame>
            <PhoneFrame caption="B · the sources arrive — recommended">
              <LoadingScreen beat={phones.beat} direction="B" />
            </PhoneFrame>
            <PhoneFrame caption="C · the reading list">
              <LoadingScreen beat={phones.beat} direction="C" />
            </PhoneFrame>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <DetailCard
              title="A · one line"
              body="What /mockups/answer-chat-perfected-v2 already drew, held for the whole wait."
            >
              <p className="text-2xs leading-5 text-[color:var(--text-muted)]">
                Right register, honest, and the cheapest thing to build. Its weakness only appears with the clock
                running: between t+0.6s and t+3.4s the screen says the same six words and nothing accrues, so a slow
                query and a stuck one look identical.
              </p>
            </DetailCard>
            <DetailCard
              title="B · the sources arrive"
              body="The same line, plus the one thing genuinely happening — documents being found."
            >
              <p className="text-2xs leading-5 text-[color:var(--text-muted)]">
                Each card lands as it is found and carries a dot, not a number. Nothing on screen moves position, so the
                rail the reader settles on during the wait is the rail they are still reading afterwards. The answer
                writes in above it and the dots become numbers.{" "}
                <span className="font-semibold text-[color:var(--text-heading)]">Recommended.</span>
              </p>
            </DetailCard>
            <DetailCard
              title="C · the reading list"
              body="Names each document as it is opened, then collapses into the rail."
            >
              <p className="text-2xs leading-5 text-[color:var(--text-muted)]">
                The most informative, and the one people ask for. It is also the only one that can mislead: retrieval
                opens many more documents than the answer cites, so a reader watches six titles go past and takes all
                six to be behind the answer. On this surface that is the precise error the citation design exists to
                prevent.
              </p>
            </DetailCard>
          </div>
        </Panel>

        <Panel
          step="Three"
          title="The recommended one, at the desktop measure"
          intro="Same direction at the 68ch reading column, where the wait has to hold the answer's position without filling it. Note what does not happen when the answer lands: nothing above the rail is removed, so nothing below it jumps."
        >
          <ReplayControls
            playing={desktop.playing}
            tick={desktop.beat.tick}
            onToggle={desktop.toggle}
            onScrub={desktop.scrub}
            onReset={desktop.reset}
          />
          <div className="mt-4">
            <DesktopFrame caption="Desktop · answer mode">
              <DesktopScreen beat={desktop.beat} />
            </DesktopFrame>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <DetailCard
              title="What each beat says, and where the number comes from"
              body="Every string below is derived from a stage the stream already emits. Nothing new has to cross the boundary for this to be built."
            >
              <ul className="space-y-2">
                {[
                  ["scoping", "Reading your question…", "stage only"],
                  ["retrieving", "Searching your documents · N found", "evidence preview, as each unit arrives"],
                  ["retrieved / ranking", "N sources · writing the answer…", "resultCount, then the trimmed preview"],
                  ["generating / verifying", "unchanged — the rail is already right", "no new event"],
                  ["complete", "Written from N of your documents.", "the final source list"],
                ].map(([stage, copy, source]) => (
                  <li key={stage} className="grid gap-0.5 border-b border-[color:var(--border)] pb-2 last:border-0">
                    <p className="font-mono text-3xs text-[color:var(--text-muted)]">{stage}</p>
                    <p className="text-2xs font-semibold leading-5 text-[color:var(--text-heading)]">{copy}</p>
                    <p className="text-3xs leading-4 text-[color:var(--text-muted)]">{source}</p>
                  </li>
                ))}
              </ul>
            </DetailCard>
            <DetailCard
              title="What is deliberately not here"
              body="Each of these was in the shipped stepper and is being dropped on purpose, so the decision is on the record rather than lost in a diff."
            >
              <ul className="space-y-2">
                {[
                  ["The five-step stepper", "It narrates the orchestrator. The reader is not operating it."],
                  ["The ECG waveform", "A clinical signal drawn from a fixed path. It could be read as data."],
                  [
                    "The elapsed counter",
                    "Only useful when something is wrong — so it appears only then (Panel Four).",
                  ],
                  ["The spinner", "It has no correct resting frame. A dot does."],
                  ["Processing details", "A disclosure nobody opens, holding the same five stages again."],
                  ["The accent panel", "Fill is how this surface marks a hazard. A wait is not one."],
                ].map(([item, why]) => (
                  <li
                    key={item}
                    className="flex items-baseline gap-2 border-b border-[color:var(--border)] pb-2 last:border-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-2xs font-semibold leading-5 text-[color:var(--text-heading)]">
                        {item}
                      </span>
                      <span className="block text-3xs leading-4 text-[color:var(--text-muted)]">{why}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </DetailCard>
          </div>
        </Panel>

        <Panel
          step="Four"
          title="The states that are not the happy path"
          intro="Most of what can go wrong with an answer is decided during the wait, and the shipped stepper draws none of it — it renders the same five circles whether retrieval found sixty passages or none. These are the five that need their own words, and the arrived state beside them for comparison."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Fragment
              title="Slower than usual"
              note="The counter earns its place only here. It appears once at ten seconds, does not tick, and says what it is for."
            >
              <StatusLine onStop={() => undefined}>
                <BreathDot />
                Searching your documents · <span className="tabular-nums">4</span> found · still going at{" "}
                <span className="tabular-nums">10s</span>
              </StatusLine>
              <ArrivingRail found={4} numbered={false} />
            </Fragment>

            <Fragment
              title="Nothing came back"
              note="A wait that ends in zero is a result, not a failure, and it should not arrive as an empty answer card."
            >
              <StatusLine>
                <BreathDot tone="muted" />
                No documents in your library matched this question.
              </StatusLine>
              <p className="text-2xs leading-5 text-[color:var(--text-muted)]">
                Nothing was written, because there was nothing to write from.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["Search the whole library", "Rephrase the question"].map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => undefined}
                    className={cn(
                      "inline-flex min-h-10 items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2.5 text-2xs font-medium text-[color:var(--text-muted)] transition hover:border-[color:var(--clinical-accent-border)] hover:text-[color:var(--clinical-accent)]",
                      focusRing,
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Fragment>

            <Fragment
              title="Assembled without the model"
              note="Twenty of thirty answers in the 2026-08-18 blinded read were source_only. The wait is where the reader should learn that, not the answer."
            >
              <StatusLine>
                <BreathDot />
                <span className="tabular-nums">6</span> sources · assembling from the sources directly…
              </StatusLine>
              <ArrivingRail found={3} numbered={false} />
              <p className="text-3xs leading-4 text-[color:var(--text-muted)]">
                Same line, one word different. It sets the expectation before the answer has to defend it.
              </p>
            </Fragment>

            <Fragment
              title="Stopped"
              note="Stop currently leaves the reader with nothing. What was already found is real and should survive."
            >
              <StatusLine>
                <BreathDot tone="muted" />
                Stopped. <span className="tabular-nums">4</span> sources were found — open them, or ask again.
              </StatusLine>
              <ArrivingRail found={4} numbered={false} />
            </Fragment>

            <Fragment
              title="Reduced motion"
              note="The dot holds, the cards appear without the rise, the hairline snaps. Everything still reads because nothing here carries meaning in the movement."
            >
              <p className="flex items-center gap-2 text-2xs leading-5 text-[color:var(--text-muted)]">
                <span
                  aria-hidden="true"
                  className="mr-1.5 inline-block h-[5px] w-[5px] shrink-0 translate-y-[-1px] rounded-full bg-[color:var(--clinical-accent)] align-middle"
                />
                <span>
                  Searching your documents · <span className="tabular-nums">3</span> found
                </span>
              </p>
              <ArrivingRail found={3} numbered={false} />
            </Fragment>

            <Fragment
              title="Arrived"
              note="For comparison: the same three inches of screen once the answer lands. The rail has not moved — it has taken its numbers."
            >
              <StatusLine>
                <BreathDot tone="success" />
                Written from <span className="tabular-nums">6</span> of your documents.
              </StatusLine>
              <ArrivingRail found={3} numbered />
            </Fragment>
          </div>

          <p style={PROSE_MEASURE} className="mt-4 text-2xs leading-5 text-[color:var(--text-muted)]">
            One thing worth saying plainly about the whole set. The current design spends its animation budget on
            movement that carries no information — a waveform on a fixed path, a spinner, a counter — and spends none of
            it on the one event the reader actually cares about, which is a document being found. The proposal is not
            &ldquo;less animation&rdquo;. It is the same budget, moved onto the only thing on this screen that is really
            happening.
          </p>
        </Panel>

        <footer className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 sm:p-4">
          <p className="flex items-start gap-2 text-2xs leading-5 text-[color:var(--text-muted)]">
            <FileText aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Design scratch. Nothing on this page is wired to retrieval, every count and document title is synthetic,
              and no production surface changes — <span className="font-mono">answer-status.tsx</span> still ships the
              stepper drawn in Panel One. Removing it is the follow-up, once a direction is chosen.
            </span>
          </p>
        </footer>
      </div>
    </main>
  );
}
