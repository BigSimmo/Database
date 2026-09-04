# Ward Flow Design Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Ward Flow the shared token and component foundation the approved "Board" design language needs, so its ten redesigned screens — and its other twelve routes — can adopt one language instead of twenty-one stylesheets.

**Architecture:** Ward Flow already declares a `--ward-*` token layer that maps onto PsychSift's v2 tokens. That layer is currently duplicated across three selectors and is missing exactly two roles the Board direction needs: a grey ground behind panels, and a light divider for rules inside a panel. This plan consolidates the layer, adds those two roles, and builds four shared CSS-module primitives (panel, figure tile, row, chip) plus a contract test that pins the language so the next twelve routes cannot drift.

**Tech Stack:** Next.js 16, React 19, TypeScript 6 strict, CSS Modules with `composes`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-ward-flow-design-language-design.md`

## Global Constraints

- **Ward Flow only.** No file outside `src/components/ward-management/`, `src/app/mockups/ward-flow/`, `tests/ward-*` may change. No change to `globals.css` or `ckb-v2-tokens.css`.
- **Tokens only, no raw hex.** `eslint-rules/no-hardcoded-hex.mjs` fails the build on a literal colour. Every new colour is a `var(--…)` resolving through the `--ward-*` layer.
- **State is worded as well as coloured.** `colourOnlyStatusIndicators` is a ratcheted metric in `scripts/design-system-contract-baseline.json`; a chip carrying only colour fails the gate.
- **Contrast floor 4.5:1 for text**, computed per pair, never sampled.
- **Fonts: use the app's existing `--font-sans` and `--font-mono` (Geist).** Do NOT add a Google Fonts link or vendor a new family — the app self-hosts deliberately and a third-party font request is a privacy and bundle change, not a style choice.
- **Do not add a type step.** `check:type-scale` fails on a declared-but-unselected step in `ckb-v2-tokens.css`.
- **Production tap targets stay `min-h-12` (48px).** Do not "fix" them to `min-h-11`; that reintroduces a known `ui-smoke` flake.
- **Never `git add -A`.** Other agents may share this worktree. Stage the exact files each task names.
- ⚠️ **NEVER `git stash`, EVEN TO CHECK SOMETHING.** The stash stack is **shared across all 180
  worktrees on this machine** and other sessions push and pop it concurrently — it currently holds
  27 entries belonging to other branches. A stash here can be popped into somebody else's tree, and
  their pop can take yours. On 2026-09-04 an implementer used `git stash` to confirm a test was green
  before its own edit; it got away with it, and "it worked" is not the standard. **To compare against
  the committed state, read it: `git show HEAD:<path>`** — no mutation of shared state, and it is the
  committed bytes rather than a tree somebody could disturb mid-check.
- **A baseline never comes from the thing under test.** Measured 2026-09-04: a byte-identity check on
  a mockup compared the file against a `.bak` taken from that same file, so a violation already inside
  it went into the baseline — and the check reported IDENTICAL twice while the file was in breach the
  whole time. It could only ever answer _"has this changed since I arrived?"_ and was read as _"is this
  correct?"_. **Every comparison in this plan resolves against the one canonical declaration, never
  against a snapshot of the file being checked.**
- **Adding a surface revalidates every text colour, including ones that already passed.** Contrast is
  a property of a pair, so `--ward-ground` is not a new colour with a known ratio — it is a new
  _pairing_ for every text token. Measured 2026-09-04 on the mockup palette: the quiet text value
  passed 4.63:1 on white and failed at **4.04:1 on the ground** and **4.31:1 on the panel**, which is
  where it actually sits. Compute each pair; never carry a ratio across surfaces.
- **Every guard in this plan ships with a mutation step that names the expected message.** Measured
  repeatedly on this surface: a suite went green while a value was wrong on every screen, and two
  separate guards were later found unable to fail at all. A guard is not accepted because it passed —
  it is accepted because someone watched it go red for the right reason and read what it said.

---

### Task 1: Consolidate the Ward Flow token layer and add its two missing roles

**Files:**

- Modify: `src/components/ward-management/ward-management.module.css:1-60` (the `.patientWorkspace` token block) and its second declaration further down the same file
- Modify: `src/components/ward-management/ward-management-modes.module.css:1-30` (the `.modeShell` token block)
- Create: `src/components/ward-management/ward-tokens.module.css`
- Test: `tests/ward-token-layer.test.ts`

**Interfaces:**

- Consumes: PsychSift's `--clinical-accent`, `--surface`, `--surface-subtle`, `--neutral-500`, `--text`, `--text-heading`, `--text-muted`, `--success-text`, `--warning-text`, `--danger-text` and their `-bg`/`-soft` partners.
- Produces: a single `.wardTokens` class that every Ward Flow root composes, declaring the full `--ward-*` set, plus two new tokens: `--ward-ground` and `--ward-divider`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/ward-token-layer.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const TOKENS = readFileSync("src/components/ward-management/ward-tokens.module.css", "utf8");
const WARD_CSS_GLOB = "src/components/ward-management";

/** Every token the layer must declare, and nothing may declare them twice. */
const REQUIRED = [
  "--ward-ground",
  "--ward-divider",
  "--ward-canvas",
  "--ward-border",
  "--ward-border-strong",
  "--ward-text",
  "--ward-muted",
  "--ward-blue",
];

describe("the Ward Flow token layer", () => {
  it("declares every required token exactly once, in one file", () => {
    for (const token of REQUIRED) {
      const declarations = TOKENS.split(`${token}:`).length - 1;
      expect(declarations, `${token} declared ${declarations} times in ward-tokens.module.css`).toBe(1);
    }
  });

  it("adds a ground distinct from the panel surface, because Board floats panels on it", () => {
    // The whole direction depends on panel and ground being different. If --ward-ground
    // resolves to the same thing as --ward-canvas the design collapses to white-on-white
    // and nothing fails visually — so it is asserted here instead.
    const ground = /--ward-ground:\s*([^;]+);/u.exec(TOKENS)?.[1]?.trim();
    const canvas = /--ward-canvas:\s*([^;]+);/u.exec(TOKENS)?.[1]?.trim();
    expect(ground).toBeTruthy();
    expect(ground).not.toBe(canvas);
  });

  it("keeps two border weights, because one token doing both jobs was the original defect", () => {
    const divider = /--ward-divider:\s*([^;]+);/u.exec(TOKENS)?.[1]?.trim();
    const border = /--ward-border:\s*([^;]+);/u.exec(TOKENS)?.[1]?.trim();
    expect(divider).toBeTruthy();
    expect(divider).not.toBe(border);
  });

  it("declares no raw hex — every value resolves through a PsychSift token", () => {
    const hex = TOKENS.match(/#[0-9a-fA-F]{3,8}\b/gu) ?? [];
    expect(hex, `raw hex in the token layer: ${hex.join(" ")}`).toEqual([]);
  });

  /**
   * ⚠️ INTRODUCING --ward-ground REVALIDATES EVERY TEXT COLOUR IN THE LAYER. Contrast is a
   * property of a pair, so a text token that passed on white has NO measured ratio on a surface
   * that did not exist until this task. Measured on the mockup palette 2026-09-04: the quiet text
   * value passed 4.63:1 on white and failed at 4.04:1 on the ground — the surface it sits on.
   *
   * This resolves each --ward-* alias to its PsychSift value and computes every text/surface pair.
   * It does not sample rendered pixels and it does not trust a documented ratio.
   */
  it("clears 4.5:1 for every text token against every surface token", () => {
    const V2 = readFileSync("src/app/ckb-v2-tokens.css", "utf8");

    /**
     * --ward-x: var(--y) -> the hex that --y is declared as, following one level of aliasing.
     *
     * ⚠️ `String.raw` IS LOAD-BEARING ON BOTH PATTERNS AND MUST NOT BE REMOVED. A plain template
     * literal drops unknown escapes, so `\s` becomes `s` and `\w` becomes `w`: the first draft of
     * this test built `--ward-ground:s*var((--[w-]+))`, which matches nothing. Reviewed and proved
     * by running it, 2026-09-04 — the pattern returned null against real CSS and matched once
     * `String.raw` was added.
     *
     * The failure that follows is the dangerous part, not the null: `expect(alias).toBeTruthy()`
     * reports *"must alias a PsychSift token, not carry a literal"*, which blames correct CSS for a
     * broken matcher. An implementer who believes that message edits a correct token file.
     */
    function resolve(token: string): string {
      const alias = new RegExp(String.raw`${token}:\s*var\((--[\w-]+)\)`, "u").exec(TOKENS)?.[1];
      expect(alias, `${token} must alias a PsychSift token, not carry a literal`).toBeTruthy();
      const hex = new RegExp(String.raw`${alias}:\s*(#[0-9a-fA-F]{3,8})`, "u").exec(V2)?.[1];
      expect(hex, `${alias} is not declared as a hex in ckb-v2-tokens.css`).toBeTruthy();
      return hex as string;
    }

    function luminance(hex: string): number {
      const h = hex.replace("#", "");
      const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
      const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16) / 255);
      const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    }

    function ratio(a: string, b: string): number {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    }

    const TEXT = ["--ward-text", "--ward-muted"];
    // ⚠️ THE REAL SURFACE NAMES. An earlier draft listed --ward-panel and --ward-sunken, which are
    // NOT declared anywhere — they were carried over from the HTML prototypes, whose palette uses
    // different names. A var() that does not resolve falls back to nothing and the element renders
    // transparent, which no assertion in these tasks would have caught. Corrected 2026-09-04 by the
    // Task 1 implementer, who checked the token file rather than trusting the plan.
    const SURFACES = ["--ward-ground", "--ward-canvas", "--ward-chrome", "--ward-subtle"];
    const failures: string[] = [];
    for (const text of TEXT) {
      for (const surface of SURFACES) {
        const r = ratio(resolve(text), resolve(surface));
        if (r < 4.5) failures.push(`${text} on ${surface}: ${r.toFixed(2)}:1`);
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-token-layer.test.ts`
Expected: FAIL — `ENOENT: no such file or directory, open 'src/components/ward-management/ward-tokens.module.css'`

- [ ] **Step 3: Create the token layer**

```css
/* src/components/ward-management/ward-tokens.module.css
 *
 * The single declaration of Ward Flow's token layer. It was previously declared three times —
 * `.patientWorkspace` and a second block in ward-management.module.css, and `.modeShell` in
 * ward-management-modes.module.css — which is how two of them drifted apart.
 *
 * ⚠️ EVERY VALUE RESOLVES THROUGH A PsychSift TOKEN. Ward Flow is a scoped layer over the app's
 * v2 palette, not a second palette. A raw hex here is the start of a fork.
 */
.wardTokens {
  --ward-blue: var(--clinical-accent);
  --ward-blue-soft: var(--clinical-accent-soft);
  --ward-blue-border: var(--clinical-accent-border);

  /* Surfaces. `--ward-ground` is the one genuinely new role the Board direction needs: panels
   * sit ON something rather than being white on white, and that separation is what makes each
   * panel read as a discrete instrument. */
  --ward-ground: var(--surface-inset);
  --ward-canvas: var(--surface);
  --ward-chrome: var(--surface-chrome);
  --ward-subtle: var(--surface-subtle);

  /* Two border weights, deliberately. A panel edge is a real boundary and takes the darker
   * value this line already adopted for accessibility. A rule INSIDE a panel should be barely
   * there; one token doing both jobs was the original defect. */
  --ward-border: var(--neutral-500);
  --ward-border-strong: var(--text-muted);
  --ward-divider: var(--border);

  --ward-text: var(--text);
  --ward-heading: var(--text-heading);
  --ward-muted: var(--text-muted);

  --ward-success: var(--success-text);
  --ward-success-soft: var(--success-bg);
  --ward-warning: var(--warning-text);
  --ward-warning-soft: var(--warning-bg);
  --ward-danger: var(--danger-text);
  --ward-danger-soft: var(--danger-bg);

  --ward-space-1: 0.0625rem;
  --ward-space-2: 0.125rem;
  --ward-space-3: 0.1875rem;
  --ward-space-4: 0.25rem;
  --ward-space-5: 0.3125rem;
  --ward-space-6: 0.375rem;
  --ward-space-7: 0.4375rem;
  --ward-space-8: 0.5rem;
  --ward-space-10: 0.625rem;
  --ward-space-12: 0.75rem;
  --ward-space-14: 0.875rem;
  --ward-space-16: 1rem;
  --ward-space-20: 1.25rem;
  --ward-space-24: 1.5rem;
  --ward-space-32: 2rem;

  --ward-leading-compact: 1.1;
  --ward-leading-tight: 1.15;
  --ward-leading-dense: 1.25;
  --ward-leading-ui: 1.3;
  --ward-leading-copy: 1.35;
  --ward-leading-body: 1.4;
  --ward-leading-relaxed: 1.45;
  --ward-leading-prose: 1.55;

  --ward-z-base: 1;
  --ward-z-raised: 2;
  --ward-z-sticky: 3;
  --ward-z-phone: 20;

  --ward-radius-pixel: 0.0625rem;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ward-token-layer.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Point the three existing declarations at the new layer**

In `src/components/ward-management/ward-management.module.css`, replace the `--ward-*` declarations inside `.patientWorkspace` with a compose, keeping every other property in that rule untouched:

```css
.patientWorkspace {
  composes: wardTokens from "./ward-tokens.module.css";
  /* every non-token property of this rule stays exactly as it was */
}
```

Do the same for the file's second `--ward-*` block and for `.modeShell` in `ward-management-modes.module.css`. **Delete only the token declarations.** Any other property in those rules is unrelated and must survive.

- [ ] **Step 6a: Prove the contrast assertion can fail, and read what it says**

⚠️ **FIRST, RUN THE TEST UNMUTATED AND CONFIRM IT IS GREEN. Record that green run.** A mutation
against an already-red baseline proves nothing, and every mutation looks like a success — which is
how a broken guard gets recorded as verified. The first draft of this very test was red before any
mutation, for a reason unrelated to contrast, and this step would have certified it.

Then point `--ward-muted` at a PsychSift token you know is too light against the ground (any
`--neutral-4xx`) and run the test. It must name the pair — `--ward-muted on --ward-ground` with a
ratio under 4.5 — not merely go red. Then reverse the edit and prove the file is back:

```bash
git diff --stat src/components/ward-management/ward-tokens.module.css   # must print nothing
```

⚠️ **A green run only counts if the mutant actually executed.** If the test throws inside `resolve()`
before it reaches the ratio, it went red for the wrong reason and has proved nothing about the maths —
that failure mode invents a passing guard rather than revealing a missing one.

- [ ] **Step 6: Prove nothing rendered differently**

Run: `npx vitest run tests/ward-token-layer.test.ts && npm run check:design-system-contract`
Expected: both exit 0. The contract chain runs five sub-checks behind `&&` — **read the exit code, not the word "passed"**, because the design-system check prints "passed" and a later sub-check can still fail.

- [ ] **Step 7: Commit**

```bash
git add src/components/ward-management/ward-tokens.module.css src/components/ward-management/ward-management.module.css src/components/ward-management/ward-management-modes.module.css tests/ward-token-layer.test.ts
git commit -m "refactor(ward-flow): one token layer, plus the ground and divider Board needs

The --ward-* layer was declared three times and had drifted between copies.
Consolidated into ward-tokens.module.css, composed by each root.

Two new roles, and only two: --ward-ground, because the approved direction
floats panels on a ground rather than white on white, and --ward-divider,
because one border token was doing both the panel edge and the rule inside
a panel, which was the original defect.

Every value still resolves through a PsychSift token. The test asserts the
ground differs from the canvas and the divider from the border — if either
collapsed, the design would flatten with nothing failing visually."
```

---

### Task 2: The panel primitive

**Files:**

- Create: `src/components/ward-management/ward-panel.module.css`
- Create: `src/components/ward-management/ward-panel.tsx`
- Test: `tests/ward-panel.dom.test.tsx`

**Interfaces:**

- Consumes: `.wardTokens` from Task 1.
- Produces: `WardPanel({ title, count, blurb, children, headingLevel })` rendering `<section>` with a `<header>` carrying the title and optional count. `headingLevel` is `2 | 3`, default `2`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ward-panel.dom.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardPanel } from "@/components/ward-management/ward-panel";

describe("WardPanel", () => {
  it("renders its title as a heading and its count beside it", () => {
    render(
      <WardPanel title="Coming in" count="6 waiting">
        <p>rows</p>
      </WardPanel>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Coming in" })).toBeInTheDocument();
    expect(screen.getByText("6 waiting")).toBeInTheDocument();
  });

  it("labels the section by its own heading, so a screen reader can list the panels", () => {
    render(<WardPanel title="Needs a decision">x</WardPanel>);
    expect(screen.getByRole("region", { name: "Needs a decision" })).toBeInTheDocument();
  });

  it("takes a heading level, because a panel nested in a section must not skip a level", () => {
    render(
      <WardPanel title="In hospital now" headingLevel={3}>
        x
      </WardPanel>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "In hospital now" })).toBeInTheDocument();
  });

  it("omits the count element entirely when there is no count, rather than rendering an empty span", () => {
    const { container } = render(<WardPanel title="Go to">x</WardPanel>);
    expect(container.querySelector("[data-ward-panel-count]")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-panel.dom.test.tsx`
Expected: FAIL — cannot resolve `@/components/ward-management/ward-panel`

- [ ] **Step 3: Write the stylesheet**

```css
/* src/components/ward-management/ward-panel.module.css
 * The shared Board vocabulary. Every Ward Flow screen uses these rather than its own copy. */
.panel {
  composes: wardTokens from "./ward-tokens.module.css";
  border: 1px solid var(--ward-border);
  border-radius: var(--radius-sm);
  background: var(--ward-canvas);
  overflow: hidden;
}
.panelHeader {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--ward-space-12);
  padding: var(--ward-space-12) var(--ward-space-16);
  background: var(--ward-subtle);
  border-bottom: 1px solid var(--ward-divider);
}
.panelTitle {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.085em;
  color: var(--ward-muted);
  line-height: var(--ward-leading-ui);
}
.panelCount {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--ward-muted);
}
.panelBlurb {
  margin: 0;
  padding: var(--ward-space-12) var(--ward-space-16) 0;
  font-size: var(--text-xs);
  color: var(--ward-muted);
  line-height: var(--ward-leading-prose);
}
```

- [ ] **Step 4: Write the component**

```tsx
// src/components/ward-management/ward-panel.tsx
import type { ReactNode } from "react";

import styles from "./ward-panel.module.css";

/**
 * The Board panel: a bordered surface with its own header.
 *
 * The heading labels the section, so a screen-reader user can list a screen's panels and jump
 * between them. `headingLevel` exists because a panel inside a band sits one level deeper and a
 * skipped level is a real navigation defect, not a style preference.
 */
export function WardPanel({
  title,
  count,
  blurb,
  headingLevel = 2,
  children,
}: {
  title: string;
  count?: string;
  blurb?: string;
  headingLevel?: 2 | 3;
  children: ReactNode;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <section className={styles.panel} aria-label={title}>
      <header className={styles.panelHeader}>
        <Heading className={styles.panelTitle}>{title}</Heading>
        {count ? (
          <span className={styles.panelCount} data-ward-panel-count>
            {count}
          </span>
        ) : null}
      </header>
      {blurb ? <p className={styles.panelBlurb}>{blurb}</p> : null}
      {children}
    </section>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/ward-panel.dom.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 6: Commit**

```bash
git add src/components/ward-management/ward-panel.module.css src/components/ward-management/ward-panel.tsx tests/ward-panel.dom.test.tsx
git commit -m "feat(ward-flow): the Board panel primitive

One panel, used by every screen, so twenty-one stylesheets stop each having
their own. The section is labelled by its own heading so a screen reader can
list a screen's panels; the heading level is a prop because a panel nested in
a band sits a level deeper and a skipped level is a navigation defect."
```

---

### Task 3: The chip primitive, where colour must never be the only carrier

**Files:**

- Modify: `src/components/ward-management/ward-chip.module.css`
- Create: `src/components/ward-management/ward-chip.tsx`
- Test: `tests/ward-chip.dom.test.tsx`

**Interfaces:**

- Consumes: `.wardTokens`, `ward-chip.module.css`.
- Produces: `WardChip({ level, children })` where `level` is `"urgent" | "routine" | "stalled" | "accepted" | "enroute" | "cancelled"`; the exported type `WardChipLevel`; **the exported constant `WARD_CHIP_LEVELS`** (Task 3b consumes it, and Task 3b's disjointness assertion is vacuous without it); and the CSS class **`.chip`**, which Task 3b composes.

⚠️ **`WARD_CHIP_LEVELS` AND `.chip` WERE BOTH CONSUMED BY LATER TASKS AND DECLARED BY NEITHER.** Found
by the cross-task matrix, 2026-09-04 — and `WARD_CHIP_LEVELS` had already turned up once, unpinned, in
the earlier review of Task 3b's test. **Two independent findings converging on one symbol is the
symbol telling you something**, and what it was telling us is that the thing three tasks depend on was
written down nowhere.

⚠️ **The union is the union the ten screens actually use — `enroute` is in and `planned` is out.**
Reviewing the mockups for chip values rather than inferring them: `enroute` appears on transport and
on both ED screens and had no chip level, while `planned` was in my original list and appears on no
screen. A level nothing renders is a level nothing can be wrong about, and it would have sat in the
union looking supported. **Six levels, each traceable to a screen that renders it.**

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ward-chip.dom.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WARD_CHIP_LEVELS, WardChip, type WardChipLevel } from "@/components/ward-management/ward-chip";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-chip.dom.test.tsx`
Expected: FAIL — cannot resolve `@/components/ward-management/ward-chip`

- [ ] **Step 3: Add the chip rules to the stylesheet**

```css
/* appended to ward-chip.module.css */
.chip {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  font-size: var(--text-xs);
  font-weight: 500;
  letter-spacing: 0.055em;
  text-transform: uppercase;
  padding: var(--ward-space-2) var(--ward-space-6);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  line-height: var(--ward-leading-ui);
}
.chip[data-level="urgent"] {
  color: var(--ward-danger);
  border-color: var(--ward-danger);
}
.chip[data-level="routine"] {
  color: var(--ward-muted);
  border-color: var(--ward-border-strong);
}
.chip[data-level="stalled"] {
  color: var(--ward-warning);
  border-color: var(--ward-warning);
}
.chip[data-level="accepted"] {
  color: var(--ward-success);
  border-color: var(--ward-success);
}
.chip[data-level="enroute"] {
  color: var(--ward-blue);
  border-color: var(--ward-blue-border);
}
.chip[data-level="cancelled"] {
  color: var(--ward-muted);
  border-color: var(--ward-divider);
  text-decoration: line-through;
}
```

- [ ] **Step 4: Write the component**

```tsx
// src/components/ward-management/ward-chip.tsx
import type { ReactNode } from "react";

import styles from "./ward-chip.module.css";

/**
 * The six states a Ward Flow row can be in. `cancelled` and `enroute` exist because the transport
 * screen needs six legible stage labels and four were not enough — they were added there first and
 * are hoisted here so the seventh screen does not invent a seventh spelling.
 */
export const WARD_CHIP_LEVELS = ["urgent", "routine", "stalled", "accepted", "enroute", "cancelled"] as const;

export type WardChipLevel = (typeof WARD_CHIP_LEVELS)[number];

/**
 * ⚠️ A CHIP MUST CARRY WORDS. `colourOnlyStatusIndicators` is a ratcheted gate here, and a
 * wordless chip is precisely that violation — it renders as a deliberate-looking coloured
 * rectangle, so nothing looks broken and a reader with no colour perception learns nothing.
 * Throwing is deliberate: a build-time failure is cheaper than a screen that silently excludes.
 */
export function WardChip({ level, children }: { level: WardChipLevel; children: ReactNode }) {
  if (typeof children === "string" && children.trim() === "") {
    throw new Error("WardChip needs text: colour alone cannot carry a state in this app.");
  }
  return (
    <span className={styles.chip} data-level={level}>
      {children}
    </span>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/ward-chip.dom.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 6: Prove the guard catches the thing it exists for**

Delete the `if (typeof children === "string" …)` block, re-run the suite, and confirm **"refuses to render a chip with no words in it"** is the test that reddens — by name. Restore the block and confirm the suite is green again.

Expected on the mutant: `1 failed | 3 passed`, the failure being that test.

- [ ] **Step 7: Commit**

```bash
git add src/components/ward-management/ward-chip.module.css src/components/ward-management/ward-chip.tsx tests/ward-chip.dom.test.tsx
git commit -m "feat(ward-flow): the chip primitive, which refuses to be wordless

Six levels, hoisted from the transport screen where two of them were invented
locally because four were not enough for six stages. Hoisting them is what
stops the next screen inventing a seventh spelling.

The component THROWS on a chip with no text. colourOnlyStatusIndicators is a
ratcheted gate, and a wordless chip is exactly that violation — but it renders
as a deliberate-looking coloured rectangle, so nothing appears broken and a
reader with no colour perception simply learns nothing. Mutation-verified:
removing the guard reddens the no-words test by name and nothing else."
```

---

### Task 3b: Split what a record _is_ from what state it is _in_

**Files:**

- Modify: `src/components/ward-management/ward-chip.module.css`
- Modify: `src/components/ward-management/ward-chip.tsx`
- Test: `tests/ward-chip.dom.test.tsx` (extend)

**Interfaces:**

- Consumes: `WardChip`, `WARD_CHIP_LEVELS` from Task 3.
- Produces: `WardKindChip({ kind, children })` where `kind` is `"ward" | "community" | "ed" | "transport"`, and the exported type `WardKindChipKind`. `WardChip` is unchanged.

⚠️ **WHY THIS IS A SEPARATE COMPONENT AND NOT A SEVENTH LEVEL.** Reviewing the ten screens turned up
two unrelated things wearing the same chip: _what kind of record this is_ (a ward referral, a
community referral, an ED hold, a transport leg) and _what state it is in_ (urgent, stalled,
accepted). Folding both into one `level` union makes `kind="ward"` and `level="urgent"` mutually
exclusive at the type level when a real row is **both at once** — and the type would have been
satisfied, so nothing would have failed. Two components, two axes, both renderable on one row.

**A kind chip carries no urgency and must not borrow the state palette.** It is the neutral border and
muted text only; `--ward-danger` and `--ward-warning` belong to state. A destination that renders in
alarm colours because of _what it is_ tells the coordinator something untrue about it.

- [ ] **Step 1: Write the failing test**

```tsx
// appended to tests/ward-chip.dom.test.tsx
import { WARD_KIND_CHIP_KINDS, WardKindChip } from "@/components/ward-management/ward-chip";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-chip.dom.test.tsx`
Expected: FAIL — `WARD_KIND_CHIP_KINDS` is not exported from `ward-chip.tsx`.

- [ ] **Step 3: Add the kind rules to the stylesheet**

```css
/* appended to ward-chip.module.css */

/* A kind chip is quieter than a state chip on purpose: it is a label, not a signal.
   No danger/warning/success token appears here — those carry urgency, and what a
   record IS never implies how urgent it is. */
.kindChip {
  composes: chip;
  color: var(--ward-muted);
  border-color: var(--ward-border);
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}
.kindChip[data-kind="ward"] {
  border-left: 3px solid var(--ward-blue-border);
}
.kindChip[data-kind="community"] {
  border-left: 3px solid var(--ward-border-strong);
}
.kindChip[data-kind="ed"] {
  border-left: 3px solid var(--ward-blue);
}
.kindChip[data-kind="transport"] {
  border-left: 3px solid var(--ward-divider);
}
```

- [ ] **Step 4: Write the component**

```tsx
// appended to src/components/ward-management/ward-chip.tsx

export const WARD_KIND_CHIP_KINDS = ["ward", "community", "ed", "transport"] as const;
export type WardKindChipKind = (typeof WARD_KIND_CHIP_KINDS)[number];

/**
 * What a record IS. Deliberately separate from WardChip, which says what state it is in:
 * a row is routinely both at once, and one merged union would have made that unrepresentable
 * while still type-checking.
 */
export function WardKindChip({
  kind,
  children,
}: {
  readonly kind: WardKindChipKind;
  readonly children: React.ReactNode;
}) {
  return (
    <span className={styles.kindChip} data-kind={kind}>
      {children}
    </span>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/ward-chip.dom.test.tsx`
Expected: PASS, all suites.

- [ ] **Step 6: Prove the separation guard can fail**

Add `"ward"` to `WARD_CHIP_LEVELS` and run the test. **It must fail on the overlap assertion naming
`kind and level share: ward`** — not on a snapshot, not on a count. Then reverse the edit and confirm:

```bash
git diff --stat src/components/ward-management/ward-chip.tsx   # must print nothing
```

⚠️ **If it fails on any assertion other than the overlap one, the overlap test is not the catcher and
you have not proved what you think.** Read which assertion went red: a filter plus an assertion over
the same predicate is a tautology, and the tell is a mutation report where the guard you are trying
to prove never appears as the thing that caught it.

- [ ] **Step 7: Commit**

```bash
git add src/components/ward-management/ward-chip.tsx src/components/ward-management/ward-chip.module.css tests/ward-chip.dom.test.tsx
git commit -m "feat(ward-flow): separate record-kind chips from state chips

Reviewing the ten screens found two unrelated axes wearing one chip: what
a record is, and what state it is in. A single union makes kind and state
mutually exclusive at the type level when a real row is both at once --
and the type would have been satisfied, so nothing would have failed.

A kind chip borrows no urgency token. A destination rendering in alarm
colours because of what it is tells the coordinator something untrue.

Four kinds, named rather than derived, and a guard proved by making the
two unions overlap and watching that assertion name the shared member.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The figure tile, and the rule that at most two may shout

**Files:**

- Modify: `src/components/ward-management/ward-figure.module.css`
- Create: `src/components/ward-management/ward-figure.tsx`
- Test: `tests/ward-figure.dom.test.tsx`

**Interfaces:**

- Consumes: `.wardTokens`, `ward-figure.module.css`.
- Produces: `WardFigure({ label, value, unit, sub, flagged })` and `WardFigureStrip({ children })`. `WardFigureStrip` throws if more than two of its children are flagged.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ward-figure.dom.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardFigure, WardFigureStrip } from "@/components/ward-management/ward-figure";

describe("WardFigure", () => {
  it("renders the label, the value and the unit", () => {
    render(<WardFigure label="Going out, awaiting a bed" value="9" />);
    expect(screen.getByText("Going out, awaiting a bed")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("sets tabular figures, so a row of tiles lines up", () => {
    render(<WardFigure label="Free beds" value="12" />);
    expect(screen.getByText("12")).toHaveClass(/figureValue/u);
  });

  /**
   * The amber flag means "look here". Three amber tiles mean nothing, and the failure is
   * invisible — the screen simply stops directing the eye, which is the whole job of the strip.
   */
  it("refuses a strip where more than two tiles are flagged", () => {
    expect(() =>
      render(
        <WardFigureStrip>
          <WardFigure label="a" value="1" flagged />
          <WardFigure label="b" value="2" flagged />
          <WardFigure label="c" value="3" flagged />
        </WardFigureStrip>,
      ),
    ).toThrow(/at most two/u);
  });

  it("allows exactly two", () => {
    expect(() =>
      render(
        <WardFigureStrip>
          <WardFigure label="a" value="1" flagged />
          <WardFigure label="b" value="2" flagged />
          <WardFigure label="c" value="3" />
        </WardFigureStrip>,
      ),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-figure.dom.test.tsx`
Expected: FAIL — cannot resolve `@/components/ward-management/ward-figure`

- [ ] **Step 3: Add the rules**

```css
/* appended to ward-figure.module.css */
.figureStrip {
  composes: wardTokens from "./ward-tokens.module.css";
  display: grid;
  gap: var(--ward-space-12);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (min-width: 52rem) {
  .figureStrip {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (min-width: 76rem) {
  .figureStrip {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
.figure {
  border: 1px solid var(--ward-border);
  border-radius: var(--radius-sm);
  background: var(--ward-subtle);
  padding: var(--ward-space-16);
  display: flex;
  flex-direction: column;
  gap: var(--ward-space-8);
}
.figureLabel {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--ward-muted);
  line-height: var(--ward-leading-copy);
}
.figureBody {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: var(--ward-space-4);
}
.figureValue {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: var(--text-xl);
  font-variant-numeric: tabular-nums;
  line-height: var(--ward-leading-compact);
}
.figureUnit {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--ward-muted);
}
.figureSub {
  font-size: var(--text-xs);
  color: var(--ward-muted);
  line-height: var(--ward-leading-copy);
}
.figure[data-flagged="true"] {
  border-color: var(--ward-warning);
  background: var(--ward-warning-soft);
}
.figure[data-flagged="true"] .figureValue {
  color: var(--ward-warning);
}
```

- [ ] **Step 4: Write the components**

```tsx
// src/components/ward-management/ward-figure.tsx
import { Children, isValidElement, type ReactNode } from "react";

import styles from "./ward-figure.module.css";

export function WardFigure({
  label,
  value,
  unit,
  sub,
  flagged = false,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  flagged?: boolean;
}) {
  return (
    <div className={styles.figure} data-flagged={flagged ? "true" : undefined}>
      <dt className={styles.figureLabel}>{label}</dt>
      <dd className={styles.figureBody}>
        <span className={styles.figureValue}>{value}</span>
        {unit ? <span className={styles.figureUnit}>{unit}</span> : null}
      </dd>
      {sub ? <span className={styles.figureSub}>{sub}</span> : null}
    </div>
  );
}

/**
 * ⚠️ AT MOST TWO TILES MAY BE FLAGGED. Amber means "look here", and a strip where everything is
 * amber directs the eye nowhere — which is a total failure of the component's only job, and one
 * that looks completely fine in a screenshot. Counting it here is the only place it can be caught.
 */
export function WardFigureStrip({ children }: { children: ReactNode }) {
  const flagged = Children.toArray(children).filter(
    (child) => isValidElement<{ flagged?: boolean }>(child) && child.props.flagged === true,
  ).length;
  if (flagged > 2) {
    throw new Error(
      `A figure strip may flag at most two tiles; this one flags ${flagged}. Amber means "look here" and stops meaning anything when everything carries it.`,
    );
  }
  return <dl className={styles.figureStrip}>{children}</dl>;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/ward-figure.dom.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 6: Prove the counter catches it**

Change `flagged > 2` to `flagged > 99`, re-run, and confirm **"refuses a strip where more than two tiles are flagged"** reddens by name while "allows exactly two" stays green. Restore.

- [ ] **Step 7: Commit**

```bash
git add src/components/ward-management/ward-figure.module.css src/components/ward-management/ward-figure.tsx tests/ward-figure.dom.test.tsx
git commit -m "feat(ward-flow): the figure tile, and a cap on how many may shout

Tabular figures in the app's mono face, so a row of tiles compares.

The strip throws above two flagged tiles. Amber means 'look here'; a strip
where everything is amber directs the eye nowhere, which is a total failure
of the component's only job and looks entirely fine in a screenshot. A count
at construction is the only place that can be caught.
Mutation-verified: raising the cap to 99 reddens the cap test alone."
```

---

### Task 4b: Hoist the seven classes every screen invented, and collapse the breakpoint sprawl

**Files:**

- Modify: `src/components/ward-management/ward-shared.module.css`
- Test: `tests/ward-primitives-shared.test.ts`

**Interfaces:**

- Consumes: **`.wardTokens` (Task 1) and nothing else.**
- Produces: seven additional composable classes — `.field`, `.hint`, `.pending`, `.step`, `.wardName`, `.hero`, `.heroFigures` — and one documented breakpoint scale.

⚠️ **THIS LINE PREVIOUSLY CLAIMED TO CONSUME `.panel` AND `.chip`, AND THE CSS COMPOSED NEITHER.** Caught
by the cross-task matrix, 2026-09-04. **Either the line was wrong or the composition was missing, and
those needed different fixes** — this was the one place in the whole plan where a cross-file
`composes … from` would have been required, so getting it wrong the other way would have produced the
exact defect the split risked. **The line was wrong.** The seven classes are independent layout
utilities: a `.field` is a labelled value and has no business inheriting panel chrome. They compose
the token layer and nothing more.

⚠️ **THESE SEVEN WERE INVENTED INDEPENDENTLY BY EVERY SCREEN, WHICH IS THE SIGNAL THEY BELONG HERE.**
Reviewing the ten mockups for classes outside the shared block found the same seven names in file after
file, written by different builders who never saw each other's work. **A class three screens invented
separately is not screen-specific — it is a primitive nobody had defined yet**, and left alone it drifts
into three near-identical definitions, which is exactly the state the `--ward-*` token layer was found
in: declared three times, already diverged.

**The breakpoint sprawl is the same defect in a different currency.** The ten screens between them use
**nine distinct min-widths — 34, 40, 48, 52, 60, 64, 68, 76, 84 and 92rem** — of which five (34, 40, 64,
68, 92) appear once or twice and carry no reason. Nine breakpoints is not a responsive design; it is ten
authors each picking the number where their own screen happened to look right.

- [ ] **Step 1: Write the failing test**

```ts
// tests/ward-primitives-shared.test.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = "src/components/ward-management";
const PRIMITIVES = join(ROOT, "ward-shared.module.css");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
const CSS = walk(ROOT).filter((f) => f.endsWith(".css"));

/** Named, not derived from the file. A set read out of the stylesheet under test would agree with
 *  it by construction and could never disagree — the baseline must not come from the subject. */
const SHARED = ["field", "hint", "pending", "step", "wardName", "hero", "heroFigures"] as const;

/**
 * Does this stylesheet declare a rule for `.name`?
 *
 * ⚠️ NOT `css.includes(".name {")`. That was the first draft and it missed every real way a
 * redeclaration is written — reviewed 2026-09-04, four surviving mutations, each of which genuinely
 * redeclares the hoisted class:
 *
 *     .wardName, .other { }     a selector list
 *     .wardName:hover { }       a pseudo-class
 *     .wardName::before { }     a pseudo-element
 *     .wardName\n{ }            a newline before the brace
 *
 * `String.raw` is load-bearing: a plain template literal turns `\s` into `s` and `\w` into `w`.
 */
function declares(css: string, name: string): boolean {
  return new RegExp(String.raw`\.${name}(?![\w-])\s*[,:.{]`, "u").test(css);
}

describe("the seven classes every screen invented now live in one place", () => {
  it("is checking the stylesheets it thinks it is", () => {
    // Both halves matter: a walk returning sixteen WRONG files passes a length check alone.
    expect(CSS).toContain(PRIMITIVES);
    expect(CSS.length).toBeGreaterThan(15);
  });

  it("defines each shared class in the primitives file", () => {
    const css = readFileSync(PRIMITIVES, "utf8");
    const missing = SHARED.filter((c) => !declares(css, c));
    expect(missing, `not defined in primitives: ${missing.join(" ")}`).toEqual([]);
  });

  it("defines each shared class in no other Ward Flow stylesheet", () => {
    const offenders: string[] = [];
    for (const file of CSS) {
      if (file === PRIMITIVES) continue;
      const css = readFileSync(file, "utf8");
      for (const c of SHARED) {
        if (declares(css, c)) offenders.push(`${file}: .${c}`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});

describe("the breakpoint scale", () => {
  /**
   * Every RESPONSIVE BREAKPOINT in every Ward Flow stylesheet, as a bare rem number.
   *
   * ⚠️ THE FIRST DRAFT MATCHED `min-width:` ANYWHERE AND CONFLATED TWO UNRELATED THINGS.
   * `min-width` is also an ordinary CSS property, and Ward Flow uses it deliberately to set
   * horizontal-scroll minimums on tables — `discharges` and `escalation` both carry a comment
   * explaining their 30rem and 44rem table floors. Measured 2026-09-04: the loose pattern
   * returned 17 values, of which only 8 were breakpoints. Collapsing the other 9 onto a
   * four-step scale, as Step 5 literally instructed, would have corrupted working layout code
   * with a documented rationale, in files this task does not own.
   *
   * The `@media` prefix is what makes this measure breakpoints rather than the word "min-width".
   */
  function breakpoints(): string[] {
    const found = new Set<string>();
    for (const file of CSS) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/@media[^{]*\(\s*min-width:\s*([\d.]+)rem/gu)) found.add(m[1]);
    }
    return [...found].sort((a, b) => Number(a) - Number(b));
  }

  it("finds breakpoints at all, so an empty pass cannot look like a clean one", () => {
    expect(breakpoints().length).toBeGreaterThan(0);
  });

  /**
   * ⚠️ A COUNT, NOT AN ALLOWLIST. A permitted-values list stops failing the moment somebody adds a
   * tenth value and adds it to the list in the same commit -- the diff then looks like configuration.
   * A count has to be argued down in its own line, in front of a reviewer.
   *
   * Measured 2026-09-04 across the ten mockups: nine distinct values (34, 40, 48, 52, 60, 64, 68, 76,
   * 84, 92rem), of which five appear once or twice with no stated reason. The scale is four:
   * 48rem tablet, 60rem small desktop, 76rem desktop, 92rem wide.
   */
  it("uses at most four distinct breakpoints", () => {
    const bp = breakpoints();
    expect(bp, `distinct breakpoints: ${bp.join(" ")}`).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-primitives-shared.test.ts`
Expected: FAIL on the shared-class assertion, naming all seven as missing from the primitives file.

⚠️ **Read the breakpoint failure message before you touch it.** It prints the distinct values it found.
If that list is shorter than four, the walk is not reaching the stylesheets and the count assertion is
passing vacuously — fix the walk, not the number.

- [ ] **Step 3: Add the seven classes**

```css
/* appended to ward-shared.module.css */

/* A labelled value in a record. Every screen invented this; none of them agreed on the gap. */
.field {
  display: flex;
  flex-direction: column;
  gap: var(--ward-space-2);
  min-width: 0;
}

/* Secondary explanation under a control or figure. Never the only carrier of meaning. */
.hint {
  font-size: var(--text-xs);
  color: var(--ward-muted);
  line-height: var(--ward-leading-body);
}

/* A record waiting on somebody else. Worded as well as styled -- see the chip rule. */
.pending {
  color: var(--ward-muted);
  font-style: normal;
}

/* One numbered stage of a multi-part form. */
.step {
  display: flex;
  align-items: baseline;
  gap: var(--ward-space-4);
}

/* A ward name where it must stay readable beside a figure: never truncated to fit. */
.wardName {
  font-weight: 600;
  color: var(--ward-text);
  overflow-wrap: break-word;
}

/* The opening block of a screen: title, scope, and what the reader is looking at. */
.hero {
  display: flex;
  flex-direction: column;
  gap: var(--ward-space-4);
  padding-block: var(--ward-space-6);
}

/* The figure strip inside a hero. The two-shout rule from Task 4 applies to its children. */
.heroFigures {
  display: grid;
  gap: var(--ward-space-4);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (min-width: 60rem) {
  .heroFigures {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
```

- [ ] **Step 4: Run test to verify the class assertions pass**

Run: `npx vitest run tests/ward-primitives-shared.test.ts`
Expected: the three shared-class assertions PASS. The breakpoint count may still fail if other Ward
Flow stylesheets carry novel values — that list is the adoption backlog for the screen plans.

- [ ] **Step 5: Collapse the novel breakpoints onto the scale**

For each value the test names that is not 48, 60, 76 or 92rem, move the rule to the **nearest scale
member**, then look at the screen at that width. Do not average, and do not add a fifth step to avoid
making a decision.

⚠️ **If a rule genuinely breaks at the nearest step, that is a layout defect the odd breakpoint was
hiding, not a reason to keep the breakpoint.** Fix the layout. Record which value you removed and what
it was papering over in the commit message — a removed breakpoint with no note reads as arbitrary, and
the next author restores it.

- [ ] **Step 6: Prove both guards can fail**

Two mutations, run and read separately:

1. Move `.hint` out of the primitives file into any other Ward Flow stylesheet. The test must fail on
   the **third** assertion, naming that file and `.hint` — not on the "defined in primitives" one.
2. Add `@media (min-width: 41rem)` to any Ward Flow stylesheet. The test must fail on the count,
   printing five values including `41`.

Then reverse both and prove the tree is clean:

```bash
git diff --stat src/components/ward-management/   # must print nothing
```

⚠️ **Mutation 1 exists because the second and third assertions look interchangeable and are not.**
"Defined in primitives" keeps passing while a duplicate sits in three other files; only the third
assertion catches the drift this task exists to prevent. If mutation 1 goes red on the second
assertion, the class was never in the primitives file and you have proved nothing.

- [ ] **Step 7: Commit**

```bash
git add src/components/ward-management/ward-shared.module.css tests/ward-primitives-shared.test.ts
git commit -m "refactor(ward-flow): hoist the seven classes every screen invented, cap breakpoints at four

Ten mockups written by different builders independently invented the same
seven class names. A class three screens invent separately is a primitive
nobody had defined yet -- left alone it becomes three definitions that
have already diverged, which is the exact state the --ward-* token layer
was found in.

The nine distinct breakpoints are the same defect in another currency:
five of them appear once or twice and carry no reason. The scale is four,
enforced as a count rather than an allowlist -- an allowlist stops failing
the moment a tenth value is added to it in the same commit.

Both guards proved by mutation, and mutation 1 exists specifically because
the two class assertions look interchangeable: only one of them catches
the duplicate-definition drift this task is for.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: A contract test that pins the language, so the other twelve routes cannot drift

**Files:**

- Create: `tests/ward-design-language-contract.test.ts`

**Interfaces:**

- Consumes: every file under `src/components/ward-management/`.
- Produces: nothing importable. This is a gate.

⚠️ **THIS GATE COMPARES AGAINST THE CANONICAL DECLARATION, NEVER AGAINST WHAT A ROUTE ALREADY
CARRIES.** The first draft of this task was going to check each route's token block against the copy
in that route — which is precisely the defect found on 2026-09-04, where a `.bak` taken from the file
under test carried the violation into the baseline and then vouched for it twice. Promoted to a
committed gate it would have run on every build and been green forever. **One declaration is the
source; every other file must contain no declaration at all, which is a comparison that can fail.**

- [ ] **Step 1: Write the test**

```ts
// tests/ward-design-language-contract.test.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = "src/components/ward-management";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const CSS = walk(ROOT).filter((f) => f.endsWith(".css"));

describe("the Ward Flow design language holds across every Ward Flow stylesheet", () => {
  /**
   * ⚠️ THE FILE SET IS DISCOVERED FROM DISK, NEVER LISTED. A hand-written list of stylesheets
   * silently stops covering the file somebody adds tomorrow, and that omission is invisible —
   * the suite still passes, with one fewer file in it.
   */
  it("finds the stylesheets it is meant to be checking", () => {
    // ⚠️ A LENGTH CHECK ALONE PASSES ON SIXTEEN WRONG FILES. Task 4b already had the stronger
    // form and it did not travel here — reviewed 2026-09-04. Name a file that must be in the set.
    expect(CSS).toContain(join(ROOT, "ward-tokens.module.css"));
    for (const required of ["ward-panel", "ward-chip", "ward-figure", "ward-shared"]) {
      expect(CSS).toContain(join(ROOT, `${required}.module.css`));
    }
    expect(CSS.length).toBeGreaterThan(15);
  });

  it("declares the token layer in exactly one file", () => {
    const declaring = CSS.filter((f) => readFileSync(f, "utf8").includes("--ward-space-10:"));
    expect(declaring).toEqual([join(ROOT, "ward-tokens.module.css")]);
  });

  it("uses no raw hex outside the token layer", () => {
    const offenders: string[] = [];
    for (const file of CSS) {
      if (file.endsWith("ward-tokens.module.css")) continue;
      const hex = readFileSync(file, "utf8").match(/#[0-9a-fA-F]{3,8}\b/gu) ?? [];
      if (hex.length) offenders.push(`${file}: ${hex.slice(0, 4).join(" ")}`);
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("declares no font-family outside the token layer — the app self-hosts its faces", () => {
    // A Google Fonts link or a new family here is a third-party network request on a clinical
    // page, and a bundle-budget change. It is a decision, not a stylesheet edit.
    const offenders = CSS.filter(
      (f) => !f.endsWith("ward-tokens.module.css") && /font-family:\s*(?!var\()/u.test(readFileSync(f, "utf8")),
    );
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});

describe("every --ward-* token a new module uses is actually declared", () => {
  /**
   * ⚠️ THE ONLY DEFECT IN THIS WHOLE PLAN THAT FAILS COMPLETELY SILENTLY. `var(--ward-typo)` is
   * not a syntax error, not a warning, and not a test failure — it resolves to nothing, and the
   * element renders with no border, no background, or default line height. On a ward board an
   * invisible chip or an invisible divider is exactly what a coordinator reads straight past.
   *
   * It is not hypothetical. Two token names in this plan (--ward-panel, --ward-sunken) never
   * existed and were caught only because someone opened the token file. And --ward-border-subtle
   * is used in search/search.module.css today and is declared nowhere in src/ at all.
   *
   * ⚠️ THE CLASS HAS TWO FAILURE MODES AND THE SECOND IS THE DANGEROUS ONE:
   *
   *   no fallback         -> the value is empty -> the element renders INVISIBLE
   *   currentColor        -> the border renders at FULL TEXT CONTRAST
   *
   * The search case is the second. `currentColor` is the element's text colour, so a token whose
   * name says SUBTLE paints the strongest line available on that element. An invisible border at
   * least reads as missing; a heavy one reads as a design decision, so nobody questions it.
   *
   * ⚠️ AND IT HIDES FROM THE GATE BUILT FOR BORDERS. A contrast audit hunting lines that are too
   * faint scores this one as exemplary, because it is text-coloured and clears 3:1 easily. The
   * phantom token conceals itself from precisely the check designed to catch bad borders — which
   * is why the gate for it is this subset assertion and not a contrast rule.
   *
   * Scope is the four new modules against the canonical layer. Older Ward Flow stylesheets have
   * their own declaration sites and are a separate, larger problem — widening this assertion to
   * cover them would make it fail for reasons this task cannot fix, and it would be turned off.
   */
  const NEW_MODULES = ["ward-panel", "ward-chip", "ward-figure", "ward-shared"].map((n) =>
    join(ROOT, `${n}.module.css`),
  );

  it("is checking all four new modules, not a subset that happens to be clean", () => {
    for (const m of NEW_MODULES) expect(CSS).toContain(m);
  });

  it("uses no --ward-* token the canonical layer does not declare", () => {
    const tokens = readFileSync(join(ROOT, "ward-tokens.module.css"), "utf8");
    const declared = new Set([...tokens.matchAll(/(--ward-[\w-]+)\s*:/gu)].map((m) => m[1]));
    expect(declared.size, "the token layer parsed as empty").toBeGreaterThan(20);

    const offenders: string[] = [];
    for (const file of NEW_MODULES) {
      const css = readFileSync(file, "utf8");
      for (const m of css.matchAll(/var\(\s*(--ward-[\w-]+)/gu)) {
        // A declaration inside the module itself is legitimate; a USE of something undeclared
        // anywhere is not. Only flag names absent from both.
        if (!declared.has(m[1]) && !new RegExp(`${m[1]}\\s*:`, "u").test(css)) {
          offenders.push(`${file}: var(${m[1]}) is declared nowhere`);
        }
      }
    }
    expect([...new Set(offenders)], offenders.join("\n")).toEqual([]);
  });
});

const TS = walk(ROOT).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));

describe("no Ward Flow file builds a regex from a template literal carrying an escape", () => {
  /**
   * ⚠️ THIS EXISTS BECAUSE A WRITTEN RULE DID NOT FIRE. The escape-dropping defect —
   * `new RegExp(`…\s…`)` silently becoming `…s…` — is documented, was known to the author, and was
   * written into this plan anyway, twice in one evening in two different files. A note that is
   * still TRUE and simply did not apply itself needs a check, not a better memory. (A note that has
   * gone FALSE is a different failure and needs re-verification instead; do not conflate them.)
   *
   * Swept 2026-09-04 across `origin/main` and this branch: zero instances of the direct form, and
   * `String.raw` is already the house style in four or more files. This guard keeps it that way
   * inside Ward Flow rather than discovering the drift later.
   */
  it("is checking source files, not an empty set", () => {
    expect(TS.length).toBeGreaterThan(10);
  });

  it("uses String.raw wherever it constructs a RegExp from a template literal", () => {
    // Matches `RegExp(` followed by a backtick — with or without `new`, and with or without
    // String.raw — then reports only the ones where String.raw is absent and a backslash is
    // present. A template literal with no escape in it is harmless and is not flagged.
    const CONSTRUCTED = /(?:new\s+)?RegExp\(\s*(String\.raw\s*)?`([^`]*)`/gu;
    const offenders: string[] = [];
    for (const file of TS) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(CONSTRUCTED)) {
        const usesRaw = Boolean(m[1]);
        const hasEscape = m[2].includes("\\");
        if (!usesRaw && hasEscape) offenders.push(`${file}: RegExp(\`${m[2].slice(0, 40)}\`)`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
```

⚠️ **The escape guard has a known blind spot and it is written down rather than left to be
rediscovered.** It requires the backtick to follow `RegExp(` directly, so **a template literal
assigned to a variable first and passed in later is NOT caught.** That form is unexamined, not
absent. Do not describe this guard as covering the defect class; it covers the direct form.

- [ ] **Step 2: Run it and read what it says**

Run: `npx vitest run tests/ward-design-language-contract.test.ts`

Expected: the two set-discovery assertions and the escape guard pass. **The raw-hex and font-family
tests will likely FAIL on the existing twenty-one stylesheets, and that is the point** — the failure
list is the adoption backlog for the screen plans. Record the list in the commit message; do not fix
those files in this task.

⚠️ **If the escape guard FAILS, stop and read it before assuming it found something.** Its own
pattern is a regex literal, not a constructed one, so it is not subject to the defect it hunts — but
a failure here names a real file and you should check that file by hand before believing the guard
over the source. The sweep that motivated it found zero instances on both refs.

- [ ] **Step 3: Narrow the gate to what is true today, without weakening it**

If the offender list is non-empty, pin **the sorted list of offenders itself** as a `KNOWN_BACKLOG`
constant in the test, with the date it was measured, and assert that the current offenders contain
**no member that is not already in it**:

```ts
const surprises = offenders.filter((o) => !KNOWN_BACKLOG.includes(o));
expect(surprises, `new violations: ${surprises.join("\n")}`).toEqual([]);
```

⚠️ **NOT a `<=` count, which was this step's first draft and survives two mutations.** Reviewed
2026-09-04: **move a violation from one file to another and the count is unchanged, so it stays
green**; and **break the walk so it returns fewer files and the count drops, so it stays green** —
the second is the worse one, because a gate that gets greener as its coverage collapses is
indistinguishable from progress.

⚠️ **A count is also the contaminated baseline this task opens by warning against.** "Today's
measured number" is obtained by running the check over the files under test — the same shape as a
`.bak` taken from the file it is meant to police. A pinned list of specific offenders is still
measured from those files, but it names them, so a move, a rename and a shrunken walk all show up as
a set difference rather than vanishing into an aggregate.

**Do not add an allowlist of file paths either.** A path allowlist stops failing when the file is
renamed, which is silent. A named offender list fails on the rename, because the old member goes
missing and a new one appears.

- [ ] **Step 3b: Prove all four guards can fail, and read which assertion caught each**

Four mutations, one at a time, each reversed before the next. **Record the assertion name that went
red for each** — not just the colour. A guard proved by a mutation that some _other_ assertion caught
has not been proved at all.

| Mutation                                                                            | Must fail on                                                                              |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Add `--ward-space-10: 1rem;` to a second Ward Flow stylesheet                       | "declares the token layer in exactly one file"                                            |
| Add `color: #ff0000;` to any Ward Flow stylesheet                                   | the raw-hex assertion, naming that file                                                   |
| Add `font-family: Archivo, sans-serif;` to any Ward Flow stylesheet                 | the font-family assertion — this is the one that would let a Google Fonts request back in |
| Add `new RegExp(` + a backtick template containing `\s` to any Ward Flow `.ts` file | "uses String.raw wherever it constructs a RegExp from a template literal"                 |

Then prove the tree is clean:

```bash
git diff --stat src/components/ward-management/   # must print nothing
```

⚠️ **The set-discovery assertions need their own mutation, and it is the awkward one.** Temporarily
point `ROOT` at a directory with no stylesheets. **Every offender assertion goes green** — because a
property over an empty set is true — **and only "is checking source files, not an empty set" goes
red.** That is the whole reason those assertions exist, and it is the only mutation that demonstrates
it. Restore `ROOT` afterwards.

- [ ] **Step 4: Commit**

```bash
git add tests/ward-design-language-contract.test.ts
git commit -m "test(ward-flow): pin the design language so twelve more routes cannot drift

Four assertions: the stylesheet set is discovered from disk rather than
listed, the token layer is declared in exactly one file, no raw hex lives
outside it, and no stylesheet declares a font-family — the app self-hosts
its faces and a new one is a privacy and bundle decision, not a style edit.

The last two start as ratchets against today's measured count, because the
existing twenty-one stylesheets carry a backlog. A count fails the moment
anything gets worse; a path allowlist would stop failing on a rename, which
is silent."
```

---

## The mockup review findings, and where each one went

**Every finding is listed, including the ones that changed nothing.** A review whose report only
names what it changed cannot be distinguished from a review that stopped early — and on this surface
we have twice had a sweep cover less than it appeared to. A row saying "no change needed, and here is
why" is evidence; a missing row is not.

| Finding                                                                                           | Where it went                                                                                                                                          |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Quiet text colour fails 4.5:1 on the ground (4.04) and the panel (4.31), passing only on white    | Task 1, new contrast assertion over all eight text/surface pairs, plus a Global Constraint                                                             |
| `--ward-*` layer declared three times and already diverged                                        | Task 1 (was already the task)                                                                                                                          |
| `enroute` renders on three screens with no chip level; `planned` renders on none                  | Task 3, union corrected                                                                                                                                |
| Record _kind_ and record _state_ wearing one chip, making a real row unrepresentable              | Task 3b, new                                                                                                                                           |
| Seven class names invented independently by different builders                                    | Task 4b, new                                                                                                                                           |
| Nine distinct breakpoints, five of them appearing once or twice with no reason                    | Task 4b, capped at four as a count                                                                                                                     |
| A drift baseline taken from the file under test vouched for a violation already inside it         | Task 5 preface, plus a Global Constraint; the gate now compares against one canonical declaration                                                      |
| Google Fonts links in all ten mockups                                                             | Global Constraint (the app self-hosts Geist; a third-party font request is a privacy and bundle decision)                                              |
| Statistics: one median across three unlike quantities                                             | Fixed in the mockup, scoped to wards and labelled; no build task needed                                                                                |
| Statistics: page-wide superlatives, two of them hidden in hover text                              | Fixed in the mockup; **hover text is now a review surface** — nobody opens a tooltip during review                                                     |
| Referral: ward-and-community refusal test passed all three cases and wrongly refused `{ward, ED}` | Already fixed and committed before this plan                                                                                                           |
| ED cards implied a referral nobody declines, contradicting FD-18                                  | Fixed in the mockups from source; **FD-18 is a safety rule — every referral is declinable, and `purpose` is what distinguishes them**                  |
| One weekday anchor contradicted another for the same patient across two screens                   | Fixed in the mockups; nothing invented, because only duration-only claims survived the shift                                                           |
| Patient record: two sensitive fields adjacent, and one sitting directly above the history panel   | Layout cleared and reordered; ⚠️ **the substance still needs the existing Aboriginal health review — layout is not the same approval**                 |
| Patient record: no zero-admissions state                                                          | Added to the mockup as a labelled alternate state                                                                                                      |
| Patient record: plural guards                                                                     | **Audited, no live defect — every count on the page is already plural.** Recorded as a requirement rather than a fix, because there was nothing to fix |
| Sort control on the referral screen was a silent no-op (the file has no `</body>`)                | Fixed and proved with three distinguishable orderings                                                                                                  |

## The adversarial pre-flight review of THIS plan, 2026-09-04

An independent reviewer read the plan before Task 1 was finished and found **five defects in the
plan's own tests**. All five are fixed above. They are listed because a plan that was reviewed and a
plan that was not look identical once the fixes are in.

| #   | Defect                                                                                                                                                                                                                                                                    | Fix                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | **Task 1's contrast test was red before any mutation.** Both constructed regexes used plain template literals, so `\s` became `s` and `\w` became `w`; the pattern built was `--ward-ground:s*var((--[w-]+))`, matching nothing. Proved by running it, not by reading it. | `String.raw` on both, and Step 6a now requires a **green pre-mutation run** to be recorded first |
| 2   | **Task 5's ratchet was a `<=` count** — survives moving a violation between files, and survives a broken walk returning fewer files, which makes collapsing coverage look like progress. It was also the contaminated baseline the task opens by warning against.         | Pin the **sorted offender list** and assert no new member                                        |
| 3   | **Task 5's walk guard was weaker than Task 4b's**, which already had the stronger form. Sixteen wrong files passed Task 5.                                                                                                                                                | `toContain` two named files in Task 5                                                            |
| 4   | **Task 4b's redeclaration check used `css.includes(".name {")`** and missed selector lists, pseudo-classes, pseudo-elements, and a newline before the brace — four mutations that genuinely redeclare the class                                                           | A `declares()` helper with a real selector regex                                                 |
| 5   | **Task 3b's disjointness assertion was vacuous if either set was empty.** Kinds were pinned; levels were not pinned in that file at all.                                                                                                                                  | Pin the levels in the same file as the assertion that reads them                                 |

⚠️ **AND ONE CATEGORY I ASKED FOR IS UNEXAMINED, NOT CLEAN.** The reviewer compared Task 4b against
Task 5, and Task 3b's dependency on Task 3, but **did not build a full produces/consumes matrix
across the five tasks that then shared one stylesheet** — and said so rather than letting the absence
read as a pass. **Treat cross-task interface agreement between Tasks 2, 3, 3b, 4 and 4b as
unverified.** It is checked task by task as each one lands, and the matrix is being built separately.

## The one stylesheet became four, so the tasks stop queueing

**Tasks 2, 3, 3b, 4 and 4b originally all modified `ward-primitives.module.css`.** That single file
was the reason they had to run one after another — five workers editing one stylesheet is not
parallelism, it is a queue with extra steps. Each primitive now owns its own module:

| Task                               | Owns                                                                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 — panel                          | `ward-panel.module.css`                                                                                                                                           |
| 3 — state chip, and 3b — kind chip | `ward-chip.module.css` (**deliberately shared**: a kind chip composes from the state chip, so splitting them would put a dependency across two files for no gain) |
| 4 — figure tile                    | `ward-figure.module.css`                                                                                                                                          |
| 4b — the seven hoisted classes     | `ward-shared.module.css`                                                                                                                                          |

**Tasks 2, 3+3b, 4 and 4b are now disjoint in every file they touch**, including their tests, so they
run at the same time with no coordination. Task 1 still goes first — everything composes from the
token layer — and Task 5 still goes last, because it reads all of them.

⚠️ **This is a better design independently of scheduling**, which is the only reason it is worth
doing mid-plan: four single-responsibility modules beat one file that four unrelated concerns append
to. Had the split been made only to go faster, it would be the wrong trade.

**One thing the reviewer cleared that I had flagged as my main worry:** Task 3b's overlap assertion
is _not_ a filter-and-assert tautology. It filters on one predicate and compares the result against
an external `[]`, which can fail. Its weakness was the unpinned set — a different defect in the same
place, which is why "I was worried about that line" is not the same as knowing what is wrong with it.

⚠️ **Two findings were corrections to briefs I wrote, and both are recorded here on purpose.** I told
builders there were eight wards when there are nine, and I described a reachability test as differing
from `main` when it does not exist on `main` at all. Both were caught by the builders and one screen
had already resolved it the wrong way round by trusting my figure over its own reading. **A brief is
not evidence, and a number in a brief is the easiest thing in this whole system to get wrong** — six
wrong figures in one session, every one of them produced while writing prose rather than while
reading a tool result.

---

## What comes after this plan

This plan delivers the foundation only, which is deliberate: it is the part every screen depends on
and the part most worth reviewing carefully. Nine screens in one change is unreviewable, and a
mistake in the foundation would be found nine screens too late.

**Still to be planned, once this lands. The mockup review findings are folded in above:**

1. **Navigation shell** — one header carrying the role switcher and the ward or team you are in, applied to all ten screens.
2. **Screens, in batches of two or three.** Community hub and ED home first: they are the two that most exercise the primitives. The patient record last, because it needs its new model fields built with it.
3. **The patient model expansion** — address, community team, psychiatric and medical history, medications, legal status, GP, interpreter, Aboriginal or Torres Strait Islander status. ⚠️ A field the screen shows and nothing can write passes every test and renders as a legitimate empty state.
4. **The `/ed` index route**, which triggers the new-route wiring gates.
5. **Phone layouts**, after the language is proven against real data.
