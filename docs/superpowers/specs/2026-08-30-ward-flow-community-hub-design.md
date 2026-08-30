# Community hub — design

**Status:** design complete, nothing built. **Approved by the owner:** *"Build community hub. I give
permission."* (`FD-29`). **On placeholder teams** (`CM-8` sense — his to replace).
**Register of record:** `docs/ward-flow-ledger.md` on `claude/Ward-design`.

## What this hub sees that nobody else does

The coordinator hub sees **across** the service at one moment. **This one sees THROUGH time for one
patient.**

Every other surface holds a slice. The ED sees a presentation. The ward sees an admission. **The
community team sees the person continuously, with the admission as an interruption in the middle of
a longer relationship.** That is the owner's *"full-circle follow-up flow"*, and it is the only
thing this hub can offer that no other screen can be rearranged to give.

```
community  →  referral  →  ED / ward  →  discharge  →  community
    └──────────────── one team, the whole way round ─────────────┘
```

**A patient has exactly one community team** (`FD-17`: a catchment contains several wards and one
community team). ⚠️ **So unlike a ward, this hub is not one of several possible destinations — it is
THE one**, and a patient it loses track of is not picked up by a peer.

## The four lists

### 1. DISCHARGED, NO FOLLOW-UP ARRANGED

**The core of the screen, and the same shape as the coordinator's first list: an absence.**

A patient discharged from a ward back into this team's area with nothing arranged. ⚠️ **Nothing else
in Ward Flow shows this.** The ward has discharged them and correctly moved on; the bed is free and
the movement is closed. **The patient has left every board in the system.**

**Empty means: everyone discharged into this area has something arranged.**

⚠️ **No threshold, no "overdue", no colouring** (`P9-D3`). This is the second most tempting place in
the prototype for an invented seven-day rule, and it is the one place where such a figure would look
most authoritative.

### 2. OUR PATIENTS, CURRENTLY ADMITTED

Patients from this team's area who are on a ward now — **where they are, and what stage they are at.**

**`FD-25` makes this list necessary rather than decorative:** a referral may exist for a patient who
already has a bed, precisely so **follow-up can be arranged before discharge rather than after it.**
A team that only learns of an admission at discharge cannot do that.

**Empty means: nobody from this area is currently an inpatient.**

### 3. REFERRALS WE HAVE MADE

This team's own outbound referrals — to a ward, to an ED — with their state and destinations.

**`community` is already a value in `REFERRAL_SOURCES`** (`ward-model.ts:511`), so these referrals
exist in the model today and have nowhere to be seen from this side.

⚠️ **`FD-23` applies unchanged: a referrer sees their patient at the destination they referred to,
and NOT the other destinations.** The coordinator sees all of them; this team does not. **Do not
build the coordinator's second list here** — it is the same data and a different permission.

**Empty means: this team has referred nobody.**

### 4. EXPECTED BACK

Patients admitted from this area with a discharge expected — **the other half of list 1, before it
becomes list 1.**

⚠️ **This list is the mechanism, not a nicety.** List 1 catches the failure; **this one is where the
failure is prevented**, because it exists while the patient is still on a ward and somebody can
still act.

**Empty means: nothing is coming back yet.**

## What this hub must NOT become

⚠️ **"Full outpatient infrastructure" is a phrase that can absorb an entire clinical system, so the
boundary is stated rather than left to judgement:**

- **No clinical record.** No progress notes, no risk assessment, no care plan, no appointment
  history. **This hub tracks a patient's position in the bed-flow circle, not their care.**
- **No free-typed values.** `FD-13` permits exactly one story field, on a referral. **Nothing here
  adds a second** — and a community screen is where a "handover note" box will feel obviously
  necessary.
- **No name, date of birth beyond what `PD-1` permits, address, or narrative history.** ⚠️ **A
  suburb is not an address** (`PD-3`), and a community screen is the single most likely place for
  that line to be crossed, because catchment work makes an address feel like the natural field.
- **No caseload management.** Who is allocated to whom, when they were last seen, how often they
  are visited — **all of it is a different product**, and none of it is bed flow.
- **No invented figures.** No follow-up interval, no contact target, no breach.

## Open, and not to be closed by building

- **The community team list is placeholders** (`CM-8` sense) until the owner supplies real teams.
  **Generic, obviously stand-in, derived from one exported array — never hand-listed.**
- ⚠️ **Whether "discharged into this area" is derived from the patient's `homeRegion` or from an
  explicit team on the referral.** `CM-1` leaves the suburb→service mapping deferred and **nothing
  derives a hospital from a suburb; whether a TEAM may be derived is a separate question and is not
  ruled on.** **Do not infer it from the region work.**
- **Whether a community team can see a ward's decline reason.** Same gap named in the coordinator
  spec; `P9-D9` settled only ED psychiatry seeing its own.
- **Whether this hub raises transport** for a community-arranged move. `TR-D1` gives booking to the
  sending ward or ED; **a community team is neither, and the case is not ruled on.**
