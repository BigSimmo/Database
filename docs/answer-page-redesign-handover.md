# Answer page redesign — build and merge handover

**Status:** design settled, not built. Nothing in `src/app/(search-app)` or
`src/components/clinical-dashboard` has changed yet.
**Design lives at:** `/mockups/answer-chat-perfected` (the design to build) and
`/mockups/answer-chat-redesign` (the three-way comparison it was chosen from).
**Owner decision on record:** direction A — numbered marks in the prose, one source
drawer that opens from the bottom.

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

> Numbered marks are an enhancement that appears on model-synthesis answers.
> The rail and the drawer must work on every answer, including source-only ones.

That is why the rail and drawer ship first, and the marks second.

---

## 2. What replaces what

The live answer surface opens four separate panels from one answer:

| Today                             | Where                                               | Becomes                                                                                                           |
| --------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Sources capsule → popover / sheet | `answer-content.tsx` `NaturalLanguageAnswer`        | The source rail + the single-source drawer                                                                        |
| Clinical notes sheet              | `answer-result-surface.tsx`                         | Folded into the drawer's per-source content, or dropped                                                           |
| Evidence sheet (6 tabs)           | `answer-result-surface.tsx` → `evidence-panels.tsx` | The drawer. A table on a cited page becomes a chip inside that source                                             |
| Safety findings sheet             | `answer-result-surface.tsx`                         | Stays a distinct surface — safety findings are answer-level, not per-source. Do **not** fold this into the drawer |

`AnswerSupportSummaryCard` is the row of buttons that opens three of those four. It
goes when they do.

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

- **Ship: a mark per rendered section.** Sections are already discrete, source-backed
  modules with exact chunk ids. Attribution is exact because the model asserted it.
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
  decision the owner may still reverse — see §10.)_
- **Touch target.** An absolutely positioned transparent child at `inset -14px -6px`.
  It must not change the line box. Production tap targets in this repo are `min-h-12`
  (48px); do not "correct" that to `min-h-11` — see `AGENTS.md`, it reintroduces a
  known `ui-smoke` flake.
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
  behind the overflow menu.
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
  these become tests of the drawer; port them rather than dropping them, especially
  the focus-move and viewport-pinning cases.
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

## 10. Open decisions for the owner

1. **Status in the mark.** The design deliberately keeps every mark one colour and
   puts document staleness on the rail card and in the drawer. If a claim resting on
   an out-of-date document should say so at the point of the claim, that is a one-line
   change in the mark component — but decide before PR 2, not after.
2. **What happens to `compactCitations`.** The preference currently shrinks the
   sources capsule. The capsule is going. Either retarget it at the rail or retire it.
3. **Clinical notes.** The design folds the clinical-notes sheet away. Confirm nothing
   in it is relied on before it goes; it is the one removed surface with content not
   obviously duplicated elsewhere.

## 11. Related records

- `docs/rag-behaviour/` — read before any PR 3 work.
- `docs/search-chrome-behaviour.md` — the phone chrome contract.
- `docs/wiring-conventions.md` — button and navigation rules the lint gates enforce.
- Ledger `#VXB8XA` — the attribution-accuracy row that rules out post-hoc
  sentence matching.
- Ledger `#231` — the `source_only` fallback rate that decides how often marks appear.
