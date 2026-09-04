# Six bed states — what is possible today, and three ways to get there

**Written for the owner. No recommendation is made here; the three options are laid out so you can
choose.**

**Everything below was measured at commit `5205e6e81`, by reading that exact commit rather than the
working files.** Three of the files involved were being edited by another session at the time, so
reading the working copy would have described something that no longer exists. Nothing here was run —
no test, no build. Where a conclusion comes from reading rather than from running, it says so in the
sentence.

---

## The short answer

**Your six states cannot be produced from what the app holds today. Four of them can, and the
remaining two would have to be shown as something other than a bed state — or the model has to gain
a record for each individual bed, which it has never had.**

The reason is simple and it is not about labels. The app counts beds four ways per ward, and those
four numbers are made by subtracting one authored number from another. There is no record anywhere
that says "this particular bed is in this particular state". So the app can say _how many_ beds are
in a state, but never _which_ bed — and it can only say "how many" for states that can be reached by
subtraction from the numbers it already holds.

Two of your six cannot be reached that way:

- **Pending** (being cleaned) is counted from a completely separate list, and that list is not
  limited by how many beds the ward has.
- **Held** (someone away on leave) is a free-standing note that changes no bed number at all, so the
  person on leave is still counted as being in their bed.

And one of your six — **Pulled** — currently has two different homes in the app, which give two
different answers depending on whether the pull happened before the demo started or during it.

---

## 1. What is true today

### The ward's beds divide four ways, and those four do add up

Every ward has a total bed count. From it the app makes four numbers, and it is proven that they add
up exactly to that total.

| Today's word  | How it is worked out                                                        | Across the 23 synthetic wards |
| ------------- | --------------------------------------------------------------------------- | ----------------------------- |
| **Available** | the smaller of "beds the ward says it can fill" and "beds physically empty" | 27                            |
| **Held**      | physically empty beds left over after Available is taken out                | 13                            |
| **Blocked**   | a fixed number typed into each ward's record                                | 4                             |
| **Occupied**  | everything that is left                                                     | 259                           |
|               |                                                                             | **303 beds total**            |

The arithmetic lives in one function — `unitCapacity`,
`src/components/ward-management/ward-derivations.ts:320-345` — and the proof that it always adds up
is `tests/ward-capacity-reconciliation.test.ts:37`, which checks every one of the 23 wards.

_(All the figures in that table are from the synthetic demo data and are yours to replace. They are
counted here, not invented, so you can see the shape of the problem against real quantities.)_

### The "five-state grid" is really a four-state grid

The function is described in its own notes as a five-state grid, and it does hand back five numbers.
But the fifth, `potential`, is deliberately **excluded** from the sum, and the code's own note calls
it dead — nothing on any screen shows it any more
(`src/components/ward-management/ward-derivations.ts:329-341`, and the test at
`tests/ward-capacity-reconciliation.test.ts:34-37` says in words that it must never be folded in).

So the thing that genuinely adds up is four boxes, not five.

### There is no record of any individual bed. Anywhere.

An admission records which **ward** a person is on, and never which bed
(`src/components/ward-management/ward-admissions.ts:262-267`). Searching the whole application and
its whole test suite at this commit for any bed identifier — a bed id, a bed number, a bed name, a
room number — returns **nothing at all**.

The ward board already says this out loud rather than pretending otherwise. It draws one tile per
bed, and its own note explains that which particular tile is blocked or held is not knowable and is
not invented (`src/components/ward-management/board/ward-board.tsx:160-171`).

### Your six states, checked one at a time

**Open — free, ready, a patient can be pulled into it.**
The app has "Available", but it is not the same thing. Available is worked out without ever looking
at whether the bed is ready (`src/components/ward-management/ward-bed-availability.ts:166`), and the
file says so deliberately. Meanwhile the app _does_ refuse to pull a patient into a bed being cleaned
(`src/components/ward-management/ward-flow-reducer.ts:779-786`). **So today the number on the screen
can be larger than the number of beds the app will actually let you use.**

