# The header — design

**Status:** design complete, nothing built. **Designed from Ward Verifier's browser report**
(`PROC-19`). **Both candidate readings of "the header is missing" turned out to be true: ABSENT on
transport, PRESENT-and-thin everywhere else.**

## Three separate jobs, and only the third is a design question

1. **Transport has no header.** Plumbing — give it the same one. *(Ward Core.)*
2. **`ward-management-modes.tsx:170` hardcodes `15 Aug 2026 · WA` beside a live clock.** A frozen
   date next to a moving one, and a changeable real-world fact written into a component. *Already
   routed as a defect — not design.*
3. **What is the header FOR?** ⚠️ **This is the one the owner actually asked, and today the answer
   is "identity and a role selector, and nothing anyone acts on."**

## What the header is for

**It is the only element on every screen. So it must carry what is true on every screen — and there
is exactly one thing in that category that matters.**

> **The header is the screen's honesty line.**

**Ward Flow is a prototype that will be put in front of clinicians.** Every safeguard in this project
points the same way: synthetic patient names must be obviously synthetic (`PD-2`), unreviewed
catchment data must render as unreviewed (`CM-7`), a diagnosis is labelled *tentative*, the transport
page says out loud that 35 of 43 movements have no vehicle to track. ⚠️ **The header is where that
discipline either holds across the whole product or is left to each screen to remember.**

**So it carries three things and stops:**

| | Why it earns its place |
| --- | --- |
| **This is synthetic** | **The most important fact on every screen**, and the only one whose absence could mislead a real clinician about a real patient |
| **What this screen is** | A name, stated once, in one form — see the naming defect below |
| **How current this is** | Everything is live now (`OD-4`, `WB-DB-11`). **The header says so, and says when it last updated** — a live screen that cannot show it is live is indistinguishable from a frozen one |

## What comes off it

- ⚠️ **The frozen date** — routed as a defect. **A stopped clock beside a running one teaches a
  reader that some of what they see is stale, without telling them which parts.**
- **Brand chrome.** It is on every screen and tells the reader nothing they do not know.
- ⚠️ **The role selector stops being dressed as product chrome.** It is a **demonstration control** —
  no real user switches between being a ward nurse and a coordinator. **A demo control styled as a
  product feature makes the demonstration lie about itself**, which is the one thing this prototype
  cannot afford. **Keep it; make it visibly a prototype affordance, sitting apart from the honesty
  line rather than inside it.**

## What must NOT go on it

⚠️ **No service-wide state.** *"Three patients waiting in ED"* on every screen is the obvious
addition and it is wrong twice: it duplicates the coordinator hub, which exists precisely to be the
one place absences are visible (`CO-D1`), **and it pushes coordinator-shaped information onto ward
screens that `FD-23` deliberately keeps narrow.**

- **No counts, no alerts, no badges with numbers.** ⚠️ **A number in a header is read as important
  by definition, and none of the numbers in this system are equally important on every screen.**
- **No invented threshold** — nothing coloured, nothing flagged (`P9-D3`).
- **No actions.** *"Nothing a coordinator acts on"* is a true observation and **not a fault to fix**:
  a header of actions is a header nobody reads. **Actions belong on the surface that owns the work.**

## The naming defect this design surfaces

**A header must state a name, which forces the question nobody has answered:**

```
route      /transport
title      "Live tracker"
component  live-tracker.tsx
```

⚠️ **Three names for one page.** **The header cannot be designed without choosing one**, and the
choice is not cosmetic — **it is what a person calls the thing when they ask somebody else to open
it.** ⚠️ **Not ruled on. Owner decision, and the transport design (`4dffeef8f`) does not settle it
either.**

**Same check is owed on every other route before this lands** — a header that states a different
name from the nav is the frozen-date fault in a different form.

## Refusals that apply

- **No free-typed values anywhere in it.**
- **No real organisation named** (`TR-D2`'s reasoning applies here too).
- **The synthetic marker is not dismissible, not collapsible, and not smaller on small screens.**
  ⚠️ **It is the one element whose absence is a safety issue rather than an inconvenience.**
