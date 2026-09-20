"use client";

import {
  ArrowRight,
  Check,
  CircleHelp,
  Compass,
  EyeOff,
  FileSearch,
  Info,
  Layers,
  MapPin,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";

import { MockupPageShell, ModuleLabel, PanelBar, PanelFrame } from "@/components/on-call-shift-cover-mockups";

/**
 * Coverage gaps — what the library could not answer (2026-09-19).
 *
 * Design scratch. Nothing is wired; every topic, count and document name below
 * is invented.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * What is actually available, which is the whole design constraint
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The app already records when retrieval fails. `rag_query_misses` holds a
 * miss reason, the near-miss files, candidate labels and — the useful part —
 * `candidate_aliases`, the canonical clinical terms a question matched from
 * the curated vocabulary in `src/lib/clinical-vocabulary.ts`. `rag_retrieval_logs`
 * holds `is_miss` and `miss_reason`. Both are retained 90 days and purged by
 * pg_cron.
 *
 * **What is not available is the question itself, and that is correct.**
 * `queryTextForStorage` in `src/lib/query-privacy.ts` writes
 * `redacted-query:<hmac>` unless `RAG_PERSIST_RAW_QUERY_TEXT` is set, and that
 * flag defaults to `false` and is blocked in production by the readiness
 * check. Legacy plaintext was irreversibly salted and scrubbed by migration.
 * So a gap report can never show what somebody typed.
 *
 * That constraint turns out to make a better feature rather than a worse one,
 * and boards A and C are about designing WITH it:
 *
 *  - The hash is deterministic, so "asked 9 times" is exact even though the
 *    question is unreadable.
 *  - `candidate_aliases` names the clinical topic without naming the query.
 *  - The gap is therefore a TOPIC with a count, which is precisely the shape
 *    the source-acquisition ladder takes as input.
 *
 * One asymmetry is worth a board of its own. The search path logs aliases; the
 * ANSWER path does not. `answer-telemetry.ts` writes `is_miss` and a fallback
 * reason code into `rag_retrieval_logs` and never touches `rag_query_misses`,
 * so the sharpest signal in the system — the app saying "I cannot answer this
 * from your library" — arrives with a reason and no topic at all. Board C
 * draws that hole rather than hiding it.
 */

function Body({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--background)] p-4">{children}</div>;
}

/* ═══════════════════  board A — the gap list  ═══════════════════ */

type Gap = {
  topic: string;
  asked: number;
  reason: string;
  nearest: string;
  rung: string;
};

const GAPS: Gap[] = [
  {
    topic: "Clozapine rechallenge",
    asked: 9,
    reason: "Nothing scored above threshold",
    nearest: "2 files nearly matched",
    rung: "No WA source held",
  },
  {
    topic: "Perinatal prescribing",
    asked: 7,
    reason: "Nothing scored above threshold",
    nearest: "1 file nearly matched",
    rung: "No WA source held",
  },
  {
    topic: "Metabolic monitoring",
    asked: 6,
    reason: "Matched, but no claim support",
    nearest: "4 files nearly matched",
    rung: "National source held, out of date",
  },
  {
    topic: "Depot transitions",
    asked: 4,
    reason: "Nothing scored above threshold",
    nearest: "none",
    rung: "No source held",
  },
  {
    topic: "Lithium in renal impairment",
    asked: 3,
    reason: "Matched, but no claim support",
    nearest: "3 files nearly matched",
    rung: "National source held",
  },
];

/**
 * The gap list, and the banner that is not boilerplate.
 *
 * The privacy line at the top is load-bearing rather than decorative. A
 * reader looking at a page headed "what your library could not answer" will
 * reasonably assume they are looking at a log of questions, and they are not:
 * every question here is an unreadable hash, and what is shown is the clinical
 * topic it matched. Saying so in the first line is the difference between a
 * page that reports coverage and a page that appears to be surveillance of
 * its own user.
 *
 * Sorted by times asked, not by recency. A gap asked nine times is worth more
 * than a gap asked once yesterday, and the whole point of the surface is to
 * choose what to go and find next.
 */