**Pending — free but being cleaned or repaired. This one does not fit inside the ward's bed count.**
It is counted from the list of bed-release notes, not from beds
(`src/components/ward-management/ward-bed-availability.ts:130-133`). Nothing limits how long that
list gets — the code says so about itself at
`src/components/ward-management/ward-flow-reducer.ts:1420-1421` — and nothing ever removes an entry
from it (`src/components/ward-management/ward-flow-reducer.ts:1160-1162`). The "open beds" figure is
then worked out as Available minus Pending, floored at zero
(`src/components/ward-management/ward-bed-availability.ts:153-156`). **So Open plus Pending equals
the free beds only while Pending is the smaller of the two. Above that, Open sits at zero and the
pair overshoots the ward.**

Worth knowing: neither of these two figures appears on any screen at all. They are read in exactly
one place in the whole app — the refusal that stops a pull into an unready bed.

**Pulled — allocated to a named patient on their way. This one exists twice, with two different
answers.**
When a pull happens while the app is running, it lowers the ward's "can fill" number and leaves the
"physically empty" number alone (`src/components/ward-management/ward-flow-reducer.ts:790`). Because
Held is simply the gap between those two, **a live pull lands in Held.**
But in the starting demo data, the three people who have been pulled and have not yet arrived are
counted inside **Occupied**, not Held (`tests/ward-board-consistency.test.ts:44-68`, together with
`src/components/ward-management/ward-admissions-seed.ts:222-245`).
**Inferred, from reading both paths rather than running them: the same event therefore ends up in a
different box depending on whether it happened before or after the demo started.**

There is one honest bit of good news here. The app already records, on each person, that they are
`pulled` (`src/components/ward-management/ward-admissions.ts:71`). So "how many beds at this ward are
pulled" **can** be counted from the people, today, without any new field. It is only the _bed_ side
of the arithmetic that has nowhere to put it.

**Held (someone away on leave) — this one double-counts if you add it in.**
Recording a leave bed creates a new note and changes **no** number on the ward at all
(`src/components/ward-management/ward-flow-reducer.ts:1443-1465`). The person is therefore still
counted inside Occupied. Adding a "Held" figure to the grid would count that bed twice.
The app avoids this today by keeping leave deliberately outside the grid, as its own separate card
labelled "Leave (usable)" (`src/components/ward-management/ward-management-modes.tsx:448`).
A second point that matters for the screen: a leave note carries no link to a person and no link to a
bed (`src/components/ward-management/ward-model.ts:631-640`). So even with the counting fixed,
**nothing can say which occupied bed is the one being held.**

**Occupied — someone is in it.**
This is whatever is left over after the other three are taken out. In today's demo data it is 259,
and **three of those 259 are beds nobody is in** — the pulled people above. The ward board already
draws them differently, as a tile reading "Empty, waiting"
(`src/components/ward-management/board/ward-board.tsx:1239`), so **the board and the capacity table
already disagree with each other on screen today.**

**Closed — physically empty, but the ward cannot staff or use it. This one has two candidate homes,
and they are different numbers.**
The app's "Blocked" figure is the natural fit by meaning — the ward board draws it as "Out of
service" (`src/components/ward-management/board/ward-board.tsx:1244`). But arithmetically it is
carved out of the **not-empty** side, not the empty side
(`src/components/ward-management/ward-derivations.ts:323-325`): a blocked bed is subtracted from the
occupied beds, which is the opposite of "physically empty". It is also a fixed number typed into each
ward's record that no action in the app ever changes.
Separately, your own ruling note says Closed is the leftover meaning of today's _Held_
(`docs/ward-flow/owner-rulings-2026-09-01-vocabulary-and-pathways.md:35`) — which is a different
figure again: 13 beds rather than 4.

### One field that is a trap

Every ward record carries a field literally called `held`. **Nothing reads it.** Every "Held" figure
on every screen is worked out by subtraction and never consults it
(`src/components/ward-management/ward-model.ts:223-232`, which warns about exactly this). Typing a
real number into it changes nothing anywhere, and there is no symptom — not a wrong figure, no
figure. Mentioned because it is the kind of thing that looks like the obvious place to put a number.

---

## 2. Three options

### Option 1 — Rename the boxes that already exist

**The arithmetic: this adds up.** It is today's four boxes with new words on them, so the proof that
they total the ward's beds is untouched.

