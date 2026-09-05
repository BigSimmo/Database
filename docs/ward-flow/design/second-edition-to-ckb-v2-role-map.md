# The second edition is a second palette — and app code resolves through ckb-v2

**Written by Ward Lead, 2026-09-05, on Ward Builder One's finding.** It is the answer to
one question nine screens were about to guess at: **when a screen is built from the locked
second-edition mockups, where do its colours come from?**

**The answer: from `ward-tokens.module.css`, which resolves through ckb-v2. The mockups are
the design INTENT, never a source of hex.**

---

## 1. The finding, and it is bigger than it first looked

Ward Builder One measured seven neutral roles and found one identical and six different.
Confirmed, and then widened — I mapped **twenty-one** roles. Of the nine that resolve to a
literal hex on both sides, **exactly one matches.**

Producing command, run from the repository root:

```bash
PYTHONIOENCODING=utf-8 python scripts/ward-flow/role-map.py
```

| mockup token      | its hex   | ward role to use      | resolves to              | that hex   | same?  | contrast on white |
| ----------------- | --------- | --------------------- | ------------------------ | ---------- | ------ | ----------------- |
| `--ground`        | `#f1f4f8` | `--ward-ground`       | `--surface-inset`        | `#f4f7fa`  | **NO** | 1.10 → 1.08       |
| `--surface`       | `#ffffff` | `--ward-canvas`       | `--surface`              | `#ffffff`  | yes    | 1.00 → 1.00       |
| `--surface-2`     | `#f7f9fc` | `--ward-chrome`       | `--surface-chrome`       | `#ffffff`  | **NO** | 1.05 → 1.00       |
| `--sunken`        | `#eef2f7` | `--ward-subtle`       | `--surface-subtle`       | `#fbfcfd`  | **NO** | 1.12 → 1.03       |
| `--ink`           | `#0d1421` | `--ward-heading`      | `--text-heading`         | `#0a1220`  | **NO** | 18.44 → 18.75     |
| `--ink-2`         | `#33415a` | `--ward-text`         | `--text`                 | `#1b2533`  | **NO** | 10.27 → 15.45     |
| `--muted`         | `#55637a` | `--ward-muted`        | `--text-muted`           | `#55627a`  | **NO** | 6.08 → 6.15       |
| `--faint`         | `#5e6c84` | `--ward-muted`        | `--text-muted`           | `#55627a`  | **NO** | 5.31 → 6.15       |
| `--rule`          | `#e4e9f0` | `--ward-divider`      | `--neutral-500`          | (indirect) | ?      | —                 |
| `--rule-2`        | `#cfd7e3` | `--ward-border`       | `--neutral-500`          | (indirect) | ?      | —                 |
| `--accent`        | `#1d6fb8` | `--ward-blue`         | `--clinical-accent`      | (indirect) | ?      | —                 |
| `--accent-strong` | `#185c99` | `--ward-blue`         | `--clinical-accent`      | (indirect) | ?      | —                 |
| `--accent-wash`   | `#eff5fc` | `--ward-blue-soft`    | `--clinical-accent-soft` | `#f2f8fe`  | **NO** | 1.10 → 1.07       |
| `--good`          | `#0c6b41` | `--ward-success`      | `--success-text`         | (indirect) | ?      | —                 |
| `--good-wash`     | `#f2fbf6` | `--ward-success-soft` | `--success-bg`           | (indirect) | ?      | —                 |
| `--signal`        | `#8a4d05` | `--ward-warning`      | `--warning-text`         | (indirect) | ?      | —                 |
| `--signal-wash`   | `#fffaf2` | `--ward-warning-soft` | `--warning-bg`           | (indirect) | ?      | —                 |
| `--crit`          | `#a3190f` | `--ward-danger`       | `--danger-text`          | (indirect) | ?      | —                 |
| `--crit-wash`     | `#fdf5f4` | `--ward-danger-soft`  | `--danger-bg`            | (indirect) | ?      | —                 |
| `--cool`          | `#0f6b73` | 🔴 **none**           | —                        | —          | —      | 6.23              |
| `--cool-wash`     | `#f1fafb` | 🔴 **none**           | —                        | —          | —      | 1.06              |

