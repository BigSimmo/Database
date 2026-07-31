# Clinical KB design system — TOKENS

**The reconciled token inventory (conflict C1 resolved): every role, its winning name, its
owner, and what it replaces. Never values** — values live only in the owner file named per
row. A value restated here is a defect in this document.

- **Date:** 31 July 2026 · companions: [SPEC.md](SPEC.md) · [DECISIONS.md](DECISIONS.md) ·
  [GATES.md](GATES.md)
- **Repo-side truth:** `src/app/ckb-v2-tokens.css` at commit `ef13a072a` (branch
  `claude/clinical-kb-design-system-333a69`, local-only). The export zip's copy is
  byte-identical **[verified: diff]**.
- **Design-side truth:** the design project's `ckb-v2-tokens.css` — **not supplied in any
  attachment**, so its divergences are reconciled at role level from the recorded list and
  the byte-level diff remains a blocked item (DECISIONS §Blocked).

**Owner key:** `@theme` — the `@theme` block of `src/app/globals.css` (generates Tailwind
utilities) · `live` — `globals.css` `:root` / `.dark` · `v2` — branch `ckb-v2-tokens.css` ·
`design` — design-project copy only · `planned` — nowhere yet.

---

## 1 · The divergences, resolved

This is the two-sources-of-truth failure C1 exists to kill. One winner per role:

| Role                     | Design side has                              | Repo side has                                                 | **Winner**                                          | Action                                                                                                                                                                                                                                                                                                       |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Recessed well shadow     | `--shadow-well`                              | _(absent; instead overrides `--shadow-inset` in both themes)_ | **`--shadow-well`** (new role, both themes)         | Add to `v2`; delete the `--shadow-inset` overrides so the DS bevel inherits from `live`. **Same commit:** update `tests/ckb-v2-token-contract.test.ts:164-169`, which currently pins the v2 override — pin `--shadow-well` as a true inset instead, and assert `--shadow-inset` is _not_ redeclared in `v2`. |
| DS bevel                 | `--shadow-inset` (inherited, un-overridden)  | `--shadow-inset` (overridden to a true inset)                 | **`--shadow-inset` stays the bevel, owner `live`**  | The v2 override was the wrong move (it stripped a highlight from ~40 surfaces); reverted per above.                                                                                                                                                                                                          |
| Quantity unit typography | `--quantity-unit-scale`                      | `--quantity-unit-tracking` + `--quantity-unit-gap`            | **repo pair wins**                                  | Two real physical properties beat one ambiguous scale factor; unit _size_ comes from the type scale (one step down), never a bespoke multiplier. Design side deletes `--quantity-unit-scale` at next sync.                                                                                                   |
| Tap target knob          | `--spacing-tap` declared inside the v2 layer | `--tap-min` literal in `v2`; `--spacing-tap` in `@theme`      | **`--spacing-tap`, owner `@theme` — the only knob** | C2 (DECISIONS): the 44→48 change lands in `@theme`; `v2`'s `--tap-min` becomes a pure alias `var(--spacing-tap)`; never set independently. Same commit: update the pin at `tests/ckb-v2-token-contract.test.ts:181-185`. The v2 layer never declares `--spacing-tap`.                                        |
| Evidence-spine roles     | present (names unknown)                      | _(absent)_                                                    | **role family accepted; names blocked**             | Needed by `EvidenceGutter`/answer spine. Names + values land only via the design side's actual file at next sync — not reconstructed from prose.                                                                                                                                                             |
| Status-mark roles        | present (names unknown)                      | _(absent)_                                                    | **role family accepted; names blocked**             | As above; consumed by `StatusMark`.                                                                                                                                                                                                                                                                          |
| Confidence-meter roles   | present (names unknown)                      | _(absent)_                                                    | **role family accepted; names blocked**             | As above; consumed by `ConfidenceMeter` (P2).                                                                                                                                                                                                                                                                |

---

## 2 · v2 structural inventory — owner `v2`, uncontested names

Declared in the `.ckb-v2` structural block **[verified: full read at `ef13a072a`]**.

