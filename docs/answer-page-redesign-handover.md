# Answer page redesign — build and merge handover

**Status:** design settled, not built. Nothing in `src/app/(search-app)` or
`src/components/clinical-dashboard` has changed yet.
**Design lives at:** `/mockups/answer-chat-perfected` (the design to build) and
`/mockups/answer-chat-redesign` (the three-way comparison it was chosen from).
**Owner decision on record:** direction A — numbered marks in the prose, one source
drawer that opens from the bottom.
**Second pass:** `/mockups/answer-chat-perfected-v2` — the answer states the first pass
did not draw, plus four corrections listed in §12. Both routes are live; v1 is the
record of what was approved, v2 is what to build from. **Read §12 before §4.**

This document is for whoever builds it. It is written to be executable without the
design conversation: what to build, in what order, against which data, and what will
block the merge if it is skipped.

---

## 1. The finding that shapes the whole build

The design shows a small numbered mark after each claim. Whether that is buildable
depends entirely on whether the answer payload knows which source supports which
claim. It partly does, and the part it does not know decides the build order.

**Verified by reading the code:**

| Data                                         | Where                                                                              | Claim-level?                                                                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `answer.answer`                              | `RagAnswer`, `src/lib/types.ts`                                                    | No. One prose string, no inline markers.                                                                                                                  |
| `answer.answerSections[].citation_chunk_ids` | `src/lib/types.ts:876`, generation contract at `src/lib/rag/rag.ts:340` and `:607` | **Yes, per section.** In the schema's `required` list.                                                                                                    |
| `answer.citations`, `answer.sources`         | `RagAnswer`                                                                        | Answer-level only.                                                                                                                                        |
| `safeAnswerSections`                         | `src/components/ClinicalDashboard.tsx:2866`                                        | **Sections already resolved to `SearchResult` objects** as `citationSources`, sanitized and deduped, and already passed into `StagedAnswerResultSurface`. |

So a numbered mark per **section** needs no change to the retrieval or generation
layer. The data is already at the render layer, unused for this purpose.

**The constraint on top of that:** every fallback and degraded path sets
`answerSections: []` — six of them in `src/lib/rag/rag.ts` (`:894`, `:2912`, `:3129`,
`:3475`, `:4177`, `:4208`). An answer with
`answerQualityTier === "source_only"` is assembled from passages without the model,
so it carries no sections and therefore no claim-level attribution — correctly, since
none is known. `docs/rag-improvement/HANDOVER.md` records a 30-pair blinded read in
which 20/30 (v18) and 21/30 (v19) answers were `source_only`.

**Do not read that as a stable rate.** It is one sample, from 2026-08-18, on the eval
question set, and ledger `#231` is the open row about that fallback behaviour. But it
is enough to conclude the thing that matters here:

> Numbered marks are an enhancement that appears wherever an answer carries sections.
> The rail and the drawer must work on every answer, including source-only ones.

**Corrected 2026-08-24 — do not gate marks on the quality tier.** The six fallback sites
above do set `answerSections: []`, but they are not the only route to `source_only`.
`applyProviderLabels` (`src/lib/rag/rag-extractive-answer.ts`) tags **any** model-less
`routingMode: "extractive"` answer `source_only`, and `buildExtractiveAnswer` passes
`answerSections: naturalAnswer.answerSections ?? []` straight through — so a deterministic
extractive answer can be `source_only` **and** carry sections with support levels. Gate marks
on the sections and their `supportLevel`, never on `answerQualityTier`. One rule, no special
case, and it fails closed: no sections, no marks.

That is why the rail and drawer ship first, and the marks second.

### 1a. Corrected again, 2026-08-25, when the marks were built: sections are the wrong source

Everything above is accurate about `answerSections` and still wrong about the marks, and
the reason only shows up when you try to render one.

`answerSections` is a **second layer**. The generation contract calls it "Second-layer
structured support… distinct source-backed modules that improve scanability"
(`src/lib/rag/rag.ts:340`), and the composition instruction tells the model to write the
prose into `answer` and _then_ use `answerSections` for separate structured support
(`:4313`). A section's body is therefore not text the clinician reads in the prose, so
there is no sentence in the answer for a section's mark to attach to. A mark per section
is only buildable by rendering the sections themselves — which is a different product
decision (more content on the answer surface), not the design that was approved.