⚠️ **THE NEAR-MISSES ARE THE DANGEROUS HALF, AND THEY DEFEAT THE PLAN'S OWN INSTRUCTION.**
`--muted` and `--text-muted` differ by a single hex digit — 6.08:1 against 6.15:1. The build
plan says "match tokens by VALUE, never by name". **Against these values that instruction
finds nothing**, so an adopter following it correctly concludes there is no match and either
picks the wrong role or invents one. **That is why this table is authored by ROLE. The script
prints the evidence beside each row; it does not discover the pairing.**

---

## 2. The ruling: app code resolves through ckb-v2

Builder One proposed building all nine screens in the second-edition palette, carrying the
reconciliation as visible debt. **Ruled against, and the reasons are mechanical rather than
aesthetic:**

1. **`local/no-hardcoded-hex` is set to `"error"` in `eslint.config`.** App code physically
   cannot carry the mockup's palette. The only ways to do it are a raw hex (lint error) or a
   parallel `--se-*` token set — which is the fork.
2. **`ward-tokens.module.css` forbids it in its own header:** _"Ward Flow is a scoped layer
   over the app's v2 palette, not a second palette. A raw hex here is the start of a fork."_
3. **The build plan already ruled the same way on radii** and recorded why: the ward
   stylesheets use the app's radius tokens directly 260 times, so a parallel scale would be
   a fork with 260 counter-examples. Colour is the same argument with more at stake.
4. 🔴 **The one VISIBLE difference favours the app.** Body ink is `10.27:1` in the mockup and
   `15.45:1` in ckb-v2. Quiet ink is `5.31:1` against `6.15:1`. **Adopting ckb-v2 makes the
   real screens MORE legible than the mockups, not less** — so the "divergence" is an
   improvement everywhere it is visible at all.

**So: build to the mockups' LAYOUT, STRUCTURE, WORDING and BEHAVIOUR exactly. Take colour
from the ward role in the table above. Where the two disagree, the app wins and this document
is why.**

---

## 3. Three gaps this exposes, which are real and not cosmetic

These are not near-misses. Each is a role the second edition needs and the ward layer cannot
currently express. **All three are fixable with existing ckb-v2 tokens — no hex, no fork.**

### 3.1 🔴 A panel header cannot be distinguished by its fill

`--ward-chrome` resolves to `--surface-chrome`, which is `#ffffff` in the light theme —
**identical to `--ward-canvas`.** The second edition tints every `.panel > header`
(`--surface-2`, `#f7f9fc`) so a header reads as a header.

⚠️ **This is not a regression the adoption introduces — the ward screens already have it.**
Panel headers in the app are already untinted. Adoption does not lose the tint; the app never
had one.

**Proposed:** re-point `--ward-chrome` to `--surface-subtle` (`#fbfcfd`). Its own comment in
`ckb-v2-tokens.css:231` designates it _"table headers, zebra rows"_ — the exact semantic role.
**Not done unilaterally:** `--ward-chrome` is consumed across the ward layer, so re-pointing it
changes shipped screens. Owner's eye first.

**Meanwhile, and this is the safe half:** the canonical block already gives `.panel > header` a
`border-bottom`, and its type is uppercase and weighted. A header is legible without the tint.

### 3.2 No fill in this layer is strong against a panel, and ⚠️ MY FIRST VERSION OF THIS SECTION MEASURED ONE THEME

🔴 **CORRECTED 2026-09-05. The first version of this section quoted light-theme figures only and
recommended a token on that basis.** That is the identical error `ward-tokens.module.css` records
against itself — _"THE GUARD DID NOT CATCH THAT BECAUSE IT USED `.exec()`, WHICH RETURNS THE FIRST
MATCH — the light declaration. It measured one theme and certified a value that failed its own rule
in the other."_ I read that comment earlier the same night and then did the same thing.

