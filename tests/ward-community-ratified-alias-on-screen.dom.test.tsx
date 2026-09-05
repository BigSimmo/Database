import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { RATIFIED_SERVICE_ALIASES } from "@/components/ward-management/community/community-ratified-aliases";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

/**
 * 🔴 **THE OWNER'S RULING WAS RECORDED, GUARDED, MUTATION-PROVED — AND RENDERED NOWHERE FOR HOURS.
 * THIS IS THE GUARD THAT WOULD HAVE CAUGHT THAT.**
 *
 * On 2026-09-05 the owner ruled that four spellings of the Inner City team are one service. The
 * table landed with seven guards over it. **Not one of them asked whether any component imported
 * it**, so a reader on the `ICC` page saw nothing at all — **precisely the gap the ruling was made
 * to close** — and a reader on `Inner City` saw `Inner City Clinic` described as a near-duplicate
 * SPELLING when a person had ruled it the same SERVICE.
 *
 * ⚠️ **BOTH HALVES WERE INDIVIDUALLY CORRECT. THE COMBINATION WAS SILENT.** Same shape as the
 * `WF-008` patient-status defect found the same night: two faithfully-merged screens whose
 * combination started saying something false. **A guard over a record is not a guard over what a
 * reader sees.**
 *
 * ⚠️ **THE EXPECTATION IS BUILT FROM `RATIFIED_SERVICE_ALIASES` DIRECTLY, NOT FROM
 * `ratifiedSameServiceNames` — the function the page calls.** Deriving it from the page's own
 * helper is the tautology this project measured twice today: the expectation moves with the defect
 * and the suite stays green. The table is the data; the helper is code under test.
 */

afterEach(() => {
  cleanup();
});

/** Every team named in the table, and the other members it should be shown beside. */
const RATIFIED_MEMBERS = new Map<string, readonly string[]>(
  RATIFIED_SERVICE_ALIASES.flatMap((entry) =>
    entry.members.map((member) => [member, entry.members.filter((other) => other !== member)] as const),
  ),
);

/** The entry behind each member, so a guard can read its recorded provenance rather than a phrase. */
const RATIFIED_ENTRIES = new Map(
  RATIFIED_SERVICE_ALIASES.flatMap((entry) => entry.members.map((member) => [member, entry] as const)),
);

function renderTeam(teamId: string) {
  return render(
    <WardFlowProvider>
      <CommunityScreen teamId={teamId} />
    </WardFlowProvider>,
  );
}

