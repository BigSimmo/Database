# Visual sweep — 2026-08-29

Read-only visual/DOM audit of the running dev app at `http://localhost:3350`. Covered all 15
app modes from `src/lib/app-modes.ts` (home, documents, services, forms, favourites,
differentials, dsm, specifiers, formulation, medications, tools, calculators,
therapy-compass, factsheets, dictionary) and the full Caring Contacts workspace (today,
patients/caseload, one patient record, schedule, templates, team, guidance, reports) at
desktop and phone widths, light and dark colour schemes. `/mockups/**` was not visited per
scope.

Screenshotting was unavailable in this session (the Browser pane never composited frames,
so every `computer` screenshot call timed out). All findings below were confirmed through
the accessibility tree (`read_page`), rendered text (`get_page_text`), and direct DOM/CSS
inspection (`javascript_tool`: bounding rects, `scrollWidth`/`clientWidth` overflow checks,
and a WCAG contrast-ratio pass over every leaf text node) rather than pixels. Two apparent
defects were investigated and ruled out as false positives before being discarded — noted
below for the next person's context.

## Findings

### 1. Unbounded raw-minute duration reads as a nonsensical number — `/caring-contacts/team`

- **URL:** `http://localhost:3350/caring-contacts/team`
- **Breakpoint/theme:** Reproduced at desktop, light and dark (dark confirmed via computed
  colour check; the value itself is theme-independent).
- **What's wrong:** The "Contacts needing review" column reports how overdue the oldest
  exception is using a raw minute count with no unit escalation once the number gets large.
  With this session's synthetic data the value was **"Oldest 44575 minutes since its
  scheduled send"** (≈31 days), and it appears twice on the page (a summary card and a
  per-coordinator row use the same string).
- **What a user would experience:** A coordinator scanning the team roster for what needs
  attention has to mentally divide by 1440 to learn this is "about a month overdue." The
  same page formats a _short_ wait correctly and legibly one paragraph above it — "The
  oldest has been waiting 3 minutes" — so the contrast between a sensible short-duration
  string and a five-digit long-duration string on the same screen makes the second one read
  like a bug rather than a deliberate value.
- **Evidence (page text, current session):** `Oldest 44575 minutes since its scheduled send`
  (appeared for `demo-coordinator`, both in the roster row and the coordinator detail card).
- **Component:** `src/components/caring-contacts/workspace/team-roster.tsx`, lines 237 and
  357 — both call `plural(backlog.oldestMinutesSinceScheduledSend, "minute", "minutes")`
  with no day/hour bucketing. Line 148 does the same for the "unclaimed work" wait, which is
  why short waits look fine and long ones don't.
- **Note:** the surrounding copy on this page is otherwise deliberately precise (e.g. "This
  system holds no name for a member of staff"), so it's possible raw minutes was a conscious
  choice for audit precision. Flagging because the two duration strings on the same screen
  now behave inconsistently in practice — one is human-scaled, the other isn't — regardless
  of original intent.

## Investigated and ruled out (not findings — recorded for the next auditor)

- **Two `<main>` / `<aside>` / header landmarks in the DOM on every route.** First look
  suggested duplicated chrome or a stuck "Loading document results" status region on
  `/documents`. Traced it to a React/Next 16 streaming placeholder container
  (`<div id="S:0" hidden>`) that Next reuses for out-of-order SSR; it carries the
  `hidden` attribute and computed `display: none`, so it is invisible to both rendering and
  the accessibility tree (`getBoundingClientRect()` is 0×0, and `hidden` removes it from AT).
  `get_page_text`'s `document.querySelector('main')` picks whichever `<main>` is first in DOM
  order, which is sometimes this hidden one, so several routes read as falsely sparse when
  spot-checked with that tool alone — the second, real `<main>` had full content every time
  it was checked directly. Not a defect; a quirk of this MCP tool's selector, not the app.
- **Therapy home (`/therapy-compass` → `/?mode=therapy-compass`) appearing to have no search
  box.** The composer lives in the shared top header (`form[role="search"]`, outside
  `<main>`), not in an in-flow hero composer like `/documents` uses — both are valid patterns
  per `docs/search-chrome-behaviour.md`. Confirmed exactly one `form[role="search"]` /
  `input[type=search]` on the page, so the one-composer rule holds.
- **Low-contrast "Let this plan run again" button text in dark mode**
  (`/caring-contacts/patients/demo-seed-patient-rowan`, ratio 3.05:1 against a 4.5:1
  threshold). The button carries `aria-disabled="true"` (the repo's documented pattern for
  "unavailable for a stated reason" controls) and is genuinely inert here because the plan
  isn't currently held — WCAG contrast has no requirement for inactive UI components, so the
  dimmed styling is intentional, not a defect.
- **A recurring `net::ERR_ABORTED` 404 on
  `_next/static/chunks/src_components_applications-launcher-page_tsx_<hash>.js`** on nearly
  every navigation. Confirmed via `read_network_requests` that this is a Turbopack dev-mode
  chunk-hash race: the stale-hash request 404s and is immediately re-requested under a fresh
  hash, which succeeds before anything renders. Reproduced on every route, self-recovers
  every time, never changed what was on screen. Not reported as a finding since it doesn't
  affect what a user sees, but noting it in case it starts actually breaking a render for
  someone else — the pattern is fully consistent, not intermittent.

## Surfaces checked and clean

Desktop + phone (375×812, reloaded), light + dark, no horizontal body overflow, no
unexpected console errors, one search composer per page, content clears the fixed phone
bottom nav (112px scroll-container padding vs. 49px nav height):

- Home `/` (Answer mode)
- `/documents`, `/services`, `/forms`, `/favourites` (table/card duplication in
  `get_page_text` output on this route is the responsive card+row pattern, not a real
  duplicate — dismissed for the same "hidden `<main>`" reason above)
- `/differentials`, `/dsm`, `/specifiers`, `/formulation`
- `/medications`, `/tools` (all 15 tools listed correctly), `/calculators`
- `/therapy-compass`, `/factsheets`, `/dictionary`
- Caring Contacts: `/caring-contacts` (Today — correctly discloses "What this screen will
  show" rather than faking data), `/caring-contacts/patients` (3 synthetic plans, filter
  chips, search-stays-in-tab notice), `/caring-contacts/patients/demo-seed-patient-rowan`
  (dense record: identity, plan state, confirmations, plan actions with correctly-wired
  disabled states, 12-month schedule), `/caring-contacts/schedule`, `/caring-contacts/templates`,
  `/caring-contacts/team` (aside from the finding above), `/caring-contacts/guidance`,
  `/caring-contacts/reports`

Every "not built yet" destination in the Caring Contacts "More destinations" panel (Service
stop, Access trail, Workload, Reconciliation, Notifications, Training, Coverage) correctly
uses `aria-disabled="true"` + a "— coming soon" title rather than a dead-looking enabled
control, and each openly states what it will hold — the deliberate convention this repo
uses, not a defect.

## Bottom line

The app is in good shape. One real finding: the overdue-duration string on the Team page
reads as a nonsensical five-digit number once the backlog is more than a few hours old.
Everything else investigated during this sweep turned out to be either a testing-tool
artifact or a deliberate, documented design choice.
