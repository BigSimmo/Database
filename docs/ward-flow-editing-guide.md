# Changing the ward data — a plain guide

**Who this is for:** whoever is putting real numbers into Ward Flow, including someone who does not
write software. Every instruction says which file to open, what to change, and what will complain.

**The one rule underneath all of it:** every changeable fact about the real world — a hospital, a
ward, a bed count, a distance, a catchment, an option in a dropdown — should be written in exactly
ONE place, and everything else should work itself out from there. Where that is not yet true, this
guide says so plainly rather than pretending.

> **Status, 2026-08-29.** This describes the prototype as it stands, measured rather than assumed;
> file and line references were read, not remembered. Several of the couplings below are ones we
> intend to remove. Until they are removed they are real, so they are documented.

---

## Before you change anything

Run the checker. It reads the data and reports problems in ordinary words:

```bash
node scripts/check-ward-data.mjs
```

It changes nothing and touches no live service. Run it before you edit, so you know the starting
point was clean, and again afterwards.

---

## Changing a ward's bed count

**Where:** `src/components/ward-management/ward-sites.ts`. Each ward is a block of about fifteen
lines. Find it by its name.

**This is not currently a one-number edit, and that is the thing this guide most exists to warn
about.** A ward's block states several numbers that have to agree with each other:

| Field                  | What it means                                          |
| ---------------------- | ------------------------------------------------------ |
| `beds`                 | How many beds the ward physically has                  |
| `empty`                | How many are empty right now                           |
| `allocatable`          | How many of the empty ones the ward says can be used   |
| `blocked`              | How many are out of service                            |
| `sexMix`               | How many women and how many men are currently in beds  |
| `speciallingCapacity`  | How many can be watched one-to-one                     |

They must satisfy this, and the checker will tell you when they do not:

> women + men **must equal** beds − empty − out of service

**And there is a second file.** `src/components/ward-management/ward-admissions-seed.ts` lists the
individual people occupying beds, one line each, grouped by ward. The number of lines for a ward
must match its `sexMix` exactly, for each sex. So raising a bed count usually means adding lines
there too.

**Why we have not simply made the computer work this out.** Two of these numbers are deliberately
written down separately so that a test can compare them and *disagree*. If one were calculated from
the other they would always match, the comparison would always pass, and it would look like a safety
check while checking nothing. That is a real trap this project has hit before, so the duplication is
on purpose. We intend to reduce it — by generating how MANY lines exist while keeping WHO each line
describes written by hand — but that has not been done yet.

**One field you can ignore.** `held` is written for every ward and read by nothing. Every screen
that shows a "Held" figure works it out from `empty` and `allocatable` instead. It is a candidate
for removal; until then, leaving it wrong changes nothing on any screen.

---

## Adding a ward to a hospital that already exists

1. Add the ward's block to that hospital's `units` list in `ward-sites.ts`.
2. Add its occupants to `ward-admissions-seed.ts` — unless the ward is entirely empty.
3. Run the checker.

**Expect some tests to complain, and it is not a fault.** Several count the network: 23 wards is
written into `tests/ward-capacity-reconciliation.test.ts`, `tests/ward-flow-provider.dom.test.tsx`,
`tests/ui-ward-referrals.spec.ts` and `tests/ui-ward-coordinator.spec.ts`. Those numbers are doing a
real job — they would catch a ward silently vanishing — so they should be updated, not deleted.

**One kind is genuinely confusing, and worth knowing in advance.** A few checks count things the
system *works out* rather than things anyone typed: how many patients end up with nowhere to go, and
in what order they are prioritised. Adding a ward changes the answer. They live in
`tests/ward-scenarios.test.ts`, `tests/ward-escalation.test.ts` and `tests/ward-priority.test.ts`,
and they fail with messages about stranded patients rather than about the ward you just added. If
you see that, you have not broken anything — the network genuinely got roomier.

---

## Adding a whole hospital

Steps 1–3 above for each of its wards, and then:

**If the hospital belongs to a health service we already have** — North Metro, South Metro, East
Metro, WACHS or Private — there is nothing else to do.

**If it belongs to a NEW health service, stop and read this.** The five services are typed out by
hand in three separate places (`ward-model.ts` line 9, `ward-derivations.ts` line 88,
`ward-management-network.tsx` lines 46–49) and there is no shared list anywhere.

It works in two steps, and only the second one is dangerous:

- **You cannot forget `ward-model.ts`.** Until the new service is added there, the build refuses
  outright. So that one looks after itself.
- **You can very easily forget the other two, and nothing will tell you.** Once the build is happy,
  missing the service from `ward-derivations.ts` means those wards are dropped from the
  emergency-department screen's ward table, and missing it from `ward-management-network.tsx` means
  the network map never draws a column for them at all. In both cases the app compiles, runs, and
  looks completely normal, with an entire health service simply absent.
- The coordinator's flow diagram is the one place that does *not* fail silently — it notices wards
  it cannot place and lists them separately. That is a visible warning rather than correct output,
  but it is at least visible.

Add the service to all three, and run the checker, which now looks for exactly this.

**If the hospital has an emergency department, expect the demo to reshuffle.** Patients are handed
out across the emergency departments in turn, so going from eight to nine changes which department
every existing patient started in. Nothing is wrong; the invented demand has simply been redealt.

---

## Changing a distance or travel time

**Where:** `src/components/ward-management/ward-travel-bands.ts`. One place, and nothing else stores
a distance, so this genuinely is a single edit.

**But three tests currently guard the fact that this data is INVENTED**, and real data will trip
them: one requires every travel band to be used at least once, and one requires at least one region
to be entirely unrecorded so the "not recorded" path has something to show. Filling the table in
properly is exactly what breaks them. That is expected, and those two guards should be switched off
in the same change — a third one already has a switch for this and the same reasoning applies.

---

## Renaming a hospital or ward

Change it in `ward-sites.ts`. Then check two things the computer will not:

- **The menu labels.** `ward-nav.ts` has ward names typed into its menu text, for example
  "Ward — RPH Adult Secure". Rename the ward and the menu keeps the old name and nothing complains.
  The checker now catches this.
- **The documentation.** Several documents describe the network in prose. Three of them already say
  22 wards when there are 23, which is this exact problem having already happened once.

---

## Adding an option to a dropdown

Most lists are safe: the list is written once and everything else follows it. Add the entry and you
are finished. That is true of the decline reasons, escalation contacts, bed-preparation notes,
blockers and release reasons.

**Four are not safe and need more than one edit:**

- **Length-of-stay bands** — the worst. The list, a second copy of the same list as a type, a colour
  map, a colour class and a colour token, and a test pinning the count. Five places.
- **Where a patient goes when they leave** — the list, plus a second copy of it as a type.
- **Reasons for releasing a held bed** — a test pins the count at five.
- **Demo scenarios** — anything that is not the standard scenario is silently treated as the scarce
  one.

---

## What to send when you have the real numbers

**Send a plain list.** Ward name and bed count, however you happen to have them — a message, a
spreadsheet, a photograph of a whiteboard. Do not try to match any format. Getting them into shape
is our job, and you should never need to know which files a number lives in.

---

_Synthetic prototype. Every number currently in the system is invented and none of it describes a
real ward, a real patient, or any legal requirement._
