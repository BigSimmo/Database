# Clinical KB design system — DECISIONS

**The five conflicts resolved — what was chosen, what was rejected, and why — plus the
clinical Q&A that shaped the component specs, the assumptions register, and the blocked
list.**

- **Date:** 31 July 2026 · companions: [SPEC.md](SPEC.md) · [TOKENS.md](TOKENS.md) ·
  [COMPONENTS.md](COMPONENTS.md) · [GATES.md](GATES.md)
- **State corrections established while resolving:** the design-system work is **committed**
  as `ef13a072a` on branch `claude/clinical-kb-design-system-333a69` (local-only, base
  `cf7728ca2`) — the briefing's "uncommitted" is stale. The export zip's token file is
  byte-identical to the committed copy **[verified: diff]**. The design side's own
  `ckb-v2-tokens.css` was **not** among the attachments (the zip is the repo-side export the
  audit reviewed: 44px tap, no `--shadow-well`).

---

## C1 · One reconciled token inventory

**Chose.** [TOKENS.md](TOKENS.md) is the single inventory: every role, its winning name, its
owner file, and what it replaces. Divergence outcomes: `--shadow-well` adopted and the v2
`--shadow-inset` overrides removed (bevel semantics restored, with the contract-test inset
pin at `tests/ckb-v2-token-contract.test.ts:164-169` updated in the same commit);
`--quantity-unit-tracking` + `--quantity-unit-gap` win over `--quantity-unit-scale`;
`--spacing-tap` in `@theme` is the only tap knob and `--tap-min` becomes its alias; the
evidence-spine / status-mark names were authored repo-side at commit `59e4c3dfc`, while
`ConfidenceMeter` remains absent (see Resolution log for details).

**Rejected.** Reconstructing the design-side names from prose descriptions. That is exactly
the restate-values-in-prose failure that produced eleven divergences last cycle — a
reconstructed token is a third source of truth wearing the second's name.

**Why.** The two-sources-of-truth failure restarts whenever both sides can mint names
independently. The inventory kills it by making every role carry one winner and one owner;
anything that cannot be verified is listed as blocked rather than guessed.

---

## C2 · The tap-target knob lands in `@theme`, never in the v2 layer

**Chose.** The 44→48 change is made to `--spacing-tap` in the `@theme` block of
`globals.css` — the token the `min-h-tap` / `h-tap` / `size-tap` utilities compile against.
`--tap-min` in the v2 layer becomes a pure alias (`var(--spacing-tap)`), and the v2 layer
never declares `--spacing-tap`. What moves with it, in the same change: the contract-test
pin (`ckb-v2-token-contract.test.ts:181-185`), the `Button` comment that still claims 44px,
and a dedicated visual-QA pass — it is a 407-call-site geometry change and ships as its own
PR (5b). No existing 48px target (`min-h-12`, 53 sites) is touched.

**Rejected.** Declaring the value in the v2 layer. In the design side's `:root`-structural
copy it silently **loses** a same-specificity cascade tie to `@theme` (later wins), leaving
the file claiming 48 while the app renders 44 — a wrong number that reads as fixed. In the
repo's class-scoped copy it would instead **win** inside opted-in subtrees, producing a
44/48 split app. Both failure modes are worse than the current honest wrongness.

**Why.** One knob, at the layer that actually generates the utilities. Every other placement
creates a value that is either dead or forked.

---

## C3 · Structural tokens stay class-scoped on `.ckb-v2`

