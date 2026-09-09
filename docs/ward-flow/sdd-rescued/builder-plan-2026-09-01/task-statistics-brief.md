# Task — the coordinator statistics screen

**Owner's words:** "Build a statistics screen so everything can be tracked which only the coordinator
has access to at present", plus "important things that the state government or ward coordinator or
policy makers would want to track... also important things clinicians would want to track".

⚠️ **TWO AUDIENCES, NAMED SEPARATELY BY HIM. DO NOT COLLAPSE THEM INTO ONE LIST OF TILES.**
A policy maker asks _how is the system performing_. A clinician asks _what is happening to patients_.
The page must have two sections and say which is which.

## What is computable, and what is NOT — measured, do not re-derive

| Statistic             | Verdict        | Evidence                                                                                                                                                                                                                                                                               |
| --------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Declines per ward** | ✅ BUILD IT    | `ReferralAddressing` carries `destination`, `state: "declined"`, `decidedAt?`, `declineReason?` — per destination, so attributable to a named ward with a reason from a controlled vocabulary.                                                                                         |
| **Pull → arrival**    | ✅ BUILD IT    | `Admission.pulledAt` and `Admission.arrivedAt`, both `Instant \| null`, both on the SAME record. No join.                                                                                                                                                                              |
| **Referral → bed**    | ❌ EMPTY STATE | `Admission.referralId` exists and is populated, but admissions MINT their own ids (`RF-${suffix}` from ward-tagged numbering) while real referrals are `RF-001`–`RF-009`. The join resolves to nothing. The model itself says the field is "written by the seed and consumed nowhere". |
| **Pending → open**    | ❌ EMPTY STATE | Bed readiness is `preparing: boolean` — a boolean with NO instants anywhere. There is no state to time, not merely missing timings.                                                                                                                                                    |

## The rules that bind this page

- **NEVER invent, estimate or interpolate a figure.** Every number rendered must be derived from
  provider state. This is the screen whose entire purpose is being believed.
- **The two empty states must say WHY, not merely that data is absent.** "Not yet collected" is
  useless; "the join exists but resolves to nothing, and the fix is the movement side" is the point.
  An empty state that explains itself is what stops somebody quietly filling it with a plausible
  number later.
- **Say on the page that it is a coordinator view AND that the prototype does not enforce it.**
  There is no route-level role gate anywhere in these mockups. An unenforced claim stated honestly
  is safe; an unenforced claim stated as though enforced is not.
- **A count of zero is a real answer and must render as one** — distinct from "cannot be measured".
  Do not let an empty result render as though the measurement is unavailable.
- **`"left"` IS BEING RENAMED to `"departed"`.** Every read of an admission state VALUE goes behind
  ONE exported named function in `statistics-derivations.ts`, so the rename is one line to correct
  and its test fails loudly rather than the figure quietly meaning something else.

## Files — all new, none exists on either branch

    src/app/mockups/ward-flow/statistics/page.tsx
    src/components/ward-management/statistics/statistics-screen.tsx
    src/components/ward-management/statistics/statistics.module.css
    src/components/ward-management/statistics/statistics-derivations.ts
    tests/ward-statistics.dom.test.tsx
    tests/ward-statistics-derivations.test.ts

**DO NOT TOUCH** `tests/ward-nav.test.ts`, `tests/ward-landmarks.test.ts`, `src/components/ward-management/ward-nav.ts`, or any top-level `src/components/ward-management/*.ts`. Ward Lead adds the route maps and the nav entry after this lands.

## Shapes you need

- `useWardFlow()` returns `{ movements, units, referrals, rejections, bedReleases, leaveBeds, admissions, now, dispatch }`.
- `Admission`: `id: string`, `unitId: string`, `state: AdmissionState`, `pulledAt: Instant | null`, `arrivedAt: Instant | null`.
- `ADMISSION_STATES = ["waitlisted", "pulled", "occupied", "left"] as const` (`ward-admissions.ts:61`).
- `ReferralAddressing`: `destination: ReferralDestination`, `state: ReferralAddressingState`, `decidedAt?: Instant`, `decidedBy?: string`, `declineReason?: ReferralDeclineReason`. A `Referral` holds `destinations`.
- `ReferralDestination` of kind `"psychiatric_ward"` names the unit; resolve unit NAMES from the live `units` array, never from a literal.
- Every screen renders `<ClinicalRail />` from `@/components/ward-management/ward-management-navigation`.
- The route is a server component that awaits `params` (there are none here) and renders the client screen — follow `src/app/mockups/ward-flow/community/[teamId]/page.tsx` for the shape.

## Check

    npx tsc -p tsconfig.typecheck.json --noEmit --tsBuildInfoFile /tmp/tsc-stats.tsbuildinfo   → zero errors
    npx vitest run tests/ward-statistics.dom.test.tsx tests/ward-statistics-derivations.test.ts  → all pass

## Falsifier

Any number on the page not derived from provider state; the two audiences merged into one
undifferentiated list; a zero count rendering as "unavailable"; a route-count assertion changed
(you must not touch those files at all); or an admission state value read anywhere outside the
single named function.
