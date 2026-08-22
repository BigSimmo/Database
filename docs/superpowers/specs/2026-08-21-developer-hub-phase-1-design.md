# Developer hub — Phase 1 design (hub shell, environment strip, task ledger)

Date: 2026-08-21
Status: proposed — awaiting owner approval
Scope: Phase 1 of four. Phases 2–4 are outlined only, not specified.

## 1. Purpose

`/mockups/development` is today a two-item index of in-progress prototypes. This phase turns it
into the **developer hub**: a single login-gated surface that answers "what is outstanding, what
am I looking at, and what should be picked up next", and that later phases extend without rework.

Phase 1 delivers three things:

1. The hub shell — grouped panel layout with a "needs you now" band.
2. The environment strip — which database, which build, live or demo, who is signed in.
3. The **task ledger** page — the recommended running order, all open items, and pending
   requests, rendered from `docs/outstanding-issues.md`.

### The problem this must not repeat

`ISSUES-LIST.html` was a visual register of the same ledger. It was retired on 2026-08-18 as
issue `#338` because it could only be refreshed from a Windows session, so it drifted silently as
work moved to cloud sessions. It looked current and was not.

**Any design that can be correct where it is built and stale where it is read is rejected.**
Section 6 is the whole answer to this and is the load-bearing part of this spec.

## 2. Scope

### In scope

- New route `/mockups/development/ledger`, gated by the existing `DeveloperAreaGate`.
- A build-time generator turning `docs/outstanding-issues.md` into a typed JSON snapshot.
- A consistency gate that fails the build when the snapshot and the ledger disagree.
- Restructuring `/mockups/development` into grouped panels with status pills.
- The environment strip.
- Renaming the Settings entry point to **"Developer"** (currently "Open Development page"), and
  updating `tests/settings-dialog-actions.dom.test.tsx` with it.

### Decisions taken (owner, 2026-08-21)

| Decision    | Choice                                          | Consequence                               |
| ----------- | ----------------------------------------------- | ----------------------------------------- |
| Freshness   | Build-time snapshot with an honest age stamp    | § 6                                       |
| Content     | Queue + open items + pending inbox requests     | § 5                                       |
| Primary use | Decide what to do next — not browse/search      | No search or filter UI                    |
| Page shape  | Option C — hub page, own route for heavy panels | § 4.4                                     |
| Alert band  | Only computed signals                           | § 8.1                                     |
| Item detail | Summary + next action, expandable               | § 8.2                                     |
| Device      | Desktop-first **design**                        | Phone-chrome **gate** still required, § 9 |
| Entry label | "Developer"                                     | Settings dialog + its test                |

### Explicitly out of scope

- **Any write path.** The page is read-only (see 3.4).
- Live GitHub or Supabase reads. Phase 1 is entirely local/build-time data.
- Phases 2–4 panels. Their cards may appear as non-interactive "planned" placeholders.
- Changing `docs/outstanding-issues.md` itself, the inbox format, or `issues:reconcile`.

### Non-goals

- Search and filtering across the 67 open items. The chosen use is "decide what to do next", not
  "browse and hunt". If browsing is wanted later it is a separate change.
- Replacing `/issues` or `npm run issues:report`. This is a second reader of the same file, never
  a second source of truth.

## 3. Domain model

This section is the glossary. The first two entries exist because getting them wrong makes the
page actively misleading; both were found by cross-referencing the ledger's own conventions
against its live rows.

### 3.1 Two independent ranking scales — never merge them

| Term                 | Applies to         | Values                       | Means                             |
| -------------------- | ------------------ | ---------------------------- | --------------------------------- |
| **Priority** (`Pri`) | every open row     | `P1`, `P2`, `P3`             | how much the item matters         |
| **Acuity**           | queue entries only | `A1`, `A2`, `A3`, `Optional` | how urgently it should be started |

These are disjoint in practice. At time of writing the `P1` rows are `#316` and `#CCZ4HB`, while
the single `A1` queue entry is `#231` — three different items. A shared "urgent" badge would
report five urgent things where there are two of one kind and one of another.

