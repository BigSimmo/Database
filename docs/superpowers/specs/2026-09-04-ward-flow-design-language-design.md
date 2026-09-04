# Ward Flow — the Board design language

**Status:** design approved by the owner 2026-09-03/04. Implementation not started.
**Scope:** Ward Flow only. No other PsychSift surface changes.

## Why this exists

Ward Flow has roughly 22 routes and no shared visual language. Three of its overview screens were
deliberately built to show nothing, and its statistics screen deliberately refused charts. The
owner has overturned both decisions and asked for the whole prototype elevated. Ten screens were
mocked up and approved; this records what was decided so the build does not re-litigate it.

The ten approved mockups are throwaway HTML in a scratch directory, not in this repository. They
are the visual reference, not the implementation.

## The owner's rulings, recorded because each reverses something in the code

1. **An overview may show counts**, provided they read from the same single calculation the detail
   screen uses. One fact rendered twice; never two calculations. This reverses the rule behind
   _"no bed numbers, no availability and nothing about who is in a bed"_ (`ward-index.tsx`) and
   _"a busy team and a team with nobody on its books look identical here"_ (`community-index`).
2. **Statistics gets charts**, interactive, alongside the numbers. This reverses
   _"no bar, no fill, no colour that changes with the count"_ in the statistics screen.
3. **Coordinator screens may show a patient's active referrals and community team; ward screens
   still may not.** FD-23 is unchanged — this only settles which screens are coordinator screens.
4. **The patient record expands** to address and suburb, current community team and whether open to
   it, past psychiatric history, past medical history, current medications, legal status under the
   Mental Health Act, GP, interpreter/preferred language, and Aboriginal or Torres Strait Islander
   status. The last two were approved explicitly and deliberately.
5. **A declines-by-ward ranking is built but kept off the front page** — reachable, labelled
   synthetic, not the first thing a visitor sees.

## The visual decision

**Direction: "Board".** An instrument panel rather than a document. Discrete surfaces on a grey
ground, dense rows, one signal colour that only ever means "look here". Chosen from a two-way
comparison against a quieter "Ledger" direction.

**Palette, resolved against PsychSift's own v2 tokens rather than replacing them:**

- **Ground and structure from Board.** Panels of `--surface` on a grey `--ground` is what makes each
  panel read as a discrete instrument. PsychSift's white-on-white loses that.
- **Accent from PsychSift** — the clinical blue (`--clinical-accent` family, `#14507f`/`#185c99`)
  for links and interactive states, so Ward Flow does not read as a different application. This
  also frees amber to mean only "attention", which it currently double-books.
- **Neutral values from PsychSift wherever they already match.** Its `--text-muted: #55627a` against
  Board's `#5a6678`, its `--text: #1b2533` against `#101724`, its danger `#a3190f` against
  `#a8351f`. Two nearly-identical tokens is how a palette rots; take one.
- **Two border weights, not one.** The original defect was a single token doing both jobs: a
  panel edge is a real boundary and takes the darker value this branch already adopted for
  accessibility (`#667085`, 4.95:1); a divider inside a panel should be barely there and takes the
  light value. Do not reuse one for both.
- **Amber (`--signal`) is reserved for attention.** At most two flagged tiles per screen. Red
  (`--crit`) is one tier above and is for the worst state on a screen, never for decoration.

**Typography:** Archivo for structure, JetBrains Mono for every figure. Do not add a type step —
`ckb-v2-tokens.css` already declares the scale and a declared-but-unselected step fails the gate.

## The five rules, in force on every Ward Flow surface

1. **Tokens only.** Every colour from a `var(--…)`. A colour the layer does not have is a finding,
   not a hex.
2. **State is worded as well as coloured.** Every chip carries text. A reader with no colour
   perception loses nothing. This is already gated: `colourOnlyStatusIndicators` is ratcheted.
3. **Contrast floor 4.5:1 for text**, computed and not eyeballed. `--faint` was caught at 3.08:1
   during design and corrected to 4.63:1 light / 5.19:1 dark.
4. **Figures are `tabular-nums`** and set in one face, so any column of numbers compares.
5. **Absence is stated, never blank.** An empty panel explains why it is empty and what the absence
   means. A merely-empty panel reads as a bug.

## The ten screens

| Screen          | Route                                  | What it must answer                                                                                                                               |
| --------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Community hub   | `/community` and `/community/[teamId]` | Two scopes: the coordinator's all-teams overview, and one team's own hub. Referrals in and out, worst wait first.                                 |
| Referral intake | `/referrals/new`                       | Four numbered steps; four questions removed by reading the record. Eligible destinations and a search in a panel alongside, which ranks nothing.  |
| Patient record  | `/people/[patientId]`, `/people/new`   | The expanded record. Referral history coordinator-only and marked so. A create state that does not demand a history before it will make a person. |
| Search          | `/search`                              | Person-first. Four states: resting, results, no matches, too many matches. Every row opens its own record; the person's name is a second link.    |
| Transport       | `/transport`                           | Who is waiting too long and who to ring. Escort requirement visible. A booking panel alongside.                                                   |
| Statistics      | `/statistics`                          | Waiting time, decline reasons, discharge blockers — by ward, team and ED, each clickable through. A fourth trend chart, separated.                |
| Ward list       | `/wards`                               | Which ward has room, and an obvious way in. Cards, with row-and-chip internals.                                                                   |
| Ward home       | new                                    | Confirm the bed counts in one tap or change them, and open the bed list either way. Never trap a nurse out of their own ward.                     |
| ED home         | new — `/ed` does not exist             | Where psychiatric patients are stuck in a department, and which department is worst.                                                              |
| ED hub          | `/ed/[edId]`                           | One department: who is waiting, which wards were asked, who is stuck with nothing pending.                                                        |

**Navigation is part of the language, built once and applied to all ten.** A set of screens with no
way between them is a set of pictures. It carries the role switcher and the ward or team you are
currently in.

## What this needs that does not exist yet

- **A Ward Flow token layer**, scoped, declaring the Board structure over PsychSift's accent and
  neutrals.
- **Shared components** for panel, row, chip, figure tile, band, rail and table — so the other
  twelve routes can adopt the language without re-arguing it.
- **Patient model fields** for every item in ruling 4. ⚠️ **A screen that displays a field nothing
  can write passes every test and renders as a legitimate empty state.** Either the fields ship
  with the patient screen or the patient screen ships last.
- **An `/ed` index route**, which triggers the new-route wiring gates.

## Out of scope, deliberately

Phone layouts (screens must degrade sensibly, not be optimised); the other twelve Ward Flow routes;
any change to a non-Ward-Flow surface; real contact details for teams or providers — the model does
not hold them and a fabricated number for a real WA clinic is a hazard, so absence is stated instead.

## How it will be verified

`npm run check:design-system-contract`, `check:type-scale`, `check:icon-scale`, `lint` and
`typecheck` all bear on this, plus `verify:phone-chrome` for any chrome change and the Ward Flow
unit suite discovered from disk. Contrast is computed per pair, not sampled. Every screen is
checked in light, dark, and the default un-stamped state — a colour declared only inside a media
block renders one theme's text on the other theme's ground.
