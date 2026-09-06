# Ward Flow — the "Board" design language

The owner chose this direction on 2026-09-03 from a two-way comparison. It now governs **every**
Ward Flow surface, not only the seven screens being redesigned. Around 22 routes exist; seven
bespoke pages would drift apart within a week, so the language lives in one place and is copied,
never re-invented.

## 🔴 THERE ARE TWO EDITIONS. READ THIS BEFORE YOU COPY ANYTHING.

**This section said `community-home.html` was THE canonical source, full stop, and it went on
saying it while a second edition was extended twice on 2026-09-05.** Two builders measured their
screens against the first edition because this line sent them there, and each reported the same two
phantom gaps — a missing tap-target token and a missing accent family — **both of which the second
edition has.** One of them withdrew a proposal it need never have made.

⚠️ **That is this project's own rule turned on this document: the sentence naming a canonical source
belongs inside the diff that changes which source is canonical.** Ward Lead extended the second
edition twice and did not fix this line either time. Found by Ward Builder Three, 2026-09-05.

| If you are building…                                                                 | copy the style block from | it is          |
| ------------------------------------------------------------------------------------ | ------------------------- | -------------- |
| **the ward home, the bed board, or any of the nine screens commissioned 2026-09-05** | `design-language.html`    | second edition |
| anything else, or a change to one of the ten older mockups                           | `community-home.html`     | first edition  |

**The second edition is carried by `design-language.html` (the source),
`mockup-ward-home-v4.html`, `mockup-ward-home-v3.html` and `mockup-ward-board-v3.html`.**

⚠️ **No character count is quoted here on purpose.** I typed one into this paragraph and then
extended the block in the same commit, making my own figure stale before it was committed — which is
the third time in one night a figure in this repository outlived what it measured. **Derive it:**
`README.md` in this directory carries the command, and the answer changes every time the block does.

Byte
identity across those four is guarded by `tests/ward-design-language-canonical.test.ts`, which names
its carriers — add a file there or the guard will not look at it. `mockup-ward-entry.html` carries
NEITHER block and never has.

⚠️ **NEITHER EDITION IS A SOURCE OF COLOUR FOR APP CODE.** The mockups are design INTENT. Real
components resolve colour through `ward-tokens.module.css`, which resolves through ckb-v2 — because
`local/no-hardcoded-hex` is an `error` and the two palettes differ in all but one role. The mapping
is by ROLE and a value match against those numbers finds nothing:
[`../second-edition-to-ckb-v2-role-map.md`](../second-edition-to-ckb-v2-role-map.md).

**Copy the block for your edition verbatim** into your mockup and then add only the rules your
screen needs, below a comment saying which screen they belong to. Do not edit the copied block. Do
not re-derive a colour, a font size, or a spacing step. **To change a block, edit its source and
re-cut every carrier from it; never hand-patch a copy.**

---

## The five rules, in force everywhere

1. **Tokens only. No raw hex below the copied block.** Every colour comes from a `var(--…)`. If a
   screen needs a colour the language does not have, that is a finding to report, not a hex to
   invent.
2. **State is worded as well as coloured.** Every chip carries text. A reader with no colour
   perception must lose nothing. A coloured dot, bar or edge may only _reinforce_ a word that is
   already there — this is the app's own accessibility rule, and it is gated in CI.
3. **Contrast floor 4.5:1 for text.** `--faint` was already caught failing at 3.08:1 and corrected
   to 4.63:1 light / 5.19:1 dark. If you introduce a colour pairing, compute it. Do not eyeball it.
4. **Figures are `tabular-nums` and set in JetBrains Mono.** Anything a reader might compare down
   a column lines up. Never a proportional figure in a table.
5. **Absence is stated, never blank.** An empty panel explains _why_ it is empty and what the
   absence means. "No phone number is held" and "Absence here means nothing has been planned, not
   that nobody is coming home" are the models. A panel that is merely empty reads as a bug.

## The discipline about numbers

Every invented figure is listed at the foot of the page under **"Every figure here is invented"**,
and everything drawn from the repository is listed under **"What is real"**. This is not decoration;
the owner replaces invented figures later and needs to know exactly which they are.

⚠️ **Never invent a phone number, an address, a record number, or a person's name that could be
mistaken for real.** Patient names are invented and deliberately unlike any real list. The real WA
clinic names may be used because they come from the repository's own catchment table; their contact
details may not, because the model does not hold them.

## Real data you may use — verified in the repository

**Community teams and their suburb counts**, from `src/components/ward-management/ward-catchment.ts`
(built from five WA Health documents, 537 suburbs): Midland 68, Bunbury 48, Joondalup 36, Bentley
32, Peel 27, Rockingham 23, Osborne 19, Subiaco 17, Mead Centre (Kelmscott) 17, Kwinana 16, Inner
City 16, Mirrabooka 15, Alma Street (Cockburn) 15, Clarkson 13, Alma Street (Melville) 13, Alma
Street (Central) 12.

**Verified suburb → team pairs:** Ashfield and Aveley → Midland · Ascot and Beckenham → Bentley ·
Coolbinia and East Perth → Inner City · Alexander Heights and Balga → Mirrabooka · Baldivis and
Bertram → Rockingham · Central Mandurah and Coolup → Peel · Anketel and Cooloongup → Kwinana ·
Carine and Churchlands → Osborne · City Beach and Claremont → Subiaco · Burns Beach and Butler →
Clarkson · Alkimos, Ashby, Banksia Grove, Beldon, Carramar, Connolly → Joondalup.

