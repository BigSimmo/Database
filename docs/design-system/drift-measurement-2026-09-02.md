# Design-token drift measurement — 2026-09-02

Two drifts away from the shared design-token contract had never been counted. This is the first
measurement of both, done by seven parallel read-only audits (six splitting `src/components` by
subdirectory to classify every inline `style={{ }}`, one auditing the 16 registered-but-unimported
design-system components), synthesized here. **Nothing was converted or deleted in this pass.** A
ratchet (`docs/design-system/drift-ratchet.json` + `npm run check:design-drift-ratchet`, wired into
`verify:cheap` and CI's `static-pr` job) now pins both counts as a ceiling so they can only be
measured going down from here, never silently grow.

## Metric 1 — inline `style={{ }}` attributes

**232 occurrences** of `style={{` across tracked `src/**/*.{ts,tsx}` (one of the 233 raw grep hits,
`src/components/card-recipes.ts:98`, is inside a `/** */` doc comment describing the pattern, not a
real attribute, and is excluded). Of the 232 real occurrences:

| Classification                                                                        | Count | Share |
| ------------------------------------------------------------------------------------- | ----: | ----: |
| LEGITIMATE (genuinely dynamic — no token category fits)                               |   142 |   61% |
| BYPASS (a colour/spacing/radius/shadow/type value with, or that should have, a token) |    89 |   38% |
| UNCLEAR                                                                               |     0 |    0% |
| audited but not real code (comment)                                                   |     1 |     — |

Two of the seven agents' own one-line count summaries didn't match the row-by-row tables they
returned (off by 2 and by 12 respectively, in both cases a self-arithmetic slip, not a
re-classification). The counts above are recounted directly from each agent's per-row table, which
is the source of truth used everywhere else in this document and in the ratchet ceiling.

### Per-slice breakdown

| Slice                     | Files                                                                                                                                                 | Legitimate | Bypass |                Total |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------: | -----: | -------------------: |
| A — factsheets            | `src/components/factsheets/**`                                                                                                                        |         37 |     23 |                   60 |
| B — dashboard/viewer/ui   | `clinical-dashboard/`, `favourites-phone-perfected-mockups/`, `ui/`, `document-viewer/`, `AccessibleTable.tsx`                                        |         41 |      4 |                   45 |
| C — answer-chat mockups A | `answer-chat-perfected-mockups.tsx`, `answer-chat-redesign-mockups.tsx`                                                                               |         18 |     26 |                   44 |
| D — answer-chat mockups B | `answer-chat-perfected-v2-mockups.tsx`, `answer-loading-redesign-mockups.tsx`, `also-matches-accent-mockups.tsx`                                      |          9 |     17 |                   26 |
| E — app/lib/web-vitals    | `web-vitals-reporter.tsx`, `src/app/**`, `src/lib/**`                                                                                                 |          4 |     16 |                   20 |
| F — misc small components | 24 small files/dirs (dictionary, calculators, differentials, privacy, therapy, dsm, specifiers, caring-contacts, card-recipes, search/filter mockups) |         33 |      3 |                   36 |
| **Total**                 |                                                                                                                                                       |    **142** | **89** | **231** (+1 comment) |

The bypass rate is not evenly spread. Slices C, D and E — almost entirely `-mockups.tsx` preview
files, plus the two non-component `src/app` boundary files (`global-error.tsx`, `opengraph-image.tsx`)
— account for 59 of the 89 bypasses (66%) despite being under half the total volume. Slice F, made of
mostly-real product directories doing genuinely data-driven layout (progress bars, weighted segment
tracks, pan-zoom canvases), has the lowest bypass rate at 8%.

### Why the "legitimate" share is this high, not because bypasses were undercounted

A recurring pattern in slices A, B, C, D dominates the legitimate count and is worth naming
explicitly so it isn't mistaken for undercounted drift: many "LEGITIMATE" rows set `background` /
`color` / `borderColor` to a **runtime-selected token reference** — e.g. `factsheets`'
`categoryTheme()` (`src/lib/category-identity.ts`) and `favourites-phone-perfected-mockups`' `identity`
lookup both resolve to `var(--type-*)`/`var(--tone-*)` strings picked per row/category from data.
`category-identity.ts` documents this as the sanctioned escape hatch for exactly the case Tailwind's
static class extraction cannot reach: a colour that must be a _value_ (inline style), chosen at
runtime, from a fixed token set. These are not literals — the value never leaves the token system —
so they were correctly classified LEGITIMATE, not BYPASS, even though the property is a colour.
Roughly 60 of the 142 legitimate rows are this pattern (factsheets ~37, favourites-rows ~12, status
marks/toasts ~8, specifiers/therapy ~3).

### The bypasses, ranked by conversion value

Not a plan to convert them — a ranking for whoever picks this up next, from clearest win to lowest
priority. "Exact token match" means the literal's numeric/hex value is byte-identical or unit-exact
to a published `@theme` or `ckb-v2-tokens.css` value, so the fix is a mechanical substitution with no
new token needed.

1. **Accent-rule reinvention** — `boxShadow`/`borderLeft: "…3px 0 0 0 var(--clinical-accent)"` hand-rolled
   instead of `var(--rule-accent)` (`ckb-v2-tokens.css`, `inset var(--rule-w) 0 0 var(--clinical-accent)`).
   7 sites: `favourites-rows.tsx:160,209` (real product component), `answer-chat-perfected-mockups.tsx:697`,
   `answer-chat-perfected-v2-mockups.tsx:857,1057,1378` (including a forced-colors branch), and the
   redesign-mockups equivalent. Several use the wrong width (2px vs the token's 3px) — a real, if minor,
   visual inconsistency the token would have prevented. Exact token exists; highest-value single fix.
2. **`FactsheetPrintSheet` token pass** (`factsheet-detail-page.tsx:722–855`) — one component, ~15
   bypasses. `fontSize` values of 26/16/13/12/11px exact-match `--text-3xl-minus`/`--text-base`/
   `--text-sm-minus`/`--text-xs`/`--text-2xs`; `borderRadius:6` exact-matches `--radius-sm`. Two colours
   (`#a3190f`, `#fef3f2`) are byte-identical hand-typed duplicates of `--danger-text`/`--danger-bg` — a
   clinical-safety colour on a **printed patient handout**, silent-drift risk if that palette is ever
   retuned for contrast. Highest safety relevance in this list.
3. **`dashboard-nav.tsx` safe-area bypass** — `dashboard-nav.tsx:248,278` use raw
   `env(safe-area-inset-right/bottom)` where `globals.css` already declares `--safe-area-right`/
   `--safe-area-bottom` for exactly this. 2 sites, real shipped navigation component, and this is the
   exact class of drift `docs/search-chrome-behaviour.md`'s phone-chrome contract exists to prevent.
4. **`--radius-sm`/`--radius-xs` literals reached for instead of the token** — `borderBottomRightRadius:6`
   (answer-chat perfected + redesign, `--radius-sm` exact), `borderRadius:4` (chat-v2 line 1259 and
   loading-redesign line 354 — an **identical duplicated `ProseSkeleton` style**, `--radius-xs` exact),
   `borderRadius:3` (chat-v2 ×2, near `--radius-xs`). 5 sites, mechanical once a radius convention is
   agreed for the shared skeleton-bar style.
5. **`--container-phone-frame` (390px) duplicated as a JS constant** — `PHONE_WIDTH = 390` defined in
   `answer-chat-perfected-mockups.tsx` and imported into 2 sibling mockups instead of reading the CSS
   token; paired with a real _value_ drift where `--radius-phone-frame` (1.85rem) is hardcoded as
   `1.75rem` at 2 sites. Fixing the constant also fixes the mismatch.
6. **`web-vitals-reporter.tsx` dev-overlay literals** — a z-index of `2147483000` outside the `--z-*`
   ladder (self-documented as deliberate isolation, but still a raw value the z-ladder rule normally
   forbids), muted-ink hex (`#cbd5e1`/`#94a3b8`) duplicating `--text-muted`/`--text-soft`, and a
   `RATING_COLOR` map duplicating `--success`/`--warning`/`--danger`. Dev-only, but this is the one file
   in slice E that ships to every page's client bundle in development; same hex-duplicates-a-semantic-
   token risk as item 2.
7. **`global-error.tsx` scale-matching literals** — `fontSize` values matching `--text-sm`/`--text-xs`
   exactly and a `borderRadius:"1rem"` matching `--radius-xl` exactly, but `var()` genuinely cannot
   resolve here (the file's own comment: `globals.css` may not be loaded when this boundary renders).
   The fix shape is different from the rest of this list — a shared TS constants module mirroring the
   token scale, not a `var()` substitution — but it's the app's error boundary, a real production
   surface, and worth a small dedicated pass.
8. **Truncated-label `maxWidth` inconsistency** — 160/150/160px across three different files for what
   reads as the same "rail card label" truncation pattern. No exact token exists yet; this is the
   textbook case for minting one once someone picks the canonical width.
9. **`PROSE_MEASURE = "68ch"` re-declared locally** instead of `var(--measure)` (`ckb-v2-tokens.css`,
   `--measure: 68ch`) — found incidentally by one agent because it's set via a shared style object, not
   a literal `style={{`, so it isn't in the 232 count at all. Same near-duplicate pattern as item 5;
   worth folding into whichever pass touches those mockup files.
10. **`opengraph-image.tsx` background colour** — `#0b1013` is a near-duplicate, not exact match, of
    `BRAND_DARK.tile` (`#171b1e`, `src/lib/brand-mark.ts`). Single site, low volume, but a visible
    marketing asset; needs a human decision on whether the two colours were meant to be identical
    before converting.

**Not recommended for conversion right now** (called out so the ranking above reads as complete, not
truncated): `FactsheetPrintSheet`'s approximate greys (`#555`/`#333`/`#222`/`#666`/`#ddd`) have no
exact token and are deliberately light-locked for print, so converting them means deciding a new
print-ink role first, not a mechanical swap. The remaining one-off decorative offsets and paddings
(14/18/3/6/24/28/12/10px, scattered across the mockup-heavy slices) have no covering token and mostly
live inside `-mockups.tsx` preview files with no live product route — the same demand-driven logic
that governs the 16 unimported components below applies: low leverage to convert a preview file's
styling before it (or its host component) ships.

## Metric 2 — registered components with no product importer

**16 of 55** registered design-system components (`docs/design-system/adoption-manifest.json`) have
zero entries in `productImportFiles` — 29% of the catalogue exists only as a design-sync preview.
This number is not new drift by itself (ledger `#266` records a deliberate "demand-driven adoption,
never a race to 55/55" policy), but it had never been individually audited against forward evidence
before. The audit found the 16 are **not a homogeneous dead-code pile**:

| Component                                  | Bucket                     | Confidence | Evidence                                                                                                                                                                                               |
| ------------------------------------------ | -------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SearchField                                | 1 — awaiting consumer      | High       | Already imported/rendered in `care-plan/mockups/patient-directory.tsx`; named in an **unchecked** task, `docs/superpowers/plans/2026-08-20-care-plan-implementation.md:917`                            |
| Citation                                   | 1 — awaiting consumer      | High       | Named in an unchecked step, `docs/superpowers/plans/2026-08-20-rag-adaptive-answer.md:681`                                                                                                             |
| CitationList                               | 1 — awaiting consumer      | High       | Same plan, same unchecked step (`:650,681`)                                                                                                                                                            |
| ErrorState                                 | 1 — awaiting consumer      | High       | Ledger `#299` names 3 exact file:line hand-rolled call sites to convert, deferred (not declined) pending a site-wide redesign decision                                                                 |
| RadioGroup                                 | 1 — awaiting consumer      | High       | Already imported in `care-plan/mockups/operations-pages.tsx:7`; named in ledger `#266`'s forms tranche                                                                                                 |
| ErrorSummary                               | 1 — awaiting consumer      | High       | Already imported in 2 `care-plan/mockups/*-form.tsx` files; same forms tranche                                                                                                                         |
| DoseLine                                   | 1 — awaiting consumer      | High       | Ledger `#267`: blocked only on a still-missing backend payload, with an explicit "adopt once it exists" instruction                                                                                    |
| Progress                                   | 1 — awaiting consumer      | Medium     | `DocumentManagerPanel.tsx:176-193` hand-rolls the exact ingestion-progress-bar pattern this component replaces; nothing schedules the conversion                                                       |
| LinkAction                                 | 1 — awaiting consumer      | Low        | Actively maintained (open "PR 9" motion work); no named call site                                                                                                                                      |
| DownloadLink / ExternalTextLink / TextLink | 1 — awaiting consumer      | Low        | Only the blanket demand-driven policy; 17 raw `target="_blank"` sites suggest latent need but none name these components                                                                               |
| StageList                                  | 1 — awaiting consumer      | Low        | Purpose statement points at ingestion, but current ingestion UI doesn't match a multi-stage-list shape closely                                                                                         |
| Tooltip                                    | 1 — awaiting consumer      | Low        | Complete, maintained, no forward or superseding evidence found                                                                                                                                         |
| Pagination                                 | 3 — genuinely dead-leaning | Medium     | Its own test documents a real candidate consumer (`review-state-table.tsx`) that explicitly chose a different pattern (server-navigated links) instead — considered and declined, not silence          |
| ToastRegion                                | 3 — genuinely dead-leaning | Medium     | No plan hits, no narrative beyond the policy list; even its own supporting `ToastProvider`/`useToast` machinery has zero product importers — the whole subsystem, not just the visual shell, is unused |

No component was found in bucket 2 ("superseded design") — the shallow clone available to this audit
(96 commits) limited git-recency evidence, so that absence is not strong. **Per the task brief, this
is a triage report, not a deletion list — deletion decisions for any of these go through
`npm run check:dead-code-candidate` separately, evidenced on their own.** Read the full per-component
table with justifications in the stage-1 agent transcript if pursuing any of these; the summary above
is condensed to what changes a reader's decision.

## The ratchet

`docs/design-system/drift-ratchet.json` records both counts above as a ceiling (232 inline styles,
16 unimported components). `npm run check:design-drift-ratchet` re-measures both and fails if either
grows past its ceiling; it's wired into `verify:cheap:internal` and CI's `static-pr` job
(`needs.changes.outputs.static_heavy_changed`), so a PR that adds a 233rd inline style or a 17th
unimported component fails the same local/CI gate as any other design-system contract check.

Lowering a ceiling is one command: `npm run check:design-drift-ratchet -- --update` measures current
counts and writes them, but **only ever lowers or matches** — it refuses to raise a ceiling and exits
non-zero if asked to via a bare `--update` when the count has grown. Raising one on purpose (a newly
legitimate dynamic style, or an intentionally-added preview component) requires the explicit
`--update --allow-increase` combination, which prints the before/after values so the change is
visible in the `drift-ratchet.json` diff during review, and the commit message should say why.

See the adversarial review below for how a contributor could still add an inline style without
tripping the ratchet's comment-line heuristic, and treat any real-world instance of that as a reason
to tighten the check, not to excuse the finding.

## Adversarial review

Two agents were asked to argue against this pass's own conclusions: one that every component
classified as dead-leaning is actually alive, one that the new ratchet is gameable. Findings below
are reported as raised, not softened.

### Are the "genuinely dead-leaning" components actually alive?

**No new evidence overturned either classification; both hold, and are now better supported.** A
full-repo string search for `Pagination` and for `ToastRegion|useToast|ToastProvider` — not just an
import grep — returns the same file sets, so no dynamic import, registry string, or route-config
reference is hiding a consumer either. One genuinely new fact surfaced for both, and it cuts the
same direction as the original finding: the real (non-mockup, `next/dynamic`-lazy-loaded) Caring
Contacts workspace (`src/components/caring-contacts/workspace/**`) is the only other place in the
repo naming these components in a plan (`docs/superpowers/plans/2026-08-14-caring-contact-
coordination-rollout.md` §2.4 names `ToastProvider` as the intended feedback mechanism), and the
part of that plan already built uses banner components instead — not `ToastRegion`/`ToastProvider`.
That is a second "considered (or planned), then not adopted when actually built" data point, not a
counter-example. **Pagination:** no second hand-rolled pager exists anywhere in `src/components/**`
that could plausibly migrate to it (the only other `?page=` hits are PDF/document page-jump
navigation, a different pattern); its only two touches in `git log --all` are its introduction and
an unrelated squash-merge. **ToastRegion:** no root provider (`src/app/layout.tsx` or otherwise)
mounts `ToastProvider` anywhere, so there is no live toast surface it duplicates or could replace —
the entire subsystem is unmounted, not just unstyled.

### Is the ratchet gameable?

Yes, confirmed by reading the script rather than speculating — ranked most to least exploitable:

1. **Computed/variable style props are structurally invisible, with zero intent to evade required.**
   The detector is a literal `line.includes("style={{")`. `const cardStyle = { color: "#0a0a0a" }; <div style={cardStyle} />` or `style={computeStyle(...)}` contain no such substring and are fully idiomatic React — a routine "extract this inline object into a named variable" refactor silently drops a bypass out of the count. This is the ratchet's most severe blind spot because it requires no gaming intent at all.
2. **A component that skips design-sync registration entirely is invisible to metric 2, and hides drift worse than a registered-but-unimported one.** `registeredComponentCount` is derived from `docs/design-system/adoption-contract.json`'s `componentFamilies` — a hand-maintained list, not a filesystem walk of `src/components/**`. A new component that's never added to that file (and `.design-sync/config.json`) is invisible to both the numerator and denominator of the ratio the ratchet tracks, and to `check:design-system-adoption`/`check:design-sync-contract` alike. `check:knip` is the only thing that could catch it, and only while it's genuinely unimported anywhere, including mockups/tests.
3. **The `--allow-increase` escape hatch has no tooling-enforced friction.** Nothing greps for a stated reason the way `pr-policy.mjs` hard-requires a `RAG impact:` line on RAG-touching PRs. `--update --allow-increase` plus a one-line commit passes the gate exactly as green as a real fix; the "shows up in review" property depends entirely on a human actually reading the `drift-ratchet.json` diff.
4. **CSS files are entirely out of scope.** `countInlineStyles()` only reads `git ls-files src` filtered to `.tsx?/.jsx?`. Unlimited hardcoded hex/px added to `globals.css` (outside `@theme`) or a `*.module.css` file is the same class of drift this audit describes, with zero signal from this check or from `eslint-rules/no-hardcoded-hex.mjs` (which only matches Tailwind bracket-notation class literals, not raw CSS or JS object properties).
5. **A whitespace variant (`style={ {`) evades the literal match locally.** Prettier normalizes it back and the pre-push format guard would eventually catch it — but `verify:cheap` (which runs this ratchet) explicitly excludes formatting, so there's a real window where this check alone is fooled.
6. **Untracked files** are invisible to `git ls-files` until staged — a local-only workflow trap, not a way to land undetected inline styles past CI, since the committed state is what CI checks out.
7. **The comment-heuristic itself was checked, not just assumed, and found not exploitable in the under-count direction:** a single-line `/* style={{...}} */` trims to text starting with `/`, not `*`/`//`, so it's still counted (an over-count, the opposite of gaming). For a real inline style to be wrongly excluded, its trimmed text would have to itself start with `//` or `*` — which would make it dead/commented-out code, not a live bypass.

None of these are reasons to trust the ratchet less than a raw grep would deserve — they're reasons
to treat #1 and #2 specifically as known gaps to close before leaning on this check for anything
beyond "did the literal, obvious count grow." Recommended next hardening, in the same priority
order: extend the detector to variable-typed `style=` props (or accept the miss and rely on a real
ESLint no-restricted-syntax rule instead of a line-grep), and generate `registeredComponentCount`
by walking `src/components/ui/**` exports rather than trusting a hand-maintained registry list.
