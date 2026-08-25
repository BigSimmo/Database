"use client";

import { cn } from "@/components/ui-primitives";

/**
 * The small numbered box after a sentence of the answer, and the control that
 * opens that sentence's source.
 *
 * **It is a `<button>`, not a span with `role="button"`.** The mark is a single
 * glyph, so it never needs to wrap, and Blink/WebKit coercing a button to
 * `inline-block` costs nothing here — the box is inline-block by design. (The
 * opposite holds for a multi-word inline phrase, which is why other inline
 * controls in the redesign use a span.)
 *
 * ### Where the geometry lives
 *
 * In `.answer-source-mark` in `globals.css`, not here. Size, rise, padding and
 * line-height are one interdependent set — the box has to sit above the text
 * without growing the line box or touching its neighbour — and it is `em`-based
 * so it scales with the prose it annotates. That is a geometry the absolute type
 * scale cannot express, and unlayered component CSS is how this repo expresses
 * one. The class carries the measured figures and the two shapes that failed;
 * read it before changing any value.
 *
 * Only colour, state and the cluster spacing stay here, because those are what
 * vary from mark to mark.
 *
 * ### Colour and state
 *
 * One colour, always. Document staleness is a property of the document, not of
 * the reference, and two hues inside running prose make the eye stop twice —
 * status lives on the rail card and in the drawer. The open mark is ringed with
 * an `outline`, never a `box-shadow`: forced-colors does not paint box shadows,
 * so a shadow ring would make an open mark indistinguishable from a closed one
 * for the readers who most need the distinction.
 */
export function AnswerSourceMark({
  index,
  label,
  active = false,
  partial = false,
  leading = false,
  onOpen,
}: {
  /** Rail row this mark opens. The visible digit is `index + 1`. */
  index: number;
  /** Full accessible name, e.g. "Source 2: WA Health lithium protocol, page 8 — partial support". */
  label: string;
  /** True while the drawer is showing this source. */
  active?: boolean;
  /** `partial` support adds the one glyph that reads at this size; a rule or underline does not. */
  partial?: boolean;
  /** First mark of a cluster sits closer to the word; later ones need the wider gap. */
  leading?: boolean;
  onOpen: (index: number) => void;
}) {
  return (
    <button
      type="button"
      data-testid="answer-source-mark"
      data-source-index={index}
      data-support={partial ? "partial" : "direct"}
      aria-pressed={active}
      aria-label={label}
      onClick={() => onOpen(index)}
      className={cn(
        "answer-source-mark nums font-semibold transition-colors",
        leading ? "ml-[0.28em]" : "ml-[0.34em]",
        active
          ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] outline outline-2 outline-offset-[1.5px] outline-[color:var(--clinical-accent)]"
          : "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] hover:border-[color:var(--clinical-accent)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[1.5px] focus-visible:outline-[color:var(--focus)]",
      )}
    >
      {index + 1}
      {partial ? (
        <span aria-hidden="true" className="answer-source-mark-star">
          *
        </span>
      ) : null}
    </button>
  );
}

/**
 * The `+N` after a capped cluster. A statement, not a control: the sources it
 * counts are all on the rail below at full tap size, and a control here would
 * have to choose one of them arbitrarily.
 */
export function AnswerSourceMarkOverflow({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      data-testid="answer-source-mark-overflow"
      className="answer-source-mark-overflow nums font-semibold text-[color:var(--text-muted)]"
    >
      <span className="sr-only">and </span>+{count}
      <span className="sr-only"> more sources</span>
    </span>
  );
}
