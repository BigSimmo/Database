import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { stripAllComments } from "./helpers/strip-source-comments";

/**
 * NINE CLAIMS THAT WERE FALSE ON THE COMMUNITY SCREENS, PINNED SO THAT NONE OF THEM CAN COME BACK.
 *
 * An audit on 2026-09-01 found nine statements in `community-screen.tsx` and
 * `community-derivations.ts` that were false against the model rather than merely loose. Four were
 * false because the repository had moved underneath them — the demo-clock fix (`44ca08839`) and the
 * owner's three new leaving destinations — two inverted the mechanism of a real finding, one was a
 * twin of a sentence corrected in the sibling file and left standing here, one wrote counts of a
 * seed into prose, and one made an unearned completeness claim in bold on the page.
 *
 * ⚠️ **EVERY ASSERTION HERE IS PAIRED: THE CORRECTED WORDING MUST BE PRESENT, AND THE FALSE WORDING
 * MUST BE ABSENT.** A presence pin alone survives the false sentence being added back beside the
 * true one, which is the shape these files were already in — `community-screen.tsx` carried the
 * corrected follow-up sentence while `community-derivations.ts` carried its false twin, for a day.
 *
 * ⚠️ **AND EVERY ABSENCE IS PRECEDED BY A NON-VACUITY FLOOR.** A `not.toContain` passes against an
 * empty string, a renamed file read as `""`, and a mis-sliced region. The floors below are what stop
 * this file reporting itself green after the thing it scans has gone.
 *
 * ⚠️ **THE RETIRED PHRASES ARE NOT REPEATED IN THE SOURCE FILES, DELIBERATELY.** Each correction
 * note in those files describes what the old sentence claimed rather than quoting it, so that the
 * absence pins below can be plain substring checks. A file that quotes its own retired false
 * sentence as history cannot be guarded this way at all.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), replace: vi.fn() }),
}));

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { LEAVING_DESTINATIONS, type Admission } from "@/components/ward-management/ward-admissions";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { INSTANT_FIELDS } from "@/components/ward-management/ward-reanchor";
import { MODEL_CLAIMS, UNEVIDENCED_CLAIMS } from "@/components/ward-management/statistics/statistics-claims-register";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
const SCREEN_PATH = "src/components/ward-management/community/community-screen.tsx";
const DERIVATIONS_PATH = "src/components/ward-management/community/community-derivations.ts";
const NAV_TEST_PATH = "tests/ward-nav.test.ts";
const REANCHOR_TEST_PATH = "tests/ward-reanchor.test.ts";

function sourceOf(path: string): string {
  const text = readFileSync(join(process.cwd(), path), "utf8");
  // The floor for every absence assertion made against this string. A missing or renamed file
  // throws above; a file that has been emptied would not, and every `not.toContain` below it would
  // pass.
  expect(text.length, `${path} is too short to be the real file`).toBeGreaterThan(2000);
  return text;
}

/**
 * A source file's prose with the comment scaffolding taken out and whitespace collapsed.
 *
 * ⚠️ **WITHOUT THIS EVERY ABSENCE BELOW IS WEAKER THAN IT LOOKS.** A doc comment wraps at the print
 * width, so a sentence lives in the file as `phrase\n         * continues` — a raw `toContain` for
 * that sentence never matches, which means a raw `not.toContain` can PASS while the false sentence
 * is sitting in the file, wrapped one word differently from the needle. Normalising both sides is
 * what makes the pin about the sentence rather than about where the line broke.
 */
