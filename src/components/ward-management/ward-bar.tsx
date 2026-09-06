import styles from "./ward-bar.module.css";

/**
 * One bar, one meaning, always with a key.
 *
 * ⚠️ **A BAR IS THE EASIEST PLACE IN THIS APP TO SAY SOMETHING FALSE.** A reader takes a stacked bar
 * as a whole — so a bar whose segments mean two different things (a locked share drawn beside an
 * occupancy share) reads as one fact and is two. `caption` is the bar's single meaning and it is
 * required for that reason, not for decoration.
 *
 * Three screens draw this bar: the wait-time split on Delays, the locked share on Capacity, the
 * transport lifecycle on Movements. Before this component they shared no code, and the locked-share
 * bar on Capacity had already been mistaken for an occupancy bar once.
 *
 * It refuses the two lies a stacked bar tells for free, and it THROWS rather than warns, because a
 * console warning is not read by the person this protects:
 *
 *   1. **A band with no word.** State is worded as well as coloured everywhere here — a coloured
 *      band carrying meaning alone is unreadable to anyone who cannot separate the hues, and
 *      nothing about a screenshot reveals it.
 *   2. **An all-zero bar.** It draws as an empty grey rail, which reads as a loading state rather
 *      than as "nothing is in any of these categories". The words that replace it depend on which
 *      zero it is, and only the call site knows — see the refusal itself for the ruling.
 *
 * ⚠️ **EVERY REFUSAL HERE IS A CONTRACT ON THE CALL SITE, AND EACH ONE IS A CRASH IF IT REACHES A
 * READER.** These throw during render, so there is no degraded state: a call site that trips one
 * takes its whole page down. That is the right trade for a component whose failure mode is stating
 * something false about beds and waiting patients — but it means the guarding belongs at every call
 * site, and `tests/ward-bar-zero-is-reachable.test.ts` exists because one of them did not have it.
 */
export type WardBarTone = "good" | "warning" | "danger" | "accent" | "rest";
export type WardBarSegment = { label: string; value: number; tone: WardBarTone };

