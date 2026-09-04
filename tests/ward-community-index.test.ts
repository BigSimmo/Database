import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// ⚠️ COMMENT-BLINDNESS CHECKED 2026-09-04 (see tests/ward-guard-comment-blindness.test.ts). Every
// link/heading/text assertion in this file reads `renderToStaticMarkup` output, never raw source —
// a JSX comment can never reach that string, so there is no comment-defeat surface here. Proved:
// planting a decoy `{/* <a href="…/decoy-team-id" data-testid="community-index-link"> */}` beside
// the real `<Link>` in `community-index.tsx` left every assertion in this file unchanged. The one
// `readFileSync` in this file (the closing describe block) reads `community-index.tsx`'s own doc
// comment ON PURPOSE — that is the subject under test, not a guard being fooled by one — and is
// left untouched per that exception.

/**
 * THE COMMUNITY TEAM INDEX, MEASURED FROM WHAT IT ACTUALLY RENDERS.
 *
 * Same "SSR-string component test" pattern `tests/ward-nav.test.ts` and
 * `tests/ward-landmarks.test.ts` use, for the same reason: this file is `.test.ts`, so it collects
 * under `vitest.config.mts`'s "node" project rather than jsdom, and `renderToStaticMarkup` renders
 * the real component tree to a string without needing `document`. `next/link` is mocked because
 * `ClinicalRail` renders anchors through it and there is no App Router context here.
 *
 * ⚠️ **WHY THIS FILE EXISTS AT ALL RATHER THAN AN ENTRY IN `ward-nav.test.ts`'s SOURCE SCAN.** That
 * scan proves reachability by regex-searching `src/` for concrete, literally quoted hrefs. Every
 * link this index renders is built inside a `.map()`, which that scan classifies as "built" rather
 * than "concrete" and counts as **zero**. The same is already true of `/wards`: `WardIndex` links
 * twenty-three of twenty-three wards and the scan still reads the route as unreachable, which is why
 * that route's orphan entry was rewritten to point at where the real proof lives. So this file IS
 * the proof for `community/[teamId]`, and no amount of tidying the source scan will make it
 * unnecessary.
 *
 * ⚠️ **WHAT THIS FILE DELIBERATELY DOES NOT PIN: the number of teams.** Assertions here read the
 * expectation from `COMMUNITY_TEAM_PAGES` and the page renders from `COMMUNITY_TEAM_PAGES`, so both
 * sides move together — the fixture losing a team would keep every assertion below green, and
 * correctly so. That is not a hole in this file; it is the division of
 * labour. **The fixture-size pin belongs in the fixture's own suite**
 * (`tests/ward-community-hub.test.ts`, which already pins the derivation and the slug uniqueness),
 * so that a data change fails as "the fixture changed" and never as "the index lost a team", and the
 * two failures stay tellable apart. That file is owned by another change and **the exact-size pin is
 * not in it yet** — recorded here so the gap is visible rather than assumed closed.
 *
 * What these assertions DO catch, which no count ever did: an href built wrongly. Set equality
 * against the derived ids fails the moment the page composes a URL the route cannot serve, and the
 * duplicate check fails on a team rendered twice — neither of which a fixture-size pin would notice.
 *
 * ⚠️ **THE INDEX'S OWN REACHABILITY IS NOT MEASURED HERE.** It is measured in
 * `tests/ward-community-index.dom.test.tsx`, as an `it.fails` tripwire, and it outranks everything in
 * this file: an index that links every derived team and that nothing links to leaves every one of
 * them exactly as reachable as they were, while every count starts reporting them healthy.
 *
 * ⚠️ **AND THAT IS WHY NO TEAM COUNT IS WRITTEN INTO THIS FILE'S PROSE EITHER.** Until 2026-09-01
 * this comment and the page's own doc comment both said "sixty-five". It was true, it was a
 * property of the SEED rather than of either file, and a seed edit would have falsified both with
 * nothing going red — the class `statistics-derivations.ts` records as having falsified itself
 * silently four times on one paragraph. The last block below is what stops it coming back.
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
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { COMMUNITY_TEAM_PAGES, type CommunityTeam } from "@/components/ward-management/community/community-derivations";
import { FOLLOW_UP_STATES } from "@/components/ward-management/ward-admissions";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const ROUTE_PREFIX = "/mockups/ward-flow";

/** The route the index links into, as one string, so a change to it fails in one place. */
const TEAM_ROUTE_PREFIX = `${ROUTE_PREFIX}/community`;

