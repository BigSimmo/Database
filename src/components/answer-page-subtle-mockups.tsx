"use client";

import { useState } from "react";
import { ArrowUp, Copy, ThumbsDown, ThumbsUp } from "lucide-react";

import { cn } from "@/components/ui-primitives";
import {
  DesktopFrame,
  PHONE_WIDTH,
  PhoneFrame,
  PROSE_MEASURE,
  TopBar,
  focusRing,
} from "@/components/answer-chat-perfected-mockups";

/**
 * The answer page, fourth pass — subtle.
 *
 * /mockups/answer-page-perfected answered every numbered issue with a block:
 * a key-points card, a source list, library rows, follow-up rows. The owner
 * rejected it the same day as too long, too list-heavy and too bulky, and
 * asked for something chat-like and subtle. This page is that: the answer
 * reads as one message, the critical sentence is bold rather than boxed, the
 * sources are one wrapped line of small links under the message, and the
 * follow-ups are chips above the composer. It fits one phone screen.
 *
 * The issue list on the rejected page still stands; this page answers it with
 * less rather than with more. Nothing here is wired to real retrieval. All
 * copy is synthetic and every clinical figure is illustrative.
 */

/* ══════════════════════  data  ══════════════════════ */

const QUESTION = "clozapine ANC monitoring";

type Source = {
  id: string;
  number: number | null;
  /** The two or three words that tell the documents apart, since all four start "Clozapine". */
  short: string;
  title: string;
  page: number;
};

const SOURCES: Source[] = [
  {
    id: "s1",
    number: 1,
    short: "Coordinator monitoring guideline",
    title: "Clozapine Coordinator Antipsychotic Monitoring Guideline",
    page: 4,
  },
  {
    id: "s2",
    number: 2,
    short: "Prescribing and monitoring policy",
    title: "Clozapine Prescribing, Administration and Monitoring Policy",
    page: 2,
  },
  {
    id: "s3",
    number: 3,
    short: "NMHS prescribing guideline",
    title: "Clozapine Prescribing (NMHS) Clinical Guideline",
    page: 15,
  },
  {
    id: "s4",
    number: null,
    short: "Patient information leaflet",
    title: "Clozapine Patient Information Leaflet",
    page: 5,
  },
];

const CITED = SOURCES.filter((source) => source.number !== null);

type Sentence = {
  /** Bold when the sentence is a safety finding; the emphasis is the whole treatment. */
  lead?: string;
  text: string;
  sourceId: string;
};

/** Source-only: one key sentence per cited document. Not the passage. */
const SOURCE_ONLY: Sentence[] = [
  {
    text: "FBC weekly for the first 18 weeks, then every four weeks while clozapine continues, with a result on file before each dispensing.",
    sourceId: "s1",
  },
  {
    lead: "ANC 1.5 to 2.0 × 10⁹/L is an amber result.",
    text: "Repeat the FBC twice weekly until it is back in the green range and notify the clozapine coordinator.",
    sourceId: "s2",
  },
  {
    lead: "Stop clozapine if the ANC falls below 1.5 × 10⁹/L.",
    text: "Repeat the FBC daily until it recovers, and do not rechallenge without haematology advice.",
    sourceId: "s3",
  },
];

/** AI-written: the same facts as flowing prose, the findings still bold. */
const READY: Sentence[] = [
  {
    text: "A full blood count is needed weekly for the first 18 weeks of clozapine and every four weeks after that, with a result on file before each dispensing.",
    sourceId: "s1",
  },
  {
    lead: "An ANC of 1.5 to 2.0 × 10⁹/L is an amber result:",
    text: "repeat the count twice weekly until it is back in the green range and tell the clozapine coordinator.",
    sourceId: "s2",
  },
  {
    lead: "Below 1.5 × 10⁹/L clozapine is stopped,",
    text: "the count is repeated daily until it recovers, and rechallenge needs haematology advice.",
    sourceId: "s3",
  },
];

const FOLLOW_UPS = ["What is a red result?", "After week 18?", "Missed blood test?"];

const LIBRARY = [
  { title: "Clozapine", kind: "medication" },
  { title: "Clozapine-specific adverse effects", kind: "differentials" },
];

const sourceById = (id: string) => SOURCES.find((source) => source.id === id) ?? SOURCES[0];

/* ══════════════════════  pieces  ══════════════════════ */

type AnswerKind = "source_only" | "ready";

function UserTurn() {
  return (
    <div className="flex justify-end">
      <p
        style={{ maxWidth: "85%", borderBottomRightRadius: 6 }}
        className="rounded-2xl bg-[color:var(--clinical-accent-soft)] px-3.5 py-2 text-sm leading-6 text-[color:var(--text-heading)]"
      >
        {QUESTION}
      </p>
    </div>
  );
}

