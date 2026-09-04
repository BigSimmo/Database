import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * THE COMMUNITY TEAM COUNT — CHECKED AGAINST ITS OWN SOURCE, NEVER AGAINST A TYPED-IN NUMBER.
 *
 * The community index page (`community-index.tsx`) renders one link per community mental health
 * team, and today that is 65 links. `tests/ward-community-index.test.ts` deliberately does not pin
 * that number — its own comment explains why: "sixty-five" was once written into two files' prose,
 * a seed edit made both claims false, and nothing went red. That comment also says the exact-size
 * pin belongs in the fixture's own suite, and names `tests/ward-community-hub.test.ts` as the
 * intended home — but that file is held by another change right now, so this is a NEW file rather
 * than an edit to an existing one (per this task's instructions), covering the same ground: the
 * rendered count checked against a count DERIVED from source, so the two move together.
 *
 * ⚠️ **WHY NOT `expect(count).toBe(65)`.** The owner has said he is likely to add or remove teams
 * soon. A hardcoded 65 breaks the moment he does, and whoever hits that failure "fixes" it by
 * typing in the new number — which turns the assertion into one that can never catch a real defect,
 * exactly the class of check this project exists to root out (see `statistics-derivations.ts`'s own
 * record of a paragraph that falsified itself silently four times). So the expectation below is
 * computed from `S2015_CATCHMENT_ROWS` — the extracted source table `communityTeamOptions()` reads
 * — every time this test runs, not typed as a literal.
 *
 * ⚠️ **THE DERIVATION IS DELIBERATELY NOT A CALL TO `communityTeamOptions()`.**
 * `COMMUNITY_TEAM_PAGES` (what the page renders) is a straight `.map()` over
 * `communityTeamOptions()`, so if a truncation happened INSIDE that function — a stray `.slice()`,
 * a dropped-singleton filter — both the page and an expectation computed by calling that same
 * function would shrink together and this test would stay green while the screen showed a wrong
 * number. `tests/ward-community-hub.test.ts` already found and fixed exactly this failure mode
 * (its own comment calls it "finding 9.7 / 13.4": a table trimmed from 65 clinics to 3, or to 43,
 * left its now-superseded same-function comparison green both times). So this file re-derives the
 * count independently, straight from `S2015_CATCHMENT_ROWS`, with its own normalisation — a second,
 * deliberately separate implementation of the same idea as the production `communityTeamKey`
 * (unexported, so it cannot be called from here even by accident).
 *
 * ⚠️ **THE FLOOR GUARD, AND WHY IT IS NOT OPTIONAL.** Even with an independent derivation, the
 * derivation and the render still ultimately read the same upstream fact: `S2015_CATCHMENT_ROWS`.
 * If that source collapsed to empty — a broken import, a bad filter applied upstream, a data file
 * that failed to load — the independently-derived expectation would ALSO collapse to 0, the render
 * would ALSO show 0, and `expect(renderedCount).toBe(expectedCount)` would pass on 0 === 0. "They
 * match" is true and completely useless in that case. The floor guard below is what makes that
 * impossible: it asserts the derived expectation is comfortably above what any plausible accidental
 * collapse would produce, BEFORE the equality check ever runs, so a collapse — to 0, or to some
 * small wrong number like 3 — fails loudly on the floor rather than silently agreeing with itself.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));

const router = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { CommunityIndex } from "@/components/ward-management/community/community-index";
import { S2015_CATCHMENT_ROWS, parseFollowUpClinicSet } from "@/components/ward-management/ward-catchment";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Same normalisation rule as production `communityTeamKey` in `referral-destination-options.ts`
 * (case, whitespace and punctuation folded to one space) — written out again here rather than
 * imported, because it is unexported and because the whole point of this derivation is that it
 * cannot be moved by editing that file's internals.
 */
function normalizeClinicName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Every distinct (normalised) community team name the raw source table names, computed fresh from
 *  `S2015_CATCHMENT_ROWS` — never from `communityTeamOptions()` or `COMMUNITY_TEAM_PAGES`. */
function expectedCommunityTeamCount(): number {
  const rawClinicNames = new Set<string>();
  for (const row of S2015_CATCHMENT_ROWS) {
    for (const clinic of parseFollowUpClinicSet(row.followUpClinicVerbatim)) {
      if (clinic.trim() !== "") rawClinicNames.add(clinic);
    }
  }
  return new Set([...rawClinicNames].map(normalizeClinicName)).size;
}

/** Renders the real community index page — the screen that shows one link per community team —
 *  through the same SSR-string pattern `tests/ward-community-index.test.ts` uses, and for the same
 *  reason: this is a `.test.ts` file, so it collects under the "node" vitest project rather than
 *  jsdom, and `renderToStaticMarkup` needs no `document`. */
function renderCommunityIndex(): string {
  const children = createElement(CommunityIndex);
  // eslint-disable-next-line react/no-children-prop -- WardFlowProviderProps requires `children`
  return renderToStaticMarkup(createElement(WardFlowProvider, { initialNow: NOW_ANCHOR, children }));
}

/** How many team links the page actually rendered, read off the markup by the same testid the page
 *  itself carries — this is "the number on screen", not a re-derivation of it. */
function renderedTeamLinkCount(markup: string): number {
  return (markup.match(/data-testid="community-index-link"/g) ?? []).length;
}

describe("Community team count — the number on screen, checked against its own source", () => {
  const expectedCount = expectedCommunityTeamCount();

  it("the source table names comfortably more teams than a silent collapse could produce by accident", () => {
    // Floor, not an exact pin, and run BEFORE the equality check below. 30 is comfortably below
    // today's real count (65, confirmed by running communityTeamOptions().length directly against
    // this checkout) but well above what a bad filter, an off-by-most-of-the-list slice, or an
    // empty data load would plausibly leave behind. Without this, a source collapsed to 0 — or to
    // 3, the exact scenario this task was written to guard against — would make the equality
    // assertion below pass on "0 === 0" or "3 === 3": both sides would have collapsed together, and
    // "they match" would be true and useless. This line is what makes that impossible.
    expect(
      expectedCount,
      "the source table's derived team count dropped to a level a silent collapse could produce — " +
        "check S2015_CATCHMENT_ROWS and parseFollowUpClinicSet before trusting anything below",
    ).toBeGreaterThan(30);
  });

  it("renders exactly one team link per team the source table names — the page's count moves with the source", () => {
    const markup = renderCommunityIndex();
    const renderedCount = renderedTeamLinkCount(markup);

    // Derived expectation, not a literal: if the owner adds or removes a team from the source
    // table, expectedCount moves with it on the next run and this assertion keeps meaning the same
    // thing. A hardcoded `toBe(65)` would break on that edit and invite exactly the "fix" — typing
    // in the new number — that turns a check into one that can never fail again.
    expect(
      renderedCount,
      "the community index rendered a different number of team links than the source table names — " +
        "either a team was silently dropped between the source and the page, or the derivation above " +
        "no longer matches what the page reads",
    ).toBe(expectedCount);
  });
});