**Chose.** The repo copy's class scoping stands. The design side's §1.1 (":root so they
apply with or without the shell class") is recorded as a defect in its copy — its own §2.3
correctly warns that the same adoption repaints the app, and a reader who stops at §1.1
imports a repaint believing it is an opt-in. Promotion of the structural half to `:root` is
a separate, staged, **app-wide** change at the end of adoption, with its own
visual-regression pass. Blast radius, honestly: ≈663 legacy type call sites, every
`rounded-md` (the radius step differs between layers), and a prose reflow from the
line-height change — per template × theme × density.

**Rejected.** Moving structural to `:root` now. "Design-system-only work with no site-wide
repaint" is the standing scope constraint, not a preference; recommending `:root` would
require asking first, and nothing in the last two cycles produced a reason to spend that
ask.

**Why.** The class scope is what makes every adoption step reversible and diffable one
surface at a time. The cost — carrying the transitional two-layer architecture
(SPEC §4.11) a while longer — is bounded and already documented; an uncommanded repaint is
neither.

---

## C4 · The v2 forced-colours block covers the descendant form

**Chose.** The v2 layer ships its own `@media (forced-colors: active)` block, placed **after
all v2 theme declarations in the same file**, with exactly this selector list:
`.ckb-v2`, `.dark .ckb-v2`, `.ckb-v2.dark`.

**Rejected.** (a) Relying on the global HCM block: it declares on `:root`/`.dark`, so any v2
theme rule that declares the same custom property **on the subtree root itself** starves the
inherited HCM value regardless of file order. (b) A `.ckb-v2`-only v2 block: after the
cascade fix, the dark theme rule `.dark .ckb-v2` is specificity (0,2,0) and beats a
(0,1,0) HCM rule outright — dark-mode high contrast would still lose. (c) The design side's
stated justification ("this layer loads later, so it would silently win"): true in the
design project, **false in the repo**, where the v2 import sits at the top of `globals.css`
and the global HCM blocks sit thousands of lines later. The portable justification is
within-file ordering: the HCM block beats the `.ckb-v2` theme block on the (0,1,0) tie only
because it comes later **in the same file**, and it beats the dark forms only because it
matches them at equal specificity.

**Why.** Custom properties follow the normal cascade; forced-colours support that depends on
import order is one refactor away from silently dying. The selector triple is the smallest
set that wins at every specificity the theme layer can produce. Porting note: the
opt-in-scope contract test accepts only selectors starting `.ckb-v2`
(`ckb-v2-token-contract.test.ts:70`) — `.dark .ckb-v2` requires the filter to learn the
ancestor form in the same commit, both here and in the cascade port (SPEC §4.1).

---

## C5 · Three identity families cover thirteen modes

**Chose.** Three families — `--kind-source`, `--kind-answer`, `--kind-workspace` — with the
mode mapping in SPEC §3. No fourth family. The four hue tones and the two specifier tones
are re-described as what the evidence shows they already are: **category colour within a
surface**, a separate channel that keeps the frozen `--tone-*` tokens and never encodes mode
identity.

**Rejected.** A fourth family (a "reference/framework" kind for dsm · specifiers ·
formulation · therapy-compass was the candidate). Nothing loses its distinction under three:
**[verified:** no mode carries a hue as its identity today — `mode-home-template.tsx`'s tone
map serves pills, and the four hues in live use label Services _pathway categories_
(ATSI / Youth / Telehealth / Free, `services-home-page.tsx:47-83`) plus specifier
categories (`specifier-ui.tsx:282-294`), not modes.**]** The kind families answer the safety
question — _is this evidence, machine output, or my workspace?_ — and reference modes are
evidence surfaces (`--kind-source`). A fourth family would re-split the channel the freeze
exists to stabilise, for a distinction no current surface draws.

**Why.** The conflict dissolved once the two channels were separated: "four tones for mode
identity" was a misreading of category colour. Kind identity is the channel that must stay
scarce — three meanings a clinician can learn; a fourth dilutes all three. The per-mode
mapping is **[assumed]** where a mode's kind is judgement (differentials, prescribing →
source), flagged in SPEC §3 and cheap to veto mode-by-mode.

---

## Q&A record — clinical inputs (31 July 2026)

| #   | Question                                               | Answer                                                  | Design consequence                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | What do you do when an answer cites an overdue source? | **Re-verify and keep using**                            | Stale evidence is a caution, never a gate: answer stays readable, each overdue source named with a one-click open-at-cited-page action; DoseLine overdue mark is also an affordance. (COMPONENTS §2)                                                                         |
| Q2  | How often do answers get printed?                      | **Occasional but real**                                 | Print specified fully; print primitives built in the answer-surface tranche; per-component print proof stays manual, not blocking. (SPEC §4.12, GATES)                                                                                                                       |
| Q3  | Is the bedside phone case real?                        | **Real**                                                | 320px reflow and compact variants are **blocking acceptance** for the eight new components. (SPEC §4.13)                                                                                                                                                                     |
| Q4  | Who else reads a printed answer?                       | **Patient record + other clinicians + patients/carers** | A printout is a standalone clinical document: self-contained printed VerificationNotice, full provenance, printed-by/at, absolute dates, link-back as courtesy only — plus a **plain-language wording variant** for patient/carer-facing prints. (COMPONENTS §1, SPEC §4.12) |

---

## Assumptions register

Assumptions proceed as stated and are flagged inline where used; each is cheap to veto.

1. **Mode → kind mapping** for differentials and prescribing as `--kind-source` (SPEC §3).
2. **"Withheld" excluded** from the missing-value phrases until a redaction path exists
   (SPEC §11, COMPONENTS §3).
3. **No patient-identifying data is entered** anywhere in the product; autocomplete guidance
   therefore covers benign fields only (SPEC §9.7). If this changes, revisit before building
   the surface.