**Contract:** the renderer must use visually distinct badge treatments for the two scales, must
label the queue heading as urgency rather than priority, and must never derive one from the other.

### 3.2 Two ID schemes

The ledger's Conventions section states IDs are monotonic `#NNN`. The live file also contains
opaque alphanumeric IDs (`#CCZ4HB`, `#C2D9JF`, `#71NT23`) allocated by the newer inbox system. The
document describes one scheme; the file contains two.

**Contract:** the parser accepts `#` followed by one or more alphanumeric characters. A parser
assuming digits would silently drop the newest items — the ones most worth seeing. An ID cell
containing several IDs ("composite") is retained verbatim and not split.

**Follow-up (not this change):** correct the Conventions prose so it matches the file.

**An ID cell is not just an ID.** 62 of the live rows carry a trailing HTML comment holding the
issue ULID — `| #SZGPAH <!-- issue-ulid:01M0A10Q19SZGPAH22TYYY2366 --> |`. Taking the cell verbatim
yields an "id" containing markup, which then fails to match the queue's plain `#SZGPAH` and silently
breaks the queue→row detail join. The parser strips HTML comments and extracts the `#…` token.

### 3.2b Cells may contain escaped pipes

The ledger contains 8 escaped pipes (`\|`), written by `escapeCell` in `scripts/outstanding-issues.mjs`
so that prose like `a | b` survives in a markdown table. A naive `line.split("|")` turns each into a
column boundary, and the row is then rejected as malformed when it is perfectly valid. The generator
reuses that module's `splitCells`, which honours the escape. Both hazards were found by running the
parser against real data, not by reading the ledger's stated conventions — which describe neither.

### 3.3 Other terms

- **Item / row** — one ledger entry: ID, priority, type, summary, detail, source, added date.
- **Type** — `task` (concrete work), `rec` (recommendation to weigh), `issue` (defect/risk/gap).
- **Queue entry** — a curated, ordered pointer to one or more open rows. Absence from the queue
  means deprioritised, never closed. Order gaps are normal and are not missing work.
- **Capability** — who can do it: Standard, High, Specialist, Operator.
- **Pending request** — an immutable JSON file in `docs/outstanding-issues-inbox/` that has been
  logged but not yet folded into the ledger by `issues:reconcile`. Real outstanding work that is
  invisible in the ledger tables.
- **Snapshot** — the generated JSON this feature builds and ships.
- **Ledger revision** — the git commit that last modified `docs/outstanding-issues.md`.

### 3.4 Why read-only

`check:ledger-write-discipline` rejects direct edits to the canonical ledger. Mutation is only
legal through immutable inbox records plus one serialized `issues:reconcile`. A browser control
that closed an item would either bypass that discipline or fail its gate. The hub therefore
displays and never edits. Acting on an item stays a `/issues` command.

Note: no root `CONTEXT.md` is created. `CLAUDE.md` and `AGENTS.md` are this repo's instruction
surfaces and are deliberately kept non-overlapping; a fourth root file would work against that.
This section is the glossary of record for the feature.

## 4. Architecture

### 4.1 The constraint that decides everything

`Dockerfile` builds the production image by copying `node_modules`, `.next`, `public`, three named
`src/lib` files, `package.json` and `next.config.ts`. **`docs/` is never copied.**

A server component calling `readFile("docs/outstanding-issues.md")` therefore works in dev and
finds nothing in production. That is `#338` repeated exactly.

### 4.2 The pattern the repo already proves

Nine generated datasets (`data/medications-snapshot.json`, `data/forms-catalog.json`,
`data/differentials-snapshot.json`, and others) are `import`ed by modules under `src/lib/`. The
import inlines them into the build output, so they ship inside `.next` and need no runtime file
access. There is no `readFile` of `data/` anywhere in `src/`.

Phase 1 follows that pattern exactly.

### 4.3 Components

