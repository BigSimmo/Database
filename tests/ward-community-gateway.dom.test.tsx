// tests/ward-community-gateway.dom.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { expectSays } from "./helpers/ward-caption";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CommunityIndex } from "@/components/ward-management/community/community-index";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import {
  communityNameCollisions,
  type CommunityNameCollision,
} from "@/components/ward-management/community/community-vocabulary";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE COMMUNITY GATEWAY (redesign v1) — guarded on the CLAIM and the CLINICAL PROPERTY, never on
 * rendering. The owner is redesigning many Ward Flow pages; a guard that goes red on a legitimate
 * restyle gets deleted, and an honest guard sitting beside it goes with it. So nothing below pins a
 * class name, a whole sentence, spacing, colour, DOM shape, or a positional index.
 *
 * ⚠️ **THE PROPERTY THAT ACTUALLY MATTERS: THIS PAGE COMPUTES NO "READS ALIKE" GROUPING OF ITS
 * OWN.** `community-vocabulary.ts`'s `communityNameCollisions()` is the one derivation the owner has
 * ruled must feed every surface — two independent implementations of "do these names read alike"
 * have already produced two separate live bugs neither a count nor a class name would have caught.
 * Every expectation below is therefore built from that same function, one layer under the page, the
 * same discipline `tests/ward-community-near-duplicate-warning.dom.test.tsx` already holds
 * `community-screen.tsx`'s per-team warning to. If a future edit here recomputed collisions locally
 * instead of reading the shared function, this file's own expectations would move with the
 * component and every assertion would silently keep passing — which is exactly why the sibling
 * suite's own comment calls that shape "not pedantry".
 *
 * ⚠️ **THE POPULATION IS FLOORED, NOT THE FINDINGS.** The very first test below asserts the walked
 * list is non-empty and that BOTH a marked and an unmarked team exist, before anything else in this
 * file is trusted — a seed with no collisions, or with nothing but collisions, would make the
 * biconditional test pass vacuously over an empty side.
 */

const TEAM_ROUTE_PREFIX = "/mockups/ward-flow/community/";

function renderGateway() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CommunityIndex />
    </WardFlowProvider>,
  );
}

/** The shared derivation, indexed by name — read fresh in every test rather than cached at module
 *  scope, so a test can never accidentally compare the page against a stale snapshot of itself. */
function collisionByName(): Map<string, CommunityNameCollision> {
  const map = new Map<string, CommunityNameCollision>();
  for (const collision of communityNameCollisions()) {
    for (const entry of collision.names) map.set(entry.name, collision);
  }
  return map;
}

function idFromHref(href: string | null): string {
  expect(href, "a team link has no href at all").not.toBeNull();
  expect(href?.startsWith(TEAM_ROUTE_PREFIX), `"${href}" is not a community team route`).toBe(true);
  return decodeURIComponent((href as string).slice(TEAM_ROUTE_PREFIX.length));
}

describe("Community gateway — the floor this whole file stands on", () => {
  it("has team pages to walk, and both a marked and an unmarked team exist among them", () => {
    expect(COMMUNITY_TEAM_PAGES.length, "there are no community team pages to walk").toBeGreaterThan(40);

    const collisions = collisionByName();
    const marked = COMMUNITY_TEAM_PAGES.filter((team) => collisions.has(team.name));
    const unmarked = COMMUNITY_TEAM_PAGES.filter((team) => !collisions.has(team.name));

    expect(
      marked.length,
      "no team's name collides with another — the marker side of every test below is vacuous",
    ).toBeGreaterThan(3);
    expect(
      unmarked.length,
      "every team's name collides with another — the unmarked side of every test below is vacuous",
    ).toBeGreaterThan(10);
  });
});

describe("Community gateway — every derived team is reachable, exactly once", () => {
  it("links every team COMMUNITY_TEAM_PAGES names, with no team missing and none doubled", () => {
    renderGateway();
    const anchors = screen.getAllByTestId("community-index-link");
    expect(anchors.length, "the gateway rendered no team links at all").toBeGreaterThan(0);

    const ids = anchors.map((anchor) => idFromHref(anchor.getAttribute("href")));
    const expected = COMMUNITY_TEAM_PAGES.map((team) => team.id);

    expect(new Set(ids).size, "a team is linked more than once").toBe(ids.length);
    expect([...ids].sort()).toEqual([...expected].sort());
  });
});