**What you would see.** The ward capacity row and the ward board keep exactly the numbers they show
today, with four of your six words on them:

- Available → **Open**
- Held → **Pulled** _or_ **Closed** — one word, and you would have to pick which
- Blocked → **Closed** _or_ left as "Out of service"
- Occupied → **Occupied**

**Pending** and **Held (on leave)** get no box. Leave stays where it is now, as its own separate
count beside the grid. Pending stays invisible, as it is today.

**What would have to change.** Wording only. No new field, no new record, no change to any number.
The words live in a small number of places, and one of them
(`src/components/ward-management/ward-morning-rollup.ts:32-39`) is already a single shared list
precisely so a rename is cheap.

**What it costs if you choose it and you are wrong.** Three things, and they are all the same shape —
a word promising a distinction the numbers do not make:

1. **"Open" would still count a bed that is being cleaned.** The screen would say a bed is open while
   the app refuses to pull anyone into it. That is a screen and an app disagreeing in front of a
   coordinator, which is the failure class this project has been most careful about.
2. **One word has to cover two different things** — a bed given to a named patient who is on their
   way, and a bed the ward simply is not offering this shift. A charge nurse reading either word
   would be right half the time.
3. **"Occupied" keeps counting beds nobody is in** — three of them in today's data. And the ward
   board would go on showing those three as waiting, so the two screens would still disagree.

None of these is new; they are all true today. Option 1's honest description is that it **names the
problem better without fixing any of it**, and it is genuinely the right answer if what you want
first is one shared vocabulary and you are content for the numbers to stay as they are while the
harder questions are settled.

---

### Option 2 — Four boxes that add up, plus two counts clearly marked as _not_ bed states

**The arithmetic: the six do NOT add up, and the screen would say so.** Four boxes total the ward's
beds. The other two — Pending and On leave — are counts of beds that are **already inside** those
four, shown beside them and labelled as such. This is not a fudge; the app already does exactly this
for another figure, and documents why
(`src/components/ward-management/ward-bed-availability.ts:108-118`).

**What you would see.** Per ward: **Open · Pulled · Closed · Occupied** adding up to the ward's beds,
and beside them, in a visibly separate group, **Pending** and **On leave**, each with a line of text
saying these beds are already counted in one of the four.

**Pulled becomes a real number for the first time**, counted from the people rather than from the
beds — the app already records that a person has been pulled.

**What would have to change.**

1. **Pulled is counted from the admissions**, not from the ward's numbers. That producer exists
   today.
2. **The disagreement about where a pulled bed sits has to be settled** — the starting data puts it
   in Occupied, a live pull puts it in Held. One of the two has to move.
3. **Pending has to be capped inside the free beds**, so Open plus Pending can never exceed them.
4. **On leave has to be shown as a marker**, not a state. It cannot become a box without
   double-counting.
5. Thirteen application files and about twenty-one test files read these figures, so this is real
   work — but it is arithmetic and wording, not a new shape of data.

**What it costs if you choose it and you are wrong.** You asked for six states where every bed
carries exactly one. **This gives four states and two markers, and it will not stop doing so.** If
what a charge nurse actually needs is to point at the grid and say _"that bed is pending"_, Option 2
never gets there — Pending remains a number, not a bed. It also still cannot say **which** occupied
bed is the one being held for someone on leave, because the leave note carries no link to a person or
a bed. And it settles the Open-versus-Pending question by making the ward's free-bed figure drop
while a bed is cleaned — which is the opposite of what you ruled on 2026-09-01. See the question
below.

---

### Option 3 — Give every bed its own record

**The arithmetic: this adds up, and it is the only option where the six themselves add up.** If each
bed is a record carrying exactly one of the six states, then counting them is the arithmetic. Nothing
is derived by subtraction and nothing can disagree with anything else.

**What you would see.** A ward grid where each tile _is_ a bed. "Bed pending — being cleaned" on a
particular tile. "Bed held — Mrs X is on leave until Thursday" on a particular tile. Which bed is out
of service, rather than how many. Everything the board's own note currently says it cannot honestly
show.

**What would have to change.** This is the largest piece of work in the project so far.

- A new record per bed. In today's synthetic network that is **303 records** where there are
  currently 23 short lists of numbers — and every one of those numbers is yours to replace with real
  figures later, so the replacement job grows with it.
