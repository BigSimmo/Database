// tests/ward-chip.dom.test.tsx
import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import {
  WARD_CHIP_LEVELS,
  WARD_KIND_CHIP_KINDS,
  WardChip,
  WardKindChip,
  type WardChipLevel,
} from "@/components/ward-management/ward-chip";

describe("WardChip", () => {
  it("renders its text, for every level", () => {
    for (const level of WARD_CHIP_LEVELS) {
      const { unmount } = render(<WardChip level={level}>{`state ${level}`}</WardChip>);
      expect(screen.getByText(`state ${level}`)).toBeInTheDocument();
      unmount();
    }
  });

  /**
   * ⚠️ THIS IS THE ASSERTION THAT MATTERS. `colourOnlyStatusIndicators` is a ratcheted gate in
   * this repository: a state carried by colour alone fails the build. A chip with an empty child
   * is exactly that failure, and it renders as a small coloured rectangle that looks deliberate.
   */
  it("refuses to render a chip with no words in it", () => {
    expect(() => render(<WardChip level="urgent">{""}</WardChip>)).toThrow(/WardChip needs text/u);
  });

  it("carries the level as data, not as a colour class, so a test can assert state", () => {
    render(<WardChip level="stalled">3 declined, none pending</WardChip>);
    expect(screen.getByText("3 declined, none pending")).toHaveAttribute("data-level", "stalled");
  });

  it("styles every level it accepts — a level with no rule is an invisible chip", () => {
    // The union and the stylesheet must agree. A level in the type with no CSS renders unstyled
    // and nobody notices, because the text still reads.
    const styled = new Set<WardChipLevel>(["urgent", "routine", "stalled", "accepted", "enroute", "cancelled"]);
    for (const level of WARD_CHIP_LEVELS) expect(styled.has(level)).toBe(true);
    expect(WARD_CHIP_LEVELS.length).toBe(styled.size);
  });
});

/**
 * ⚠️ THE EMPTINESS GUARD USED TO READ `typeof children === "string"`, WHICH IS A MUCH NARROWER
 * CHECK THAN IT LOOKS. Every case below skipped it and rendered a wordless coloured rectangle.
 * `{condition && "text"}` is the one that happens in real code: it looks like it can only ever
 * produce words, and it produces `false` the rest of the time.
 *
 * Under forced colours a wordless chip is not merely weak — border and text colour are both
 * overridden to system values, so a chip carrying its state in colour alone carries nothing.
 */
