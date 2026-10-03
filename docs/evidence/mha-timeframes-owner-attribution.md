# Mental Health Act timeframes: owner's attribution confirmed

On 3 October 2026 the project's coordinator asked Josh, PsychSift's clinical owner, whether he
personally signed the nine Mental Health Act timeframes in `data/mha-timeframes.json` that are
marked as reviewed by "PsychSift". He replied: "Yes I did to both".

This confirms, for these nine timeframes, what
[`pr-3143-owner-signoff-confirmation.md`](pr-3143-owner-signoff-confirmation.md) already records
for the sign-offs in PR #3143: the public reviewer attribution "PsychSift" is Josh's own clinical
sign-off, not a review by an automated agent.

What it changes: `OWNER_CONFIRMED_TIMEFRAME_ATTRIBUTIONS` in `src/lib/on-call/mha-timers.ts` now
lists "PsychSift", so these timeframes count as signed by a named clinician for the On Call
countdowns.

What it does not change: each sign-off still covers only its pinned content, so editing a timeframe
still needs a fresh sign-off. The countdowns remain off until Josh signs the countdown switch
himself with `npm run rules:sign -- --write`, including the medical-device ruling. The other part
of "both" is not recorded here as any further sign-off: those come only from Josh running the
sign-off tools himself.
