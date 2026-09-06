# Status colours lose their high-contrast handling — the ward fix taken, and the app fix proposed

**Ward Builder Three, 2026-09-06.** Measured on the master line at `2c8fe3752`.

This is a **proposal for `src/app/ckb-v2-tokens.css`, not a change to it.** That file serves the
whole product, so the decision is not Ward Flow's to take. The ward-scoped half is done and
committed; this records the half that is cleaner, larger, and somebody else's call.

---

## 1. The defect, measured rather than argued

Both app-level forced-colours blocks re-point `--danger`, `--warning` and `--success`. **Neither
re-points the six roles that ward screens actually consume**, nor the three `-border` partners.
Extracted from inside each `@media (forced-colors: active)` block by brace-matching, not by reading:

| token                                                       | `ckb-v2-tokens.css` | `globals.css` |
| ----------------------------------------------------------- | ------------------- | ------------- |
| `--danger` / `--warning` / `--success`                      | re-pointed          | re-pointed    |
| `--danger-text` / `--warning-text` / `--success-text`       | **absent**          | **absent**    |
| `--danger-bg` / `--warning-bg` / `--success-bg`             | **absent**          | **absent**    |
| `--danger-border` / `--warning-border` / `--success-border` | **absent**          | **absent**    |

The ward layer aliases the first six and re-points its aliases:

    ward-tokens.module.css:72-77    --ward-danger: var(--danger-text);   (and five siblings)
    ward-tokens.module.css:200-208  --ward-danger: CanvasText;           inside forced-colours

**So the two spellings are identical in every mode a developer looks at, and differ only in the one
nobody renders.** `var(--ward-danger)` becomes `CanvasText` under Windows High Contrast;
`var(--danger-text)` stays a themed colour the mode has already decided to ignore. On a clinical
screen, that is a warning that stops looking like a warning.

**Nothing reported it.** `tests/ward-forced-colors-tokens.test.ts` reads the token layer and never
opens a consumer stylesheet. Proved, not assumed: reverting a single re-point in
`handover.module.css` leaves that suite **11 passed, 0 failed**, while the new consumer guard fails
naming the file.

---

## 2. What was done, and what was deliberately not

**Done — 157 uses across 20 ward stylesheets re-pointed onto the `--ward-*` aliases.** The alias
resolves to the same value in every ordinary mode, so this changes nothing on screen except under
forced colours. `tests/ward-status-colour-reach.test.ts` now holds the property as a ratchet.

**Not done, and why:**

| left alone                                                                                                                   | reason                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `ward-tokens.module.css` (6)                                                                                                 | the bridge itself — those uses _are_ the alias definitions. Permanent.                                                                       |
| `ward/ward.module.css` (24), `patients/add-patient.module.css` (8), `ed/ed.module.css` (7), `patients/person.module.css` (2) | held by Ward Builder Four on 2026-09-06                                                                                                      |
| the `-border` family (~60 uses)                                                                                              | **there is no `--ward-*-border` alias to re-point onto.** Fixing it needs three new tokens, which is a token addition and goes to Ward Lead. |

⚠️ **The `-border` family was not in the brief and is the larger half.** `--warning-border` alone
appears in 19 ward stylesheets. It is defined as raw hex in `globals.css` (`#f5d9a8` light,
`#725e23` dark) and re-pointed nowhere.

---

## 3. The proposal — exact lines

Add inside the existing block at `src/app/ckb-v2-tokens.css:427`, beside the three roles already
there at lines 465-467, matching their indentation:

```css
--success-text: CanvasText;
--warning-text: CanvasText;
--danger-text: CanvasText;
--success-bg: Canvas;
--warning-bg: Canvas;
--danger-bg: Canvas;
--success-border: CanvasText;
--warning-border: CanvasText;
--danger-border: CanvasText;
```

⚠️ **`--danger` is re-pointed to `Mark`, not `CanvasText`, at line 467.** That is a deliberate
choice for the base role and I have not copied it: `Mark` is the highlight background, and using it
for a text role would set text to a background colour. Whoever takes this should decide whether the
danger _text_ role should follow `--danger` to `Mark` or stay `CanvasText`. **That is the one line
in this proposal I would not apply without asking.**

---

## 4. Blast radius — what else consumes these tokens

**103 uses outside `ward-management`**, across more than twenty files: Caring Contacts (workspace
and mockups), the clinical dashboard's medication prescribing and record pages, factsheets, the
privacy pages and tone module, therapy-compass, `AccessibleTable`, and several mockup suites.

**Every one of them has the same defect today and would be fixed by the same nine lines.** That is
the argument for the app-level change and equally the argument for not making it from here: it
alters high-contrast rendering on screens nobody in this room has opened, and the only honest way to
check it is to render them.

**It cannot make forced-colours rendering worse in the ordinary case** — these declarations exist
only inside a `forced-colors: active` block, so they are inert in every other mode. The risk is
confined to whether `CanvasText` / `Canvas` are the _right_ system colours for each role on screens
outside Ward Flow, and to the `--danger`/`Mark` question above.

---

## 5. If this is taken, delete the ward guard rather than adjust it

`tests/ward-status-colour-reach.test.ts` derives "protected" by reading the forced-colours blocks,
so the day these lines land its first assertion goes red **on purpose**, saying in terms: an app
layer now re-points these six directly, this guard has served its purpose, delete it and its
ceilings with it. That is deliberate — a ratchet that outlives its defect becomes a list nobody
dares remove.