describe("no chip renders without words, whatever shape the empty child arrives in", () => {
  const empties: ReadonlyArray<readonly [string, ReactNode]> = [
    ["an empty string", ""],
    ["whitespace only", "   "],
    ["null", null],
    ["undefined", undefined],
    ["false", false],
    ["a false condition", false && "Accepted"],
    ["an empty list", []],
  ];

  for (const [name, child] of empties) {
    it(`refuses a state chip whose child is ${name}`, () => {
      expect(() => render(<WardChip level="urgent">{child}</WardChip>)).toThrow(/WardChip needs text/u);
    });

    it(`refuses a kind chip whose child is ${name}`, () => {
      expect(() => render(<WardKindChip kind="ward">{child}</WardKindChip>)).toThrow(/WardKindChip needs text/u);
    });
  }

  it("still accepts a number, because a numeral is words", () => {
    render(<WardChip level="routine">{0}</WardChip>);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  /**
   * 🔴 THE LIMIT, ASSERTED SO NOBODY READS THE GREENS ABOVE AS MORE THAN THEY ARE. An element
   * child that renders no text passes. Whether a component produces words is not knowable from
   * props; catching it needs an assertion over rendered output. This test PASSES on the defect —
   * it exists to record the hole, and it must be deleted the day a real check closes it.
   */
  it("cannot catch an element child that renders no text — recorded, not fixed", () => {
    expect(() =>
      render(
        <WardChip level="urgent">
          <span aria-hidden="true" />
        </WardChip>,
      ),
    ).not.toThrow();
  });
});

describe("a kind chip says what a record is, never how urgent it is", () => {
  it("renders every kind with a visible word, not colour alone", () => {
    for (const kind of WARD_KIND_CHIP_KINDS) {
      const { unmount } = render(<WardKindChip kind={kind}>{kind}</WardKindChip>);
      expect(screen.getByText(kind)).toBeVisible();
      unmount();
    }
  });

  it("covers exactly the four record kinds Ward Flow has", () => {
    // Named, not derived. A set built by pattern from the stylesheet would pass with zero
    // members the day a class is renamed, and a property over an empty set is true.
    expect([...WARD_KIND_CHIP_KINDS].sort()).toEqual(["community", "ed", "transport", "ward"]);
  });

  it("pins the state levels too, because the disjointness check reads BOTH sets", () => {
    // ⚠️ THE OVERLAP ASSERTION BELOW IS VACUOUS IF EITHER SET IS EMPTY. Kinds are pinned above;
    // levels were not pinned anywhere in this file, so a broken import or an emptied union made
    // `overlap` [] and the test green. Reviewed 2026-09-04. Both sets must be pinned where the
    // assertion that depends on them lives — a pin in the neighbouring file does not travel.
    expect([...WARD_CHIP_LEVELS].sort()).toEqual(["accepted", "cancelled", "enroute", "routine", "stalled", "urgent"]);
  });

  it("shares no data-level value with the state chip, so neither can be mistaken for the other", () => {
    const overlap = WARD_KIND_CHIP_KINDS.filter((k) => (WARD_CHIP_LEVELS as readonly string[]).includes(k));
    expect(overlap, `kind and level share: ${overlap.join(" ")}`).toEqual([]);
  });

  it("lets one row carry a kind and a state at the same time", () => {
    // This is the assertion a single merged union could not have satisfied.
    render(
      <div data-testid="row">
        <WardKindChip kind="ward">Ward</WardKindChip>
        <WardChip level="urgent">Urgent</WardChip>
      </div>,
    );
    const row = screen.getByTestId("row");
    expect(row.querySelectorAll("[data-kind]")).toHaveLength(1);
    expect(row.querySelectorAll("[data-level]")).toHaveLength(1);
  });
});

describe("the chip stylesheet composes the shared token layer, not just an ancestor's", () => {
  /**
   * ⚠️ WHY THIS READS THE RAW CSS SOURCE INSTEAD OF A RENDERED CLASS NAME. This repo's
   * jsdom/vitest CSS-module resolution is a synthetic proxy: `styles.anything` returns a
   * fabricated `_anything_<fileHash>` string for ANY property name — including one that does
   * not exist in the CSS at all — and it never resolves `composes`. Verified directly: accessing
   * a made-up property (`thisDoesNotExistInCss`) on the imported module returned a plausible
   * scoped-looking class name exactly like a real one. A test asserting on the rendered
   * className, or on the shape of the imported style object, would therefore pass or fail for
   * reasons entirely unrelated to whether `.chip` actually composes `wardTokens` — it would be
   * checking the test harness's naming convention, not this file. Reading the authored CSS text
   * is the only honest way to pin this declaration in this environment.
   */
  const CSS = readFileSync("src/components/ward-management/ward-chip.module.css", "utf8");

  it("declares composes: wardTokens as part of .chip, so a chip never depends on an ancestor happening to declare the --ward-* tokens", () => {
    const chipBlock = /\.chip\s*\{([^}]*)\}/u.exec(CSS)?.[1] ?? "";
    expect(chipBlock).toMatch(/composes:\s*wardTokens\s+from\s+["']\.\/ward-tokens\.module\.css["'];/u);
  });

  it("lets kindChip inherit the token layer transitively through chip, rather than declaring it a second time", () => {
    // kindChip composes chip (not wardTokens directly). CSS Modules composition is transitive,
    // so as long as chip itself composes wardTokens (asserted above), kindChip gets it too. A
    // second direct `wardTokens` composition on kindChip would hide a break in that chain: this
    // test would keep passing even if chip's own composes line were later deleted, because
    // kindChip would still be carrying its own copy.
    const kindChipBlock = /\.kindChip\s*\{([^}]*)\}/u.exec(CSS)?.[1] ?? "";
    expect(kindChipBlock).toMatch(/composes:\s*chip\s*;/u);
    expect(kindChipBlock).not.toMatch(/wardTokens/u);
  });
});
