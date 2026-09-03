# Owner rulings, 2026-08-31 — the community hub, and six urgency reasons

**All first-hand to the orchestrator.** He was given nine questions with one recommendation each,
said _"if not below I give permission and agree with your recommendations"_, and listed five
exceptions.

---

## ✅ ACCEPTED AS RECOMMENDED

### 1. A patient is "this team's" by an EXPLICIT TEAM ON THE REFERRAL, not by home area

**A home area is a guess about geography; a named team is a fact somebody entered.** ⚠️ **It also
keeps the unresolved suburb mapping out of a second screen** — `CM-1` defers suburb→service, nothing
derives a hospital from a suburb, and this ruling means nothing needs to.

### 2. ✅ A community team CAN see a ward's reason for declining their patient

**Consistent with the earlier ruling that ED psychiatry sees the reasons for its own referrals.** **A
team that referred someone is in the same position: they need to know whether to try elsewhere or
change the plan.**

⚠️ **This is scoped to THEIR OWN referrals.** It is not a general widening — `FD-23` stands, and a
community team learns nothing about referrals it did not make.

### 6. Real transport providers and community teams stay DEFERRED · 7. The refresh-wipes-state gap stays CUT

**Placeholders demonstrate the behaviour.** ⚠️ **On the refresh gap his position is unchanged: do not
refresh while showing it.** **If anyone is ever to drive it themselves, that decision reopens** — a
stranger will refresh.

---

## ⛔ 3. REVERSED BY HIM, AND THE REASON IS CLINICAL

**I recommended that a community team may SEE transport but not ARRANGE it.** ⛔ **He overruled it:**

> **"Yes community can as they will sometimes send patients to ED via WAPOL or St John's etc."**

⚠️ **MY RECOMMENDATION RESTED ON A FACTUAL ERROR, NOT A JUDGEMENT DIFFERENCE.** **I treated a
community team as neither the sending ward nor the ED, and therefore not a sending location.**
✅ **It is one.** **A community team seeing someone in the community who needs an ED IS the sending
location, and it arranges the conveyance — routinely via police or ambulance.**

> ✅ **SO `TR-D5`/`TR-D6` ARE NOT WIDENED, THEY ARE CORRECTLY APPLIED. "The sending location always
> organises transport" already covered this; I misclassified who the sending location was.**

**Consequence for the build: the community hub raises transport for a move it is sending.** ⚠️ **It
does NOT gain cancel rights beyond the existing rule (`TR-D5`/`TR-D6`: cancel belongs to the booking
team and the coordinator), and a community team booking a move IS the booking team for that move.**

---

## ⚠️ 4. THE SIX URGENCY REASONS — CHOSEN BY ME, ACCEPTED PROVISIONALLY, NOT HIS WORDS

> **"You just choose the top 6 you think based on your understanding of flow and I accept that for
> now to be changed later."**

⛔ **THE DISTINCTION THAT MUST SURVIVE EVERY FUTURE EDIT: the SHAPE is his, the SELECTION is mine,
and the ACCEPTANCE is provisional and time-limited by his own words.** ⚠️ **Nothing here may start
reading as his language.** **The previous block said "he has not seen them"; that is now false and
must not simply be deleted — he has seen the ten, delegated the cut to me, and pre-accepted the
result sight-unseen.**

### ✅ The six, and they preserve the setting-shaped rule

```
cannot_safely_prevent_leaving          a detained person in a setting that cannot hold them
cannot_be_observed_safely_here         the observation level required is not deliverable here
safety_of_others_in_this_setting       risk to other patients and staff where they are now
no_psychiatric_cover_at_this_site      no psychiatric input available at all
needs_medical_care_unavailable_here    the reverse direction, a psychiatric bed needing medical care
escort_in_place_and_unsustainable      resources holding the situation that will run out
```

⚠️ **EVERY ONE DESCRIBES WHAT A SETTING CANNOT DO, NOT A FACT ABOUT THE PATIENT.** ✅ **That is the
property that lets the coordinator and every ward hold the same list with nothing hidden and nothing
filtered, and it is the reason the earlier reword dissolved the who-may-see-a-reason question rather
than answering it. Selecting six must not quietly reintroduce a person-shaped reason.**