function proseOf(source: string): string {
  return source
    .replace(/^[ \t]*\*[ \t]?/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const screenSource = sourceOf(SCREEN_PATH);
const derivationsSource = sourceOf(DERIVATIONS_PATH);
const screenProse = proseOf(screenSource);
const derivationsProse = proseOf(derivationsSource);

/**
 * One team's page, rendered to a string. `.test.ts` collects under the "node" project, so there is
 * no `document`; `renderToStaticMarkup` renders the real tree without one, the same pattern
 * `tests/ward-community-index.test.ts` uses.
 */
function renderTeamMarkup(admissions?: Admission[], referrals?: Referral[]): string {
  return renderToStaticMarkup(
    // eslint-disable-next-line react/no-children-prop -- WardFlowProviderProps requires `children`
    createElement(WardFlowProvider, {
      initialNow: NOW_ANCHOR,
      children: createElement(CommunityScreen, { teamId: COMMUNITY_TEAM_PAGES[0].id, admissions, referrals }),
    }),
  );
}

/** The visible text of the page, tags removed, so a sentence broken across JSX expressions is still
 *  one sentence to a reader and to an assertion. */
function visibleText(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, "")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const pageMarkup = renderTeamMarkup();
const pageText = visibleText(pageMarkup);

describe("the community screens rendered something to scan at all", () => {
  it("renders the real page, so every absence below is measured against text that exists", () => {
    expect(pageText.length, "the community screen rendered almost nothing").toBeGreaterThan(2000);
    expect(pageMarkup).toContain('data-testid="ward-community-unattributable"');
    expect(pageMarkup).toContain('data-testid="ward-community-expected-elapsed"');
    expect(pageMarkup).toContain('data-testid="ward-community-departure-elapsed"');
  });
});

/**
 * ⚠️ Claims 1 and 2 — the demonstration clock, and the guard that was said to read one file.
 *
 * The screen said the re-anchor left `Admission`'s instants behind and that the guard on it could
 * never see them. `44ca08839` fixed both, and this branch has it through the merge `aeff0635b`. The
 * imports below are the part that cannot go stale: they read the live set and the live guard rather
 * than describing them, so if either regresses these fail before the prose pins do.
 */
describe("claims 1 and 2 — the demo clock shifts the admission instants, and the guard reads both files", () => {
  it("the live set really does name every admission instant the prose now names", () => {
    for (const field of [
      "pulledAt",
      "awayAtEmergencyDepartmentSince",
      "expectedDischargeAt",
      "dischargeDateSetAt",
      "dischargeConfirmedAt",
      "leftAt",
      "recordedAt",
      "arrivedAt",
    ]) {
      expect(INSTANT_FIELDS.has(field), `INSTANT_FIELDS no longer names ${field}`).toBe(true);
    }
  });

  // ⚠️ MATCHED WITH COMMENTS STRIPPED (`stripAllComments`, see
  // tests/ward-guard-comment-blindness.test.ts). This checks that the guard REALLY reads both
  // files — a code write, not prose — via a raw path string. Unstripped, a comment merely
  // mentioning "src/components/ward-management/ward-model.ts" satisfies the match exactly as well
  // as the real `MODEL_FILES` array entry does. Proved live 2026-09-04: emptying `MODEL_FILES` in
  // `tests/ward-reanchor.test.ts` and leaving only an explanatory comment naming both paths passed
  // this test unchanged.
  it("the guard really does read both model files, which is the claim the screen had inverted", () => {
    const guard = stripAllComments(sourceOf(REANCHOR_TEST_PATH));
    expect(guard).toContain("src/components/ward-management/ward-model.ts");
    expect(guard).toContain("src/components/ward-management/ward-admissions.ts");
  });

  it("neither doc block asserts the repaired defect any more", () => {
    for (const phrase of [
      "which that guard never reads",
      "That set does not name",
      "500-minute offset",
      "two different clocks",
      "wrong by the anchor offset",
    ]) {
      expect(screenProse, `the repaired clock defect is asserted again: "${phrase}"`).not.toContain(phrase);
    }
  });

  it("says instead what is true, and names the commit rather than a measurement taken before it", () => {
    expect(screenProse).toContain("44ca08839");
    expect(screenProse).toContain("aeff0635b");
    expect(screenProse).toContain("MODEL_FILES");
  });

  it("the two rendered caveats no longer justify a withheld date with the fixed clock", () => {
    for (const phrase of [
      "do not move with it",
      "could be out by that difference",
      "true on either clock",
      "a limitation of this prototype rather than of the record",
    ]) {
      expect(pageText, `a rendered caveat still blames the repaired clock: "${phrase}"`).not.toContain(phrase);
    }
  });

  it("the two rendered footnotes no longer withhold the dates — they state elapsed time instead", () => {
    // The render changed on 2026-09-01: whether to show these dates was the owner's open question,
    // and the owner has since answered it. This pin is what makes a silent reversion back to
    // withholding visible — the same discipline the pin it replaces held for the clock-defect
    // finding, now aimed at the opposite regression.
    for (const retired of [
      "No row above says when somebody left",
      "The date itself is not shown",
      "open question for the product owner",
    ]) {
      expect(pageText, `a retired withheld-date phrase has returned: "${retired}"`).not.toContain(retired);
    }
    expect(pageText).toContain("This screen states how long ago somebody left, never the date itself");
    expect(pageText).toContain("so a calendar date here would be a synthetic one");
    expect(pageText).toContain(
      "This page states how long until that date, or how long since it passed, never the calendar date itself",
    );
    expect(pageText).toContain(
      "so printing one would put a synthetic day in front of a reader as though it were a plan",
    );
    expect(pageText).toContain("every date in this prototype is invented");
    // And no instant leaked in while the prose was being rewritten.
    expect(pageText).not.toMatch(/[0-9][0-9]:[0-9][0-9]/);
  });
});

/**
 * ⚠️ Claim 3 — the follow-up twin. Corrected in `community-screen.tsx` on 2026-09-01 and left
 * standing in `community-derivations.ts`, where it was the authoritative comment on the very array
 * the screen renders.
 */
describe("claim 3 — the follow-up concept exists on the record and has no producer and no consumer", () => {
  it("the false denial is gone from the derivations, in every form it took", () => {
    for (const phrase of [
      "There is no follow-up concept anywhere in this model",
      "not a field,",
      "not an event,",
      "not a vocabulary",
    ]) {
      expect(derivationsProse, `the false follow-up denial has returned: "${phrase}"`).not.toContain(phrase);
    }
  });

  it("the corrected claim is stated, with the evidence a reader can check", () => {
    expect(derivationsProse).toContain("no producer and no consumer");
    expect(derivationsProse).toContain("FOLLOW_UP_STATES");
    expect(derivationsProse).toContain("Admission.followUp");
  });

  it("both files now say the same thing, which is the defect that let the twin survive", () => {
    for (const prose of [screenProse, derivationsProse]) {
      expect(prose).toContain("no producer and no consumer");
    }
  });
});

/**
 * ⚠️ Claims 4 and 5 — the leaving-destination vocabulary. Three destinations were added by owner
 * ruling on 2026-09-01, and both doc comments went on describing the list as it had been.
 *
 * Claim 5 is the one that matters clinically, so it is proved on the RENDERED page and not only in
 * the prose: a coordinator can read a death on the ward in this footnote.
 */
describe("claims 4 and 5 — the departure vocabulary, as it is rather than as it was", () => {
  it("the vocabulary really has grown past the size the retired prose assumed", () => {
    expect(LEAVING_DESTINATIONS.length).toBeGreaterThan(5);
    for (const id of ["died-on-the-ward", "transferred-to-custody", "did-not-return"]) {
      expect(
        LEAVING_DESTINATIONS.some((destination) => destination.id === id),
        `${id} is no longer in the vocabulary — the prose that names it must be revisited`,
      ).toBe(true);
    }
  });

  it("no count of the vocabulary is written into the derivations prose", () => {
    for (const phrase of ["Of the five", "of the five", "the five LEAVING_DESTINATIONS", "the eight"]) {
      expect(derivationsProse, `a count of the vocabulary is typed into prose again: "${phrase}"`).not.toContain(
        phrase,
      );
    }
  });

  it("the enumeration names the three destinations the retired version omitted", () => {
    for (const id of ["died-on-the-ward", "transferred-to-custody", "did-not-return"]) {
      expect(derivationsProse, `the enumeration does not mention ${id}`).toContain(id);
    }
  });

  it("⚠️ the otherDepartures comment no longer promises only transfers and against-advice endings", () => {
    for (const phrase of [
      "transfers, residential care, and admissions that ended against advice",
      "Every other recorded departure for this team — transfers",
    ]) {
      expect(derivationsProse, `the doc promises a gentler list than it carries: "${phrase}"`).not.toContain(phrase);
    }
    expect(derivationsProse).toContain("DEATHS ON THE WARD AND TRANSFERS INTO POLICE OR PRISON CUSTODY");
  });

  it("⚠️ and the screen really does render a death on the ward into that footnote, which is why", () => {
    // The claim the comment must match is about what a coordinator SEES, so it is measured on the
    // page rather than inferred from the vocabulary. This is the falsifier for claim 5.
    const [toTeam] = referralsNamingFirstTeam();
    const died = departedAdmission("AD-DIED", toTeam.id, "died-on-the-ward");
    const custody = departedAdmission("AD-CUSTODY", toTeam.id, "transferred-to-custody");
    const text = visibleText(renderTeamMarkup([died, custody], [toTeam]));

    // Non-vacuity: the footnote is on the page and has counted both of them.
    expect(text).toContain("2 other admissions");
    expect(text).toContain("Died on the ward");
    expect(text).toContain("Transferred to police or prison custody");
  });
});

/**
 * ⚠️ Claims 6 and 7 — the team switcher's comment, which cited a real test for the opposite of what
 * that test records, and wrote two counts of the seed into prose.
 */
describe("claims 6 and 7 — the switcher is the way across, and carries no count", () => {
  /**
   * The switcher's own comment, bounded at both ends so the scan cannot widen into the file.
   *
   * ⚠️ **ANCHORED ON THE `<nav>` IT DOCUMENTS, NOT ON A PHRASE INSIDE ITSELF.** A prose anchor makes
   * this region unfindable the moment somebody rewrites the comment — which is exactly the edit the
   * scan exists to police — and the whole suite then fails to collect rather than failing on the
   * claim. The element is pinned independently by the claims register, so anchoring here is stable
   * for a reason outside this file.
   */
  const switcherComment = (() => {
    const nav = screenSource.indexOf("<nav className={styles.teamSwitcher}");
    expect(nav, "the team switcher's <nav> has gone — this region no longer exists").toBeGreaterThan(-1);
    /*
     * 🔴 **THE WHOLE RUN OF COMMENTS, NOT THE NEAREST ONE, AND THAT DISTINCTION HAD ALREADY BROKEN
     * THIS FILE.** A single `lastIndexOf` takes the comment immediately above the `<nav>`. The
     * second-edition port added a short note there about why this is a `<nav>` rather than a
     * `WardPanel` — so the scan started returning 368 characters of the wrong comment, the length
     * floor went red, and the claim assertion below reported the long comment's sentence as MISSING
     * when it was three lines further up and entirely intact.
     *
     * ⚠️ **THAT IS THE DANGEROUS DIRECTION: a guard pointing at correct text and calling it false**
     * sends the next reader to "fix" something that is already right. It walks the contiguous run
     * now — every comment separated from the next by nothing but whitespace and the closing brace —
     * so inserting another note above the element cannot hide the one being policed.
     */
    const blocks: string[] = [];
    let cursor = nav;
    for (;;) {
      const end = screenSource.lastIndexOf("*/", cursor);
      if (end === -1) break;
      const start = screenSource.lastIndexOf("{/*", end);
      if (start === -1) break;
      const between = screenSource.slice(end + 2, cursor).replace(/[}\s]/gu, "");
      if (between !== "") break;
      blocks.unshift(screenSource.slice(start, end));
      cursor = start;
    }
    expect(blocks.length, "no comment at all sits above the team switcher").toBeGreaterThan(0);
    return blocks.join(" ");
  })();

  it("scans a comment that is really there, so the absences below mean something", () => {
    expect(switcherComment.length, "the comment scanned is too short to be the real one").toBeGreaterThan(800);
  });

  it("no longer claims the rail already reaches this route", () => {
    for (const phrase of [
      "records exactly that shortfall",
      "the rail can carry one concrete example",
      "the only way to reach",
    ]) {
      expect(screenProse, `the inverted reachability claim has returned: "${phrase}"`).not.toContain(phrase);
    }
    expect(proseOf(switcherComment)).toContain("THERE IS NOW A WAY IN");
  });

  it("the test it cites records a scan limit, and no longer an orphan", () => {
    /*
     * THIS PIN ALREADY FIRED ONCE, WHICH IS WHY IT IS WORDED LIKE THIS. It used to assert
     * `ward-nav.test.ts` said "NOTHING links to it", with a comment explaining that the pin would go
     * red if somebody linked the route, "which is the outcome everybody wants". Somebody did, about
     * an hour later: `/mockups/ward-flow/community` landed and `ward-nav.ts` carries it. The pin
     * went red on the merge and the comment above was rewritten instead of being left describing a
     * fixed orphan. That is the mechanism working, not a fault.
     *
     * The trap it now guards is subtler than the one it replaced. `ward-nav.test.ts` STILL says
     * "0 of 65 instances reachable without state" — the figure did not move when the front door
     * landed, because the index builds hrefs inside a `.map()` and the scan counts a built site as
     * nought BY DESIGN. So the number is unchanged and its meaning is inverted, which is exactly
     * the shape a careless check waves through. Pin the reasoning, never the bare figure.
     */
    const nav = sourceOf(NAV_TEST_PATH);
    // ⚠️ MATCHED WITH COMMENTS STRIPPED (`stripAllComments`) for this one assertion only. This is a
    // code-write check — is the route really a registered dynamic-route entry — not a prose check,
    // so a comment merely naming the route must not satisfy it. Proved live 2026-09-04: removing all
    // three real `MODEL_FILES`-style entries from `ward-nav.test.ts` and leaving one decoy comment
    // naming the route passed this test unchanged. The two checks below stay on the unstripped `nav`
    // deliberately: one pins a documented explanation (reads a comment on purpose) and the other is
    // an absence check, the conservative direction already.
    expect(stripAllComments(nav)).toContain("/mockups/ward-flow/community/[teamId]");
    expect(nav, "the nav test no longer explains that 0 is a scan limit rather than an orphan").toContain(
      "a limit of a source scan, not an orphan",
    );
    expect(nav, "the orphan wording has returned to the nav test").not.toContain("NOTHING links to it");
    expect(
      proseOf(switcherComment),
      "the switcher comment has gone back to citing the bare figure as if it meant unreachable",
    ).not.toContain("NOUGHT of its instances are reachable without state");
  });

  it("contains no count of the teams or of the pages, in any form", () => {
    // The dates in the comment are the one legitimate run of digits, so they come out before the
    // scan rather than being carved out of it.
    const withoutDates = switcherComment.replace(/[0-9]{4}-[0-9]{2}-[0-9]{2}/g, "");
    const digit = withoutDates.match(/[0123456789]/);
    expect(
      digit,
      `the switcher comment now contains the numeral "${digit?.[0] ?? ""}". A count of the teams is a claim about ` +
        `the catchment source that nothing can re-check; describe the set or render it.`,
    ).toBeNull();

    // Spelled out is the same defect, and is the form the retired claim actually took. Split into
    // words rather than searched as substrings: "written" contains "ten", and a substring scan here
    // would fail on prose that is perfectly correct.
    const words = new Set(switcherComment.toLowerCase().split(/[^a-z]+/));
    for (const word of ["nine", "ten", "eleven", "twelve", "twenty", "thirty", "forty", "fifty", "sixty", "hundred"]) {
      expect(
        words.has(word),
        `the switcher comment says "${word}" — a spelled-out count of the fixture is the same defect as a numeral, ` +
          `and it is the exact form the claim removed on 2026-09-01 took.`,
      ).toBe(false);
    }
  });
});

/**
 * ⚠️ Claim 8 — `recordedAt` is named in `INSTANT_FIELDS` explicitly and deliberately, not reached by
 * accident because the shift recurses. The conclusion the comment drew was sound; the mechanism was
 * inverted, and the inversion invites somebody to stop naming nested fields.
 */
describe("claim 8 — the nested instant is named, not stumbled upon", () => {
  it("the false mechanism is gone from both files that carried it", () => {
    const indexTestProse = proseOf(sourceOf("tests/ward-community-index.test.ts"));
    for (const prose of [screenProse, indexTestProse]) {
      expect(prose, "the inverted recursion mechanism has returned").not.toContain(
        "touches it only because the clock shift",
      );
    }
  });

  it("says instead that the set names it, and the set really does", () => {
    expect(screenProse).toContain("`INSTANT_FIELDS` NAMES `recordedAt`");
    expect(INSTANT_FIELDS.has("recordedAt")).toBe(true);
  });
});

/**
 * ⚠️ Claim 9 — the strongest sentence on the page, in bold, and unearned. A person reaches a team's
 * page only when `admissionBelongsToTeam` FINDS their referral; an admission whose `referralId`
 * resolves to nothing is excluded exactly as if it had none.
 */
describe("claim 9 — the page says what it can establish, and says who is missing", () => {
  it("the unearned completeness claim is gone from the page and from both files", () => {
    for (const phrase of [
      "This page is a complete picture of who was referred to this team",
      "a complete picture of who was REFERRED",
      "a complete picture of who was referred",
    ]) {
      expect(pageText, `the unearned completeness claim is rendered again: "${phrase}"`).not.toContain(phrase);
      expect(screenProse, `the unearned completeness claim has returned: "${phrase}"`).not.toContain(phrase);
      expect(derivationsProse, `the unearned completeness claim has returned: "${phrase}"`).not.toContain(phrase);
    }
  });

  it("states the conditional claim the code supports, and keeps the half that was already true", () => {
    expect(pageText).toContain("everyone this prototype could match to this team");
    expect(pageText).toContain("It is not a picture of an area");
  });

  it("names the population that is missing, which no sentence on the page used to do", () => {
    expect(pageText).toContain("Anyone whose admission points at a referral this page cannot find is missing");
    expect(pageText).toContain("counted in the figure above rather than shown here");
  });

  it("⚠️ and a person whose referral cannot be found really is absent from every list, and counted", () => {
    // The falsifier for the sentence above: an admission pointing at a referral that is not in the
    // list this screen was handed. It must appear nowhere and be counted in the unattributable line.
    const [toTeam] = referralsNamingFirstTeam();
    const unresolvable: Admission = { ...blankAdmission("AD-LOST"), referralId: "REF-DOES-NOT-EXIST" };
    const markup = renderTeamMarkup([unresolvable], [toTeam]);

    expect(markup, "the unresolvable admission was rendered on a team's list").not.toContain("AD-LOST");
    expect(visibleText(markup)).toContain("1 admission is on no community team's page");
  });
});

/**
 * ⚠️ Claim 10 — three places said the community index route was unreachable except by typing an
 * address, and that an `it.fails` tripwire still guarded the gap. Both halves went false on
 * 2026-09-01: `ward-nav.ts` carries a `community` entry (group "role", no `exampleOnly` flag) and
 * `tests/ward-community-index.dom.test.tsx`'s tripwire was already flipped to an ordinary passing
 * assertion. This is the mockups route page and the model-claims register — the community index's
 * own doc comment is pinned separately in `tests/ward-community-index.test.ts`, which carries the
 * same paired presence/absence discipline for that file.
 */
describe("claim 10 — the community index route is registered, in the mockups page and in the claims register", () => {
  const routePagePath = "src/app/mockups/ward-flow/community/page.tsx";
  const routePageSource = readFileSync(join(process.cwd(), routePagePath), "utf8");
  // This route page is much shorter than the screens `sourceOf` was calibrated for, so its own
  // floor (rather than `sourceOf`'s 2000-char one) is what stops a renamed or emptied file
  // reporting every absence assertion below as a false green.
  expect(routePageSource.length, `${routePagePath} is too short to be the real file`).toBeGreaterThan(500);

  it("the mockups route page no longer says the route is unregistered or held by a tripwire", () => {
    for (const phrase of [
      "is not yet registered in",
      "nothing links to it yet",
      "reachable only by typing its address",
      "so the suite stays green while the gap is open",
      "goes red the moment the nav entry lands",
    ]) {
      expect(routePageSource, `the retired "not yet registered" wording has returned: "${phrase}"`).not.toContain(
        phrase,
      );
    }
  });

  it("the mockups route page states instead that the route is registered and linked", () => {
    expect(routePageSource).toContain("registered in `ward-nav.ts`");
    expect(routePageSource).toContain("root rail links it");
    expect(routePageSource).toContain("started life as an `it.fails` tripwire");
  });

  it("the claims register no longer carries the retired id as an unevidenced absence", () => {
    const registeredIds = new Set([
      ...MODEL_CLAIMS.map((claim) => claim.id),
      ...UNEVIDENCED_CLAIMS.map((claim) => claim.id),
    ]);
    expect(
      registeredIds.has("community-index/reachability/nothing-links-to-this-index-yet"),
      "the retired id — which asserted the index has no nav link — is still present somewhere in the register",
    ).toBe(false);
  });

  it("the claims register carries the corrected claim as real, citable evidence rather than an absence", () => {
    const corrected = MODEL_CLAIMS.find(
      (claim) => claim.id === "community-index/reachability/the-root-rail-links-this-index",
    );
    expect(corrected, "the corrected claim is missing from MODEL_CLAIMS").toBeDefined();
    expect(corrected?.sourceFile).toBe("src/components/ward-management/ward-nav.ts");
    expect(corrected?.evidence).toContain('id: "community"');
    expect(corrected?.claim).toContain("reachable");
    expect(
      UNEVIDENCED_CLAIMS.some((claim) => claim.id === "community-index/reachability/the-root-rail-links-this-index"),
      "the corrected claim is a presence, not an absence, and must not also sit in UNEVIDENCED_CLAIMS",
    ).toBe(false);
  });
});

// ── fixtures ────────────────────────────────────────────────────────────────────────────────────

/**
 * One referral naming the first team, minted through the reducer's own write path so its shape is a
 * shape the live system produces. One chain only: two calls to `seedWardFlowState()` mint the same
 * next referral id, and colliding ids are how a green suite hides a wrong association.
 */
function referralsNamingFirstTeam(): Referral[] {
  let state = seedWardFlowState();
  const before = state.referrals.length;
  state = wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW_ANCHOR,
    ageBand: "Adult",
    destinations: [{ kind: "community_team", teamName: COMMUNITY_TEAM_PAGES[0].name }],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  });
  expect(state.rejections, "the reducer refused the fixture referral").toEqual([]);
  const created = state.referrals.slice(before);
  expect(created, "the reducer did not create the fixture referral").toHaveLength(1);
  return created;
}

/** A fully-populated admission, typed as `Admission` so a new field fails to compile here rather
 *  than leaving this helper silently building a stale shape. */
function blankAdmission(id: string): Admission {
  return {
    id,
    unitId: "unit-under-test",
    referralId: null,
    sex: "Female",
    homeRegion: "Perth Metropolitan",
    tentativeDiagnosis: null,
    // Ruling 1 made this a required field on `Admission` after this branch forked. `false` is the
    // seed's own default and the inert choice: it consumes none of the ward's one-to-one staffing,
    // so it cannot perturb any assertion in this file. Nothing here asserts on specialling.
    specialling: false,
    state: "occupied",
    pulledAt: 0,
    arrivedAt: 0,
    awayAtEmergencyDepartmentSince: null,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    dischargeConfirmedAt: null,
    dischargeConfirmedBy: null,
    blockReason: null,
    leavingDestination: null,
    leftAt: null,
    followUp: null,
  };
}

function departedAdmission(
  id: string,
  referralId: string,
  leavingDestination: (typeof LEAVING_DESTINATIONS)[number]["id"],
): Admission {
  return {
    ...blankAdmission(id),
    referralId,
    state: "departed",
    leavingDestination,
    leftAt: NOW_ANCHOR,
  };
}
