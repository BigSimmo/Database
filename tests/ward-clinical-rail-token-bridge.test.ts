import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { blankCssComments } from "./helpers/strip-source-comments";

const railCss = readFileSync(
  new URL("../src/components/ward-management/ward-management.module.css", import.meta.url),
  "utf8",
);
const coordinatorCss = readFileSync(
  new URL("../src/components/ward-management/coordinator/coordinator.module.css", import.meta.url),
  "utf8",
);

function cssBlock(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  expect(start, `missing ${selector} block`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let index = source.indexOf("{", start); index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${selector} block did not close`);
}

describe("Ward coordinator token bridge (DS-P0-05)", () => {
  /**
   * ⚠️ ADAPTED FOR THE TOKEN-LAYER CONSOLIDATION (2026-09-04 Task 1). `.clinicalRail` used to
   * hand-declare a subset of `--ward-*` locally so it stayed self-sufficient regardless of which
   * shell hosts it (see the comment above the rule). That subset is now gone: it composes the
   * single shared `wardTokens` layer instead, which is the fix for the original defect this test
   * pins — three near-identical hand-written copies of the layer, already diverged, of which this
   * rule's copy was one. The self-sufficiency guarantee still needs proving, so this now checks
   * that (a) `.clinicalRail` pulls in the shared layer via `composes`, so it never depends on a
   * host shell for `--ward-*`, and (b) that shared layer actually declares the two tokens the
   * rail's own rules read (`--ward-border`, `--ward-chrome`) — checking only (a) would pass even
   * if the shared file forgot one of them, and checking only (b) would pass even if `.clinicalRail`
   * never composed the file at all.
   *
   * ⚠️ MATCHED WITH COMMENTS BLANKED (`blankCssComments`, see `tests/ward-guard-comment-blindness.test.ts`).
   * Both matches below are PRESENCE checks against raw CSS text: a comment reading
   * `/* composes: wardTokens from "./ward-tokens.module.css" *\/` or `/* --ward-border: ... *\/`
   * satisfies the un-blanked regex exactly as well as the real declaration does, so a genuinely
   * broken bridge — the composition removed, or a token dropped — would still read green if either
   * comment happened to mention it. Proved live 2026-09-04: removing the real `composes:` line and
   * leaving only an explanatory comment containing the matched text passed this test unchanged.
   */
  it("composes the shared wardTokens layer on .clinicalRail, which declares --ward-border and --ward-chrome", () => {
    const block = blankCssComments(cssBlock(railCss, ".clinicalRail"));
    expect(block).toMatch(/composes:\s*wardTokens\s+from\s+"\.\/ward-tokens\.module\.css"/);

    const tokens = blankCssComments(
      readFileSync(new URL("../src/components/ward-management/ward-tokens.module.css", import.meta.url), "utf8"),
    );
    expect(tokens).toMatch(/--ward-border\s*:/);
    expect(tokens).toMatch(/--ward-chrome\s*:/);
  });

  // ⚠️ DELIBERATELY LEFT UNSTRIPPED. This is an ABSENCE check (`.not.toMatch`): matching the raw,
  // comment-included block is the CONSERVATIVE direction here — a stray `--ward-foo:` mentioned
  // inside a comment would fail this test too, which is a false alarm a human reads rather than a
  // real alias slipping through silently. Blanking comments would only make this MORE permissive
  // (able to miss less), which is the wrong direction to hand a safety check. Proved 2026-09-04: a
  // comment-only `--ward-foo:` mention inside `.screen` turns this red, confirming the unstripped
  // form is strictly the safer one.
  it("does not put --ward-* aliases onto coordinator .screen", () => {
    const block = cssBlock(coordinatorCss, ".screen");
    expect(block).not.toMatch(/--ward-[a-z0-9-]+\s*:/);
  });
});