- Admissions would point at a bed instead of only at a ward.
- The thirteen application files and twenty-one test files above all change, and so does the proof
  that things add up — it becomes a different kind of proof.
- The starting demo data has to be rebuilt.

**What it costs if you choose it and you are wrong.** Three real costs:

1. **It is hard to undo.** Once screens show individual beds, going back to counts means taking
   information off screens people have started relying on.
2. **It forces decisions now that you may not want to make yet.** Do beds get names or numbers a ward
   would recognise? The board's existing note warns that inventing "Bed 1 … Bed 20" would create an
   identity nothing in the model holds and that a ward would read as real. And your own point that
   _"some wards have only male or female only beds"_ would naturally move sex designation from the
   ward onto the bed — sensible, but another change riding on this one.
3. **It opens a door this project has kept shut.** A record per bed is a natural place for
   information about the person in it. The bed-release record today deliberately carries **nothing**
   about the departing patient — not even sex — and that is pinned by tests
   (`src/components/ward-management/ward-model.ts:556-562`). Per-bed records would need that same
   discipline applied deliberately, rather than inherited.

---

## 3. What each option needs from you

### The one question all three options need answered first

**When a bed is being cleaned, does the ward's free-bed number go down?**

On 2026-09-01 you were asked exactly this and chose **no** — the ward has not changed what it can
staff, so its figures should not lurch as cleaning starts and stops; only the _pull_ is refused. That
ruling is built and working (`src/components/ward-management/ward-flow-reducer.ts:779-786`).

The six-state list says a bed is either **Open** or **Pending** and cannot be both — which means
**yes**, the number goes down.

**These two cannot both hold, and it is not an implementer's call.** Either the free-bed figure moves
as cleaning starts and stops, or "Open" is not a count of beds a patient can be pulled into, and one
of the two words has to change.

### Option 1 needs

1. **One naming decision:** which single word — **Pulled** or **Closed** — goes on the box that
   currently reads Held. Whichever you pick, the other meaning stops having a name.
2. **The Open/Pending answer above**, or an acceptance that "Open" is a looser word than your
   definition of it.

### Option 2 needs

1. **The Open/Pending answer above.** Option 2 only works if the free-bed figure is allowed to drop
   while a bed is cleaned.
2. **A ruling on where a pulled bed belongs**: is a bed given to a named patient who has not arrived
   _occupied_, or is it its own thing sitting outside the occupied count? The starting data and the
   live app currently answer this differently.
3. **Your agreement that Pending and On leave may be shown as counts beside the grid**, plainly
   marked as beds already counted elsewhere, rather than as states of their own.

### Option 3 needs

1. **A decision on bed identity:** do beds get names or numbers a ward would recognise, and if so,
   where do those come from? Invented numbering is the thing the board currently refuses to do.
2. **A decision on sex designation:** does it move from the ward to the bed?
3. **Your agreement that this becomes the next large piece of work**, ahead of the other items
   already queued from the 2026-09-01 rulings.

---

## What this document does not decide

Three things came up in the measurement that are outside what was asked here, and they are recorded
rather than answered:

1. **Your ruling that every departure sends the bed to Pending rather than straight to free**
   (`docs/ward-flow/owner-rulings-2026-09-01-pull-and-hold.md`, item 6) is not yet built, and it
   changes the arithmetic in all three options above. Whichever option is chosen, that ruling lands
   on top of it.

2. **Inferred, not measured:** there appear to be two separate routes by which one bed becomes free —
   recording that a person left, and separately releasing the bed through the bed-release lifecycle.
   Reading them, each raises the ward's empty count by one
   (`src/components/ward-management/ward-flow-reducer.ts:1071` and `:1437`). If both run for the same
   bed, the ward would appear to gain two beds where one was freed. **This was not run and is not
   claimed as a defect** — it is flagged because it sits directly underneath the arithmetic of every
   option above and should be checked before any of them is built.

3. **The word "Closed" has two candidate homes** — today's Blocked (4 beds) and today's Held
   (13 beds) — and your own ruling note points at the second while the meaning points at the first.
   Which one it names is a decision, and it is yours.