function renderIndex(teams?: readonly CommunityTeam[]): string {
  // `teams` passed explicitly as possibly-undefined rather than as a conditional object: the union
  // `{ teams: CommunityTeam[] } | {}` matches no `createElement` overload, and `undefined` here is
  // exactly what the component treats as "use the derived list".
  //
  // The provider is mounted because `ClinicalRail` mounts `WardRoleSwitcher`, which calls
  // `useWardFlow()` during render. The index itself reads nothing from it — its teams are derived,
  // not live state — so the provider here is the page's chrome, not its data.
  const children = createElement(CommunityIndex, { teams });
  // eslint-disable-next-line react/no-children-prop -- WardFlowProviderProps requires `children`
  return renderToStaticMarkup(createElement(WardFlowProvider, { initialNow: NOW_ANCHOR, children }));
}

/**
 * The `<main id="main-content">` ELEMENT's own markup — its opening tag through to the first
 * `</main>` after it, end bound included.
 *
 * Both bounds are asserted rather than assumed: `indexOf` returns -1 when it finds nothing, and a
 * slice taken from -1 — or one left to run to the end of the string — silently widens the scan to
 * markup this region does not own, without failing.
 *
 * Because the slice is closed at both ends by the element's own tags, anything rendered outside
 * `<main>` is excluded by CONTAINMENT rather than by document order. That matters concretely here:
 * the `ClinicalRail` this page mounts renders its own seeded links, and a scan bounded only at the
 * front would re-admit them the first time somebody reordered the component. This is the exact false
 * pass `tests/ward-nav.test.ts` records having hit on the ward index.
 *
 * The one thing not enforced by an assertion is that `<main>` does not nest — it cannot in valid
 * HTML, and this component renders exactly one — so the first `</main>` is its closing tag.
 */
function mainRegionOf(markup: string): string {
  const start = markup.indexOf('<main id="main-content"');
  expect(start, 'the rendered page has no <main id="main-content"> to scope the link scan to').toBeGreaterThan(-1);
  const end = markup.indexOf("</main>", start);
  expect(end, "the rendered page has no </main> to bound the link scan at").toBeGreaterThan(start);
  return markup.slice(start, end);
}

/**
 * The team ids the index's own links name, read back out of the rendered markup.
 *
 * Scoped twice over, for the reason `mainRegionOf` records: to the `<main>` element, and within it
 * to anchors carrying the index's own `data-testid`. Built with `new RegExp` from the route constant
 * rather than written as a literal — the convention `ward-nav.test.ts` already uses — because an
 * escape that survives review can still arrive as a different byte.
 */
function linkedTeamIdsIn(markup: string): string[] {
  const pattern = new RegExp(
    '<a[^>]*href="' + TEAM_ROUTE_PREFIX + '/([^"/]+)"[^>]*data-testid="community-index-link"',
    "g",
  );
  const main = mainRegionOf(markup);
  const found: string[] = [];
  for (let match = pattern.exec(main); match !== null; match = pattern.exec(main)) found.push(match[1]);
  return found;
}

/** How many index links the main region holds, counted from the testid alone — independent of the
 *  href pattern above, so the two disagreeing is itself the failure rather than a shorter list. */
function linkCountIn(markup: string): number {
  return (mainRegionOf(markup).match(/data-testid="community-index-link"/g) ?? []).length;
}