⚠️ **AND THERE IS A SECOND TRAP HERE THAT CAUGHT WARD BUILDER TWO.** These tokens are declared in
**two** files: `globals.css` on `:root` (0,1,0) and `ckb-v2-tokens.css` on `.ckb-v2.ckb-v2` (0,2,0)
and `.ckb-v2.dark.ckb-v2` (0,3,0). **ckb-v2 wins on specificity, so globals' values never apply**,
and this repository has been caught by that before — 27 files once carried ratios measured against
the losing file. Builder Two measured `--surface: #fcfdfe` / `--surface-chrome: #f7f9fc`; those are
globals' losing values. **Always resolve through `ckb-v2-tokens.css`.**

Measured against the panel (`--surface`) in BOTH themes, ckb-v2 values:

| role            | resolves to        | light                 | dark          |
| --------------- | ------------------ | --------------------- | ------------- |
| `--ward-chrome` | `--surface-chrome` | `1.000:1` (identical) | `1.035:1`     |
| `--ward-subtle` | `--surface-subtle` | `1.027:1`             | **`1.121:1`** |
| `--ward-ground` | `--surface-inset`  | `1.075:1`             | `1.078:1`     |

**So the honest conclusion is not the one I first wrote.** `--ward-subtle` is the STRONGEST fill in
dark — ckb-v2 aliases it deliberately, its own comment saying _"subtle must lift, not sink"_ — and
the weakest in light. `--ward-ground` is the only role that behaves the SAME in both, at roughly
`1.075:1`. **And nothing clears `1.11:1` in light**, which is the threshold this project applied when
it replaced an invisible rule across 27 stylesheets.

**RULED: a band, a sticky header, a totals row or a row marker is carried by BORDER AND TYPE first,
never by a fill.** A fill may only reinforce. Where a fill is used anyway, use `--ward-ground`,
because it is the only one that does not change character between themes.

⚠️ **Ward Builder Two reached this same instruction from the losing file's numbers.** Its advice was
right, its figures were wrong, and the correct figures support the same advice — which is worth
recording, because "the numbers were wrong" is normally where an instruction gets discarded.

### 3.3 🔴 The fifth state colour has no ward role at all

`--cool` / `--cool-wash` have **no** equivalent in `ward-tokens.module.css`. The locked design
uses them for `chip[data-level="planned"]` — _"Accepted, no bed yet"_, a real state on the ward
home's "Coming in" panel.

⚠️ **Do not substitute it onto `--ward-blue`.** Accent means "this is the action" throughout the
layer; a planned-but-not-yet state is not an action, and collapsing the two would make an
accepted referral look like a button.

**MEASURED, so this is not a hypothetical: ckb-v2 HAS NO TEAL, CYAN OR INFO ROLE.**
`grep -nE '^\s+--(info|teal|cyan|accent-2)[a-z-]*:' src/app/ckb-v2-tokens.css` returns nothing,
and the ward layer's own role list has no fifth state either — it carries success, warning, danger
and blue, and stops.

**So there is nowhere for this colour to come from, and inventing one here is the fork.** Until the
design system answers it, the `planned` chip uses **`--ward-muted` with its word intact** —
"Accepted, no bed yet" — because the word was always the signal and the colour was only ever
reinforcing it. A state that loses its tint and keeps its sentence has lost nothing a reader needed.

⚠️ **Do not read that as "cool is unnecessary".** It is a fifth state the locked design draws and
the app cannot express. The right fix is a role in ckb-v2, which is a design-system request, not a
ward change.

---

## 4. What this does not settle

**Whether ckb-v2 should adopt the second edition's values instead.** That is the reconciliation
the front-door decision record warned about — _a screen styled from a copied prototype block has
to be re-derived against ckb-v2 the moment it becomes real code, and a re-derivation nobody
schedules is how a second design system gets born._ It has been born. This document schedules
the re-derivation for the nine ward screens and **for nothing else**, because ckb-v2 is the whole
product's palette and changing it is not a ward decision.

**Recorded as owner-visible debt, in Builder One's words rather than mine**, because it found it
and its framing is better than my summary of it.