| Unit                                               | Responsibility                                                         | Depends on                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------- |
| `scripts/generate-outstanding-issues-snapshot.mjs` | Parse the ledger + inbox, write the snapshot                           | ledger markdown, inbox JSON, git                    |
| `src/lib/developer-area/ledger-snapshot.ts`        | Import the JSON, expose typed accessors, freshness                     | the snapshot                                        |
| `src/lib/developer-area/hub-panels.ts`             | The panel registry: one entry per panel, with group, phase, and target | none                                                |
| `src/app/mockups/development/page.tsx`             | Render the hub                                                         | `hub-panels.ts`, `ledger-snapshot.ts` (counts only) |
| `src/app/mockups/development/ledger/page.tsx`      | Render the ledger page                                                 | `ledger-snapshot.ts`                                |
| `src/components/developer-area/hub/*`              | Panel cards, group sections, environment strip, freshness stamp        | none                                                |
| `scripts/check-outstanding-issues-snapshot.mjs`    | Regenerate and compare; fail on mismatch                               | generator                                           |

The parser lives in the generator, not in the app: parsing runs once at build, and no markdown
parsing code reaches the client bundle.

### 4.4 Page shape — hub sections vs their own route

Chosen shape (Option C of three considered; A was "a route per panel", B was "everything on one
page").

The hub is **one page** using the repo's canonical in-page navigation, `InPageNavHeader`
(`src/components/in-page-nav/in-page-nav-header.tsx`). Per
`docs/search-chrome-behaviour.md` § "Default in-page navigation template", a page adding in-page
navigation mounts that component and does **not** invent a second phone header or a second
scroll-hide owner.

**A panel earns its own route when it is data-heavy, or needs a data source the hub must not
depend on.** Otherwise it is a section on the hub. Phase 1: the ledger takes a route; everything
else is a section. Phase 3's live-Supabase panels will take routes for the same reason — the hub
must never require a database read to render.

Sections are declared as `PageSection` (`src/components/in-page-nav/page-section-index.ts`) for
**all** panel groups including phases 2–4. `useResolvedPageSections` resolves each declared
section to the first _visible_ member of its `targetIds` and drops the rest, so an unbuilt panel
produces no dead jump and a later phase needs no navigation change. Section headings carry
`inPageAnchor` (`src/components/in-page-nav/in-page-nav-classes.ts`); without it a jump lands
under the header.

Both pages are Server Components. The snapshot is therefore read on the server and rendered to
HTML — no ledger data reaches the client bundle. `InPageNavHeader`'s own interactivity is the
only client boundary.

## 5. Data contract

`data/outstanding-issues-snapshot.json`:

```json
{
  "version": "outstanding-issues-snapshot-v1",
  "ledger_revision": { "sha": "<40-char>", "committed_at": "<ISO 8601>" },
  "counts": { "open": 67, "p1": 2, "p2": 33, "p3": 32, "queued": 11, "pending": 3, "resolved": 336 },
  "queue": [
    {
      "order": 1,
      "ids": ["#231"],
      "acuity": "A1",
      "capability": "Specialist — answer path + Operator",
      "timing": "Immediate approved live investigation",
      "estimate": "…",
      "detail": "…"
    }
  ],
  "open": [
    {
      "id": "#316",
      "priority": "P1",
      "type": "issue",
      "summary": "…",
      "detail": "…",
      "source": "…",
      "added": "2026-08-11"
    }
  ],
  "pending": [{ "request_id": "…", "action": "add", "summary": "…", "created_at": "…" }]
}
```

Rules:

- `version` is checked at read time. A mismatch is a build failure, not a render fallback.
- Queue prose is taken from the cited row's own Detail cell, matching `issues-report.mjs`, which
  fixed a real drift where the queue's copy pointed at a refuted approach for days.
- Resolved/archive tables are parsed for counts only and not shipped (scope decision: the page
  shows outstanding work).

## 6. Freshness — the anti-drift design

Three independent mechanisms. Each alone is insufficient.

**6.1 Generation is wired into the build, not a remembered step.** The generator runs from the
existing `docs:update` script and from `prebuild`. Nobody has to remember it.

**6.2 A gate fails the build when the snapshot is behind.** `check:outstanding-issues-snapshot`
regenerates into memory and compares against the committed file. If they differ it fails with the
exact command to fix it, and joins the existing `check:outstanding-issues` family so it runs in
`verify:cheap` and CI. **The snapshot cannot silently fall behind, because falling behind stops
the site deploying.** This is the mechanism `ISSUES-LIST.html` lacked.

**6.3 The page states its own age and cannot hide it.** The header always renders when the ledger
content last changed (`ledger_revision.committed_at`) and how many hours old that is at read time.

It does **not** claim a build time. The snapshot carries no `generated_at`: it must be byte-
deterministic or § 6.2's gate would fail on every regeneration. And the page cannot derive one — the
route is dynamic because `DeveloperAreaGate` reads cookies, so render time is request time, not
build time. Ledger-content age is the honest signal and still exposes a stale deploy: edit the
ledger and the displayed age stays large until the site redeploys.

The stamp is not conditional and has no "fresh" short-circuit that could
suppress it.

## 7. Failure behaviour

Conservative, and loud at build time rather than quiet at read time.

| Condition                                   | Behaviour                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| Ledger file missing or unparseable          | Generator exits non-zero. Build fails.                                           |
| Snapshot missing at build                   | Import fails. Build fails. Never an empty page.                                  |
| Snapshot `version` unrecognised             | Build fails.                                                                     |
| Snapshot disagrees with ledger              | `check:` gate fails with the fix command.                                        |
| Inbox unreadable                            | Generator fails — under-reporting outstanding work is a real fault.              |
| A table row is malformed                    | Generator fails and names the line. No silent row-dropping.                      |
| Ledger revision unavailable (shallow clone) | Snapshot records `null`; page shows "revision unknown", never a fabricated date. |

No case renders a page that looks like "no outstanding work" when the truth is unknown.

## 8. Page design

### 8.1 Hub — `/mockups/development`

One page, `InPageNavHeader` mounted, sections in order: environment strip; "needs you now" band;
then the four panel groups — work and decisions, clinical trust, system truth, reference. Each
group is a `PageSection` with an `inPageAnchor` heading, and all four are declared regardless of
phase.

Phase 1 ships the task ledger, environment, and the existing prototypes as live cards.
Later-phase cards render as non-interactive placeholders carrying their phase label, so the
page's shape is honest about what does not exist yet.

**The "needs you now" band reports only signals this page computes.** In Phase 1 that is the
`P1` count from the snapshot. It must not carry hand-written text about problems whose panel is
unbuilt — a literal string like "red for 26 days" cannot age, and static alert text is the same
class of defect as a stale snapshot. The band renders nothing rather than something unverifiable.
Known-but-unmonitored problems arrive with their panel, in their phase.

Placeholders use `aria-disabled="true"` + `onClick={ignoreUnavailableActivation}` +
`title="… — coming soon"` + an `sr-only` note via `aria-describedby`, per
`docs/wiring-conventions.md`. Native `disabled` is not used: it removes the tab stop and the
reason would never be reachable.

### 8.2 Ledger — `/mockups/development/ledger`

In order: back link; title; freshness stamp; four counts (open, P1, queued, pending); the P1
blockers; the recommended running order with acuity badges and the urgency caption; all open items
grouped by priority; pending requests.

**Item detail is progressive.** Each item shows ID, type, priority, summary and the next action;
the full Detail cell, capability and source expand on demand. Several Detail cells run to multiple
paragraphs, so rendering 67 of them inline would make the page unscannable — which would defeat
the chosen purpose of deciding what to do next.

Expansion uses native `<details>`/`<summary>`, not a click handler. That keeps the page a Server
Component with **zero client JavaScript**, keeps keyboard and screen-reader behaviour correct for
free, and sidesteps `require-button-wiring` (a `<summary>` is not a `<button>`). Item text is
present in the HTML whether collapsed or not, so expansion is a readability device, not a
data-hiding one.

### 8.3 Constraints honoured

- Design tokens only — `eslint-rules/no-hardcoded-hex.mjs`.
- Tap targets `min-h-12` (48 px). **Not** `min-h-11` — that reintroduces a known `ui-smoke` flake
  and is explicitly excluded from generic accessibility advice by `AGENTS.md`.
- Internal navigation via `<Link>`; no raw `<a href="/…">`.
- No second search composer — the hub owns no composer.
- Mockup routes are exempt from the button-wiring and route-reachability gates **only**. They are
  still typechecked, and their chunks are weighed against the separate `mockups` bundle budget
  (25% tolerance). The snapshot is small, but the budget still applies.

## 9. Verification

| Check                                           | Covers                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests for the parser                       | Both ID schemes; composite IDs; priority/acuity separation; malformed row fails; queue prose from row's Detail                                                                                                                                                                                              |
| Unit test for the freshness stamp               | Renders in all states including unknown revision                                                                                                                                                                                                                                                            |
| `check:outstanding-issues-snapshot` self-test   | The gate detects a deliberately stale snapshot                                                                                                                                                                                                                                                              |
| DOM test of the ledger page                     | P1 and A1 render as distinct treatments; counts match the snapshot                                                                                                                                                                                                                                          |
| DOM test of the hub                             | Placeholder cards are `aria-disabled` with a reason, never bare                                                                                                                                                                                                                                             |
| `tests/in-page-nav-route-sections.dom.test.tsx` | Every declared hub section resolves to a **rendered** anchor. Asserted against real DOM, never by grepping for `id=` — that shortcut is the failure `/issues #256` records                                                                                                                                  |
| `npm run verify:phone-chrome`                   | Required **despite** the desktop-first design decision. `InPageNavHeader` is shared chrome, so a defect here degrades phone behaviour on pages that are used on a phone. The decision reduces design effort on this page; it does not remove the shared-surface gate. Run before any `verify:ui` escalation |
| `npm run verify:pr-local`                       | Handoff gate for the whole change                                                                                                                                                                                                                                                                           |

Provider-backed gates are not required: Phase 1 touches no OpenAI or Supabase surface.

## 10. Extension points for phases 2–4

- Panel cards are data-driven from one registry (`hub-panels.ts`), so a later phase adds a card by
  changing one entry's phase from planned to built — no layout change.
- All four group sections are declared in Phase 1 and resolved by `useResolvedPageSections`, so
  phases 2–4 need **no** navigation change at all.
- Group sections take an arbitrary card list.
- The freshness stamp component is generic over "content date vs build date" so later build-time
  snapshots reuse it.
- Live-data panels (Phase 3) will need their own read path and their own approval; the hub does not
  assume all panels share Phase 1's build-time model.

## 11. Risks and open questions

1. **The ledger format is a de facto contract.** A future change to the markdown tables breaks the
   generator. Mitigated by failing loudly and by the parser tests, but it is a real coupling and
   should be noted in the ledger doc.
2. **Snapshot churn in diffs.** Every ledger change also changes the snapshot. Acceptable — it is
   exactly what makes staleness impossible — but it makes the file a frequent merge point.
   Generated, never hand-edited, so conflicts are resolved by regenerating.
3. **Conventions/reality mismatch on IDs** (3.2) is left uncorrected by this change.
4. **Unverified claim.** The recorded state that all 2,851 documents carry an identical placeholder
   quality score feeding ranking has not been re-confirmed in this session. It belongs to Phase 3
   and must be verified before being displayed as fact.

## 12. Phases 2–4 (outline only)

- **Phase 2 — repo awareness.** Work in flight (open changes, checks, review state), documentation
  register, routes and modes, test health. Local data; no new permissions.
- **Phase 3 — clinical trust.** Source review queue (ranked by influence on answers, flagged by
  `pending_qualified_human_review`), source currency, governance debt, ingestion state. Requires
  live Supabase reads and per-use approval.
- **Phase 4 — the rest.** Decision log, hazard register, errors and alerts, speed and weight,
  commands index.
