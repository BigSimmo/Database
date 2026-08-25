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
 * ### The geometry is load-bearing — do not "tidy" these values
 *
 * At the answer's 16px / 1.66 prose, this renders a 12×12px box lifted 5px, so
 * it spans 5→17px above the baseline inside 19.2px of leading: **+2.2px of
 * clearance to the line above, and no line growth.** Margins give 2.2px before a
 * word and 2.7px between two marks, which is what stops "2" and "3" in a cluster
 * from touching.
 *
 * Two earlier shapes failed and are recorded so they are not retried:
 *
 * - `line-height: 0` with the box painted by a `::before` collapsed the padding
 *   box to a sliver — an inline-block with zero line-height has no height to pad.
 * - Painting the box from a pseudo-element wider than the element itself made
 *   adjacent marks overlap, because the margins size the *element*, not the
 *   paint. The border here is on the control itself for exactly that reason.
 *
 * A bordered box cannot sit entirely above the capitals at readable leading;
 * clearing cap height needs roughly 45% more line spacing. This is as high as it
 * goes without stealing the line above.
 *
 * The line-height is `leading-none`, a named step rather than an arbitrary
 * bracketed value — `tests/design-token-contract.test.ts` keeps that vocabulary
 * closed in production, and it scans the raw file, so even naming the bracketed
 * form in a comment trips it. It must never go to zero: an inline-block with
 * zero line-height has a zero-height padding box, which is how the box collapsed
 * to a sliver the first time.
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
        "nums relative inline-block min-w-[1.5em] -top-[0.625em] rounded-[var(--radius-xs)] border px-[0.2em] py-[0.15em] text-center align-baseline text-[0.5em] font-semibold leading-none transition-colors",
        leading ? "ml-[0.28em]" : "ml-[0.34em]",
        active
          ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] outline outline-2 outline-offset-[1.5px] outline-[color:var(--clinical-accent)]"
          : "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] hover:border-[color:var(--clinical-accent)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[1.5px] focus-visible:outline-[color:var(--focus)]",
      )}
    >
      {index + 1}
      {partial ? (
        <span aria-hidden="true" className="ml-[0.03em] text-[0.85em] leading-none">
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
      className="nums relative -top-[0.625em] ml-[0.34em] align-baseline text-[0.5em] font-semibold leading-none text-[color:var(--text-muted)]"
    >
      <span className="sr-only">and </span>+{count}
      <span className="sr-only"> more sources</span>
    </span>
  );
}