export function WardBar({ segments, caption }: { segments: WardBarSegment[]; caption: string }) {
  for (const segment of segments) {
    if (segment.label.trim() === "") {
      throw new Error("WardBar: every segment needs a label — a coloured band with no word says nothing.");
    }
  }
  /*
   * 🔴 **THIS REFUSAL IS A CALL-SITE CONTRACT, NOT A SAFETY NET, AND THE DIFFERENCE IS A BLANK
   * SCREEN.** It throws during render, so a call site that reaches it does not degrade — it takes
   * the whole page down. Every caller must therefore decide the empty case BEFORE constructing a
   * bar. Reaching this message at runtime is already the failure; the message exists to make the
   * next person's fix the right one rather than the quick one.
   *
   * ⚠️ **AND THE OLD MESSAGE ASKED FOR THE WRONG FIX.** It read *"Render the absence in words
   * instead"* — which sends a caller holding a MEASURED zero to write an absence sentence over it.
   * Ward Lead ruled on exactly that distinction on 2026-09-06, and the wording here was pulling
   * against the ruling:
   *
   *     a measured zero  — the count ran and found none      → a plain word: "None." "Nobody is waiting."
   *     an unknown       — nothing derived a figure at all   → the absence sentence, saying what is missing
   *
   * The component cannot tell those apart and never will: both arrive as the number 0. Only the call
   * site knows whether a derivation ran. That is the whole reason this throws instead of rendering
   * something reasonable — a bar drawn over either one would say "nothing in any category" when the
   * true statement might be "we cannot say".
   */
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) {
    throw new Error(
      "WardBar: every segment is zero, and an empty rail reads as a loading state rather than as a result. " +
        "This is a decision for the call site, because only it knows which zero this is. If the count RAN and " +
        'found none, say so in a plain word — "None", "Nobody is waiting" — and do not draw a bar. If nothing ' +
        "derived a figure at all, use the absence sentence that says what is missing and why. Do not use the " +
        "absence sentence over a measured zero: it would be false about a real figure.",
    );
  }

  /*
   * 🔴 THE THIRD AND FOURTH LIES, AND THEY ARE THE MIRROR OF THE ALL-ZERO ONE.
   *
   * This component already refuses an empty rail, because an empty rail reads as "still loading"
   * rather than as "nothing in any category". **A FULL RAIL READS AS "EVERYTHING", AND NOTHING
   * REFUSED IT.** Every stacked bar is full by construction — the segments are drawn as shares of
   * their own sum — so the fill is never a measure of anything. It is only ever safe because the
   * caption tells the reader what the whole rail IS.
   *
   * ⚠️ **FOUND BY OPENING THE PAGE, ON THE ONE SCREEN WHERE IT MATTERS MOST.** Capacity drew
   * `27 of 303 beds ready across the network` as a full-width bar: the rail divides the 27, the
   * caption names the 303, and the reader's eye attributes the fill to the larger number.
   * **Nine per cent of the network's beds were ready and the picture said full**, on the screen
   * whose entire subject is whether there are enough beds. Every test in the repository was green;
   * the words above and below the bar were correct.
   *
   *   1. **A caption naming a total the bar does not draw.** Every number in the caption must be
   *      the segment sum. Two different numbers beside one rail cannot both be what it shows, and
   *      the reader has no way to tell which one it is. Where a second number is genuinely worth
   *      showing — a denominator, a ceiling — it belongs in the panel header, which is where
   *      Capacity's `27 of 303` already lives, and not beside the rail as well.
   *   2. **A bar with one segment.** A distribution needs at least two categories to distribute
   *      between; with one, the rail is 100% of itself whatever the value, and it is a number
   *      wearing the costume of a chart. Note this counts the segments DECLARED, not the ones
   *      drawn: a four-category bar where three are currently zero is legitimate and says something
   *      real — that everything is in one category today — and it keeps its rail.
   *
   * ⚠️ **THESE RUN AFTER the label and all-zero checks on purpose.** Both of those are more
   * fundamental, and their tests construct single-segment bars; if this fired first, those tests
   * would pass on the wrong error and stop testing what they name.
   */
  if (segments.length < 2) {
    throw new Error(
      `WardBar: a bar needs at least two segments to be a distribution, and this one declares ${segments.length}. ` +
        "A single category fills the rail whatever its value, so the bar says only what its own number already says. " +
        "Render the number instead — or, if the other categories exist but are empty today, declare them at zero.",
    );
  }

  const captionNumbers = [...caption.replace(/,/gu, "").matchAll(/\d+(?:\.\d+)?/gu)].map((match) => Number(match[0]));
  const notDrawn = captionNumbers.filter((value) => value !== total);
  if (notDrawn.length > 0) {
    throw new Error(
      `WardBar: the caption names ${notDrawn.join(" and ")}, and this bar draws ${total}. ` +
        "A stacked bar is always full, so a caption naming a number the bar does not draw invites the reader to " +
        "read the fill as that number — a bar dividing 27 under a caption saying 303 shows nine per cent as full. " +
        "Caption the bar with what it draws, and put the other figure in the panel header.",
    );
  }

  // Names every segment AND its count, so a screen-reader user gets the same reading as somebody
  // looking at the widths — not merely "chart".
  const description = `${caption}: ${segments.map((segment) => `${segment.label} ${segment.value}`).join(", ")}.`;

  return (
    <div className={styles.bar} data-ward-primitive="bar">
      {/*
       * 🔴 THE CAPTION IS RENDERED. UNTIL 2026-09-06 IT EXISTED ONLY IN THE `aria-label`.
       *
       * Measured on Capacity before this change: the accessible name read "27 beds ready across the
       * network", and **zero visible elements on the page carried that sentence**. The only text a
       * sighted reader had beside a full-width rail was the panel header above it — which said
       * "27 of 303 beds".
       *
       * ⚠️ **So the screen-reader user was better served than the sighted one, which inverts the
       * assumption this component was built on.** Its own header says the `aria-label` exists so that
       * "a screen-reader user gets the same reading as somebody looking at the widths". That was true
       * of the segment values and false of the thing that says what the whole rail IS.
       *
       * Fixing the caption's WORDS was necessary and did nothing for the eye. This is the half that
       * does: the sentence naming the rail now sits above the rail, where the misreading happens.
       */}
      <p className={styles.caption}>{caption}</p>
      <div className={styles.track} role="img" aria-label={description}>
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <span
              key={segment.label}
              className={styles.segment}
              data-tone={segment.tone}
              style={{ width: `${(segment.value / total) * 100}%` }}
            />
          ))}
      </div>
      <ul className={styles.key}>
        {segments.map((segment) => (
          <li key={segment.label} className={styles.keyItem}>
            <span className={styles.swatch} data-tone={segment.tone} aria-hidden="true" />
            {segment.label}{" "}
            {segment.value === 0 ? (
              <span className={styles.zero}>none</span>
            ) : (
              <b className={styles.count}>{segment.value}</b>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