### ⚠️ The four I cut, and why — so the reasoning is reviewable rather than asserted

| Cut                                                | Why                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `one_to_one_observation_needed`                    | Overlaps `cannot_be_observed_safely_here`, and is the more **person-shaped** of the pair                      |
| `restrictive_measures_this_setting_cannot_sustain` | Overlaps both `cannot_be_observed_safely_here` and `escort_in_place_and_unsustainable`                        |
| `earlier_placement_broke_down`                     | A **history** fact rather than a current-state driver; it says what happened, not what this setting cannot do |
| `this_setting_cannot_continue_current_care`        | A **catch-all** — and a catch-all gets chosen instead of the specific reason, which degrades the data         |

⚠️ **THE TRADE-OFF I MADE, STATED SO HE CAN REVERSE IT: dropping the catch-all forces a choice among
six.** **That is better for data quality and worse when none of the six fits.** ✅ **Reversible in one
edit; the list is authored in exactly one place, `ward-change-reasons.ts`, plus its labels.**

---

## ⚠️ DEFERRED BY HIM — recorded so absence is not read as oversight

| Item                                                            | Status                                                                                                                           |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **5. The catchment suburb mapping** and its eight disagreements | **Defer for now**                                                                                                                |
| **8. Three escalation questions** from the cut phase            | **Defer for now**                                                                                                                |
| **9. Repository visibility** — it is PUBLIC                     | ⚠️ **Defer for now** — **his decision, made knowing the eight invented patient records and three commits of history are public** |

---

## ⚠️ TWO ADDITIONS FROM WARD VERIFIER, ONE OF WHICH IS A COST OF MY OWN SELECTION

### ⚠️ 1. A SHORTER LIST IS EASIER TO APPLY AND THEREFORE EASIER TO OVER-APPLY

> ⚠️ **"If the urgent mark inflates, the threshold has failed even though every individual reason
> was sound."**

**I chose six for precision — no overlaps, no catch-all, every reason distinct.** ⚠️ **I did not
weigh that the same properties make the mark EASIER TO REACH FOR.** **Ten reasons with overlaps
force a moment of thought about which one fits; six clean ones do not.**

✅ **NOTHING TO DO YET — there is nothing to measure it against.** **But once urgent marks exist in
any number, the thing to look at is the RATE, not the reasons.** ⚠️ **Every individual reason being
sound is compatible with the threshold having collapsed, and the reasons are where anyone
reviewing would look.**

### ⛔ 2. QUOTE HIM FOR THE PROVISIONALITY. DO NOT PARAPHRASE IT.

**The docblock correction must carry his exact words:** _**"I accept that for now to be changed
later."**_

> ⛔ **A PARAPHRASE OF "FOR NOW" DECAYS INTO "APPROVED" WITHIN TWO EDITS, AND NOTHING LOCAL WILL EVER
> FAIL.**

**And the deletion risk is the live one: `HE DID NOT WRITE THESE WORDS AND HAS NOT SEEN THEM` has a
false second clause and a true first one.** ⚠️ **Deleting the sentence removes the warning entirely
and the list starts reading as settled — the exact misreading, arriving through the door marked
"tidying up a stale comment".**

### ⚠️ AND A PROVENANCE CORRECTION ABOUT THE REPOSITORY

**Ward Verifier declined to state that the repository is public, because it has not measured it and
would not take a GitHub read without being asked.** ✅ **It is right, and the same applies to me:**

> ⚠️ **"THE REPOSITORY IS PUBLIC" IS THE OWNER'S STATEMENT, NOT MY MEASUREMENT.** **He said _"It is
> public for now but I will change later"_, and I have repeated it since as though I had checked.
> I have not.**

✅ **What IS measured, by both of us independently: the branch is on the remote, `ward-patients-seed.ts`
carries eight named records there, and three commits in its history contain them.** ⚠️ **Whether
that remote is visible to the world rests on his word alone.**