const quietLink =
  "rounded-sm underline decoration-[color:var(--border-strong)] underline-offset-2 transition hover:text-[color:var(--text-heading)] hover:decoration-[color:var(--text-muted)]";

/** One grey line. Provenance, then the one control, as words. */
function ProvenanceLine({ kind }: { kind: AnswerKind }) {
  return (
    <p className="text-2xs leading-5 text-[color:var(--text-muted)]">
      {kind === "source_only"
        ? "Key sentences from your documents, not an AI-written answer"
        : "AI-written from 3 documents"}{" "}
      <span className="whitespace-nowrap">
        <span aria-hidden>· </span>
        <button type="button" onClick={() => undefined} className={cn(quietLink, focusRing)}>
          {kind === "source_only" ? "2 limitations" : "1 limitation"}
        </button>
      </span>
    </p>
  );
}

/** A small number after the sentence. One colour, nothing else. */
function Mark({ source, active, onOpen }: { source: Source; active: boolean; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(source.id)}
      aria-pressed={active}
      aria-label={`Source ${source.number}, ${source.title}, page ${source.page}`}
      className={cn(
        "nums ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-sm px-0.5 align-super text-3xs font-semibold leading-none transition",
        active
          ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
        focusRing,
      )}
    >
      {source.number}
    </button>
  );
}

/** The message. The finding is bold; that is the whole key-points treatment. */
function Message({
  sentences,
  flowing,
  activeId,
  onOpen,
}: {
  sentences: Sentence[];
  flowing: boolean;
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  // The mark is an atomic inline, so a browser may break the line before it even
  // with no space in the source — which strands a bare number at the start of a
  // line. Gluing it to the last word prevents that.
  const render = (sentence: Sentence) => {
    const words = sentence.text.split(" ");
    const last = words.pop();
    return (
      <>
        {sentence.lead ? <strong className="font-semibold">{sentence.lead}</strong> : null}
        {sentence.lead ? " " : null}
        {words.join(" ")}{" "}
        <span className="whitespace-nowrap">
          {last}
          <Mark source={sourceById(sentence.sourceId)} active={activeId === sentence.sourceId} onOpen={onOpen} />
        </span>
      </>
    );
  };
  if (flowing) {
    return (
      <p style={PROSE_MEASURE} className="text-base-minus leading-prose text-[color:var(--text-heading)]">
        {sentences.map((sentence, index) => (
          <span key={sentence.sourceId}>
            {index > 0 ? " " : null}
            {render(sentence)}
          </span>
        ))}
      </p>
    );
  }
  return (
    <div style={PROSE_MEASURE} className="space-y-2 text-base-minus leading-prose text-[color:var(--text-heading)]">
      {sentences.map((sentence) => (
        <p key={sentence.sourceId}>{render(sentence)}</p>
      ))}
    </div>
  );
}

/** One wrapped line of small links. The number and the short title, nothing else. */
function SourcesLine({ activeId, onOpen }: { activeId: string | null; onOpen: (id: string) => void }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-2xs leading-5 text-[color:var(--text-muted)]">
      <span className="font-medium">Sources</span>
      {CITED.map((source) => (
        <button
          key={source.id}
          type="button"
          onClick={() => onOpen(source.id)}
          aria-pressed={activeId === source.id}
          aria-label={`Source ${source.number}: ${source.title}, page ${source.page}`}
          className={cn(
            "inline-flex items-baseline gap-1 rounded-sm transition hover:text-[color:var(--text-heading)]",
            activeId === source.id && "text-[color:var(--text-heading)]",
            focusRing,
          )}
        >
          <span className="nums font-semibold text-[color:var(--clinical-accent)]">{source.number}</span>
          <span>{source.short}</span>
          <span className="nums">p.{source.page}</span>
        </button>
      ))}
      <span>+1 read</span>
    </p>
  );
}