describe("Community team index — every team the prototype can name has a way in", () => {
  const markup = renderIndex();
  const linked = linkedTeamIdsIn(markup);
  const expected = COMMUNITY_TEAM_PAGES.map((team) => team.id);

  it("renders one link per derived team, with no team linked twice and no id the route cannot serve", () => {
    // Non-vacuity floor first. Equality between two empty collections passes, and a page that
    // rendered nothing at all would satisfy every assertion below it.
    expect(expected.length, "the team fixture is empty — nothing below this line proves anything").toBeGreaterThan(1);
    expect(linked.length, "the community index rendered no team links at all").toBeGreaterThan(0);

    // (1) Aggregate omissions and duplicates. A count alone survives one team linked twice while
    // another is missed — which is why it is not the only assertion here.
    expect(linked.length, "the index did not render exactly one link per team").toBe(expected.length);

    // (2) The duplicate case directly. Set equality below absorbs a team rendered twice; only this
    // line sees it.
    expect(new Set(linked).size, "a team is linked more than once").toBe(linked.length);

    // (3) Membership. This is the assertion that earns its place even though both sides read the
    // same fixture: it fails the moment an href is COMPOSED wrongly — a prefix typo, a name used
    // where the slug belongs, an id that has been prettified — none of which a size pin would see.
    expect([...linked].sort()).toEqual([...expected].sort());

    // The two independent counts must agree, or the href pattern above has stopped seeing anchors
    // the page is still rendering.
    expect(linkCountIn(markup), "the href scan and the testid count disagree").toBe(linked.length);
  });

  it("each link's dynamic segment decodes back to the team id, rather than merely containing it", () => {
    // Non-vacuity floor, same as the sibling test above: `linked` is computed once at `describe`
    // scope, and this test has no assertion of its own that the index rendered anything at all. An
    // empty `linked` would make the loop below — and `needingEscape`, derived from `expected` — pass
    // vacuously.
    expect(linked.length, "the community index rendered no team links at all").toBeGreaterThan(0);

    // An href can match as a string and 404 as a route: `%20` reads as a space to a human scanning
    // markup and is a different path segment to the router. So the segment is round-tripped rather
    // than compared loosely.
    for (const id of linked) {
      expect(decodeURIComponent(id), `the href segment "${id}" does not decode back to a team id`).toBe(id);
      expect(
        COMMUNITY_TEAM_PAGES.some((team) => team.id === id),
        `no team has the id "${id}"`,
      ).toBe(true);
    }

    // ⚠️ **STATED BECAUSE ITS ABSENCE IS EXACTLY WHEN IT WOULD GO UNNOTICED.** `communityTeamSlug`
    // collapses every run of non-alphanumeric characters to a hyphen, so no id in the fixture today
    // contains a character `encodeURIComponent` would escape, and the round trip above is currently
    // an identity on every one of them. If that ever stops being true, this assertion is what tells
    // you — and until then, nobody should read the loop above as evidence that an escaping id has
    // been exercised, because none exists to exercise.
    const needingEscape = expected.filter((id) => encodeURIComponent(id) !== id);
    expect(
      needingEscape,
      "a team id now needs percent-encoding — the loop above is no longer an identity and the href builder must be " +
        "re-checked against the route",
    ).toEqual([]);
  });

  it("says on the page why the list is alphabetical, rather than leaving a reader to infer a grouping was lost", () => {
    const main = mainRegionOf(markup);

    // The sentence is the honest version of the grouping that was asked for, and it is the record of
    // a decision two chats got wrong before anybody read the type. Asserted on the rendered page
    // rather than on the source, because a comment saying it is not a reader saying it.
    expect(main).toContain("listed alphabetically because the record holds a team");
    expect(main).toContain("nothing else to group by");

    // The restraint statement: an index of every team must not read as a caseload board.
    expect(main).toContain("This is a way in, not a caseload.");

    // No heading, badge or label carries a comparative or a count. The page renders one section and
    // one list; a second heading here would be the first step towards a grouping nobody decided.
    expect((main.match(/<h2/g) ?? []).length, "the index grew a second heading — it renders one flat list").toBe(1);
  });
});

describe("Community team index — an empty list explains itself instead of looking like an answer", () => {
  // Driven by an injected empty list rather than by mutating the fixture: the derived source cannot
  // produce this state, and a test that edited the fixture to reach it would be testing the edit.
  const markup = renderIndex([]);
  const main = mainRegionOf(markup);

  it("states that the list is empty and that this is a page finding nothing, not a service having nothing", () => {
    expect(main).toContain("This list is empty.");
    expect(main).toContain("that derivation returned no teams");
    expect(main).toContain("does not mean this prototype has no community teams");
  });

  it("renders zero team links, checked ALONGSIDE the sentence rather than instead of it", () => {
    // Zero links is also what a crashed or half-rendered page produces, so the count is only
    // evidence when the page has also been shown to be the page. The heading and the empty notice
    // above are that evidence; this line adds that nothing was linked behind them.
    expect(linkedTeamIdsIn(markup)).toEqual([]);
    expect(linkCountIn(markup)).toBe(0);
    expect(main, "the empty page rendered no section at all — it did not render an empty state").toContain(
      "Community teams",
    );
  });
});

