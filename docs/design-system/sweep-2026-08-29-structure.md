# Structural sweep — 2026-08-29

Read-only audit for defects the enforced lint/test gates cannot see: lying controls, orphaned UI,
broken ARIA/heading/id structure, half-implemented unavailable-control patterns, and shipped
placeholder content. Scope: `src/**` and `src/app/**`, excluding `src/app/mockups/**` and
`*-mockups.tsx` per instructions.

## Result: no confirmed defects

Every candidate this sweep turned up was verified against source and found to be either a false
positive of the search method, or an already-correct implementation of a documented convention.
No finding is reported below the confidence bar stated in the brief ("a false finding costs more
than a missed one here"). Rather than pad the report with weak or unconfirmed items, this records
what was swept, what the near-misses were, and why each was ruled out.

The codebase — and in particular `src/components/caring-contacts/workspace/**`, the largest
recently-landed surface (commit `17df388e8`, "Phase 2B workspace, plan lifecycle, team roster and
database") — is unusually disciplined about the exact conventions this sweep targets: every
unavailable control I sampled implements `aria-disabled` + inert handler + `title` + `aria-describedby`-linked
`sr-only` note correctly and completely; navigation controls that redirect rather than act
(`ReassignWork` in `team-roster.tsx`) document why in visible, screen-reader-reachable text rather
than overstating what they do; and the overlay-trigger contract (`overlay-trigger.tsx`,
`workspace-overlays.tsx`) makes a wired confirm handler a compile error to omit, which forecloses
the "advertises an action it doesn't perform" defect class at the type level for that whole surface.

## What was swept

**1. Controls that lie** — grepped for empty arrow handlers (`onClick={() => {}}`), log-only
handlers, no-op handlers (`onClick={noop}` / `() => undefined` / `() => null}`), and raw internal
`<a href="/…">` anchors bypassing `<Link>`. Zero matches outside comments/docs referencing the
pattern by name. Manually read every "coming soon" surface found by grep
(`favourites-hub.tsx`, `evidence-panels.tsx`, `visual-evidence.tsx`,
`caring-contacts/workspace/{plan-wizard,team-roster,unavailable-destination}`,
`developer-area/hub/panel-card.tsx` + `hub-panels.ts`) — all correctly wired, and
`hub-panels.ts`'s phase-1/href pairing (the one place a data/UI mismatch could silently downgrade
a built panel to a fake-disabled one) is internally consistent for every entry.

**2. Unreachable/orphaned UI** — `tests/route-reachability.test.ts`'s `REACHABILITY_ALLOWLIST`
read first (three entries, all legitimate redirect/legacy targets, per its own comments). Did not
re-run a full orphan-export sweep (that is `check:dead-code-candidate`'s job and it fails closed);
spot-checked that new Phase 2B components are actually imported by their route/shell rather than
just present, and confirmed no new `caring-contacts` route uses a hardcoded href string instead of
`caring-contacts-routes.ts`'s builder (`grep 'href="/caring-contacts'` in the workspace directory:
zero hits — every internal link goes through the canonical builder).

**3. Broken structure**:

- _Duplicate ids in list loops_ — scripted a search for literal `id="…"` inside `.map()` callback
  bodies (the shape that creates one DOM id per row). Six candidates, all false positives on
  inspection: each was a heading `id` defined once, _outside_ the actual list-rendering `.map()`,
  that a crude fixed-length window match had misattributed to a nearby-but-unrelated `.map()` call
  (e.g. `patient-overview.tsx:304`, where the real duplicate-risk loop is the `<ul>{plans.map(...)}`
  a few lines later and uses `key={record.plan.id}` with no `id` attribute at all).
- _Dangling `aria-describedby`/`aria-labelledby`/`htmlFor`_ — scripted a same-file id/reference
  cross-check across every non-mockup `.tsx`. Four candidates
  (`applications-launcher-page.tsx:817`, `patient-safety-plan.tsx:747/872`,
  `pwa-lifecycle.tsx:711/739`, `panel-primitives.tsx` comment). All resolve correctly once traced
  through prop indirection the script couldn't follow: `ModeHomeHero`'s `id={`${testId ?? "mode-home"}-title`}`
  generates `tools-home-title` for the caller passing `testId="tools-home"`; `pwa-lifecycle.tsx`
  passes a `titleId` prop into a child that sets `id={titleId}`; `patient-safety-plan.tsx`'s tab ids
  are `id={`spg-tab-${tab}`}` for a two-value union, matching the two static labels checked; the
  fourth was a doc-comment ellipsis, not a real attribute.
- _Nested interactive elements_ — scripted a `<button>…</button>` scan for a nested `<button>`,
  `<Link>`, or `<a>`. Two candidates, both false positives: `calculator-sheet.tsx:100` is a
  self-closing overlay-dismiss button followed by a separate sibling close button (not nested);
  `ui/button.tsx:55` is a doc comment using the word "button".
- _Heading level skips_ — checked heading sequences in the largest new Phase 2B screens
  (`schedule-screen.tsx`, `patient-overview.tsx`, `templates-library.tsx`, `template-detail.tsx`,
  `operational-reports.tsx`). All sequential (h2→h3→h4→h5 in `schedule-screen.tsx`; h2/h3 pairs
  elsewhere), no skips found.

**4. Both-attribute / disabled-state defects** — scripted a repo-wide (non-mockup) scan for
`disabled` and `aria-disabled` on the same `<button>` tag: zero matches, consistent with the lint
rule. Scripted a second scan for `aria-disabled`-bearing buttons missing _both_ `title` and
`aria-describedby` (the "half-right" pattern the brief specifically asked for): one apparent hit,
`document-image-filmstrip.tsx:42`, which turned out to be a regex artifact — the button's own
`onClick={… : () => onSelectPage(page)}` arrow contains a bare `>` that truncated the tag match
before reaching the (present, correct) `title=` and `aria-describedby=` attributes later in the
same tag. Read the file directly: the control is fully and correctly wired (`title`,
`aria-describedby={pageUnavailableId}`, and a matching `<span id={pageUnavailableId}>` sibling).

**5. Placeholder content** — grepped for `TODO`, `FIXME`, `lorem`/`Lorem ipsum`, and `xxx` across
non-mockup `src`. Zero matches.

## Method notes / limitations

- Structural checks were script-assisted (Python regex over the tree) rather than AST-based, so
  every positive was hand-verified against source before being considered; all cleared. The same
  scripts will produce more false positives than a real parser on dynamic ids/labels built from
  props or template interpolation — that limitation is called out above wherever it produced a
  near-miss, so a repeat sweep can skip re-chasing the same dead ends.
- Did not re-derive dead-export/orphan-module findings; `check:dead-code-candidate` already covers
  that ground and is fail-closed with protections this sweep would only duplicate.
- Given the size of `src/components/**` (~200+ files), this was a breadth-first sweep across
  categories rather than an exhaustive line-by-line read of every file. The heaviest manual
  attention went to the largest and most recently landed surface
  (`caring-contacts/workspace/**`, added in commit `17df388e8`), on the reasoning that new,
  large, freshly-merged surfaces are the most likely place for a gate-invisible defect to exist.
  Older, more stable areas (`document-viewer/**`, `therapy-compass/**`, `dsm/**`, etc.) were swept
  by the same scripted patterns but not separately hand-read file-by-file.
