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
evidence-spine / status-mark / confidence-meter **role families are accepted** but their
names and values land only via the design side's actual file (see Blocked).

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

## Unresolved — and what each is blocked on

1. **Byte-level completion of C1.** Blocked on the design side's actual `ckb-v2-tokens.css`
   (and with it the names/values of the evidence-spine, status-mark and confidence-meter
   families). No attachment contained it; TOKENS.md reconciles at role level and refuses to
   reconstruct names from prose. **Unblock: export that one file for diffing.**
2. **Design-sync manifest regeneration.** `_ds_manifest.json` is stale (236/341 tokens,
   `themes: []`, deleted token still listed, `--tw-*` published). Regeneration needs
   `resync.mjs`, which ships with the `/design-sync` skill and is installed in neither
   environment. **Unblock: run a sync from an environment with the skill installed; the
   manifest is generated-only.**
3. **The react-shim load-order race.** The fix (lazy `window.React` read inside
   `jsx()`/`jsxs()`/`jsxDEV()`) lives in the design-side bundle generator, outside both
   repos; `ds-bundle-loader.js` is the documented interim workaround and is deleted when the
   shim fix and the repo `process` fix (already shipped) are both live. **Unblock: named
   owner with access to the bundle generator.**
4. **Dark fall-through confirmations.** Two probable omissions in the v2 dark block —
   `--clinical-chat-document` and the disabled-contrast contract for the inherited dark
   `--disabled` (TOKENS §3) — need a yes/no from the next token pass. **Unblock: ordinary
   review, no external dependency.**
5. **Branch publication.** `ef13a072a` exists only locally; nothing here is on `origin`.
   Pushing and PR-ing is an explicit user action under this repo's provider rules —
   **unblock: say the word.**
