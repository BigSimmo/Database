import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CommunityIndex } from "@/components/ward-management/community/community-index";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

/**
 * 🔴 **THE CLAIMS THE TWO LIVE COMMUNITY SCREENS MAKE, PINNED BEFORE THEIR MARKUP IS TOUCHED.**
 *
 * Ward Lead's ruling on the second-edition adoption: **port prose first, markup second.** This file
 * is the first half. The two screens are about to be redesigned, and a redesign is exactly the kind
 * of change that drops a sentence while every existing test stays green.
 *
 * ⚠️ **MEASURED BEFORE IT WAS WRITTEN, AND THE FIGURE IS WHY IT EXISTS.** Every rendered sentence
 * of eight words or more on both components was extracted and searched for across all 1,224 test
 * files (14.5 million characters): **12 of 44 were pinned by any test. Thirty-two were not** —
 * including "no team has agreed to be represented", which is a governance claim carried by BOTH
 * screens and asserted by neither.
 *
 * ⚠️ **AND A TESTID IS NOT A PIN, WHICH IS THE TRAP THAT MAKES THIS LOOK COVERED.** Nine of the
 * thirty testids on these two components are referenced by no test at all, and a reviewer counting
 * `data-testid` attributes would read the pair as thoroughly guarded. Those attributes cost nothing
 * to keep and protect nothing.
 *
 * ⚠️ **THIS PINS CLAIMS, NOT WORDING, AND THE DIFFERENCE IS DELIBERATE.** Pinning whole sentences
 * would make an honest rewording go red — this project has already been caught with guards that
 * three rephrasings restored to green, and the mirror of that is a guard that forbids improving a
 * sentence. So each entry below is **the shortest clause that cannot still be present if the claim
 * has been dropped**. Reword the sentence around it freely; delete the claim and this goes red.
 *
 * The clauses are grouped by what they protect rather than by which element carries them, because
 * an element can move in a redesign and a claim may not.
 */

const TEAM = COMMUNITY_TEAM_PAGES[0];

function renderIndex(teams = COMMUNITY_TEAM_PAGES) {
  return render(
    <WardFlowProvider>
      <CommunityIndex teams={teams} />
    </WardFlowProvider>,
  );
}

function renderTeam() {
  return render(
    <WardFlowProvider>
      <CommunityScreen teamId={TEAM.id} />
    </WardFlowProvider>,
  );
}

/** The whole page's text, normalised, so a claim split across `<strong>` boundaries still matches. */
function pageText(): string {
  return (document.body.textContent ?? "").replace(/\s+/gu, " ");
}

const INDEX_CLAIMS = [
  {
    protects: "that the team names are a source document, not a roster anybody agreed to",
    clause: "no team has agreed to be represented",
  },
  {
    protects: "that nothing here was checked against a real service",
    clause: "has been checked against a real service",
  },
  {
    protects: "that the flat list is the record's limit, not a layout choice",
    clause: "would be one this prototype invented",
  },
  {
    protects: "that this page is a way in and not a caseload",
    clause: "no counts of people, no discharges",
  },
];

const TEAM_CLAIMS = [
  {
    protects: "that the team names are a source document, not a roster anybody agreed to",
    clause: "no team has agreed to be represented here",
  },
  {
    protects: "that the names are not a roster of real services",
    clause: "not a roster of Western Australian community services",
  },
  {
    protects: "that membership comes from the referral, and from nothing else",
    clause: "only because a referral NAMED this team",
  },
  {
    protects: "that most of the ward is on no team page at all",
    clause: "is on no team's page anywhere",
  },
  {
    /*
     * 🔴 The most dangerous sentence on the screen to lose. An empty follow-up list under a heading
     * about follow-up asserts that everybody discharged to this team is being followed up, and
     * nothing else in Ward Flow could contradict it.
     */
    protects: "that an empty follow-up list is not a statement that follow-up happened",
    clause: "must never be read that way",
  },
  {
    protects: "that the follow-up field exists and nothing reads it",
    clause: "no screen or figure reads it",
  },
  {
    protects: "that a refusal never removes somebody from this page",
    clause: "a decline locks nobody out",
  },
  {
    protects: "the owner's 2026-08-31 ruling that home region is not membership",
    clause: "Where the person lives is not read at all",
  },
  {
    protects: "that referrals raised BY a team cannot be attributed",
    clause: "cannot be attributed",
  },
];

describe("the claims the live community screens make", () => {
  /**
   * ⚠️ **THE FLOOR FIRST, AND ON BOTH SCREENS.** Every assertion below is "this text is present". A
   * component that rendered nothing — or that threw and left an empty body — satisfies none of them
   * for a reason no message would explain, and one that rendered a not-found state would fail them
   * all at once with nine confusing messages instead of one clear one.
   */
  it("renders both screens with substantial content before any claim is asserted", () => {
    renderIndex();
    expect(pageText().length, "the index rendered almost nothing").toBeGreaterThan(400);
    document.body.innerHTML = "";
    renderTeam();
    expect(pageText().length, "the team screen rendered almost nothing").toBeGreaterThan(1000);
    expect(screen.queryByTestId("ward-community-screen"), "the team screen is not on the page").not.toBeNull();
  });

  it.each(INDEX_CLAIMS)("the index states $protects", ({ clause }) => {
    renderIndex();
    expect(pageText(), `the community index no longer states this: "${clause}"`).toContain(clause);
  });

  it.each(TEAM_CLAIMS)("a team page states $protects", ({ clause }) => {
    renderTeam();
    expect(pageText(), `the community team page no longer states this: "${clause}"`).toContain(clause);
  });

  /**
   * ⚠️ **THE EMPTY STATE IS A SEPARATE RENDER AND ITS CLAIM IS THE ONE MOST LIKELY TO BE LOST**,
   * because a redesign that replaces a list rarely reproduces the wording of the case where the list
   * has nothing in it. A blank list looks exactly like a loaded page for a service with no teams,
   * and nobody re-checks a blank.
   */
  it("says which kind of empty an empty list is", () => {
    renderIndex([]);
    const text = pageText();
    expect(text, "the empty index no longer says the derivation returned nothing").toContain(
      "that derivation returned no teams",
    );
    expect(text, "the empty index no longer distinguishes finding nothing from having nothing").toContain(
      "not as a service that has nothing",
    );
  });
});