describe("a ratified service ruling reaches the reader", () => {
  /** ⚠️ The floor. Every assertion below quantifies over these two sets. */
  it("has ratified members, and team pages to render them on", () => {
    expect(RATIFIED_MEMBERS.size, "the alias table names no teams, so nothing below is tested").toBeGreaterThan(1);
    expect(COMMUNITY_TEAM_PAGES.length, "there are no team pages to walk").toBeGreaterThan(40);
    const pageNames = new Set(COMMUNITY_TEAM_PAGES.map((team) => team.name));
    expect(
      [...RATIFIED_MEMBERS.keys()].filter((name) => !pageNames.has(name)),
      "a ratified member has no page, so it could never be rendered anywhere",
    ).toEqual([]);
  });

  /**
   * 🔴 **THE BICONDITIONAL OVER EVERY PAGE — and the direction that was actually broken is the
   * first one.** A ruling shown nowhere is a decision made and not shown; a ruling shown where none
   * exists tells a reader a person has merged two services when nobody has.
   */
  it("shows the ruling on exactly the pages the table names", () => {
    const missing: string[] = [];
    const spurious: string[] = [];
    let walked = 0;

    for (const team of COMMUNITY_TEAM_PAGES) {
      renderTeam(team.id);
      walked += 1;
      const shown = screen.queryByTestId("ward-community-ratified-alias") !== null;
      const expected = RATIFIED_MEMBERS.has(team.name);
      if (expected && !shown) missing.push(team.name);
      if (!expected && shown) spurious.push(team.name);
      cleanup();
    }

    expect(walked, "the sweep rendered no pages").toBe(COMMUNITY_TEAM_PAGES.length);
    expect(
      missing,
      "a person has ruled these teams are one service and their pages say nothing about it — the " +
        "decision is recorded and the reader cannot see it, which is the defect this file exists for",
    ).toEqual([]);
    expect(
      spurious,
      "these pages claim a person ruled them one service with another team, and no such ruling exists",
    ).toEqual([]);
  });

  /**
   * ⚠️ **NAMING THREE OF A TEAM'S FOUR SIBLINGS READS AS COMPLETE.** The `ICC` page is the one that
   * matters: it carries no near-duplicate sentence at all, so this block is a reader's only route
   * to the other three spellings.
   */
  it("names every other member of the ruling, on every member's page", () => {
    let checked = 0;
    const wrong: string[] = [];

    for (const team of COMMUNITY_TEAM_PAGES) {
      const others = RATIFIED_MEMBERS.get(team.name);
      if (others === undefined) continue;
      renderTeam(team.id);
      checked += 1;
      const text = (screen.getByTestId("ward-community-ratified-alias").textContent ?? "").replace(/\s+/gu, " ");
      for (const other of others) {
        if (!text.includes(other)) wrong.push(`${team.name} does not name ${other}`);
      }
      /*
       * ⚠️ **THIS PINNED THE LITERAL PHRASE `"Decided by "` AND WENT RED ON AN HONEST CHANGE.**
       * The block now opens with "Recorded by" for an entry no person signed, because saying
       * "Decided by" over an agent's working note is the fabricated-signature this whole field
       * exists to prevent — so the guard was forbidding the correct fix.
       *
       * The property that survives either wording, and is stronger than the phrase was: the page
       * names WHO decided and WHEN, in the entry's own words. Reading them from the entry rather
       * than restating them here is not a tautology — the entry is the source of truth for
       * provenance and the question is whether the SCREEN carries it.
       */
      const entry = RATIFIED_ENTRIES.get(team.name);
      expect(entry, `${team.name} has members but no entry`).toBeDefined();
      if (entry !== undefined) {
        expect(text, `${team.name} does not say who decided`).toContain(entry.decidedBy);
        expect(text, `${team.name} does not say when it was decided`).toContain(entry.decidedOn);
      }
      cleanup();
    }

    expect(checked, "no ratified page was reached, so this ran over nothing").toBeGreaterThan(1);
    expect(wrong, "a ruling names some of a team's other spellings and not all of them").toEqual([]);
  });

  /**
   * 🔴 **THE AUTHORITY MUST BE LEGIBLE, AND THIS IS THE ASSERTION THAT SAYS SO.**
   *
   * A near-duplicate sentence is a string resemblance a rule computed. A ratified alias is a
   * clinical judgement a named person made. **They must not read as the same kind of claim**, and
   * `Inner City` is the page where both appear at once — so it is the page where a reader could
   * most easily mistake one for the other.
   *
   * The checkable property is not a colour or a class name, which a redesign may change honestly:
   * it is that the ruling is a SEPARATE element from the near-duplicate sentence, and that it
   * carries a decider and a date, which the computed sentence has no equivalent of.
   */
  it("keeps a person's ruling distinguishable from a computed resemblance", () => {
    const both = COMMUNITY_TEAM_PAGES.find(
      (team) => RATIFIED_MEMBERS.has(team.name) && team.name === "Inner City Clinic",
    );
    expect(both, "the page carrying both a ruling and a near-duplicate sentence has gone").toBeDefined();

    renderTeam(both!.id);
    const ruling = screen.getByTestId("ward-community-ratified-alias");
    const resemblance = screen.queryByTestId("ward-community-near-duplicate-warning");
    expect(
      resemblance,
      "this page no longer carries a near-duplicate sentence, so the contrast is untested",
    ).not.toBeNull();

    expect(
      ruling.contains(resemblance),
      "the ruling and the computed resemblance are rendered as one element, so a reader cannot tell " +
        "a person's clinical judgement from two strings that look alike",
    ).toBe(false);
    expect(
      (ruling.textContent ?? "").replace(/\s+/gu, " "),
      "the ruling does not say who decided it or when, which is the only thing distinguishing it " +
        "from a resemblance a rule computed",
    ).toMatch(/Decided by .+ on \d{4}-\d{2}-\d{2}/u);
    expect(
      (resemblance?.textContent ?? "").includes("Decided by"),
      "the computed near-duplicate sentence now claims a decider, which it has none of",
    ).toBe(false);
  });
});
