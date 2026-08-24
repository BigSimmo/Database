"use client";

import { useId, useState } from "react";

import { cn } from "@/components/ui-primitives";
import { interactiveRowBase } from "@/components/ui/interactive-row";

/**
 * A source marker the catalogue writes inline at the end of a sentence, e.g.
 * "… as unsupported self-help. (PubMed)".
 *
 * Left in the running text these repeat every two or three sentences and read
 * as an interruption; removed outright they would strip the record's
 * provenance, which this repository never does. So they are lifted out of the
 * sentence and re-rendered as chips — the same information, out of the reading
 * line.
 *
 * Recognition is **structural, not a list of publisher names**. The catalogue
 * cites at least Phoenix Australia, PubMed, NCBI, PMC, NICE, RANZCP, VA/DoD and
 * several government departments, and a closed list silently stops working the
 * day a new one is imported — which is the wrong failure for a provenance
 * surface. What every marker shares is its position: a short bracketed name
 * that *follows a sentence ending*.
 *
 * That position is also what separates a citation from ordinary prose. An
 * abbreviation gloss sits mid-sentence after a word — "cognitive behavioural
 * therapy (CBT)" — and an aside like "(see below)" does too, so neither
 * matches. Content may not contain sentence punctuation, so a whole bracketed
 * sentence is left where the author put it.
 */
const AUTHORITY_PATTERN = /(?<=[.!?])\s*\(([A-Z0-9][^().!?]{0,58})\)/g;

type ProseSentence = {
  text: string;
  citations: string[];
};

export type ProseParagraph = { text: string; citations: string[]; sentences: ProseSentence[] };

/**
 * Pull recognised source markers out of one run of text.
 *
 * Returns the text with the markers removed and the ordered, de-duplicated set
 * of authorities that were removed. Text with no recognised marker comes back
 * byte-identical.
 */
export function extractCitations(text: string): { text: string; citations: string[] } {
  const citations: string[] = [];
  const stripped = text.replace(AUTHORITY_PATTERN, (_match, authority: string) => {
    if (!citations.includes(authority)) citations.push(authority);
    return "";
  });
  return {
    text: stripped
      .replace(/\s+/g, " ")
      .replace(/\s+([.,;:])/g, "$1")
      .trim(),
    citations,
  };
}

/**
 * Break one long field into readable paragraphs.
 *
 * Author newlines win where they exist. Otherwise sentences are grouped in
 * pairs: the catalogue's fields run to 300–700 characters as a single block,
 * which on a phone is fifteen unbroken lines, and a paragraph break every two
 * sentences is what gives the eye a place to land.
 */
export function splitParagraphs(text: string, sentencesPerParagraph = 2): ProseParagraph[] {
  const byLine = text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const splitBySentence = (paragraph: string): ProseSentence[] =>
    paragraph
      .split(/(?<=[.)])\s+(?=[A-Z])/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .map((sentence) => {
        const { text: body, citations } = extractCitations(sentence);
        return { text: body, citations };
      })
      .filter((sentence) => sentence.text.length > 0 || sentence.citations.length > 0);

  const grouped =
    byLine.length > 1
      ? byLine.map((line) => splitBySentence(line))
      : (() => {
          const sentences = splitBySentence(text);
          const groupedByTwoSentences: ProseSentence[][] = [];
          for (let index = 0; index < sentences.length; index += sentencesPerParagraph) {
            groupedByTwoSentences.push(sentences.slice(index, index + sentencesPerParagraph));
          }
          return groupedByTwoSentences;
        })();

  return grouped
    .map((blockSentences) => {
      const paragraphText = blockSentences
        .map((sentence) => sentence.text)
        .join(" ")
        .trim();
      const citations = [...new Set(blockSentences.flatMap((sentence) => sentence.citations))];
      return {
        text: paragraphText,
        citations,
        sentences: blockSentences,
      };
    })
    .filter((paragraph) => paragraph.text.length > 0 || paragraph.citations.length > 0);
}

export type SourceCitation = { text: string; authority: string };

/**
 * Split a record's reference blob into individual citations.
 *
 * The catalogue stores every record's references as one run of prose in which
 * each citation ends with its authority in brackets — which is why the old
 * provenance card rendered as a single unreadable paragraph. Splitting on the
 * authority marker recovers the list the author wrote.
 *
 * Text after the final marker is not a citation and is returned separately
 * rather than dropped: in this catalogue that tail is usually the import
 * artefact "Your attached prior chat for sequence and locked format
 * continuity.", which must not be presented to a clinician as a source, and
 * must not be silently deleted either.
 */
