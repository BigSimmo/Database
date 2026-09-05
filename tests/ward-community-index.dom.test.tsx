import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { expectSays } from "./helpers/ward-caption";

// Same reason as every sibling dom suite: `ClinicalRail` renders next/link anchors, and jsdom
// cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CommunityIndex } from "@/components/ward-management/community/community-index";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE COMMUNITY TEAM INDEX, JUDGED FROM THE RENDERED DOM RATHER THAN FROM SOURCE TEXT.
 *
 * `tests/ward-community-index.test.ts` proves the markup the index emits. This file proves the two
 * things only a live tree can testify to:
 *
 *  1. **That the index itself is reachable**, which outranks everything else in this task. An index
 *     that links every derived team and that nothing links to leaves every one of them exactly as
 *     reachable as they were — while every scan and count starts reporting them healthy, which is
 *     strictly worse than the honest "none of them are reachable" it replaces. Reachability is
 *     transitive. Tests are not.
 *  2. **That each team link is not inert.** A link inside a `hidden` ancestor, an `aria-hidden`
 *     subtree or a closed `<details>` is in the DOM, passes every markup scan, and cannot be reached
 *     by a person — which is the same class of defect this whole page exists to fix.
 *
 * ⚠️ **THE LIMIT OF THIS FILE, WRITTEN DOWN SO THE NEXT READER DOES NOT ASSUME IT WAS COVERED.**
 * jsdom does not apply the CSS module, so nothing here can testify about `display: none`,
 * `visibility: hidden`, zero height, or a link sitting under an overlay. Ward Flow has already
 * shipped exactly that defect once — the rail's bottom block overlapped its last links and
 * swallowed their clicks while every link stayed in the DOM and the whole unit suite stayed green.
 * Only a browser journey can close that, and no assertion below should be read as having closed it.
 */

const TEAM_ROUTE_PREFIX = "/mockups/ward-flow/community";

/** The index route itself — the thing the root nav names, checked below. */
const INDEX_ROUTE = "/mockups/ward-flow/community";

function renderInProvider(node: ReactNode) {
  return render(<WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>);
}

/**
 * The index's own `<main>`, rendered fresh for the caller.
 *
 * Rendered inside each test rather than once per `describe`: Testing Library's automatic cleanup
 * unmounts after every test, so a tree built at describe scope is live for the first assertion and
 * an empty container for the rest — which reads as "the page renders nothing" and would be believed.
 */
function renderIndexMain(teams?: readonly { id: string; name: string }[]): HTMLElement {
  const { container } = renderInProvider(<CommunityIndex teams={teams} />);
  const main = container.querySelector<HTMLElement>("main#main-content");
  expect(main, 'the index rendered no <main id="main-content"> to scope to').not.toBeNull();
  return main as HTMLElement;
}

/** The index's own team links inside that region. The rail mounts in the same tree and carries its
 *  own seeded links; scoping to the `<main>` ELEMENT excludes them by containment rather than by
 *  document order, which is what survives somebody reordering the component later. */
function teamLinksIn(main: HTMLElement): HTMLAnchorElement[] {
  return [...main.querySelectorAll<HTMLAnchorElement>("a[data-testid='community-index-link']")];
}

/**
 * Every href the ward-flow root rail renders, collected ONCE, here, outside any test body.
 *
 * It was extracted out here while the assertion below was an `it.fails`, because an `it.fails`
 * passes for any failure inside it — a render that threw included — and a broken rail had to fail
 * this file loudly at collection rather than be absorbed by the inverted verdict. The assertion is
 * an ordinary one now, so that reason has expired; the extraction stays because it is still the
 * right shape: the rail is rendered once for a fact about the rail, not once per assertion.
 */
const railHrefs: string[] = (() => {
  const { container } = renderInProvider(<ClinicalRail />);
  return [...container.querySelectorAll("a[href]")].map((anchor) => anchor.getAttribute("href") ?? "");
})();