/**
 * ⚠️ **LODGED HERE FOR A FILE-OWNERSHIP REASON, NOT A TOPICAL ONE.** This block pins wording on
 * `community-screen.tsx`, whose natural home is `tests/ward-community-hub.dom.test.tsx`. That file
 * was being held by another change when this correction was made, and the only test files this task
 * could create were `tests/ward-community-index*`. **Move this block into the hub suite when that
 * file is free**; nothing about it belongs to the index.
 *
 * ⚠️ **WHAT IT PINS, AND WHY A PIN RATHER THAN A COMMENT.** Until 2026-09-01 the community hub said,
 * in bold, inside its follow-up absence notice, that whether follow-up has been arranged "is not
 * recorded anywhere in this prototype. There is no field for it, no way to set one, and nothing that
 * could be counted." **Every clause of that was false**, and it was false on a clinical-adjacent page
 * whose entire purpose is being believed by a reader with no way to check it.
 *
 * Measured on this worktree at the time of the correction:
 *
 *  - `Admission.followUp: FollowUpRecord | null` — `ward-admissions.ts`, around `:452`, and present
 *    in the field-presence map around `:484`.
 *  - `FollowUpRecord = { state: FollowUpState; recordedAt: Instant; recordedBy: string }`, with the
 *    vocabulary `FOLLOW_UP_STATES = ["arranged", "not_arranged"]` (`ward-admissions.ts`, around
 *    `:159`).
 *  - The seed sets a real record on two departed admissions (`ward-admissions-seed.ts:733`, `:770`).
 *
 * What IS true is narrower and sharper: the field has **no producer and no consumer**. Nothing reads
 * it, and the sole mention in `ward-flow-reducer.ts` writes `followUp: null` (around `:941`, inside
 * `case "PULL_PATIENT"` around `:811`) when it creates an admission, so no action available in the
 * prototype can put a record there. `ward-reanchor.ts` moves the record's `recordedAt` because
 * `INSTANT_FIELDS` NAMES `recordedAt`, explicitly and with its own comment saying a nested instant
 * is exactly the kind that set loses track of — not, as this comment claimed until 2026-09-01, as a
 * side effect of the shift recursing.
 *
 * **A field with no producer and no consumer passes every gate and renders as an ordinary empty
 * state**, which is exactly how the wrong sentence survived. The conclusion the page draws from it is
 * unchanged and is pinned here too: the list is "discharged to the community", never "missing
 * follow-up", and an empty list must never read as an all-clear.
 */
describe("The community HUB's follow-up notice — the corrected claim, pinned so the false one cannot return", () => {
  const markup = renderToStaticMarkup(
    // eslint-disable-next-line react/no-children-prop -- WardFlowProviderProps requires `children`
    createElement(WardFlowProvider, {
      initialNow: NOW_ANCHOR,
      children: createElement(CommunityScreen, { teamId: COMMUNITY_TEAM_PAGES[0].id }),
    }),
  );

  it("says the field is recorded and unread, and never again that no such field exists", () => {
    expect(markup, "the hub did not render its follow-up notice at all").toContain(
      'data-testid="ward-community-follow-up-not-recorded"',
    );
    expect(markup).toContain("Whether follow-up has been arranged is recorded on the admission");
    expect(markup).toContain("nothing in this prototype");

    // The negative pins are the guard. Each is a phrase from the false version, and each returning
    // is a claim a reader cannot check going back on the page.
    expect(markup, "the false 'not recorded anywhere' claim has returned").not.toContain(
      "is not recorded anywhere in this prototype",
    );
    expect(markup, "the false 'no field for it' claim has returned").not.toContain("There is no field for it");
  });

  it("keeps the conclusion the correction does not touch: an empty list is never an all-clear", () => {
    // Pinned on the negation itself, `<strong>` tags included: "everyone who is missing" alone
    // survives deleting `<strong>not</strong>` — the exact false all-clear this notice exists to
    // prevent — because that phrase sits outside the negation it is meant to guard.
    expect(markup, "the discharge list must still read as NOT the missing-follow-up list").toContain(
      "— <strong>not</strong> everyone who is missing follow-up",
    );
    expect(markup).toContain("does not mean everybody is being followed up");
  });

  it("the field the notice now describes really does exist, so this pin cannot outlive its subject", () => {
    // Imported rather than described. If `followUp` is ever removed from the model, this import
    // stops resolving and the wording above must be revisited — which is the failure we want, rather
    // than a page quietly describing a field that has gone.
    expect([...FOLLOW_UP_STATES].sort()).toEqual(["arranged", "not_arranged"]);
  });
});

/**
 * ⚠️ **THE COUNT MAY NOT COME BACK.** Until 2026-09-01 `community-index.tsx`'s own doc comment said
 * "sixty-five" three times — twice as a count of team pages and once as the honest "0 of 65" the
 * index replaces. Every one of those was a property of the seed, none was a property of the page,
 * and a seed edit would have made all three false with nothing going red anywhere. That is the fifth
 * and sixth member of a class `statistics-derivations.ts` records as having falsified itself
 * silently four times on one paragraph.
 *
 * The rule the rewrite writes to, and the rule these assertions enforce: **describe what the
 * derivation can and cannot establish, never what the seed happens to contain.** A count RENDERED
 * from live state is fine — the referral-join figures on the statistics home page are the pattern.
 * A count TYPED into prose is the defect, and a doc comment cannot render, so the count comes out
 * rather than moving.
 *
 * Scoped to the leading doc comment because that is where the claim lived and where a rewrite would
 * put it back. The rest of the file legitimately contains digits — `<h1>`, `<h2>`, `=== 0`, a `404`
 * — and a whole-file numeral scan would have to carve exceptions for all of them, which is how a
 * guard becomes something people switch off.
 */
