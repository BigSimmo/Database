import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 🔴 **THE SERVER'S MARKUP MUST NOT DEPEND ON THE WALL CLOCK, OR HYDRATION CANNOT MATCH IT.**
 *
 * Found 2026-09-06 by opening a ward page and reading the console, which is the only place it was
 * ever visible. React reported *"Hydration failed because the server rendered text…"* on the ward
 * board. The same URL, fetched server-side and compared against the live DOM:
 *
 *     server HTML   As at <!-- -->01:17
 *     browser DOM   As at 01:16
 *
 * `WardFlowProvider` read `wallClockNow()` inside a `useState` initialiser. **That initialiser runs
 * once during SSR and again during hydration, on two different machines at two different moments**,
 * so any minute boundary between them changed the offset — and the offset feeds
 * `seedWardFlowStateAt`, which shifts EVERY instant in the seeded world, so the mismatch was never
 * one stale clock but the whole board at once.
 *
 * ⚠️ **WHY NOTHING CAUGHT IT, AND WHY THIS FILE PASSES NO `initialNow`.** Every other ward test
 * pins the clock, and that argument short-circuits the wall clock entirely — **the suite exercised
 * the one code path where the defect is impossible.** jsdom component tests never server-render
 * either. This file therefore renders the LIVE path, on the server, which is the combination that
 * had no coverage at all.
 *
 * The property is not "the clock is right". It is that **two server renders taken at different
 * moments produce the same markup** — because whatever the server produces, the client's first
 * render has to reproduce exactly, and the client cannot know what minute the server was in.
 */

const clock = { wall: 0, absolute: 0 };

vi.mock("@/components/ward-management/ward-clock", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-clock")>();
  return {
    ...actual,
    wallClockNow: () => clock.wall,
    absoluteWallClockMinutes: () => clock.absolute,
  };
});

const { WardFlowProvider } = await import("@/components/ward-management/ward-flow-provider");
const { WardBoard } = await import("@/components/ward-management/board/ward-board");

/** One server render of a real ward screen at whatever moment `clock` currently reports. */
function serverMarkupAt(wall: number, absolute: number): string {
  clock.wall = wall;
  clock.absolute = absolute;
  return renderToStaticMarkup(
    createElement(WardFlowProvider, null, createElement(WardBoard, { unitId: "rph-adult-secure" })),
  );
}

describe("the server's ward markup does not depend on what minute it is", () => {
  beforeEach(() => {
    clock.wall = 0;
    clock.absolute = 0;
  });

  it("renders a real board with real content, or the comparison below compares two blanks", () => {
    const markup = serverMarkupAt(10 * 60 + 42, 100_000);
    expect(
      markup.length,
      "the server rendered almost nothing — this file would compare two empty strings",
    ).toBeGreaterThan(2000);
    expect(markup, "the board did not render its as-at stamp, which is the text the mismatch was in").toContain(
      "As at",
    );
  });

  /**
   * ⚠️ **THE MINUTE PAIR IS THE ORIGINAL DEFECT, EXACTLY.** 01:16 and 01:17 are the two values
   * measured off the running app on the day — the server said one and the browser said the other.
   */
  it("produces identical markup one minute apart — the pair that actually broke", () => {
    const at0116 = serverMarkupAt(1 * 60 + 16, 100_000);
    const at0117 = serverMarkupAt(1 * 60 + 17, 100_001);
    expect(
      at0117,
      "two server renders a minute apart differ, so the client's hydration render cannot reproduce " +
        "either one. Whatever varies here is being read from the wall clock during render.",
    ).toBe(at0116);
  });

  /**
   * Wider than the pair above on purpose: a fix that happened to make two adjacent minutes agree —
   * by rounding, say — would pass that test and still break across the hour it rounded at.
   */
  it("produces identical markup across widely separated moments, including across a day boundary", () => {
    const baseline = serverMarkupAt(10 * 60 + 42, 100_000);
    const moments: readonly (readonly [number, number])[] = [
      [0, 0],
      [23 * 60 + 59, 250_000],
      [12 * 60, 500_000],
      [1, 999_999],
    ];
    for (const [wall, absolute] of moments) {
      expect(
        serverMarkupAt(wall, absolute),
        `server markup changed at wall=${wall} absolute=${absolute}; the render is reading a clock`,
      ).toBe(baseline);
    }
  });

  /**
   * 🔴 **THE CONTROL, AND WITHOUT IT THE THREE CHECKS ABOVE COULD ALL BE MEASURING A BROKEN MOCK.**
   * If `vi.mock` were not taking effect — wrong path, wrong export name — every render would read
   * the same real clock and come back identical, and this file would pass while guarding nothing.
   * A pinned `initialNow` is the one input that IS meant to change the markup, so it proves the
   * renders react to their input at all.
   */
  it("DOES change when the pinned clock changes, so an identical result above means something", () => {
    /*
     * `children` is passed IN THE PROPS OBJECT here, and the two obvious alternatives are both
     * worse. `WardFlowProviderProps` declares `children` as REQUIRED, so `createElement(C, props,
     * child)` does not typecheck — TypeScript does not credit the third argument against a required
     * prop, and it fails with TS2769 on this exact call. Making the prop optional to satisfy a lint
     * rule would weaken a production type for a test's convenience.
     *
     * ⚠️ And this file CANNOT become `.tsx` to use JSX instead: the vitest projects include
     * `tests/**\/*.test.ts` for node and `tests/**\/*.dom.test.tsx` for jsdom, so a plain `.tsx`
     * would match NEITHER and this suite would silently stop running — a zero that reads exactly
     * like a pass.
     */
    // eslint-disable-next-line react/no-children-prop -- see above: the prop is required, and renaming this file would stop it running
    const anchorElement = createElement(WardFlowProvider, {
      initialNow: 10 * 60 + 42,
      children: createElement(WardBoard, { unitId: "rph-adult-secure" }),
    });
    // eslint-disable-next-line react/no-children-prop -- see above
    const laterElement = createElement(WardFlowProvider, {
      initialNow: 15 * 60 + 30,
      children: createElement(WardBoard, { unitId: "rph-adult-secure" }),
    });
    const anchor = renderToStaticMarkup(anchorElement);
    const later = renderToStaticMarkup(laterElement);
    expect(
      later,
      "two renders at different PINNED instants are identical, so this file cannot tell a " +
        "deterministic render from a render that ignores its inputs entirely",
    ).not.toBe(anchor);
  });
});
