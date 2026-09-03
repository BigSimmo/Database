# Task 1 — the community team index (WF-BUILD-002)

Base `0901b4471`. Ward Lead's assignment: `/mockups/ward-flow/community/[teamId]` serves 65 teams
and **nothing links to it**. `community-screen.tsx` links the other 64 teams, but only from a team
page — which you reach only by typing a URL. Build the front door.

## Facts established by reconnaissance — do not re-derive these, but DO verify any you rely on

**The template is `/wards`.** Route `src/app/mockups/ward-flow/wards/page.tsx:11-13` (a plain
server component returning `<WardIndex />`, no props). Screen
`src/components/ward-management/wards/ward-index.tsx:57-175`. CSS
`ward-index.module.css`. **Read all three before writing anything.**

**There is no shared page frame.** Grepping `PageFrame|ScreenFrame|WardFrame` returns zero hits.
Both `/wards` and `community` hand-roll the same shape independently: a `.screen` root with
`display: grid; grid-template-columns: auto minmax(0, 1fr); min-height: 100dvh;`, a `<ClinicalRail />`
in column one, a `<main id="main-content">` in column two, and a local custom-property namespace
(`--wi-*` for wards, `--cm-*` for community). **Reproduce the pattern in your own module; do not
build a shared frame and do not import another screen's module.**

**Phone reserve, identical in both modules:**
`@media (max-width: 40rem) { .screen { padding-top: var(--spacing-ward-phone-bar); } }`

**Rows:** `WardLink` (`ward-index.tsx:164-175`) is a `<Link>` wrapping the whole card, rendering the
name and one secondary line. **It deliberately renders NO bed count, occupancy or pressure** — an
owner ruling, quoted in that file at `:24-31`: _"Two surfaces answering one question in wording that
can drift is this project's most reliable defect."_ Your index carries the same restraint: a team's
name and a link, nothing that another surface also answers.

## ⚠️ THE GROUPING: there is none, and its absence is enforced

`CommunityTeam` (`community-derivations.ts:52-56`) is **exactly**:

```ts
export type CommunityTeam = { id: string; name: string };
```

Both required. **No third field of any kind** — no region, service, hospital, kind or catchment.
That is deliberate, and the file says so at `:49-51`: _"There is no `region` field, and its absence
is enforcement rather than tidying: a screen cannot fall back to region-derived membership if no
team here knows a region."_ A region-keyed `COMMUNITY_TEAMS` table exists in `ward-teams.ts` and
that same module forbids reading it at `:38-39`: _"deliberately NOT read here — using it would
reintroduce region-derived membership under a different name."_

`id` is a slug derived from `name` (`:68-73`), so it is not an independent field either.

**RULING, already made — do not re-open it: render ONE FLAT, ALPHABETICALLY ORDERED LIST of all 65
teams. Do not group. Do not read `ward-teams.ts`. Do not create an "Other" bucket.** Ward Lead
asked for "grouped sensibly" without knowing the type carries no key; grouping would require either
reading a table the codebase forbids, or inventing a category, and an invented category on this
prototype reads to a coordinator as a real one. Say plainly on the page that the teams are listed
alphabetically because the record holds a name and nothing else to group by — that sentence is the
honest version of the missing grouping, and it belongs on the screen, not only in a comment.

## Coverage: 65, and how it must be proved

`COMMUNITY_TEAM_PAGES` (`community-derivations.ts:88-91`) holds **65** teams — verified by
executing the code, not by reading a comment. It derives from `communityTeamOptions()`
(`referrals/referral-destination-options.ts:189-201`), which reads 71 raw strings and merges 6
duplicate spellings.

**⚠️ THE SOURCE SCAN CANNOT SEE YOUR LINKS, AND THAT IS EXPECTED.**
`tests/ward-nav.test.ts` proves reachability by regex-scanning `src/` for **concrete, literally
quoted** hrefs. An href generated inside a `.map()` is classified "built", not "concrete", and
contributes **zero**. This already happened to `/wards`: `WardIndex` links 23 of 23 and the scan
still cannot see it, so that route's orphan entry was **rewritten to explain where the real proof
lives**, not deleted.

**So your coverage proof is a RENDERED-MARKUP test, mirroring `ward-nav.test.ts:837-875` and
`:938-955`:** render the index with `renderToStaticMarkup`, scrape the links back out of the markup
**scoped to `<main id="main-content">`** — the `ClinicalRail` carries its own seeded example link
and will pollute an unscoped scrape — and to anchors carrying your own `data-testid`. Then assert:

1. **Exact sorted-array equality** of the linked ids against the live fixture's ids. Not a count,
   not containment.
2. **No duplicate links** — a set comparison silently absorbs a team rendered twice.
3. **A cross-check** that the href-regex count matches an independent `data-testid` count.

All three. Each catches a fault the others miss, and the redundancy is the point.

Put the test in a NEW file `tests/ward-community-index.test.ts` (and a `.dom.test.tsx` if you need
one). **Do not edit `tests/ward-nav.test.ts` or `tests/ward-landmarks.test.ts`** — Ward Lead owns
both and both are mid-change.

## Constraints, all hard

- **Files you may write:** `src/app/mockups/ward-flow/<your route>/page.tsx`,
  `src/components/ward-management/community/**` (new files only — do NOT edit
  `community-screen.tsx`), and new `tests/ward-community-index*` files.