/** Three muted icons. They are the only chrome under the message. */
function Actions() {
  const action =
    "grid h-8 w-8 place-items-center rounded-md text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-heading)]";
  return (
    <div className="-ml-2 flex items-center gap-0.5" aria-label="Answer actions">
      {[
        ["Copy with sources", Copy],
        ["Helpful", ThumbsUp],
        ["Report a problem", ThumbsDown],
      ].map(([label, Icon]) => (
        <button
          key={label as string}
          type="button"
          onClick={() => undefined}
          aria-label={label as string}
          title={label as string}
          className={cn(action, focusRing)}
        >
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

function AlsoLine() {
  return (
    <p className="text-2xs leading-5 text-[color:var(--text-muted)]">
      Also in your library:{" "}
      {LIBRARY.map((link, index) => (
        <span key={link.title}>
          {index > 0 ? " · " : null}
          <button type="button" onClick={() => undefined} className={cn(quietLink, focusRing)}>
            {link.title}
          </button>{" "}
          <span>({link.kind})</span>
        </span>
      ))}
    </p>
  );
}

/** Follow-ups as chips above the composer, the way chat apps do it. */
function ComposerWithChips() {
  return (
    <div className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface-chrome)] px-3 pb-3 pt-2">
      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
        {FOLLOW_UPS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => undefined}
            className={cn(
              "inline-flex min-h-8 shrink-0 items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-2xs font-medium text-[color:var(--text-muted)] transition hover:border-[color:var(--clinical-accent-border)] hover:text-[color:var(--clinical-accent)]",
              focusRing,
            )}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-full border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] py-1 pl-3.5 pr-1 shadow-[var(--shadow-inset)]">
        <span style={{ color: "var(--text-placeholder)" }} className="min-w-0 flex-1 truncate text-sm">
          Ask a follow-up…
        </span>
        <button
          type="button"
          onClick={() => undefined}
          aria-label="Send question"
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--command)] text-[color:var(--command-contrast)] transition hover:bg-[color:var(--command-hover)]",
            focusRing,
          )}
        >
          <ArrowUp aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1.5 text-3xs text-[color:var(--text-muted)]">Do not enter patient-identifiable information.</p>
    </div>
  );
}

/* ══════════════════════  the screen  ══════════════════════ */

function SubtleScreen({ kind, wide }: { kind: AnswerKind; wide: boolean }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const openSource = (id: string) => setActiveId((current) => (current === id ? null : id));
  return (
    <>
      <TopBar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn("space-y-4 px-4 py-4", wide && "mx-auto w-full max-w-2xl px-6 py-6")}>
          <UserTurn />
          <div className="space-y-2.5">
            <ProvenanceLine kind={kind} />
            <Message
              sentences={kind === "source_only" ? SOURCE_ONLY : READY}
              flowing={kind === "ready"}
              activeId={activeId}
              onOpen={openSource}
            />
            <SourcesLine activeId={activeId} onOpen={openSource} />
            <Actions />
            <AlsoLine />
          </div>
        </div>
      </div>
      <ComposerWithChips />
    </>
  );
}

/* ══════════════════════  the page  ══════════════════════ */

const CHANGES: Array<[string, string]> = [
  ["One grey line, not two chips", "Provenance in words, and the limitations count as a text link inside it."],
  [
    "Bold, not a block",
    "The safety finding is the bold sentence in the message. No card, no coloured rule, no number badge.",
  ],
  [
    "Sentences, not passages",
    "With no AI-written answer, the message is one key sentence per document. Three lines, not three paragraphs.",
  ],
  [
    "Sources as a line of links",
    "Number, the two or three words that tell the documents apart, page. Wraps; never scrolls sideways.",
  ],
  ["Chips above the composer", "Follow-ups where chat apps put them. The page ends at the sources line."],
];

export function AnswerPageSubtleMockupsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6">
      <header className="mb-6">
        <p className="text-3xs font-semibold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
          Answer page · fourth pass
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[color:var(--text-heading)]">Subtle</h1>
        <p style={PROSE_MEASURE} className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
          The third pass answered every issue with a block and was rejected as bulky. This one answers the same list
          with less: the answer reads as one message, the critical sentence is bold, the sources are a line of small
          links, and the follow-ups are chips above the composer. It fits one phone screen.
        </p>
        <p className="mt-2 text-2xs text-[color:var(--text-muted)]">
          Synthetic copy throughout. Clinical figures are illustrative and are not a source of truth.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <PhoneFrame caption="Phone · no AI-written answer">
          <SubtleScreen kind="source_only" wide={false} />
        </PhoneFrame>
        <PhoneFrame caption="Phone · AI-written">
          <SubtleScreen kind="ready" wide={false} />
        </PhoneFrame>
      </div>

      <div className="mt-6">
        <DesktopFrame caption="Desktop · one reading column, no side panel">
          <SubtleScreen kind="ready" wide />
        </DesktopFrame>
      </div>

      <dl className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" style={{ maxWidth: PHONE_WIDTH * 3 }}>
        {CHANGES.map(([title, body]) => (
          <div key={title}>
            <dt className="text-2xs font-semibold text-[color:var(--text-heading)]">{title}</dt>
            <dd className="text-2xs leading-5 text-[color:var(--text-muted)]">{body}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
