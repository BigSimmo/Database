# Allocation B, third pass — and this one changes what the fix can BE

**Independent enumeration at `cf9d87e1f`, run without sight of Ward Verifier's answer.** It agrees
with the refutation and then goes further in three ways, one of which is architectural.

## ⚠️ 1. `dispatch` RETURNS VOID BY CONSTRUCTION. "Read what the reducer returned" is impossible.

`dispatch` is React's raw `useReducer` dispatch (`ward-flow-provider.tsx:84,127`), typed
`Dispatch<WardFlowEvent>`. **Nothing in this codebase can capture a return value from it.**

**So the whole framing "every surface either pre-checks or renders the rejection it got back" was
describing a mechanism that does not exist.** The only way any file learns an outcome is a
side-channel: **diffing the shared `rejections` array across the dispatch**, which is exactly what the
files that do handle refusal already do:

```
morning-tour.tsx:265   const refused = rejections.length > lastSeenRejectionCountRef.current;
ed-screen.tsx:729      const priorRejectionCountRef = useRef(rejections.length);
```

⚠️ **This is not a quibble. It means allocation B is not "check the return value" — it is "adopt the
established rejections-diff pattern", and there is already a house idiom to copy.**

## ⚠️ 2. `ward-screen.tsx` never destructures `rejections` AT ALL

```
ward-screen.tsx:128  const { movements, units, bedReleases, leaveBeds,
                            refreshRequests, now, dispatch } = useWardFlow();
```

`grep -n "rejections\b"` returns nothing in the file. ⚠️ **So it is not that it ignores the answer —
it does not have the answer in scope. It is structurally unable to check, even if it tried.**

## ⚠️ 3. It is not ungated. It is gated on the WRONG predicate.

Two different mechanisms live in that file and conflating them is the trap:

- **`eligibilityWarning` — DISPLAY ONLY**, and the file says so in its own comment at `:1150-1153`:
  _"the reducer enforces nothing behind `ACCEPT_IN_PRINCIPLE`/`PULL_PATIENT`, so this is INFORMATION
  for the human reading the screen, never a gate — accept below still dispatches exactly as before
  whether or not this renders."_
- **`referralAnswerBlocked` (`:62`) and `pullBlockedReason` (`:78`) — A REAL GATE**, wired to
  `aria-disabled` and `ignoreUnavailableActivation` at `:1167-1173` and `:1296-1302`.

⚠️ **So a reviewer looking for "is the dispatch gated" finds a gate and stops. The gate is real and it
is a different question from eligibility.** That is a much easier thing to get wrong than an absent
gate would have been.

## The dispatcher inventory, repo-wide, non-test

| Event                                   | Site                                      | Surfaces a refusal?                    |
| --------------------------------------- | ----------------------------------------- | -------------------------------------- |
| `REFER_TO_UNITS`                        | `coordinator/shortlist-panel.tsx:425,442` | ✅ yes                                 |
| `REFER_TO_UNITS`, `ACCEPT_IN_PRINCIPLE` | `morning/morning-tour.tsx:89,98`          | ✅ yes — `:402-407` renders the reason |
| `ACCEPT_IN_PRINCIPLE`, `PULL_PATIENT`   | `ward/ward-screen.tsx:1176,1305`          | ❌ **no**                              |
| `ACCEPT_REFERRAL`                       | `referrals/referral-match.tsx:202`        | ✅ yes — `role="alert"` at `:416-420`  |

⚠️ **FOUR DISPATCHING SURFACES. THREE HANDLE REFUSAL. ONE DOES NOT.** That is a far stronger control
than either of my earlier attempts: it is not "zero is unusual", it is **"every other dispatcher in
the tree already does this, in a pattern that exists to be copied."**

⚠️ **And `shortlist-panel.tsx` and `referral-match.tsx` were in neither my nine nor the corrected
four.** Two of the tree's four real dispatchers were missing from every list published tonight,
including the one that corrected mine.

## ⚠️ 4. My zero was partly a vocabulary artefact, and the correction is smaller than it looks

The codebase's user-facing vocabulary is **`refus-`, not `reject-`**: `TourPhase = "refused"`,
`styles.refusalsSection`, `data-testid="ward-refusals"`, _"The model refused this step"_. A search on
"reject" alone would miss all of it.

**But it does not rescue my finding's target.** `rejections` contains the substring "rejection", and
`ward-screen.tsx` has zero of those — because it never destructures the array. **The claim survives;
the method that produced it was still unsound, and would have produced a false zero on any of the
other three files.**

## Allocation B, as it now stands

1. **`ward/ward-screen.tsx` alone**, and the work is: **bring `rejections` into scope and adopt the
   existing diff pattern** — not invent a mechanism, and not check a return value that does not exist.
2. **Distinguish the two gates while doing it.** `referralAnswerBlocked`/`pullBlockedReason` stay;
   eligibility remains advisory per the owner's "keep advising and let the clinician decide".
3. **A ward-visible surface for the refusal.** `ExceptionDrawer` is the coordinator's running log,
   mounted only at `coordinator-screen.tsx:14`. ⚠️ **Do not mount the log twice** — `referral-match.tsx:416`
   is the better template: an inline `role="alert"` naming what was not recorded and why.
4. **Verified by looking, not by a passing test.** Every gate here was green while all of this was true.
