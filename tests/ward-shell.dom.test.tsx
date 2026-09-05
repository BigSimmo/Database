// tests/ward-shell.dom.test.tsx
//
// Tasks 1 and 2 of docs/superpowers/plans/2026-09-04-ward-flow-navigation-shell.md, combined
// into one file per the implementer brief (the two tasks share `ward-shell.tsx` and
// `ward-shell.module.css`, so their assertions are kept together rather than split across the
// two files the plan names — `tests/ward-shell-ground.test.ts` and
// `tests/ward-shell-header.dom.test.tsx`).
//
// Updated 2026-09-04 for the ruling that split `ward-shell.tsx` into two components:
// `WardGround` (the ground alone, mounted in `src/app/mockups/ward-flow/layout.tsx`, the only
// thing that is an ancestor of every route's `<main>`) and `WardShellHeader` (the place label
// alone, no props, deriving its own place from `usePathname` — never a role switcher, since
// `ClinicalRail` already renders one). See `tests/ward-shell-mounted.test.tsx` for proof the
// split is actually wired together at the real mount point.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardGround, WardShellHeader } from "@/components/ward-management/ward-shell";

const WARD_DIR = "src/components/ward-management";

function stylesheets(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return stylesheets(path);
    return path.endsWith(".module.css") ? [path] : [];
  });
}

describe("Task 1 — the shell owns the ground", () => {
  const files = stylesheets(WARD_DIR);

  it("found the Ward Flow stylesheets, or every assertion below is vacuous", () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files).toContain(join(WARD_DIR, "ward-shell.module.css"));
  });

  it("has exactly one stylesheet painting --ward-ground, and it is the shell's", () => {
    /*
     * ⚠️ **A STICKY OCCLUDER IS EXEMPT, AND THE EXEMPTION IS NARROW ON PURPOSE (2026-09-05).** A bar
     * pinned over scrolling content has to repaint the ground it sits on, or the rows pass through
     * it. That is not a second OWNER of the page ground — it is the same value being re-laid over
     * itself — and the alternative was worse in both directions: hard-coding `var(--surface)` in the
     * sticky rule silently un-tracks the ground the day it changes again, and dropping this guard
     * loses the drift it exists to catch.
     *
     * **So the rule must ALSO declare `position: sticky`.** A plain panel or card reaching for the
     * ground still fails here, which is the case that actually goes wrong.
     *
     * ⚠️ **A SECOND CHAT NARROWED THIS SAME ASSERTION TONIGHT TO PAGE-LEVEL SELECTORS —
     * `.screen|.shell|.page|.root` — AND THIS VERSION IS THE BETTER ONE, WHICH IS WHY IT WON.** That
     * one matched on the CLASS NAME, so a page-level container called `.wrap` or `.board` escaped it
     * entirely: a detector defeated by a rename. **This one computes the exemption from the rule's own
     * declaration, which cannot be renamed around.** It also fixed the two offending chips
     * (`.kbdHint` and `.familyCard` now take `var(--surface)`) instead of widening the guard to
     * tolerate them — a smaller exemption AND fewer things exempted.
     *
     * ⚠️ **WHY A NON-STICKY GROUND PAINT IS DANGEROUS AT ALL, carried across from that other
     * narrowing because it is the justification this exemption rests on and was measured:** a
     * dark-theme `--ward-ground` survives into print, because the dark palette is scoped by a CLASS on
     * `<html>` and not by a media query. A card painted with it would print dark while the screen's
     * print reset forces text to `CanvasText` — black ink on a dark card. `community-index`'s print
     * block already declares `background-color: Canvas !important` on `.screen` and `.screen *`, which
     * is what makes the sticky exemption safe rather than merely convenient. **A screen that paints
     * the ground WITHOUT such a reset is the real defect, and it still fails here.**
     */
    const painters = files.filter((file) => {
      const rules = readFileSync(file, "utf8").split("}");
      return rules.some((rule) => /background:\s*var\(--ward-ground\)/.test(rule) && !/position:\s*sticky/.test(rule));
    });
    // Pinned as a sorted list, not a count: a count survives the declaration moving to
    // another file, which is the failure this guard exists to catch.
    expect(painters).toEqual([join(WARD_DIR, "ward-shell.module.css")]);

    // ⚠️ Non-vacuity for the exemption itself: if nothing anywhere paints the ground on a sticky
    // rule, the branch above is dead code and this test has quietly become the old one.
    const stickyPainters = files.filter((file) =>
      readFileSync(file, "utf8")
        .split("}")
        .some((rule) => /background:\s*var\(--ward-ground\)/.test(rule) && /position:\s*sticky/.test(rule)),
    );
    expect(stickyPainters.length, "the sticky exemption above matches nothing and can be deleted").toBeGreaterThan(0);
  });

  it("declares the token exactly once, so the shell is painting a real value", () => {
    const declarers = files.filter((file) => /^\s*--ward-ground:/m.test(readFileSync(file, "utf8")));
    expect(declarers).toEqual([join(WARD_DIR, "ward-tokens.module.css")]);
  });
});

const pathnameState = vi.hoisted(() => ({ pathname: "/mockups/ward-flow/ward/rph-adult-secure" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.pathname,
}));

/**
 * A minimal route fixture: a page-level `<main>`/`<h1>` (standing in for whatever real screen
 * mounts inside `WardGround`) alongside `WardShellHeader`, exactly the shape
 * `src/app/mockups/ward-flow/layout.tsx` now produces for every real route. `WardShellHeader`
 * reads `usePathname` directly (mocked above via `pathnameState`), never a `place` prop.
 */
function renderRoute(pathname: string) {
  pathnameState.pathname = pathname;
  return render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <WardGround>
        <WardShellHeader />
        <main id="main-content">
          <h1>Page&apos;s own heading</h1>
          <p>page body</p>
        </main>
      </WardGround>
    </WardFlowProvider>,
  );
}

describe("Task 2 — the header region adds no landmark, no heading, and no role switcher", () => {
  it("adds no second <h1> — exactly one remains, the page's own", () => {
    renderRoute("/mockups/ward-flow/ward/rph-adult-secure");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Page's own heading");
  });

  it('adds no second <main id="main-content"> — exactly one remains, the page\'s own', () => {
    renderRoute("/mockups/ward-flow/ward/rph-adult-secure");
    expect(document.querySelectorAll('main[id="main-content"]')).toHaveLength(1);
  });

  it('contributes zero role="main" elements on its own, with no page main present', () => {
    pathnameState.pathname = "/mockups/ward-flow/ward/rph-adult-secure";
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <WardGround>
          <WardShellHeader />
          <p>page body</p>
        </WardGround>
      </WardFlowProvider>,
    );
    expect(screen.queryAllByRole("main")).toHaveLength(0);
  });

  it("renders the place as text, never as a heading", () => {
    renderRoute("/mockups/ward-flow/ward/rph-adult-secure");
    expect(screen.queryByRole("heading", { name: "RPH Adult Secure" })).toBeNull();
    expect(screen.getByText("RPH Adult Secure")).toBeInTheDocument();
  });

  it("renders no place label at all when the route has none — never a placeholder", () => {
    renderRoute("/mockups/ward-flow/queue");
    expect(screen.queryByText(/RPH Adult Secure/)).toBeNull();
  });

  it("renders no role switcher — ClinicalRail already renders the only one", () => {
    renderRoute("/mockups/ward-flow/ward/rph-adult-secure");
    expect(screen.queryAllByRole("button", { name: /change view/i })).toHaveLength(0);
  });
});