export function splitSourceCitations(text: string): { citations: SourceCitation[]; notes: string[] } {
  const citations: SourceCitation[] = [];
  const notes: string[] = [];
  let cursor = 0;

  // `AUTHORITY_PATTERN` is global; reset so repeated calls start from the top.
  AUTHORITY_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(AUTHORITY_PATTERN)) {
    const start = match.index ?? 0;
    const body = text.slice(cursor, start).trim();
    cursor = start + match[0].length;
    if (body) citations.push({ text: body, authority: match[1] });
  }

  const tail = text.slice(cursor).trim();
  if (tail) {
    // No marker anywhere: the whole blob is one unattributed reference, so keep
    // it as a citation rather than demoting a real source to a note.
    if (!citations.length) citations.push({ text: tail, authority: "" });
    else notes.push(tail);
  }
  return { citations, notes };
}

/** Above this, a block is clamped and gets a Show more control. */
const CLAMP_THRESHOLD = 320;

function CitationChips({ citations }: { citations: string[] }) {
  if (!citations.length) return null;
  return (
    <span className="ml-1.5 inline-flex flex-wrap gap-1 align-baseline">
      {citations.map((citation) => (
        <span
          key={citation}
          className="rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-1.5 py-px text-3xs font-semibold text-[color:var(--clinical-accent)]"
        >
          {citation}
        </span>
      ))}
    </span>
  );
}

/**
 * One field of record prose, formatted for reading rather than for storage.
 *
 * Long blocks clamp to four lines behind a real labelled button — `<details>`
 * would give the control no accessible name of its own, and this one has to say
 * which block it expands. The clamped copy stays in the DOM (it is clipped, not
 * removed) so find-in-page and screen readers still reach every word; only the
 * visual height is bounded.
 */
export function ProseBlock({
  text,
  label,
  className,
  tone = "muted",
}: {
  text: string;
  /** Names the block in the toggle's accessible name, e.g. "Use when". */
  label: string;
  className?: string;
  tone?: "muted" | "warning";
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const paragraphs = splitParagraphs(text);
  const clampable = text.length > CLAMP_THRESHOLD;

  if (!paragraphs.length) return null;

  return (
    <div className={className}>
      {/* The clamp is a bounded height with an overflow clip, not `line-clamp`:
          that utility is a `-webkit-box` and only clamps the inline content of
          one box, so it silently does nothing to a stack of paragraphs. The
          collapsed copy stays in the DOM — clipped, never unmounted — so
          find-in-page and assistive technology still reach every word. */}
      <div
        className={cn(
          "relative",
          clampable && !expanded && "max-h-[6.5rem] overflow-hidden print:overflow-visible print:max-h-none",
        )}
      >
        <div
          id={`${id}-prose`}
          className={cn(
            "max-w-[68ch] space-y-2.5 text-sm-minus leading-relaxed",
            tone === "warning" ? "text-[color:var(--warning-text)]" : "text-[color:var(--text-muted)]",
          )}
        >
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="m-0">
              {paragraph.sentences.map((sentence, sentenceIndex) => (
                <span key={`${index}-${sentenceIndex}`}>
                  {sentence.text}
                  <CitationChips citations={sentence.citations} />
                  {sentenceIndex === paragraph.sentences.length - 1 ? null : " "}
                </span>
              ))}
            </p>
          ))}
        </div>
        {clampable && !expanded ? (
          <span
            aria-hidden
            className={cn(
              // The clamp lifts in print (`print:max-h-none`), so this fade would
              // sit on the last lines of the full field — including safety copy —
              // unless it is dropped for paper too.
              "pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t to-transparent print:hidden",
              tone === "warning" ? "from-[color:var(--warning-bg)]" : "from-[color:var(--surface-raised)]",
            )}
          />
        ) : null}
      </div>
      {clampable ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-controls={`${id}-prose`}
          // The visible text is the same on every block on the page, so the
          // accessible name names the block it belongs to. It keeps the visible
          // text as its prefix, so "label in name" still holds for anyone
          // driving the page by voice.
          aria-label={expanded ? `Show less of ${label}` : `Show more of ${label}`}
          className={cn(
            interactiveRowBase,
            "-mx-1 mt-1 inline-flex min-h-tap items-center px-1 text-xs font-bold text-[color:var(--clinical-accent)] hover:underline",
          )}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}