4. **Product-import counts** for `main`-tier shared components are assumed >0 rather than
   enumerated (COMPONENTS §0.1); the adoption tracker owns exact counts.
5. **Forced colours is owned, not best-effort** (SPEC §4.2) — a support decision taken here
   because status encoding is safety information; the cost is the planned gate, and until it
   exists the support claim is an intention.
6. **Document location:** this set lives at `docs/design-system/` and supersedes the four
   prior documents; the export's `DESIGN_GUIDE.md` remains a snapshot artefact, not a spec.

---

## Resolution log — second pass, same day

The five blocked items were actioned on 31 July 2026 with user authorisation ("smallest
logical fix for each; if you can't find [the design-side file], create it"). Three closed,
two reduced to a single named step.

1. **C1 byte-level / the three family names — closed by creation.** Recovery was attempted
   first: `DesignSync` reads of design project `08d6f126-3fd0-4764-aedf-0062a467280a` show
   it was last updated **2026-07-13** and contains none of the 31 July design-side files —
   that `ckb-v2-tokens.css` was never written to the project and is unrecoverable
   **[verified: `list_projects`/`list_files`]**. As authorised, the repo file is now the
   **canonical reconciled copy** (design-branch commit `59e4c3dfc`): `--shadow-well`
   replaces the two `--shadow-inset` overrides (contract test updated in the same commit —
   it now pins `--shadow-well` as a true inset and asserts `--shadow-inset` is not
   redeclared), and the evidence-spine (`--spine-w` / `--spine-current` / `--spine-stale`)
   and status-mark (`--status-mark-size` / `--status-mark-stroke`) families are authored
   repo-side, derived from existing roles. Confidence-meter stays absent — no call site.
   The design side now conforms to this file; there is nothing left to diff.
2. **Manifest regeneration — reduced to one command.** The stale manifest belongs to the
   same 13 July project state. The canonical `ckb-v2-tokens.css` has been written to the
   design project (DesignSync `write_files`, 1 file), and the pane now compiles
   `_ds_manifest.json` from the app's self-check. Remaining step: one full `/design-sync`
   run from an environment with the skill installed, to republish components and clear
   `_ds_needs_recompile`. The manifest itself stays generated-only.
3. **React-shim race — paste-ready patch.** Still applied in the design-side bundle
   generator (outside both repos); `ds-bundle-loader.js` stays the workaround until it
   lands, then both are deleted. Replacement for `shim:react-shim` (adapt to the
   generator's module format):

   ```js
   // shim:react-shim — read window.React lazily so bundle evaluation
   // order cannot race React.
   function getReact() {
     var R = window.React;
     if (!R) {
       throw new Error(
         "ckb-design-system: window.React is unavailable at render time - " +
           "load React before rendering, or keep ds-bundle-loader.js",
       );
     }
     return R;
   }
   function jsx(type, props, key) {
     var rest = Object.assign({}, props);
     var children = rest.children;
     delete rest.children;
     if (key !== undefined) rest.key = key;
     return children === undefined
       ? getReact().createElement(type, rest)
       : Array.isArray(children)
         ? getReact().createElement.apply(null, [type, rest].concat(children))
         : getReact().createElement(type, rest, children);
   }
   module.exports = {
     // React.Fragment IS Symbol.for("react.fragment") — no window read needed.
     Fragment: Symbol.for("react.fragment"),
     jsx: jsx,
     jsxs: jsx,
     jsxDEV: jsx,
   };
   ```

4. **Dark fall-throughs — closed.** `--clinical-chat-document` was a real omission: the
   live `.dark` declaration (`var(--surface-inset)`) is substituted at `<html>` before
   inheritance, so it can never re-resolve against the v2 dark ramp — fixed in
   `59e4c3dfc` by declaring it in the v2 dark block. `--disabled` fall-through is
   **confirmed acceptable**: the live dark value on the v2 dark surface computes ≈3.4:1,
   stronger than the v2 light disabled tier (≈2.5:1 on white)
   **[verified: computed from the declared hexes]**. No change.
5. **Publication — done.** The design branch (through `59e4c3dfc`) and the docs branch
   are pushed to `origin`; the docs branch has an open PR. The design branch is pushed
   **without** a PR: its PR needs the full clinical-governance preflight (it contains
   source-rendering components), which is its own handoff, not a quick fix.

Found while verifying, fixed in the same pass: `answer-card.tsx` used arbitrary
`leading-[var(--leading-prose,1.65)]` — a restated token value that failed the
design-token contract's no-arbitrary-leading rule on the branch tip. Now the named
`leading-prose` step. Both token-contract test files: **47 passed (47)**.
