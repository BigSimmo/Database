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
    const painters = files.filter((file) => /background:\s*var\(--ward-ground\)/.test(readFileSync(file, "utf8")));
    // Pinned as a sorted list, not a count: a count survives the declaration moving to
    // another file, which is the failure this guard exists to catch.
    expect(painters).toEqual([join(WARD_DIR, "ward-shell.module.css")]);
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