**The field that does anchor to the prose is `RagAnswer.supportedClaims`**
(`src/lib/types.ts:519`). `rag-claim-support.ts:1049` builds its top-level entries as
`splitClaims(answer.answer)` — literally the sentences of the displayed prose — and each
carries `supportingChunkIds` and a `supportStatus` of `direct | partial | unsupported`.
`answer-render-policy.ts` already reads it client-side, so it is on the client today with
no payload change.

So the marks are built from `supportedClaims`, and §3's requirement is met by a stricter
route than it asked for: attribution is per _sentence_ rather than per section, and it is
the pipeline's own recorded attribution rather than one the render layer derived. The
resolution rules live in `src/lib/answer-claim-marks.ts` and are exact — a sentence either
**is** a recorded claim (or exactly a run of consecutive all-`direct` ones) or it carries
no mark. Every ambiguity resolves to no mark:

- the display sanitizer rewrote the sentence → no mark;
- two recorded claims disagree about the same sentence → no mark;
- the claim cites a chunk the rail does not list → that citation is dropped, never
  renumbered onto a neighbouring card;
- the word budget cut the sentence short → no mark;
- `supportStatus: "unsupported"` → no mark, and no worded tag either (see §12.2 below,
  superseded by the owner in design review on 2026-08-25).

**Expect partial coverage, and do not tune it up.** A sentence the usefulness pass
rewrote, or one holding several claims at different support levels, renders unmarked with
the rail underneath still carrying every source. That is the designed degrade. Raising
coverage means changing what the generation contract emits, which is PR 3 — protected RAG
surface, owner flag, live eval canary.

---

## 2. What replaces what

The live answer surface opens four separate panels from one answer:

| Today                             | Where                                               | Becomes                                                                                                           |
| --------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Sources capsule → popover / sheet | `answer-content.tsx` `NaturalLanguageAnswer`        | The source rail + the single-source drawer                                                                        |
| Clinical notes sheet              | `answer-result-surface.tsx`                         | **Goes** (settled 2026-08-24). Its content is carried by the prose, the drawer and the rail — audited in §10a     |
| Evidence sheet (6 tabs)           | `answer-result-surface.tsx` → `evidence-panels.tsx` | The drawer. A table on a cited page becomes a chip inside that source                                             |
| Safety findings sheet             | `answer-result-surface.tsx`                         | Stays a distinct surface — safety findings are answer-level, not per-source. Do **not** fold this into the drawer |

`AnswerSupportSummaryCard` is the row of buttons that opens three of those four. It
goes when they do.

---

## 2b. The answer states this has to cover

`AnswerState` (`src/lib/answer-state-types.ts`) has five kinds. The v1 mockup draws one.
Every one of these reaches this surface, and two of them change what the surface must
contain rather than just what it says:

| State               | What changes                                                                                                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ready`             | The drawn case. Marks where sections earn them, rail, drawer.                                                                                                                                                                                   |
| `source_only`       | Often no `answerSections`, so no marks and the rail is the only route to a source (20/30 in the read cited in §1) — but **not always**: the extractive route is tagged `source_only` and can carry sections. Gate on sections, not on the tier. |
| `stale_evidence`    | Adds a banner. Overdue documents are named on the rail card and in the drawer, never in the mark (§4).                                                                                                                                          |
| `partial_retrieval` | Adds a banner, and sections resting on unretrieved documents are absent — drop the section, never the citation.                                                                                                                                 |
| `ungrounded`        | Renders as `source_only` plus a stronger notice.                                                                                                                                                                                                |

Two consequences the design has to answer, both drawn in v2 panel one:

- **The rail can never be the control that gets shrunk when space is tight.** On a
  `source_only` answer it carries the entire reference system on its own.
- **A degraded `AnswerCard` requires `onOpenSource`** (`answer-result-surface.tsx`) — a
  caution is never raised with nowhere to go. That route is the drawer, so the banner's
  action opens it.

**Ordering: the evidence arrives before the prose, but arrives unnumbered.** A `VerifiedEvidencePreviewUnit`
(sequence 0) lands after retrieval, ranking, owner-scope and governance, carrying the
trimmed sources, and the client already consumes it (`search-utils.ts`,
`onEvidencePreview`). The rail can therefore be on screen before there is an answer at all.
Then whole verified sections land — `VerifiedAnswerSectionUnit`, each with its own
`citations` and `supportLevel`. See §12.3.

**But do not number the preview.** `buildEvidencePreviewUnit` emits the top slice of the
retrieval results in retrieval order; `buildAnswerRenderModel` independently rebuilds
`primarySources` from citations, quote cards, section citation ids and core source links,
then dedupes and caps by trust. Different sets, different order — so a number assigned at
preview time can point at a different document once the answer lands, which is exactly the
attribution failure this design exists to prevent. Render preview cards unnumbered and assign
numbers when the answer arrives, or define and test an explicit identity/order reconciliation
contract first. Minimal regression case: preview `[A, B]`, final citations `[B]`.

---

## 3. Build order — three pull requests

Each is independently revertible and independently useful. Do not combine them:
PR 2 changes clinical output and PR 1 does not, so they need different PR bodies
(see §7).

### PR 1 — the source rail and the drawer

**Scope:** replace the sources capsule, the evidence sheet and the clinical-notes
sheet with the rail plus a single-source drawer. No change to the prose. No change to
any file under `src/lib/rag/**`.

Works on 100% of answers, because it needs only `renderModel.primarySources` /
`answer.sources`, which every answer carries.

Files:

- `src/components/clinical-dashboard/answer-content.tsx` — remove the capsule button,
  `SourcePreviewContent`, and the popover/sheet pair. Add `<SourceRail>`.
- `src/components/clinical-dashboard/answer-result-surface.tsx` — remove the evidence
  and clinical-notes `Sheet`s and `AnswerSupportSummaryCard`; mount `<SourceDrawer>`.
  Keep the safety-findings sheet.
- New, both under `src/components/clinical-dashboard/`: a source-rail component and
  a source-drawer component, lifted from the mockup.
- `src/components/clinical-dashboard/source-preview-popover.tsx` — becomes unused.
  **Do not delete it in this PR.** See §8.

### PR 2 — numbered marks on the prose

**Scope:** render marks where `safeAnswerSections` gives them, wire them to the
drawer. Clinical-risk diff — it changes what a clinician reads as the attribution of
a claim.

The mark component is the one in the mockup, lifted as-is. The open question is not
how to draw it but **what a "claim" is**, and there is one answer that is safe today:

- **Ship: a mark per rendered section only after direct support is established.** Sections carry exact
  chunk ids, but those ids record what the model associated with the section; they do not prove that
  every routine claim is directly supported. Gate direct marks on **`AnswerSection.supportLevel`**
  (`src/lib/types.ts` — `direct | partial | nearby | unsupported`, already resolved per section and
  carried on the streamed `VerifiedAnswerSectionUnit`), falling back to `supportedClaims` /
  `evidenceAssessments`. The four levels need **four treatments, not two** — see §12.2. Partial or
  unsupported sections must suppress the plain mark, never silently print one.
- **Do not ship: sentence-level marks derived by matching answer prose to retrieved
  chunks after the fact.** A mark that points at a page not actually supporting the
  claim is worse than no mark, and this failure mode is already an open ledger row —
  `#VXB8XA`, "offline document-match listing cites every retrieved document, not only
  the claim-bearing one". Do not build on that surface without fixing it first.
- **Degrade:** when `answerSections` is empty (`source_only`, or a model answer with
  none), render the prose with no marks and the rail underneath. Do not synthesise a
  mark, and do not hide the rail.

### PR 3 — optional, and only with approval

Raising claim-level coverage means either raising the rate at which the model returns
sections, or changing the contract so `answer` carries inline markers. **Both edit
`src/lib/rag/rag.ts`, which is a protected RAG ranking/generation surface.** That
requires flagging the task to the owner _before_ editing, a live eval-canary
before/after pair, and a `RAG impact:` line in the PR body. Read `docs/rag-behaviour/`
first. Do not fold this into PR 2.

---

## 4. Design contract

Take the values from `src/components/answer-chat-perfected-mockups.tsx` rather than
re-deriving them. The ones that matter:

**The mark.** Superscript, `font-size: 0.7em`, `vertical-align: super`,
`line-height: 0`, padding `0.2em 0.13em`, radius 3, colour
`var(--clinical-accent)`. No left margin — it sits tight against the word it follows;
the earlier margin-plus-padding read as a word space. Hover and focus paint
`--clinical-accent-soft`; the mark whose source is open adds a 1px
`--clinical-accent-border` ring.

- **One colour, always.** Document staleness is not encoded in the mark. It is a
  property of the document, and two hues inside running prose make the eye stop
  twice. Status lives on the rail card and in the drawer. _(This is the one design
  decision the owner might have reversed; **settled 2026-08-24 — one colour stays.** See §10.)_
- **Touch target — the v1 figures are wrong; use these.** An absolutely positioned
  transparent child that must not change the line box, at `inset -7px -10px -8px -10px`
  and **split across a cluster** (outer edges reach 10px, interior edges 2px).
  `inset -14px -6px`, as v1 has it, overlaps the marks on the line above and below —
  prose at this size sets on a ~25px line and 14+14+~10 is 38 — and inside a cluster the
  ±6px extensions overlap across the comma, so a tap between two numbers can open the
  wrong source. The v1 caption claiming "an invisible 44-pixel target" overstates what
  that inset produces.
  **An inline mark cannot reach this repo's 48px production standard** (`min-h-tap`)
  without stealing the line above it. That is a real limit, and it is the argument for
  the rail: every source is reachable a second time from a card at full tap size, and on
  a `source_only` answer the rail is the _only_ route. Size the **rail** at `min-h-12`,
  not the `min-h-11` v1 carries — mockups are exempt from that gate and production is
  not. Never "correct" production to `min-h-11`: see `AGENTS.md`, it reintroduces a
  known `ui-smoke` flake.
- **Forced colors.** The active ring must be an `outline`, not a `box-shadow` — box
  shadows are not painted in forced-colors, so v1's ring vanishes and an open mark is
  indistinguishable from a closed one. The claim wash is a `background`, which is
  remapped, so pair it with a non-colour cue (a 2px left rule on the claim) or the
  mechanism that holds the reader's place disappears exactly for the users who need it
  most. Verified in Chromium `forcedColors: "active"` on `/mockups/answer-chat-perfected-v2`,
  not assumed; `tests/ui-accessibility.spec.ts` already emulates the mode.
- **The prose splitter will not survive real answers.** v1's `Claim` binds the last word
  to the cluster with `block.text.lastIndexOf(" ")`. Production prose runs through
  `SafeBoldText` and carries `**bold**`, so the final word can sit inside a span a string
  split cannot reach. Bind the cluster to a trailing anchor emitted by the renderer, and
  cap the cluster (`1,2,+2`) so a claim on four documents cannot produce an unbreakable
  run wider than a phone column.
- **Never strand.** The final word of a claim and the whole mark cluster are wrapped
  in one `whitespace-nowrap` span, so a number cannot fall alone onto the next line.
- **Clusters.** Multiple sources render `1,2` with a `--text-soft` comma at
  `margin: 0 -0.02em`. Each digit is its own control.
- **It must be a `<button>`.** Do not reach for a span here. The mark is a single
  glyph, so it never needs to wrap, and a button gets the semantics for free.
  (The opposite is true of a multi-word inline phrase — Blink and WebKit coerce a
  button to `inline-block` whatever `display` says. That is why direction C used a
  span with `role="button"`. It does not apply to direction A.)

**The rail.** Horizontally scrolling cards, `min-h-11`, `rounded-xl`, 1px
`--border`, `--surface-raised`. Each card: a `h-5 min-w-5` numbered badge tinted by
document status (accent, or `--warning-*` when review-due), the short title truncated
at 160px, then `p.12 · Current` in `--text-muted`. The active card takes an accent
border and `--e1`.

> A coloured left edge was tried in place of the tinted badge and **rejected by the
> owner** — it read as a separate object beside the card. Do not reintroduce it.

**The drawer.** One source at a time. A single chrome row — prev, the numbered pager,
next, spacer, overflow menu, close — then the source title, one metadata line
(`p.14 · Local formulary 2025 · Current`), the passage as the hero, an optional table
chip, and one primary action (`Open page 14`). Natural height, capped at 78%; on
desktop a centred panel at `max-width: 560px` rather than a full-width sheet.

- Secondary actions (copy passage, scope search to document, ask about passage) live
  behind the overflow menu, **plus one more: "This page doesn't support the claim."**
  `evidence-panels.tsx` already ships the taxonomy (`wrong_source`, `missing_source`,
  `numeric_error`, …) and `RagAnswer` carries `interactionId` / `feedbackToken`. Once a
  number points at a specific page, the moment a clinician opens it and finds it does not
  say that is the highest-value moment in the product to catch a bad citation, and v1 has
  no feedback control anywhere.
- **Support comes back, as one clause of words** — not the pill v1 struck as "never
  actionable". If support decides whether a claim may carry a number (§3), it is the most
  actionable field on the surface, and the reader is owed the reason at the moment they
  open the page it points at. One line: "This page states the claim directly." /
  "This page supports part of the claim…" / "Related — this page does not state the claim."
- **The pager does not scale past four.** `answer-render-policy.ts` caps primary sources
  at 6 for high trust; six 36px buttons plus prev, next, overflow and close need ~396px
  inside a ~362px phone drawer. Keep the numeric pager while `N <= 4` — random access by
  number beats stepping — and above that show `‹ N of M ›`, with the rail behind still
  giving random access.
- **Build it on `src/components/ui/sheet.tsx`, do not hand-roll it.** `Sheet` already
  portals into `OverlayRoot`, traps focus, returns it with late resolution, handles Escape
  and backdrop-pointer-down discipline, and is a bottom sheet on phone and a centred
  dialog from `sm:` up — which is this drawer's spec exactly. v1's version sets
  `aria-modal="true"` without inerting the background and scopes its Escape handler to
  _focus inside the dialog_, so Escape does nothing if focus lands elsewhere.
- Left/right arrows and Escape are wired. The pager is the same control by mouse.
- **The claim that owns the open source is washed in `--clinical-accent-soft`** while
  the drawer is open. This is not decoration: the drawer covers the lower third of a
  phone, and this is what stops the clinician losing the sentence they were checking.
- The menu state is per source. In the mockup that is done by keying the panel on the
  source id — keep that, it avoids a `setState`-in-effect lint error.

---

## 5. Phone chrome rules that will bite

Read `docs/search-chrome-behaviour.md` before touching layout. The relevant ones:

- **One composer per page.** The answer surface uses the shell composer. The drawer
  must not introduce a second input.
- **Edge-to-edge phone composers** sit flush to the viewport bottom and own their
  safe-area padding. The drawer sits above the composer in the z-order, not inside it.
- **Hidden chrome means zero reserve.** Do not add reserve padding for the drawer.
- Z-index must land on an allowed rung (`eslint-rules/require-z-index-ladder.mjs`:
  0, 5, 10, 20, 30, 40, 60, 80–85, 95, 100, 110). The mockup uses 20 for the drawer
  and 30 for the menu inside it.

The mockup sets several values with inline styles rather than Tailwind classes. **That
is a mockup-only workaround** — `globals.css` excludes `./mockups` from utility
generation, so a novel arbitrary value written in a mockup file never reaches the
stylesheet. Production files are scanned normally, so in `src/components/**` use
ordinary Tailwind utilities and design tokens. Never hardcode hex
(`eslint-rules/no-hardcoded-hex.mjs`).

---

## 6. Tests

**Existing tests that will fail and must be updated, not deleted:**

- `tests/ui-smoke.spec.ts` — asserts `plain-answer-response`, `source-capsule-preview`
  and `source-capsule-preview-row` in more than one place (the row count is asserted
  at `:1979`, and the row is re-used at `:3144`). The row assertion is the one that
  changes shape: the drawer shows one source plus a pager, not a list.
- `tests/ui-stress.spec.ts`, `tests/ui-tools.spec.ts` — same test ids.
- `tests/source-preview-popover.dom.test.tsx` — 16 cases pinning the popover's
  positioning, portalling and focus behaviour. If the drawer replaces the popover,
  these become tests of the drawer; port them **onto `Sheet`** rather than dropping them,
  especially the focus-move and viewport-pinning cases.
- `tests/answer-preferences.dom.test.tsx` — pins the `compactCitations` preference
  behaviour on the capsule label, including that the missing-source warning is
  **never** hidden in compact mode. Decide explicitly what `compactCitations` means
  once the capsule is gone; do not let the preference silently become a no-op.

**New tests to write:**

1. A mark renders per section with the section's chunk ids, and clicking it opens the
   drawer on that source.
2. An answer with `answerSections: []` renders no marks, still renders the rail, and
   does not crash.
3. A `source_only` answer keeps its existing amber disclosure alongside the rail.
4. The claim highlight follows the open source, including a claim citing two sources.
5. Drawer keyboard contract: left/right change source, Escape closes, focus returns
   to the mark that opened it.
6. The mark's accessible name is distinct from the pager's ("Source 2, …" vs
   "Show source 2, …") so the two controls do not announce identically.
7. A routine partial or unsupported section renders no direct claim mark; only
   `supportLevel` / `supportedClaims` / `evidenceAssessments` may establish direct
   attribution.
8. Each of the four `supportLevel` values renders its own treatment: `direct` a plain
   number, `partial` a marked number, `nearby` a worded control that opens the drawer,
   `unsupported` worded and **not** a control.
9. Two marks in a cluster have non-overlapping hit rectangles, and a mark's rectangle does
   not overlap the marks on the adjacent lines.
10. The pager renders as a counter above four sources and does not overflow a 390px
    viewport at six.
11. Under `forcedColors: "active"` the open mark is still distinguishable from a closed
    one, and the claim owning the open source is still identifiable.
12. `stale_evidence` and `partial_retrieval` render their banner and its `onOpenSource`
    route, and that route opens the drawer. `source_only` renders the compact disclosure
    instead, and does not restate the verification notice.
13. A `source_only` answer that **does** carry sections still renders its marks — the gate is
    the sections, not `answerQualityTier`.
14. Opening the drawer from the rail or the pager shows no claim-support sentence; opening it
    from a mark shows that mark's section support, including when one source is cited by two
    sections at different support levels.
15. Preview-stage source cards render unnumbered, and numbers appear only once the answer
    lands.

---

## 7. Gates and PR bodies

Run the smallest gate that covers the change, then widen. Consult
`npm run arbiter -- <gate>` first and quote its verdict.

- PR 1 and PR 2 are executable UI scope: `npm run verify:pr-local`.
- Before any browser claim: `npm run ensure`, then `npm run verify:phone-chrome`
  (it selects the affected owners before escalating to the full `verify:ui`).
- `npm run format` **and commit the result** before pushing. It is in neither
  `test`, `typecheck` nor `lint`, and changed-file CI blocks on it.
- Domain check: this touches answer generation output, so add
  `npm run check:production-readiness`.

**PR bodies are parsed input, not prose.** `scripts/pr-policy.mjs` hard-blocks merges:

- **PR 2 is a clinical-risk diff** (it changes clinical output). It needs a complete
  `## Clinical Governance Preflight` with every item checked, written in full from
  `.github/pull_request_template.md`, structure verbatim. Paraphrasing silently fails.
- **PR 3 touches a RAG surface** and needs a satisfying `RAG impact:` line —
  either `RAG impact: no retrieval behaviour change — <reason>` or
  `RAG impact: behaviour change — canary pair <baseline> -> <post>`.
- PR 1 may need neither, but check `classifyPullRequestFiles` rather than assuming.

**Merging to `main` deploys to production** (Railway auto-deploys `main`). There are
no Supabase migrations in this work, so no database risk — but do not enable
auto-merge on a clinical-risk PR outside a window the owner has agreed.

---

## 8. Do not delete the old code in the same PR

`npm run check:dead-code-candidate -- --diff origin/main` fails closed for good
reason, and this work will strand several exported symbols
(`SourcePreviewContent`, `sourceCapsuleDisplay`, parts of `evidence-panels.tsx`).
"Nothing imports it" is necessary and nowhere near sufficient in this repo — a
cleanup sweep on that reasoning had to be walked back seven times (PR #2204).

Land the new surface first, let it sit, then remove the old one in a separate PR that
passes the dead-code gate. `sourceCapsuleDisplay` in particular is pinned by
`tests/answer-preferences.dom.test.tsx`.

---

## 9. Rollback

Each PR reverts cleanly on its own. If a problem is found after merge, revert the
relevant PR rather than patching forward — the answer surface is the app's centrepiece
and a half-fixed reference system is worse than the old one.

If you want a safer landing than revert-on-failure, gate the new surface behind an
env flag following the `NEXT_PUBLIC_MOCKUPS_ENABLED` pattern in `src/lib/env.ts`
(`z.enum(["true","false"]).optional()` plus a helper). That is a judgement call, not a
requirement — it costs a branch in the render path that has to be removed later.

---

## 10. Decisions — settled by the owner, 2026-08-24

All four are settled. They were judged against the frames in
`/mockups/answer-chat-perfected-v2`, which already draws each one the way it was decided.
**Do not reopen these while building.** The reasoning is kept alongside the verdict so a
later reader can see why, rather than re-deriving it.

1. **Status in the mark — NO. Every mark stays one colour.** Document staleness is a
   property of the document, not of the claim, and two hues inside running prose make the
   eye stop twice at reading speed. Status is carried where there is room to say it in
   words: the rail card's tinted badge and the drawer's metadata line. This also keeps the
   mark legible in forced-colors, where a second hue would not survive (§4).
2. **`compactCitations` — KEEP, retargeted at the rail.** Compact collapses the rail to a
   single `Sources · 3` chip that expands on tap. The preference therefore keeps meaning
   something instead of silently becoming a no-op when the capsule goes. The invariant
   `tests/answer-preferences.dom.test.tsx` pins — the missing-source warning is never
   hidden in compact mode — still holds, because the verification notice, the source-only
   disclosure and any worded mark all sit outside the rail.
3. **The table aside — GOES. Tables fold into the drawer.** The wide-screen
   `table-specific-answer-layout` column is removed; a table on a cited page becomes a chip
   inside that source. The accepted cost is that a table can no longer be read side by side
   with the answer on a large screen — it is one tap away instead. Stated so the removal is
   deliberate; see §12.5.
4. **The clinical-notes sheet — GOES.** Audited before the decision was recorded rather
   than after; the audit is §10a. Nothing in it is lost, but two at-a-glance views are, and
   one of those is worth re-checking before the old surface is actually deleted.

### 10a. Clinical-notes Essentials audit (2026-08-24, corrected)

The Essentials tab is the only removed surface whose content was not obviously duplicated, so
it was traced rather than assumed.

**Trace the rendered rows, not the builder.** The first version of this audit read
`buildClinicalOutputSections` (`src/lib/ward-output.ts`) and reported every section it
produces. That is wrong: two of those sections never reach the screen. Corrected after review
of PR #2358, by tracing what actually renders.

What the sheet renders, exactly:

- `clinicalNotesDetailSectionsForAnswer` (`evidence-panels.tsx`) ends with
  `.filter((section) => section.items.length > 0)`, so any section carrying only `tables`
  is dropped before the tabs are built.
- `clinicalNotesRowsForTab` then builds rows with `for (const item of section.items.slice(0, 4))`.
  **A table never becomes a row.**
- `displayItemsForClinicalDetailSection` additionally drops items already redundant with the
  answer prose, keeping the originals only when that would empty the section — so the sheet is
  a de-duplicated view of the prose to begin with.

Consequently:

| Essentials section          | Created as                                                                      | Renders?                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `support-map`               | `items: []` plus one structured-support table (`ward-output.ts:705`)            | **Never.** Dropped by the empty-items filter                                                     |
| `comparison`                | `items: []` plus one table when the prose produced no comparison lines (`:766`) | **Only when the prose produced comparison items**; the table-only form is dropped                |
| `thresholds`                | `items: thresholdItems` plus tables                                             | **Its items only** — the threshold lines from the prose and quote cards. Its tables never render |
| `monitoring` / `medication` | items from `parsedLines`                                                        | Yes — and those lines are the answer prose and `sectionDisplayLines`                             |

**Corrected conclusion: no content is lost, and one at-a-glance view is.**

Every row the Essentials tab renders originates in the answer prose or its sections, which the
new design shows as the prose itself. The earlier claim that a _stacked per-document comparison_
view would be lost was wrong — that view is table-only and never rendered here.

**The one real loss is the grouped threshold list**: `thresholds` items collect the
threshold-shaped lines into a single scan, and the new design has no equivalent. Every value is
still on screen or one tap away, so it is not a blocker — but re-check it against real answers
once the rail and drawer ship, **before** the old surface is deleted in the separate PR §8
already stages.

**A method note worth keeping.** This audit was wrong the first time in the same way the
first-pass design was wrong: it asserted from a code path without checking what the code path
puts on screen. When this document says "confirm nothing is relied on", it means trace to the
rendered output.

## 11. Related records

- `docs/rag-behaviour/` — read before any PR 3 work.
- `docs/search-chrome-behaviour.md` — the phone chrome contract.
- `docs/wiring-conventions.md` — button and navigation rules the lint gates enforce.
- Ledger `#VXB8XA` — the attribution-accuracy row that rules out post-hoc
  sentence matching.
- Ledger `#231` — the `source_only` fallback rate that decides how often marks appear.

---

## 12. Errata against the first pass

Found by reading the code, after this document was written. Each is a place where
following §4 literally produces something that will be sent back at review, or that does
not work. All four are drawn corrected at `/mockups/answer-chat-perfected-v2`.

### 12.1 The verification line is on the wrong side of the answer

v1 places its own `VerifyLine` — "AI-generated · check each number against its page" —
_below_ the prose. `answer-result-surface.tsx` records the opposite decision with its
reasons and issue numbers (#207, #227, #228): system-owned verification wording sits
**above** the prose in document order, on screen and print alike, and its attribution is
read from `answerQualityTier` precisely so it can never announce "AI-generated" above a
notice saying no model wrote this answer. Either the line replaces the `AnswerCard`
notice — a design-system change with its own review — or it goes. Do not ship it as drawn.

### 12.2 `supportLevel` needs four treatments, not two

v1 has a number and a worded "no source", with nothing between, while its drawer strikes
support as "never actionable". §3 requires marks to be gated on support, which makes it
the field that decides whether a number appears at all. Drawn in v2:

| Level         | Treatment                                                                         |
| ------------- | --------------------------------------------------------------------------------- |
| `direct`      | Plain number.                                                                     |
| `partial`     | Number plus one trailing glyph; the drawer says which part in words.              |
| `nearby`      | Worded "related" — still a control, because the reader should see what it says.   |
| `unsupported` | Worded "no source" — a statement, not a control: there is nowhere for it to lead. |

A dotted underline and a 1px bottom border were both tried for `partial` and **neither is
drawn** under a `0.7em` glyph with `line-height: 0` — checked in the browser. Use a glyph.

### 12.3 The streaming frame draws a state this product refuses to be in

v1 panel five shows a typewriter caret mid-sentence. `src/lib/answer-stream-contract.ts`
excludes `token` and `revising` events by name — "accepting those events would re-expose
unvalidated clinical prose" — and `docs/verified-answer-incremental-delivery-design.md`
rejects raw model-token delivery, provisional prose and in-place revision outright. That
frame cannot legitimately occur, so do not build a caret for it.

What does occur is better, and it is the sequence v2 panel three draws: evidence preview
lands and the rail paints, then verified sections land whole. It is also buildable now —
the preview half already ships.

### 12.4 Two corrections found in review of this document (2026-08-24)

Both were raised against PR #2356 and both were verified in the code before being accepted.

- **`source_only` does not imply section-less.** See the corrected block in §1. The invariant
  as first written would have suppressed marks on extractive answers carrying perfectly good
  section-level citation ids.
- **The evidence preview must not be numbered.** See the ordering block in §2b. Numbering it
  and promising the number is stable would reintroduce, in the streaming path, the exact
  wrong-page attribution the design forbids everywhere else.

### 12.5 The table aside — raised as an unacknowledged removal, now decided

`data-testid="table-specific-answer-layout"` gives tables their own column on `lg:` today
(`answer-result-surface.tsx`). Folding tables into a chip inside the drawer removes that
column — a real change to a shipped layout, raised here because the design was making it
silently.

**Settled 2026-08-24: the column goes.** The table travels with the page it came from, and
the answer keeps one reading column. The accepted cost is that a table can no longer be read
side by side with the answer on a large screen. Still state it in the PR body — a reviewer
seeing the aside disappear deserves the sentence.

---