function BoardGapList() {
  return (
    <PanelFrame
      caption="A · The gap list — topics, not questions"
      note="Sorted by how often it was asked. Every question behind these rows is an unreadable hash; what is shown is the clinical topic it matched."
      heightClass="h-[760px]"
    >
      <PanelBar crumb="Corpus health" title="What your library could not answer · last 90 days" />
      <Body>
        {/* Not boilerplate: without this line the page looks like a log of
            the reader's own questions, which is exactly what it is not. */}
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] p-2.5">
          <EyeOff aria-hidden="true" className="mt-px size-icon-md shrink-0 text-[color:var(--text-muted)]" />
          <p className="text-2xs leading-4 text-[color:var(--text)]">
            <strong className="font-bold">The questions themselves are not stored.</strong> Query text is replaced by a
            one-way keyed hash before it is written, so this page counts repeats and names the clinical topic each
            question matched — never the words anyone typed.
          </p>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          {[
            ["29", "questions missed"],
            ["5", "distinct topics"],
            ["2", "with no source at all"],
          ].map(([value, label]) => (
            <span
              key={label}
              className="grid gap-0.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2.5"
            >
              <span className="nums text-lg-minus font-bold text-[color:var(--text-heading)]">{value}</span>
              <span className="text-3xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
                {label}
              </span>
            </span>
          ))}
        </div>

        <ModuleLabel action={<>Most asked first</>}>Topics</ModuleLabel>
        <div className="grid gap-1.5">
          {GAPS.map((gap) => (
            <div
              key={gap.topic}
              className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2.5 shadow-[var(--e1)]"
            >
              <span className="grid w-10 shrink-0 justify-items-center gap-0.5">
                <span className="nums text-base font-bold text-[color:var(--text-heading)]">{gap.asked}</span>
                <span className="text-3xs uppercase tracking-kicker text-[color:var(--text-muted)]">asked</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[color:var(--text-heading)]">{gap.topic}</span>
                <span className="block text-xs text-[color:var(--text-muted)]">
                  {gap.reason} · {gap.nearest}
                </span>
                <span className="mt-0.5 inline-flex items-center gap-1 text-3xs font-semibold text-[color:var(--text-soft)]">
                  <MapPin aria-hidden="true" className="size-icon-xs" />
                  {gap.rung}
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-[color:var(--command)] px-2 py-1 text-3xs font-bold text-[color:var(--command-contrast)]">
                <Search aria-hidden="true" className="size-icon-xs" />
                Find a source
              </span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-2xs leading-4 text-[color:var(--text-muted)]">
          Topics come from the curated clinical vocabulary, so a question about something the vocabulary does not name
          is counted but cannot be labelled. Those land in the unlabelled group on board C.
        </p>
      </Body>
    </PanelFrame>
  );
}

/* ═══════════════  board B — one gap, into the ladder  ═══════════════ */

const RUNGS: Array<{ rung: string; scope: string; state: "searched-none" | "searched-found" | "not-reached" }> = [
  { rung: "1 · WA local", scope: "Health service and hospital guidelines", state: "searched-none" },
  { rung: "2 · WA state", scope: "Department of Health, statewide policy", state: "searched-none" },
  { rung: "3 · Australian national", scope: "College, TGA, national guidelines", state: "searched-found" },
  { rung: "4 · Other states", scope: "Interstate health departments", state: "not-reached" },
  { rung: "5 · International", scope: "NICE, WHO, other national bodies", state: "not-reached" },
];

/**
 * A gap handed straight to the acquisition ladder.
 *
 * The repository's source protocol runs a WA-first ladder and stops at the
 * first rung that holds a current source covering the claim. It also requires
 * every search — including the ones that found nothing — to be recorded with
 * a `capturedFor` field saying why the search happened and what it was looking
 * for.
 *
 * That field is exactly what a gap row already is. So the one design idea on
 * this board is that the gap does not merely link to the search: it BECOMES
 * the justification attached to whatever the search finds or fails to find.
 * The topic, the nine askings and the date range are the honest answer to "why
 * did you go looking for this", and typing that sentence again by hand is how
 * a register of rejections stops being kept.
 *
 * The rungs that found nothing are drawn as prominently as the rung that
 * found something, because a recorded absence at rung 1 is the finding that
 * justifies using a national source.
 */
function BoardLadder() {
  return (
    <PanelFrame
      caption="B · One gap, into the WA-first ladder"
      note="The gap is not just a link to a search — it becomes the recorded reason the search happened, on every capture and every rejection."
      heightClass="h-[820px]"
    >
      <PanelBar crumb="Corpus health · gap" title="Clozapine rechallenge — asked 9 times" />
      <Body>
        <div className="mb-3 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] p-3">
          <p className="text-2xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
            Recorded as the reason for this search
          </p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text)]">
            &ldquo;Asked 9 times between 21 Jun and 19 Sep 2026. Nothing in the library scored above threshold; two
            files nearly matched. No WA source held.&rdquo;
          </p>
          <p className="mt-1.5 flex items-start gap-1.5 text-2xs leading-4 text-[color:var(--text-muted)]">
            <Info aria-hidden="true" className="mt-px size-icon-xs shrink-0" />
            <span>
              This sentence is attached to every source captured or rejected below — including the rejections, which is
              the half people stop recording first.
            </span>
          </p>
        </div>

        <ModuleLabel>The ladder</ModuleLabel>
        <div className="mb-3 grid gap-1.5">
          {RUNGS.map((row) => (
            <div
              key={row.rung}
              className={`flex items-center gap-2.5 rounded-lg border p-2.5 ${
                row.state === "searched-found"
                  ? "border-[color:var(--success)] bg-[color:var(--success-soft)]"
                  : row.state === "not-reached"
                    ? "border-[color:var(--border)] bg-[color:var(--surface-subtle)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface-raised)]"
              }`}
            >
              <Compass
                aria-hidden="true"
                className={`size-icon-md shrink-0 ${
                  row.state === "not-reached" ? "text-[color:var(--text-soft)]" : "text-[color:var(--text-muted)]"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-bold ${
                    row.state === "not-reached" ? "text-[color:var(--text-muted)]" : "text-[color:var(--text-heading)]"
                  }`}
                >
                  {row.rung}
                </span>
                <span className="block text-xs text-[color:var(--text-muted)]">{row.scope}</span>
              </span>
              {/* A recorded absence is a finding, drawn as loudly as a find. */}
              {row.state === "searched-none" ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-[color:var(--border-strong)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--text-muted)]">
                  <CircleHelp aria-hidden="true" className="size-icon-xs" />
                  Searched · nothing held
                </span>
              ) : row.state === "searched-found" ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-[color:var(--success)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--success-text)]">
                  <Check aria-hidden="true" className="size-icon-xs" />1 candidate
                </span>
              ) : (
                <span className="shrink-0 rounded-sm border border-[color:var(--border)] px-1.5 py-0.5 text-3xs font-semibold text-[color:var(--text-soft)]">
                  Not reached
                </span>
              )}
            </div>
          ))}
        </div>

        <ModuleLabel>Candidate at rung 3</ModuleLabel>
        <div className="mb-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3">
          <p className="text-sm font-bold text-[color:var(--text-heading)]">Example national guideline (invented)</p>
          <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">
            National body · published 2025 · guideline · rung 3
          </p>
          <div className="mt-2 flex gap-2">
            <span className="inline-flex min-h-tap flex-1 items-center justify-center gap-1.5 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)]">
              Capture and score it
              <ArrowRight aria-hidden="true" className="size-icon-sm" />
            </span>
            <span className="inline-flex min-h-tap items-center justify-center rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] px-3 text-sm font-bold text-[color:var(--text-heading)]">
              Reject, with a reason
            </span>
          </div>
        </div>

        <p className="flex items-start gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5 text-2xs leading-4 text-[color:var(--text-muted)]">
          <ShieldCheck aria-hidden="true" className="mt-px size-icon-sm shrink-0" />
          <span>
            Stopping at rung 3 is only defensible because rungs 1 and 2 were searched and recorded as empty. That is why
            the empty rungs are drawn as findings rather than as greyed-out steps on the way down.
          </span>
        </p>
      </Body>
    </PanelFrame>
  );
}