describe("Community gateway — the reads-alike marker, exactly where the shared derivation says", () => {
  it("marks a team's row when its name collides and only when its name collides", () => {
    renderGateway();
    const collisions = collisionByName();
    const anchors = screen.getAllByTestId("community-index-link");
    expect(anchors.length).toBeGreaterThan(0);

    const missing: string[] = [];
    const spurious: string[] = [];

    for (const anchor of anchors) {
      const row = anchor.closest("li");
      expect(row, "a team link does not sit inside a row").not.toBeNull();
      const name = (anchor.textContent ?? "").trim();
      const hasMarker = row!.querySelector('[data-testid="community-gateway-reads-alike"]') !== null;
      const shouldHaveMarker = collisions.has(name);
      if (shouldHaveMarker && !hasMarker) missing.push(name);
      if (!shouldHaveMarker && hasMarker) spurious.push(name);
    }

    expect(missing, "these teams DO collide by the shared derivation but their row carries no marker").toEqual([]);
    expect(
      spurious,
      "these teams do NOT collide by the shared derivation but their row carries a marker anyway",
    ).toEqual([]);
  });

  it("never phrases the marker as identity, and always asks the reader to check rather than assume", () => {
    renderGateway();
    const markers = screen.getAllByTestId("community-gateway-reads-alike");
    expect(
      markers.length,
      "no marker rendered at all — the floor test above says some team must collide",
    ).toBeGreaterThan(0);

    const forbidden = [/did you mean/i, /\bsame team\b/i, /\bsame service\b/i, /duplicate of/i, /\bmerg(e|ed|ing)\b/i];
    for (const marker of markers) {
      const text = marker.textContent ?? "";
      for (const pattern of forbidden) {
        expect(text, `marker text "${text}" uses merge-implying language`).not.toMatch(pattern);
      }
      expectSays(text.toLowerCase(), "the near-duplicate warning", ["the right one", "right team"]);
    }
  });

  it("renders the marker as a real <button>, a sibling of the row link rather than nested inside it", () => {
    renderGateway();
    const markers = screen.getAllByTestId("community-gateway-reads-alike");
    expect(markers.length).toBeGreaterThan(0);
    for (const marker of markers) {
      expect(marker.tagName).toBe("BUTTON");
      expect(marker.getAttribute("type")).toBe("button");
      expect(marker.closest("a"), "a reads-alike marker sits inside an anchor").toBeNull();
    }
  });
});

describe("Community gateway — an unmarked name is stated, in words, as no guarantee of uniqueness", () => {
  it("says on the page that a name without the marker may still not be unique", () => {
    renderGateway();
    const main = screen.getByRole("main").textContent ?? "";
    expect(main).toContain("not a guarantee");
    expect(main.toLowerCase()).toContain("appears only once");
    // The rule the page states is never that a name IS unique absent a marker, so the same page
    // must not also claim the marker's absence proves uniqueness anywhere else on it.
    expect(main.toLowerCase()).not.toContain("guarantees it is unique");
  });
});

describe("Community gateway — live search narrows to exactly the matching set", () => {
  it("shows exactly the teams whose name contains the typed text, live, with a truthful visible count", () => {
    renderGateway();
    const sampleWord = COMMUNITY_TEAM_PAGES[0].name.split(" ")[0].toLowerCase();
    const expectedNames = COMMUNITY_TEAM_PAGES.filter((team) => team.name.toLowerCase().includes(sampleWord)).map(
      (team) => team.name,
    );
    expect(expectedNames.length, "the sampled search term matches nothing — this test proves nothing").toBeGreaterThan(
      0,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Search team names" }), { target: { value: sampleWord } });

    const anchors = screen.getAllByTestId("community-index-link");
    const shownNames = anchors.map((anchor) => (anchor.textContent ?? "").trim());
    expect([...shownNames].sort()).toEqual([...expectedNames].sort());

    const resultLine = screen.getByTestId("community-gateway-result-line");
    expect(resultLine.textContent ?? "").toContain(String(expectedNames.length));
  });

  it("narrows further to only colliding names when the reads-alike filter is also on", () => {
    renderGateway();
    fireEvent.click(screen.getByRole("button", { name: /Names that read alike/ }));

    const collisions = collisionByName();
    const anchors = screen.getAllByTestId("community-index-link");
    expect(
      anchors.length,
      "the reads-alike filter left nothing visible — the floor test says some team must collide",
    ).toBeGreaterThan(0);
    for (const anchor of anchors) {
      const name = (anchor.textContent ?? "").trim();
      expect(collisions.has(name), `"${name}" is shown under the reads-alike filter but does not collide`).toBe(true);
    }
  });
});

describe("Community gateway — the letter jump rail", () => {
  it("moves focus to a present letter's own heading, and disables an absent letter with a spoken reason", () => {
    renderGateway();
    const presentLetters = new Set(COMMUNITY_TEAM_PAGES.map((team) => team.name.charAt(0).toUpperCase()));
    const [enabledLetter] = [...presentLetters];
    expect(enabledLetter, "no letter is present at all").toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: enabledLetter }));
    const heading = screen.getByRole("heading", { level: 3, name: enabledLetter });
    expect(document.activeElement).toBe(heading);

    const missingLetter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((letter) => !presentLetters.has(letter));
    if (missingLetter) {
      const disabledButton = screen.getByRole("button", { name: `No team starts with ${missingLetter}` });
      expect(disabledButton).toBeDisabled();
    }
  });
});

