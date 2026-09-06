import { render, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite: `ClinicalRail` renders next/link anchors, and jsdom
// cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsCompareScreen } from "@/components/ward-management/statistics/statistics-compare-screen";
import { StatisticsEdScreen } from "@/components/ward-management/statistics/statistics-ed-screen";
import { StatisticsOverviewScreen } from "@/components/ward-management/statistics/statistics-overview-screen";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allEmergencyDepartments, allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * EVERY SECTION OF EVERY STATISTICS SCREEN IS A LANDMARK A SCREEN-READER USER CAN JUMP TO.
 *
 * ⚠️ **WHY THIS IS THE PROPERTY AND NOT "THESE SCREENS IMPORT `WardPanel`".** Until 2026-09-05 all
 * five screens wrapped their sections in a bare `<section className={styles.section}>` — a
 * `<section>` with no accessible name, which is not exposed as a `region` landmark at all. So the
 * pages had headings a sighted reader could scan and no landmark list anybody else could use, and
 * every existing test stayed green because they all query by `data-testid` and by text, both of
 * which survived the rewrite untouched. **The 236 statistics tests passed identically before and
 * after these screens adopted `WardPanel`.** That is not a criticism of them; it is what it looks
 * like when nothing in a suite asks the question.
 *
 * `WardPanel` is one way to satisfy this and the way these screens use, but the assertion is about
 * the DOM contract, not the component — a redesign that reaches it some other way stays green,
 * which is the standing rule for guards on these screens.
 *
 * 🔴 **THE POPULATION IS EVERY `<h2>` THE SCREEN ACTUALLY RENDERS**, read out of the render rather
 * than listed here. A list would go stale in the silent direction the moment a section is added.
 *
 * ⚠️ **ONE STRUCTURAL EXCEPTION, AND IT IS STRUCTURAL RATHER THAN A NAME.** The footnote
 * (`data-ward-primitive="stat-footnote"`) heads each of its groups with an `<h2>` — "Invented
 * figures", "What this cannot yet show". Those are the parts of one glossary, not sections of the
 * page, and naming each as a landmark would bury the page's real sections in a landmark list. The
 * exception is expressed as "inside that primitive", so a new footnote group is covered and a new
 * SECTION is not.
 *
 * 🔴 **AND THAT EXCEPTION HAS NO SUBJECT TODAY, WHICH IS WORTH SAYING RATHER THAN LEAVING TO BE
 * DISCOVERED.** A mutation stripping the `stat-footnote` marker left this file GREEN, which looked
 * like a hole in the guard and is not: `StatFootnote` has no production call site at all —
 * `grep -rn "StatFootnote" src` finds only its own definition, and only
 * `tests/ward-statistics-primitives.dom.test.tsx` constructs it. So the exception is written for a
 * component that reaches no reader, and it is kept rather than removed because the shape is the one
 * a screen will use the day it carries a grouped list of invented figures. The component's own
 * comment states a rule — that a screen carrying any synthetic number always names it as such at
 * the foot of the page — which no screen follows through this component; the frame's governance
 * banner and `statistics-disclaimers.tsx` meet that obligation another way. Reported to Ward Lead
 * rather than deleted: an unused export in this repository answers to
 * `docs/agents/dead-code-deletion.md`, not to whoever noticed it.
 */

function headingsOutsideTheFootnote(container: HTMLElement): string[] {
  return [...container.querySelectorAll("h2")]
    .filter((heading) => heading.closest('[data-ward-primitive="stat-footnote"]') === null)
    .map((heading) => (heading.textContent ?? "").trim())
    .filter((text) => text.length > 0);
}

/**
 * ⚠️ **THIS ASKED FOR `region` ALONE AND THAT WAS WRONG — IT WENT RED ON A PAGE THAT WAS CORRECT.**
 * The hub's section index is a `<nav aria-labelledby>` pointing at its own `<h2>`: a properly named
 * NAVIGATION landmark, which is the right role for a list of links and not a `region` at all. The
 * property is "this heading names a landmark", so the query has to ask about landmarks. Caught by
 * running it, and the tempting repair was to relabel a correct `<nav>` as a region.
 *
 * Both naming mechanisms are resolved, because the two are interchangeable to a user and this
 * codebase uses each: `WardPanel` sets `aria-label`, the index nav uses `aria-labelledby`.
 */
const LANDMARKS = ["region", "navigation", "complementary", "search", "form"] as const;

function accessibleName(element: Element, container: HTMLElement): string {
  const label = element.getAttribute("aria-label");
  if (label !== null) return label.trim();
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy === null) return "";
  return labelledBy
    .split(/\s+/u)
    .map((id) => container.querySelector(`#${CSS.escape(id)}`)?.textContent ?? "")
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
}

function landmarkNames(container: HTMLElement): string[] {
  const query = within(container);
  return LANDMARKS.flatMap((role) => query.queryAllByRole(role)).map((element) => accessibleName(element, container));
}

const UNIT = allUnits()[0];
const ED = allEmergencyDepartments()[0];

const SCREENS: { name: string; render: () => HTMLElement }[] = [
  {
    name: "the statistics hub",
    render: () =>
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <StatisticsScreen />
        </WardFlowProvider>,
      ).container,
  },
  {
    name: "across all services",
    render: () =>
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <StatisticsOverviewScreen />
        </WardFlowProvider>,
      ).container,
  },
  {
    name: "comparisons",
    render: () =>
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <StatisticsCompareScreen />
        </WardFlowProvider>,
      ).container,
  },
  {
    name: "one ward",
    render: () =>
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <StatisticsWardScreen unitId={UNIT.id} />
        </WardFlowProvider>,
      ).container,
  },
  {
    name: "one emergency department",
    render: () =>
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <StatisticsEdScreen edId={ED.id} />
        </WardFlowProvider>,
      ).container,
  },
];

describe("every statistics section is a landmark, not just a heading", () => {
  it.each(SCREENS.map((screen) => [screen.name, screen] as const))(
    "%s heads every section with a region a screen-reader user can jump to",
    (_name, subject) => {
      const container = subject.render();
      const headings = headingsOutsideTheFootnote(container);

      // 🔴 THE FLOOR IS ON THE DENOMINATOR. A screen that rendered nothing, or whose sections lost
      // their headings, would satisfy the assertion below over an empty set and report green.
      expect(headings.length, `${_name} renders no section heading at all outside its footnote`).toBeGreaterThanOrEqual(
        2,
      );

      const named = new Set(landmarkNames(container));
      const unnamed = headings.filter((heading) => !named.has(heading));
      expect(
        unnamed,
        `on ${_name} these sections have a heading but no landmark of that name, so a screen-reader ` +
          `user can ` +
          `neither list them nor jump between them: ${unnamed.join(" | ")}`,
      ).toEqual([]);
    },
  );
});