describe("The community index's own explanation — no count of the fixture typed into it", () => {
  const SOURCE = "src/components/ward-management/community/community-index.tsx";
  const source = readFileSync(join(process.cwd(), SOURCE), "utf8");

  /** The file's first `/** … *\/` block: the comment that explains why this page exists. */
  const leadingDocComment = (() => {
    const start = source.indexOf("/**");
    expect(start, `${SOURCE} has no leading doc comment to scan`).toBeGreaterThan(-1);
    const end = source.indexOf("*/", start);
    expect(end, `${SOURCE}'s leading doc comment is unterminated`).toBeGreaterThan(start);
    return source.slice(start, end);
  })();

  it("scans a doc comment that is really there, so the absences below mean something", () => {
    // Every assertion in this block is a NOT, and every NOT passes against an empty string. This is
    // the floor that stops a renamed file or a mis-sliced comment reporting itself green.
    expect(leadingDocComment.length, "the doc comment scanned is too short to be the real one").toBeGreaterThan(1000);
    expect(leadingDocComment).toContain("THE COMMUNITY TEAM INDEX");
    expect(leadingDocComment).toContain("THE INDEX'S OWN REACHABILITY IS THE POINT");
  });

  it("contains no numeral, so no quantity about the seed can be stated in it", () => {
    // Written as an explicit digit class rather than \d: a literal backslash-b pasted into a pattern
    // becomes a backspace byte (0x08), matches nothing, and prints as perfectly valid — which has
    // already cost this project a day. No escape sequence is used here at all.
    const numeral = leadingDocComment.match(/[0123456789]/);
    expect(
      numeral,
      `the doc comment now contains the numeral "${numeral?.[0] ?? ""}". A figure typed into prose is a claim about ` +
        `the data that nothing can re-check; render it from live state or leave it out.`,
    ).toBeNull();
  });

  it("contains no spelled-out count either, which is the form the retired claim actually took", () => {
    // The retired wording, forbidden by name, plus the tens words a replacement count would use.
    // Small number words are NOT here on purpose: the comment says "exactly two ways", "Two chats
    // recommended", "the same fact twice", and a forbidden word that also occurs innocently teaches
    // the next reader to widen the exception rather than fix the sentence.
    const lowered = leadingDocComment.toLowerCase();
    for (const word of ["sixty", "fifty", "forty", "thirty", "twenty", "hundred"]) {
      expect(
        lowered,
        `the doc comment says "${word}" — a spelled-out count of the fixture is the same defect as a numeral, and ` +
          `it is the exact form the claim removed on 2026-09-01 took.`,
      ).not.toContain(word);
    }
  });

  it("still explains the page and its reachability, so the count was removed and not the paragraph", () => {
    // The point of the removal was to lose a false-in-future clause, never the explanation around
    // it. If a later edit takes the paragraph instead, this is what says so.
    expect(leadingDocComment).toContain("was to type its address");
    expect(leadingDocComment).toContain("Reachability is transitive");
    expect(leadingDocComment).toContain("registered in `ward-nav.ts`");
  });

  /**
   * ⚠️ **THE CLAIM WAS TRUE WHEN THIS FILE FIRST PINNED IT, AND STOPPED BEING TRUE ON 2026-09-01
   * WHEN `ward-nav.ts` REGISTERED THE ROUTE.** The paired absence this file's own doc comment
   * promises above ("EVERY ASSERTION HERE IS PAIRED" is `ward-community-corrected-claims.test.ts`'s
   * rule, and it applies here too the moment a pin's own subject flips): the old present-tense
   * wording said the index conferred nothing and nothing linked to it — both now false — and a
   * presence-only pin would have kept passing with the false sentence sitting right beside the true
   * one, which is exactly the shape this project has already shipped once.
   */
  it("no longer claims the index is unreached, in the present tense the old wording used", () => {
    expect(
      leadingDocComment,
      'the present-tense "nothing links to it" claim has returned — the route is registered now',
    ).not.toContain("nothing links to it from");
    expect(
      leadingDocComment,
      "the old present-tense reachability gap is stated again as though still open",
    ).not.toContain("must therefore be registered");
    expect(leadingDocComment, "the record of the tripwire's own resolution is missing").toContain("started life as");
  });
});