- **NEVER touch** `ward-flow-reducer.ts`, `ward-flow-events.ts`, `ward-nav.ts`,
  `tests/ward-nav.test.ts`, `tests/ward-landmarks.test.ts`, or **anything under
  `src/components/ward-management/statistics/`** — other agents hold every one of them right now.
- **Do not register the route in nav.** Ward Lead does that when we tell it the route landed.
- **An href builder writes its route prefix as a LITERAL**, never composed from a constant:
  `` `/mockups/ward-flow/community/${team.id}` `` — `communityTeamHref` already does this correctly
  at `community-screen.tsx:358-360`; import and reuse it rather than writing a second builder.
- Design tokens only, no hex. `<Link>` never a raw anchor. Every `<button>` wired, or ship none.
- Next.js 16: if your route takes params they are a Promise, awaited. This one probably takes none.

## Gate

```
npx tsc -p tsconfig.typecheck.json --noEmit
npx vitest run $(ls tests/ward-community*.test.ts tests/ward-community*.test.tsx 2>/dev/null | tr '\n' ' ')
```

Derive the list from disk; never name test files by hand. Prove your coverage assertion can fail:
mutate the index to drop one team, watch the equality assertion go red, restore the file and
confirm it byte-identical by hash before the final run.

## A stale fact to REPORT, not fix

Two places still say the hub has **ten** placeholder teams — `tests/ward-nav.test.ts:326-327` and
`community-screen.tsx:330-335` ("The other nine teams… nine of the ten pages"). The real count is 65. Both files are out of bounds. **Report the exact lines; do not touch them.**

---

# ⚠️ AMENDMENT — my coverage plan above was DEFECTIVE. Replace it with this.

An independent falsifier pass found that the coverage plan I gave you **cannot fail**. Read this
section as replacing the "Coverage" section above wherever the two disagree.

## The index's OWN reachability comes FIRST, before any coverage work

**The highest risk in this task is fixing 65 orphans by creating one.** An index that links all 65
teams, and that nothing links to, leaves all 65 exactly as reachable as they are today — while
every scan and count now reports them healthy. **That is strictly worse than today**, because today
is honestly labelled "0 of 65".

So: assert that the index itself is reachable from the ward-flow root nav, the same way you assert
the teams. Reachability is transitive; tests are not.

**This assertion will be RED until Ward Lead registers the route, and that is correct.** We may not
edit `ward-nav.ts`. Write the assertion anyway, and put a comment on it saying it is red pending
that registration. A declared red is a gap somebody can see; a missing assertion is one nobody can.

## Why my set-equality plan was a tautology

If the index renders from `COMMUNITY_TEAM_PAGES` and the test reads its expectation from
`COMMUNITY_TEAM_PAGES`, **both sides shrink together.** The fixture drops to 64 and the assertion
still passes — not because somebody edited a literal, but because nothing could ever have failed.
I swapped a guard that could be defeated by an edit for one that cannot be defeated because it does
not guard.

Set equality is still worth having — it catches wrong href CONSTRUCTION, which a count never did.
It just cannot be the only assertion.

## The four assertions, each catching something the others miss

1. `hrefs.length === teams.length` — omissions and duplicates in aggregate.
2. `new Set(hrefs).size === hrefs.length` — the duplicate case directly. A team rendered under two
   headings is absorbed by set comparison and caught only here.
3. Set equality of rendered hrefs against the derived set — wrong membership.
4. **The fixture-size pin goes in the FIXTURE'S OWN test, NOT this one.** One place, one clear
   failure message. Then a data change breaks "the fixture changed" and never "the index lost a
   team", and the two failures stay distinguishable.

**Why (4) is a constraint and not a preference:** the owner has ruled the catchment and suburb data
provisional and due for replacement. A hard `65` inside the index test buys churn on every data
revision, and a pin people routinely re-type is not a pin.

## Reachability must be judged from the RENDER, not from source text

A text scan can only ever prove _reads-as-reachable_. Only a render can testify to
_actually-reachable_. So collect hrefs from the **rendered DOM**, and:

- For each team id, assert an href exists whose dynamic segment **`decodeURIComponent`s to that
  id** — not that it _contains_ it. An href can match as a string and 404 as a route. Do the round
  trip on at least one id needing escaping; **if no such id exists in the fixture today, say so in
  the test**, because that is exactly when it would go unnoticed.
- Assert each link is **not inert**: no ancestor with `hidden` or `aria-hidden="true"`, no closed
  `<details>`. A link inside a collapsed group is in the DOM and unreachable by a person — the same
  class of defect you are fixing.
- **State the limit in the test:** jsdom does not apply the CSS module, so it cannot testify about
  `display: none`. Write that down, or the next reader will believe it was covered.

Keep the source-text scan as well. The two measure different things and neither subsumes the other:
the scan catches a route with no way in at all; the render catches a route linked only from
somewhere nobody can reach.

## If you ever do group (you are not, but the rule belongs on the page)

**A grouping is dishonest when a reader can draw a conclusion the data does not support.** The
flat-list ruling stands. But if a grouping key ever appears: assert `sum of group sizes === team
count` explicitly — a multi-valued field either double-counts or silently drops a real
relationship. And never enumerate group names in JSX; that is a second copy of data the owner has
said he will change.