describe("Community gateway — the family panel lists exactly the shared derivation's collisions", () => {
  it("links every colliding name once in the family panel, and no non-colliding name at all", () => {
    renderGateway();
    const collisions = communityNameCollisions();
    const expectedNames = collisions.flatMap((family) => family.names.map((entry) => entry.name));
    expect(expectedNames.length, "the shared derivation found no collisions to compare").toBeGreaterThan(3);

    const familyLinks = screen.getAllByTestId("community-gateway-family-link");
    const familyNames = familyLinks.map((link) => (link.textContent ?? "").trim());

    expect([...familyNames].sort()).toEqual([...expectedNames].sort());
  });
});

describe("Community gateway — accessible plumbing the brief specifically asks for", () => {
  it('focuses the search field when "/" is pressed anywhere on the page', () => {
    renderGateway();
    const input = screen.getByRole("searchbox", { name: "Search team names" });
    fireEvent.keyDown(document, { key: "/" });
    expect(document.activeElement).toBe(input);
  });

  it("marks the result line as a polite live region", () => {
    renderGateway();
    expect(screen.getByTestId("community-gateway-result-line")).toHaveAttribute("aria-live", "polite");
  });

  it("gives every letter heading a real level-3 heading role with tabindex -1", () => {
    renderGateway();
    const headings = screen.getAllByRole("heading", { level: 3 });
    const letterHeadings = headings.filter((heading) => /^[A-Z]$/.test((heading.textContent ?? "").trim()));
    expect(letterHeadings.length).toBeGreaterThan(0);
    for (const heading of letterHeadings) {
      expect(heading).toHaveAttribute("tabindex", "-1");
    }
  });
});

describe("Community gateway — a way in, not a caseload: no row carries anything but the team's name", () => {
  /**
   * ⚠️ THIS GUARD EXISTS BECAUSE THE PROPERTY WAS COMPLETELY UNGUARDED AND THREE RED TESTS SAID
   * OTHERWISE.
   *
   * The page states, in the owner's own recorded constraint, that it is "a way in, not a caseload —
   * no counts of people, no discharges and nothing about who a team is following up". On 2026-09-05
   * a fabricated `— 7 patients currently open` was rendered on every one of the 65 rows, twice:
   *
   *   INSIDE the team's link   -> 3 assertions went red, and NOT ONE of them was about caseloads.
   *                               They read a team's name out of the link's `textContent`, so the
   *                               injected words corrupted the NAME and were reported as
   *                               collision-marker errors. Three reds that look exactly like
   *                               coverage and are not.
   *   OUTSIDE the link         -> 69 tests across SIX files passed. The mutant survived.
   *
   * So the only thing standing between this page and a fabricated caseload figure was where the
   * text happened to be nested. Move it one element sideways and nothing in the repository noticed.
   *
   * The assertion below is therefore about the WHOLE ROW rather than about any wording: strip the
   * reads-alike marker's own text, and what remains must be the team's name and nothing else. That
   * catches a caseload count, a discharge figure, a follow-up status, a stray date — anything
   * smuggled onto a row — without pinning a class, a sentence or a DOM shape, so a restyle cannot
   * make it go red.
   */
  it("renders the team's name and the marker, and nothing else, on every row", () => {
    renderGateway();
    const links = screen.getAllByTestId("community-index-link");
    expect(links.length, "no team rows rendered — this guard would be vacuous").toBeGreaterThan(0);

    let rowsChecked = 0;
    for (const link of links) {
      const row = link.closest("li");
      expect(row, "a team link is not inside a row element").not.toBeNull();
      if (row === null) continue;

      // The marker is a real button and legitimately carries its own words ("reads like N others").
      // Everything else on the row must be the name.
      const markerText = Array.from(row.querySelectorAll("button"))
        .map((button) => button.textContent ?? "")
        .join("");
      const rowText = (row.textContent ?? "").replace(markerText, "");
      const name = (link.textContent ?? "").trim();

      expect(
        rowText.replace(/\s+/gu, " ").trim(),
        `the row for "${name}" carries text beyond the team's name and the reads-alike marker. ` +
          `This page is a way in, not a caseload: no counts of people, no discharges, nothing about ` +
          `who a team is following up.`,
      ).toBe(name.replace(/\s+/gu, " ").trim());
      rowsChecked += 1;
    }
    expect(rowsChecked, "no row was actually inspected").toBeGreaterThan(0);
  });

  it("renders no digit anywhere in the team list except inside a reads-alike marker", () => {
    /*
     * The second direction, and the cheaper one to reason about: a caseload figure is a NUMBER.
     * The only numbers this list may legitimately show are the marker's own group sizes, which sit
     * inside a button. A digit anywhere else in the list is a figure about people, and there is no
     * figure about people this page is allowed to hold.
     */
    renderGateway();
    const links = screen.getAllByTestId("community-index-link");
    expect(links.length, "no team rows rendered — this guard would be vacuous").toBeGreaterThan(0);
    for (const link of links) {
      const row = link.closest("li");
      if (row === null) continue;
      for (const button of Array.from(row.querySelectorAll("button"))) button.remove();
      expect(
        row.textContent ?? "",
        `a digit appears on the row for "${link.textContent}" outside the reads-alike marker`,
      ).not.toMatch(/\d/u);
    }
  });
});
