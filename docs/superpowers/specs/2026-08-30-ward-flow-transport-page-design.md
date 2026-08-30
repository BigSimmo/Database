# The Transport page — design

**Status:** design complete, nothing built. **Designed from Ward Verifier's browser report**
(`PROC-19`). ⚠️ **Distinct from the transport FLOW design (`4dffeef8f`), which this page predates
entirely** — that one says who acts; this one says what the page is.

**Its name is settled: *Transport*.** *(`HD-Q1`, owner — reached this session as a relay.)* The route
`/transport` and the page title now agree; **`live-tracker.tsx` is internal and cosmetic.**

## The tension this page has to resolve

**The transport flow design says transport is NOT a separate hub** — jobs appear on the board of
whoever owns them, and *"if a transport-officer view is ever wanted it is a view over the same jobs,
never a second place they live."*

**So what is `/transport` for?**

> **It is that view. It already exists, and the rule is that it must stay a VIEW.**

⚠️ **The distinction is not pedantic and it is the whole risk: a page that shows every transport job
will accumulate actions, and the moment a job can be created or reassigned here, transport has a
second home and `TR-D1`'s ownership rule is dead** — silently, because nothing would look wrong.

**Jobs are booked on the sending team's board (`TR-D5`). They are cancelled by that team or the
coordinator (`TR-D6`). Neither happens here.**

## What is already right — and it is the best copy in the product

> *"35 of 43 open movements have no transport job at all right now and are not listed below: there is
> no vehicle yet to track for them."*

🔴 **Keep it, and keep it exactly.** ⚠️ **That sentence is conservative failure working: the page
states what it cannot show, and says why, in the place where a reader would otherwise assume the list
was complete.**

**And it is the same shape as the coordinator hub's first list** — **the most valuable thing on a
transport page is the movements with NO transport, not the ones with it.** ⚠️ **The 35 are the story;
the 8 are the easy part.**

**So the page's structure follows from its own best sentence:**

| | |
| --- | --- |
| **No transport job yet** | **First, and it is the point.** These are patients accepted somewhere with nothing arranged |
| **Jobs in progress** | The vehicle cards that exist today |

⚠️ **Today those 35 are named in a sentence and then not listed.** **They should be the list.**

## The header

**It has none** (`HD-D1` — one of the three header jobs was giving this page one). **It opens straight
into the synthetic banner and vehicle cards**, so **the one screen with no header is the one whose
name was ambiguous** — those are the same defect seen twice.

**With the header in place, the page-level synthetic banner is redundant** and comes off, exactly as
on capacity (`CP-D1`): **said once, in the place that carries it on every screen.**

## What must NOT happen

- 🔴 **No booking, no reassignment, no provider change on this page.** ⚠️ **That is the line between a
  view and a second home**, and crossing it kills `TR-D1` without breaking anything visible.
- **The 35-of-43 sentence is not shortened, softened, or moved below the fold.** ⚠️ **It is the
  page's honesty and the first thing a compression pass would cut** — same risk as the capacity
  disclaimer, and for the same reason.
- **No invented threshold.** No "waiting too long for transport", no colouring — `P9-D3`.
- **No real organisation named.** Providers are generic placeholders until the owner supplies the
  list (`TR-D2`), and this page **renders the provider straight to screen**, which is where `TR-F2`
  was visible in the first place.
- **No ranking of providers**, for the same reason a capacity table must not sort by worst.

## Open, and not to be closed by building

- ⚠️ **Whose page is it?** Transport has no owning role (`TR-D1` gives booking to the sending team),
  **so this is a whole-service view — which by `CO-D1`'s reasoning makes it coordinator-shaped.**
  **Whether it belongs inside the coordinator hub rather than beside it is not ruled on**, and the
  answer changes whether it survives as a route at all.
- **Whether a movement with no transport job needs one at all.** ⚠️ **Not every movement does** —
  a ward→ED-medical trip keeps the bed (`FD-19`) and `TR-D5` now says the sender arranges it, **but
  nothing says every movement raises a job.** **So "35 with no job" may be 35 gaps or 35 correct
  absences, and the page currently cannot tell the difference.** ⚠️ **That is the most important
  open question on this screen: a list of absences is only useful if an absence is a problem.**