| Group            | Roles                                                                                                                                       | Notes                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Space scale      | `--space-0` … `--space-11`                                                                                                                  | 4px base. Markup never references the raw scale — semantic tokens only.                                                                                             |
| Semantic gaps    | `--gap-tight` · `--gap-inline` · `--gap-stack` · `--gap-block` · `--gap-section`                                                            | The only inter-element spacing markup may use.                                                                                                                      |
| Semantic padding | `--pad-chip-x` · `--pad-control-x` · `--pad-cta-x` · `--pad-card` · `--pad-panel` · `--pad-strip`                                           | Heading-inset convention rides on these (SPEC §4.6).                                                                                                                |
| Page             | `--page-gutter` · `--page-max` · `--measure` · `--header-h`                                                                                 | `--measure` is the prose measure — never wider.                                                                                                                     |
| Type steps       | `--text-{xs,sm,body,md,lg,xl}` each with `-lh` and `-tr` · `--text-hero` · `--text-hero--line-height` · `--text-hero-tr`                    | Seven steps, per-step line-height and tracking (gated). ⚠️ `--text-hero--line-height` is the one double-dash name — keep as-is; renaming is churn without a defect. |
| Type companions  | `--leading-prose` · `--tracking-eyebrow` · `--nums`                                                                                         | `--nums` = numeric variant for all data.                                                                                                                            |
| Weights          | `--font-weight-{body,label,heading,value}`                                                                                                  | One job each; display uses heading weight (SPEC §4.6).                                                                                                              |
| Radius           | `--radius-{sm,md,lg,xl,2xl}`                                                                                                                | One step per surface role. ⚠️ v2 `--radius-md` ≠ live `--radius-md` — adoption is PR 5c, its own visual diff.                                                       |
| Icons            | `--icon-{xs,sm,md,lg}`                                                                                                                      | Paired to adjacent type steps.                                                                                                                                      |
| Density          | `--tap-min` (→ alias of `--spacing-tap`, §1) · `--chip-height` · `--row-comfortable` · `--row-compact` · `--cell-pad-{comfortable,compact}` | Tap target is not row height (gated: `--row-compact` ≠ `--tap-min`).                                                                                                |
| Accent rules     | `--rule-w` · `--rule-accent` · `--rule-warning`                                                                                             | ⚠️ Reference `var(--clinical-accent)` / `var(--warning)` **without declaring them** — v2 depends on the live layer for both (§5).                                   |
| Evidence gutter  | `--gutter-col` · `--gutter-dot` · `--gutter-line-w`                                                                                         | One gutter column owns line and dot (SPEC §7).                                                                                                                      |
| Quantity         | `--quantity-unit-tracking` · `--quantity-unit-gap`                                                                                          | Winners per §1.                                                                                                                                                     |
| Dashed edge      | `--border-dashed`                                                                                                                           | Drop targets / "nothing here yet" — distinct from `--border-strong`, which means emphasis.                                                                          |
| Stacking         | `--z-{base,raised,chrome,overlay,popover,modal,toast}`                                                                                      | Each rung names its `--eN` partner; toast above modal deliberately.                                                                                                 |
| Motion           | `--duration-{fast,base,slow}` · `--ease-standard` · `--ease-physical`                                                                       | Durations zero under `prefers-reduced-motion` (gated).                                                                                                              |

## 3 · v2 shell inventory — light and dark blocks

Light block roles **[verified]**: `--background` · `--surface` · `--surface-chrome` ·
`--surface-raised` · `--surface-lux` · `--surface-subtle` · `--surface-wash` ·
`--surface-inset` · `--surface-highlight` · `--clinical-chat-table-header` ·
`--clinical-chat-document` · `--border` · `--border-strong` · `--border-lux` ·
`--text-heading` · `--text` · `--text-muted` · `--text-soft` (deprecated alias) ·
`--decoration-soft` (canonical) · `--disabled` · `--command` · `--command-hover` ·
`--command-active` · `--command-contrast` · `--clinical-accent-soft` ·
`--clinical-accent-border` · `--primary-soft` · `--ring-hairline` · `--e0`…`--e4` ·
`--shadow-inset` (override — removed per §1) · `--glow-primary` · `--glow-soft` ·
`--overlay-backdrop`.

Dark block overrides a subset **[verified]** and **deliberately falls through to the live
dark layer for the rest** — the v2 dark shell is _not_ self-contained:

| Fall-through role (not redeclared in v2 dark)                | Consequence                                                                                                                                                                 |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--text`, `--text-heading`                                   | Dark body/heading ink comes from `live` `.dark`. Acceptable during opt-in; must be revisited at `:root` promotion (C3).                                                     |
| `--disabled`                                                 | Same. ⚠️ Confirm the live dark value clears the disabled contrast contract before adoption of disabled-heavy surfaces.                                                      |
| `--glow-primary`, `--glow-soft`, `--overlay-backdrop`        | Same fall-through.                                                                                                                                                          |
| `--clinical-chat-document`, `--surface-highlight` companions | ⚠️ Dark block overrides `--clinical-chat-table-header` but not `--clinical-chat-document` — flagged as a probable omission, unowned. Confirm intent at the next token pass. |

## 4 · Identity and category tokens

| Role family                                                                         | Owner     | Status                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--kind-source` · `--kind-answer` · `--kind-workspace`                              | `planned` | The three identity families (SPEC §3, DECISIONS §C5). No values exist yet anywhere; they enter `v2` with their first call site.                                                                |
| `--tone-{purple,indigo,rose,slate}` each with `-soft` and `-border` (twelve tokens) | `live`    | **Frozen, not deleted.** Live across 16 call sites; in dark none matches its nearest `--type-*`, so delete-and-alias would silently change four dark colours. Category channel only (SPEC §3). |
| `--type-*` families                                                                 | `live`    | Information-type colour; unchanged by this pass.                                                                                                                                               |

## 5 · Live-layer roles the v2 contract governs but does not declare

The v2 layer _references_ or _depends on_ these; their values stay in `live` / `@theme`:

| Role                                                    | Owner            | Rule                                                                                                                       |
| ------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `--spacing-tap`                                         | `@theme`         | **The** tap knob; generates `min-h-tap`/`h-tap`/`size-tap`/`min-w-tap`/`w-tap` (407 call sites). 44→48 lands here (PR 5b). |
| `--clinical-accent`                                     | `live`           | Consumed by v2 `--rule-accent` without declaration — inherited dependency.                                                 |
| `--warning`                                             | `live`           | Consumed by v2 `--rule-warning` — same.                                                                                    |
| `--danger`, `--danger-solid`, `--danger-solid-contrast` | `live`           | Filled danger pairs with `--danger-solid-contrast` (HCM-mapped to `MarkText`); pairing enforced from PR 3.                 |
| `--success`, `--info`                                   | `live`           | Clinical/status palette — reserved channel.                                                                                |
| `--focus`                                               | `live`           | The only focus outline colour; no companion ring, ever.                                                                    |
| `--text-placeholder`                                    | `planned` (PR 3) | New role ≥4.5:1; until it exists, placeholders use `--text-muted`.                                                         |

## 6 · Deprecations and deletions

| Token                                                                                                                              | Disposition                                                                                                                                                          | Gate                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `--text-soft`                                                                                                                      | Deprecated alias of `--decoration-soft`; both resolve identically during the window. Delete when zero references remain outside the alias declaration.               | Contract test pins the tier from both sides; a lint for `--text-soft`/`--decoration-soft` on text-bearing nodes is planned (GATES §1). |
| `--shadow-focus`                                                                                                                   | **Delete** (PR 9) — encodes a companion focus ring the conventions forbid; a trap for the next person who greps "focus".                                             | Planned lint after deletion.                                                                                                           |
| `--shadow-lift`                                                                                                                    | Retire into the `--eN` ladder (PR 9).                                                                                                                                | Planned.                                                                                                                               |
| `--shadow-card`, `--shadow-soft`                                                                                                   | Aliases of a ladder step; retire **inside the recipes first**, then delete.                                                                                          | Planned.                                                                                                                               |
| `--spring-bouncy` + two other dead springs                                                                                         | Delete (PR 9); byte-duplicate and unused curves.                                                                                                                     | Planned.                                                                                                                               |
| `--quantity-unit-scale` (design side)                                                                                              | Never lands; superseded per §1.                                                                                                                                      | Next design sync removes it.                                                                                                           |
| Legacy type steps (`text-2xs`/`3xs`, `sm-minus`, `base-minus`, `2xl-minus`, `lg-minus`, `3xl-minus`, `2xl-compact`, `3xl/4xl/5xl`) | Retired **last of all** — ≈663 call sites; `--text-md` arrives additively first. ⚠️ `Quantity` currently consumes `text-base-minus` — fix in the retirement tranche. | Contract ratchet extension, planned.                                                                                                   |

## 7 · Naming rules going forward

- No new token without a call site and a usage rule (SPEC §12).
- Roles are named for their job, never their appearance or a place ("well", "bevel",
  "placeholder" — not "grey-2").
- A deprecation ships with an alias, a lint rule, and a named deletion condition.
- The design-sync manifest is generated; a hand-edited token entry anywhere under `_ds/` is a
  defect regardless of its content.