/* ═══════════════  board C — the blind spot, drawn  ═══════════════ */

/**
 * The hole in the data, given a panel instead of a footnote.
 *
 * There are two ways the app fails to answer, and they are logged
 * differently. A SEARCH miss writes `rag_query_misses` with
 * `candidate_aliases` — so it has a topic. An ANSWER abstain writes only
 * `rag_retrieval_logs.is_miss` plus a fallback reason code — so it has no
 * topic at all.
 *
 * The second is the better signal. `coverage_gap` is the system stating, in
 * its own words, that it could not support a claim from the library; that is a
 * stronger statement about the corpus than "nothing scored well". And it is
 * the one arriving with nothing to act on.
 *
 * The temptation is to leave these out, because a list of counts with no
 * topics looks broken. That would hide the most important number on the
 * surface behind the fact that it is currently unusable. So they get a panel,
 * labelled honestly, with the one-line fix named on it — write the aliases on
 * the answer path too, the same way the search path already does.
 */
function BoardBlindSpot() {
  return (
    <PanelFrame
      caption="C · The blind spot — the best signal arrives with no topic"
      note="Search misses carry a clinical topic. Answer abstains do not. That is the sharper signal, and it is the one with nothing to act on."
      heightClass="h-[700px]"
    >
      <PanelBar crumb="Corpus health" title="Abstains · reason only, no topic" />
      <Body>
        <div className="mb-3 grid gap-2">
          {[
            {
              name: "Search miss",
              detail: "Nothing scored above threshold",
              has: "Topic, near-miss files, repeat count",
              tone: "ok" as const,
            },
            {
              name: "Answer abstain",
              detail: "Could not support a claim from your library",
              has: "Reason code and a count. No topic.",
              tone: "hole" as const,
            },
          ].map((row) => (
            <div
              key={row.name}
              className={`rounded-lg border p-3 ${
                row.tone === "hole"
                  ? "border-[color:var(--warning)] bg-[color:var(--warning-soft)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface-raised)]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className={`text-sm font-bold ${
                      row.tone === "hole" ? "text-[color:var(--warning-text)]" : "text-[color:var(--text-heading)]"
                    }`}
                  >
                    {row.name}
                  </p>
                  <p
                    className={`text-xs leading-5 ${
                      row.tone === "hole" ? "text-[color:var(--warning-text)]" : "text-[color:var(--text-muted)]"
                    }`}
                  >
                    {row.detail}
                  </p>
                </div>
                {row.tone === "hole" ? (
                  <EyeOff aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--warning-text)]" />
                ) : (
                  <Layers aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
                )}
              </div>
              <p
                className={`mt-1.5 text-2xs font-semibold ${
                  row.tone === "hole" ? "text-[color:var(--warning-text)]" : "text-[color:var(--text-muted)]"
                }`}
              >
                Carries: {row.has}
              </p>
            </div>
          ))}
        </div>

        <ModuleLabel>Abstains this quarter, by reason</ModuleLabel>
        <div className="mb-3 grid gap-1.5">
          {[
            ["coverage_gap", 31, "Nothing in the library supported the claim"],
            ["no_candidates", 12, "Retrieval returned nothing to work from"],
          ].map(([code, count, meaning]) => (
            <div
              key={String(code)}
              className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2.5"
            >
              <span className="nums w-8 shrink-0 text-right text-base font-bold text-[color:var(--text-heading)]">
                {count}
              </span>
              <span className="min-w-0 flex-1">
                <span className="nums block text-sm font-semibold text-[color:var(--text-heading)]">{code}</span>
                <span className="block text-xs text-[color:var(--text-muted)]">{meaning}</span>
              </span>
              <span className="shrink-0 rounded-sm border border-[color:var(--border)] px-1.5 py-0.5 text-3xs font-semibold text-[color:var(--text-soft)]">
                No topic
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] p-3">
          <p className="text-xs font-bold text-[color:var(--text-heading)]">Why this panel exists at all</p>
          <p className="mt-1 text-xs leading-5 text-[color:var(--text)]">
            Thirty-one times the app said it could not support an answer from your library, and none of them can be
            turned into something to go and find. Leaving them off the page would hide the best number on it behind the
            fact that it is currently unusable.
          </p>
          <p className="mt-1.5 text-xs leading-5 text-[color:var(--text)]">
            <strong className="font-bold">The fix is small and belongs before this surface is built:</strong> the answer
            path writes a reason code but no clinical aliases, while the search path already writes both. Make the
            answer path record what the search path records, and these 31 rows become the top of board A.
          </p>
        </div>
      </Body>
    </PanelFrame>
  );
}

/* ═══════════════  board D — the loop closed  ═══════════════ */

/**
 * Closing the loop, which is what stops this being a dashboard.
 *
 * A coverage report that only ever grows is a list of complaints. The thing
 * that makes it a working surface is the last step: the source lands, the
 * topic is re-asked, and the gap either closes or does not.
 *
 * The eval-case proposal is the part that makes the closure durable rather
 * than momentary. The repository already promotes query misses into eval
 * cases; a gap that has just been filled is the best possible candidate for a
 * retrieval regression test, because it is a question that provably failed and
 * now provably works. That is a test worth having, and it is free at exactly
 * this moment and expensive to write from scratch later.
 *
 * Deliberately NOT automatic. A provider-backed eval run costs money and needs
 * approval, and a surface that queues them on its own would spend it quietly.
 * The board proposes; a person dispatches.
 */
function BoardLoop() {
  return (
    <PanelFrame
      caption="D · Closing the loop — and the free regression test at the end of it"
      note="A gap that just closed is the best possible eval case: a question that provably failed and now provably works. Proposed, never dispatched."
      heightClass="h-[700px]"
    >
      <PanelBar crumb="Corpus health · gap" title="Clozapine rechallenge — answered, not yet closed" />
      <Body>
        <div className="mb-3 grid gap-1.5">
          {[
            ["Gap found", "21 Jun — 19 Sep · asked 9 times", true],
            ["Ladder run", "Rungs 1 and 2 searched and recorded empty", true],
            ["Source captured", "Rung 3 national guideline, scored and indexed", true],
            ["Re-asked", "Now answered, 3 supporting passages", true],
            ["Answer read against the source", "Waiting on a person — retrieval success is not correctness", false],
          ].map(([step, detail, done]) => (
            <div
              key={String(step)}
              className="flex items-start gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2.5"
            >
              <span
                className={`mt-px grid size-5 shrink-0 place-items-center rounded-pill ${
                  done
                    ? "bg-[color:var(--success-soft)] text-[color:var(--success-text)]"
                    : "border border-[color:var(--border-strong)]"
                }`}
              >
                {done ? <Check aria-hidden="true" className="size-icon-xs" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[color:var(--text-heading)]">{step}</span>
                <span className="block text-xs text-[color:var(--text-muted)]">{detail}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="mb-3 rounded-xl border border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] p-3">
          <p className="flex items-start gap-2 text-sm font-bold leading-5 text-[color:var(--text-heading)]">
            <TrendingUp
              aria-hidden="true"
              className="mt-px size-icon-md shrink-0 text-[color:var(--clinical-accent)]"
            />
            Propose this as a retrieval eval case
          </p>
          <p className="mt-1 text-xs leading-5 text-[color:var(--text)]">
            It failed nine times and now succeeds, which is the whole specification of a regression test. Writing one
            from scratch in six months costs an afternoon; capturing it now costs a click.
          </p>
          <p className="mt-1.5 text-2xs leading-4 text-[color:var(--text-muted)]">
            Into the <strong className="font-bold">captured</strong> tier, never the strict golden fixture. That fixture
            is a protected ranking surface with coupled files a web control cannot edit, and pinning an answer nobody
            has read against the source would bake a possibly-wrong expectation into the thing that guards every future
            change.
          </p>
          <div className="mt-2 flex gap-2">
            <span className="inline-flex min-h-tap flex-1 items-center justify-center gap-1.5 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)]">
              <FileSearch aria-hidden="true" className="size-icon-sm" />
              Add to the captured eval cases
            </span>
            <span className="inline-flex min-h-tap items-center justify-center rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] px-3 text-sm font-bold text-[color:var(--text-heading)]">
              Not this one
            </span>
          </div>
          {/* The boundary. A provider-backed run costs money and needs
              approval, so this surface never starts one. */}
          <p className="mt-2 text-2xs leading-4 text-[color:var(--text-muted)]">
            Adding a case does not run anything. A live evaluation is provider-backed, costs money, and is dispatched by
            a person — never by this page.
          </p>
        </div>

        <p className="flex items-start gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5 text-2xs leading-4 text-[color:var(--text-muted)]">
          <Info aria-hidden="true" className="mt-px size-icon-sm shrink-0" />
          <span>
            Telemetry is purged at 90 days, so a closed gap keeps its own summary row rather than depending on rows that
            will be deleted. The history of what was missing is worth more than the rows it was derived from.
          </span>
        </p>
      </Body>
    </PanelFrame>
  );
}

/* ══════════════════════════  the page  ══════════════════════════ */

export function CoverageGapsMockups() {
  return (
    <MockupPageShell
      eyebrow="Corpus health · study 5"
      title="What your library could not answer"
      summary="The app already records its own retrieval failures, with a miss reason, the near-miss files and the clinical topic each question matched. What it deliberately does not record is the question: query text is replaced by a one-way keyed hash before it is written, and that flag is off by default and blocked in production. These four boards design with that constraint rather than around it — a gap is a topic with a repeat count, which happens to be exactly the shape the WA-first source ladder takes as input. Board C draws the one real hole: the sharpest signal in the system, the app saying it could not support an answer, arrives with no topic attached at all."
      scratchNote="Design scratch. Nothing is wired, and every record, count and reviewer name in these boards is invented. Drawn at desk width in the app's own tokens, because this is sat-down work rather than corridor work."
    >
      <div className="flex flex-wrap gap-x-6 gap-y-10">
        <BoardGapList />
        <BoardLadder />
        <BoardBlindSpot />
        <BoardLoop />
      </div>
    </MockupPageShell>
  );
}
