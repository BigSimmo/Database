/**
 * Bounded windows for source-text contract tests.
 *
 * Several tests in this suite assert on the raw text of a component rather than
 * its behaviour, scoped to a window between two marker strings. The idiom they
 * all reached for is:
 *
 *     source.slice(source.indexOf(start), source.indexOf(end))
 *
 * which has a silent failure mode that is worse than the fragility it is
 * usually blamed for. When `end` no longer matches — someone renamed a symbol,
 * reflowed a line, changed a class string used as a delimiter — `indexOf`
 * returns `-1`, and `slice(start, -1)` does not throw. It quietly returns
 * *everything to the end of the file bar one character*. Every positive
 * `toContain` in that window then passes for the wrong reason: the assertion
 * silently stops being scoped and starts matching anywhere in the file.
 *
 * The mirror case is just as bad. A missing `start` gives `slice(-1, n)`, an
 * empty or one-character window, so every `not.toContain` passes vacuously.
 *
 * So the danger is not "this test breaks when unrelated code moves" — a broken
 * test is loud and gets fixed. The danger is a test that keeps passing while
 * enforcing nothing. This helper converts both cases into an immediate, named
 * failure.
 *
 * It also rejects an *ambiguous* start marker. A window anchored on a string
 * that occurs more than once silently covers only the first occurrence, so a
 * negative assertion ("this must not appear here") proves nothing about the
 * others. That is not hypothetical: `{showUniversalAlsoMatches &&` appears
 * twice in `ClinicalDashboard.tsx`, and the window anchored on it was checking
 * one of the two while reading as though it covered the contract.
 *
 * Prefer a structural end marker where the language provides one — a matching
 * closing tag, `$$;` in SQL, a closing brace you can see. `header-scroll-hide-
 * contract.test.ts` anchoring on `</PhoneHeaderCollapsePortal>` is the model.
 * An end marker that is merely "whatever is declared next" is adjacency, not
 * structure, and will widen the day something is inserted between them.
 */

type SourceSegmentOptions = {
  /**
   * Label used in failure messages so a throw names the contract rather than
   * just the markers. Optional, but a test that scopes a window usually has a
   * name for what the window IS.
   */
  label?: string;
  /**
   * Set when the start marker legitimately occurs more than once and the first
   * occurrence is the intended one. Opt-in, so ambiguity is a decision rather
   * than an accident.
   */
  allowRepeatedStart?: boolean;
};

function describeMarker(marker: string) {
  const collapsed = marker.replace(/\s+/g, " ").trim();
  return collapsed.length > 60 ? `${collapsed.slice(0, 57)}…` : collapsed;
}

function requireNonEmptyMarker(marker: string, kind: "start" | "end", context: string) {
  if (marker.length === 0) {
    throw new Error(`${context}${kind} marker must not be empty`);
  }
}

/**
 * Slice the window between `startMarker` and the first `endMarker` after it.
 *
 * Throws — never returns a silently wrong window — when the start is missing,
 * the end is missing, or the start is ambiguous.
 */
export function sourceSegment(
  contents: string,
  startMarker: string,
  endMarker: string,
  options: SourceSegmentOptions = {},
): string {
  const context = options.label ? `${options.label}: ` : "";
  requireNonEmptyMarker(startMarker, "start", context);
  requireNonEmptyMarker(endMarker, "end", context);
  const start = contents.indexOf(startMarker);
  if (start < 0) {
    throw new Error(`${context}start marker not found: "${describeMarker(startMarker)}"`);
  }

  if (!options.allowRepeatedStart) {
    const second = contents.indexOf(startMarker, start + 1);
    if (second >= 0) {
      throw new Error(
        `${context}start marker "${describeMarker(startMarker)}" occurs more than once, so this window covers only ` +
          "the first occurrence and proves nothing about the rest of the file. Anchor on something unique, widen the " +
          "assertion to the whole file, or pass allowRepeatedStart if the first occurrence really is the contract.",
      );
    }
  }

  const end = contents.indexOf(endMarker, start + startMarker.length);
  if (end < 0) {
    throw new Error(
      `${context}end marker not found after the start: "${describeMarker(endMarker)}". Without this guard the window ` +
        "would have silently become the rest of the file and every assertion in it would pass for the wrong reason.",
    );
  }

  return contents.slice(start, end);
}

/**
 * Window from `startMarker` to the end of the file. Use only where the contract
 * genuinely runs to EOF; otherwise give `sourceSegment` a real end marker.
 */
export function sourceFrom(contents: string, startMarker: string, options: SourceSegmentOptions = {}): string {
  const context = options.label ? `${options.label}: ` : "";
  requireNonEmptyMarker(startMarker, "start", context);
  const start = contents.indexOf(startMarker);
  if (start < 0) {
    throw new Error(`${context}start marker not found: "${describeMarker(startMarker)}"`);
  }
  if (!options.allowRepeatedStart) {
    const second = contents.indexOf(startMarker, start + 1);
    if (second >= 0) {
      throw new Error(
        `${context}start marker "${describeMarker(startMarker)}" occurs more than once; anchor on something unique ` +
          "or pass allowRepeatedStart.",
      );
    }
  }
  return contents.slice(start);
}