describe("The community index's OWN reachability — the assertion that outranks the rest of this file", () => {
  /**
   * AN ORDINARY GUARD, AND IT WAS AN `it.fails` TRIPWIRE UNTIL 2026-09-01.
   *
   * The assertion never changed. While `ward-nav.ts` carried no entry for this index the modifier
   * inverted the verdict, so the suite stayed green for exactly as long as the index was
   * unreachable and went RED the moment the nav entry landed. That red was the notification the
   * tripwire existed to send, not a regression, and the response it asked for was to delete the
   * `.fails` — which is what happened here. **The response is never to re-add it.**
   *
   * What it guards now is the thing that outranks everything else in this file: an index that links
   * every derived team and that nothing links to leaves every one of those teams exactly as
   * reachable as they were, while every scan and count starts reporting them healthy. Reachability
   * is transitive; a page that is not itself reachable confers none of it. So this fails if the
   * `community` entry is ever removed from `WARD_NAV` or its href drifts from the route on disk.
   *
   * ONE assertion in this body and nothing else, which was the discipline the inverted verdict
   * required and is worth keeping: the rail is rendered at collection above, so a rail that throws
   * fails this file loudly rather than passing here for the wrong reason.
   */
  it("is linked from the ward-flow root rail", () => {
    expect(railHrefs, "the root rail does not link the community team index").toContain(INDEX_ROUTE);
  });
});

describe("Community team index — the links a person can actually reach", () => {
  it("links exactly the derived teams, once each, with every segment decoding back to its id", () => {
    const anchors = teamLinksIn(renderIndexMain());
    expect(anchors.length, "the index rendered no team links at all").toBeGreaterThan(0);

    const ids = anchors.map((anchor) => {
      const href = anchor.getAttribute("href") ?? "";
      expect(href.startsWith(`${TEAM_ROUTE_PREFIX}/`), `"${href}" is not a community team route`).toBe(true);
      return decodeURIComponent(href.slice(TEAM_ROUTE_PREFIX.length + 1));
    });
    const expected = COMMUNITY_TEAM_PAGES.map((team) => team.id);

    expect(expected.length, "the team fixture is empty — nothing below this line proves anything").toBeGreaterThan(1);
    expect(ids.length, "the index did not render exactly one link per team").toBe(expected.length);
    expect(new Set(ids).size, "a team is linked more than once").toBe(ids.length);
    expect([...ids].sort()).toEqual([...expected].sort());
  });

  it("renders no link inside a hidden, aria-hidden, inert or collapsed ancestor", () => {
    const anchors = teamLinksIn(renderIndexMain());
    expect(anchors.length, "the index rendered no team links at all").toBeGreaterThan(0);

    // Every one of these keeps a link in the DOM and takes it away from a person, so a markup scan
    // reports full coverage while the page delivers none of it.
    for (const anchor of anchors) {
      for (let node: HTMLElement | null = anchor; node !== null; node = node.parentElement) {
        expect(node.hasAttribute("hidden"), `a link sits inside a hidden ${node.tagName}`).toBe(false);
        expect(node.getAttribute("aria-hidden"), `a link sits inside an aria-hidden ${node.tagName}`).not.toBe("true");
        expect(node.hasAttribute("inert"), `a link sits inside an inert ${node.tagName}`).toBe(false);
        if (node.tagName === "DETAILS") {
          expect(node.hasAttribute("open"), "a link sits inside a closed <details>").toBe(true);
        }
      }
    }
  });
});

describe("Community team index — the empty state, driven by an injected list", () => {
  // An override rather than a mutated fixture: the derived source cannot produce an empty list, and
  // a test that edited the fixture to reach this state would be testing the edit.

  it("says the list is empty and what an empty list here does and does not mean", () => {
    const main = renderIndexMain([]);
    expect(main.textContent).toContain("This list is empty.");
    expectSays(main.textContent ?? "", "the empty community index", ["returned no teams", "no teams"]);
    expectSays(main.textContent ?? "", "the empty community index", ["does not mean"]);
  });

  it("renders zero team links — asserted alongside the sentence, never instead of it", () => {
    const main = renderIndexMain([]);

    // Zero links is also what a crashed render produces, so it is only evidence once the page has
    // been shown to be the page. The empty-state sentence and the heading here are that showing.
    expect(teamLinksIn(main).length).toBe(0);
    expect(main.textContent, "the page rendered no empty-state notice").toContain("This list is empty.");
    expect(main.textContent, "the page rendered no section — it did not render an empty state").toContain(
      "Community teams",
    );
  });
});