⚠️ **THE PROTOTYPES SHOW NINE WARDS. THE MODEL HOLDS TWENTY-THREE, ACROSS SEVENTEEN SITES.** Measured 2026-09-04: 23 unit entries in `ward-sites.ts`, 17 `units:` arrays. The nine below are the subset the prototypes chose to draw; they are NOT the ward list. Every screen must read the live collection, never this paragraph and never a count taken from a mockup. A card grid that looks right for nine becomes a second dashboard at twenty-three.

**The nine the prototypes draw**, from `src/components/ward-management/ward-sites.ts`: Royal Perth Hospital
(RPH Adult Secure, RPH Older Adult), Sir Charles Gairdner Hospital (SCGH Adult Open, SCGH Older
Adult), Fiona Stanley Hospital (FSH Adult Secure, FSH Older Adult), Armadale Health Service (ARM
Adult Open), St John of God Midland Public Hospital (SJGM Adult Open), Rockingham General Hospital.
⚠️ **THERE ARE EIGHT EMERGENCY DEPARTMENTS AND ONLY SIX OF THEM SIT AT A HOSPITAL LISTED ABOVE.**
An earlier version of this line said "each hospital also has a named Emergency Department", which
reads as six. **`Joondalup Health Campus Emergency Department` and `Peel Health Campus Emergency
Department` have no inpatient ward in this data**, so they appear in no hospital list and are easy
to lose. The eight, verbatim from `ward-sites.ts`:

Royal Perth Hospital, Sir Charles Gairdner Hospital, Fiona Stanley Hospital, Armadale Hospital,
St John of God Midland, Rockingham General Hospital, **Joondalup Health Campus**, **Peel Health
Campus** — each as `<name> Emergency Department`.

⚠️ **A builder nearly reported a correct prototype as wrong because of this line.** The ED home
says "of 8 departments", this document implied six, and the prototype was right. **It checked
`ward-sites.ts` before filing the defect. A figure contradicted by a summary is not a defect until
you have read the data** — and the summary is the likelier of the two to be stale, because nothing
tests it.

⚠️ **Do not invent a ward or a hospital.** Use these. A plausible-looking fake WA ward is worse than
a repeated real one.

---

## Components, with their markup shape

Copy these shapes. They are already styled by the canonical block.

**Page frame** — `<div class="shell" role="main">`, with `<p class="prototype">` as the first child
carrying "Synthetic prototype · No real patient data · Every figure invented — listed at the foot".

**Masthead** — `.masthead` holding two `.identity` columns: left is `.eyebrow` + `<h1>` +
`.covers`; right is any control plus `.liveness`.

**Totals strip** — `<dl class="totals">` of `.total` blocks, each `<dt>` label + `<dd>` with
`.figure` and optional `.unit`, plus optional `.sub`. Add `data-flag="true"` to a tile that needs
attention — it turns amber. **At most two flagged tiles per screen**; amber means "look here" and
loses all meaning if everything is amber. Optional `.volume` bar row plus `.caption`.

**Columned body** — `.grid` gives 1 column on a phone, 2 from 60rem, and 2 + a 19rem rail from
84rem. Between 60 and 84rem the `.rail` drops full-width and lays its panels out side by side.

**Panel** — `<section class="panel">` with `<header>` containing `<h2 class="panel-title">` and an
optional `<span class="n">` count, then optional `<p class="blurb">`, then content.

**Rows** — `<ul class="rows">` of `<li data-level="urgent|stalled|routine">` each wrapping
`<a class="row">` with `.id`, `.path`, `.wait`, `.chip`, and a `.meta` line. Rows are links, because
every row is somewhere you would go next. Direction is carried by an arrow inside `.path` — `←` for
inbound, `→` for outbound — so a reader never has to consult the heading.

**Chips** — `.chip` with `data-level="urgent|routine|stalled|accepted|planned"`. Text always.

**Attention panel** — `.attention` list, each item a `.who` locator plus one plain sentence saying
what is wrong and what it means. Lead the rail with this, not with links: a dashboard's job is to
say what is wrong; links are what you use afterwards.

**Band** — `.band` for a three-across row of panels below the main grid, used to fill width with
something useful rather than padding.

**Table** — `.teams` inside `.table-wrap` (which scrolls horizontally on its own so the page never
does). Numeric cells take `class="n"`. A zero renders as the word **"none"** in `.zero`, never `0`
— a nought reads as a measurement, "none" reads as a state.

**Facts list** — `.facts` definition grid for short labelled values.

**Footnote** — `.footnote` with the invented / real / decisions sections.

## Typography

Archivo for everything structural: `h1` 700 at `clamp(1.45rem, 1.1rem + 1.3vw, 2rem)` with
`-.024em` tracking; `.panel-title` 600 at .8125rem uppercase with `.085em`. JetBrains Mono for
every figure. Body text .875rem, meta .75rem, eyebrows .6875rem. **Do not add a type step.**

## Themes

Three states, already handled by the copied block: bare `:root` is the complete light palette,
`@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])` redefines only
tokens, and `:root[data-theme="dark"]` redefines them again. **Never declare a colour only inside a
media or `[data-theme]` block** — it will not apply in the default un-stamped state and the page
renders one theme's text on the other theme's ground.
