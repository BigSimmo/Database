# Personal practice

_The key document for the Personal practice area of the [organisation map](../organisation/README.md).
Written 2026-09-26._

This area is the clinician's own records and tools: what they keep about their own work, and the
logic, data and server routes behind it. It is defined by that job, never by a page or a mode.
Features here move between pages and modes often; today they include On Call, CPD tracking,
favourites, the calendar and reminders, but those names are examples of the current layout, not
the definition.

**What is in the area** is whatever `docs/organisation/systems/personal-practice.json` lists. Run
`npm run check:organisation -- --files <path>` to see which area owns a file. Pages are not part of
this area: every page sits in App experience, whatever mode it serves.

## The rules for anything in this area

These are the checks the `personal-practice-reviewer` agent
(`.claude/agents/personal-practice-reviewer.md`) applies to every change here.

1. **The clinician's records stay theirs.** Every read and write is bound to the signed-in
   clinician unless a recorded decision in [`../decisions/`](../decisions/README.md) says a read is
   deliberately shared. Items marked personal never leave their account, whether through a shared
   read, a printable card, an export or an offline copy.
2. **Nothing happens to the record quietly.** A suggestion or prefill offers; the clinician
   confirms. Opening something never creates an entry. Targets and thresholds are confirmed by the
   clinician against a named document, never hard-coded. Dates are the ones the clinician entered.
   Exports and period-close records never drop items silently.
3. **Honest states, conservative failure.** Freshness (stale, overdue, due) is worked out when the
   record is read, never stored. A failed read shows an error and no count, and must never look
   like "nothing to do".
4. **The app never speaks clinically in its own voice.** Personal tools hold the clinician's own
   notes, links and records. They do not author management steps, doses or thresholds. Anything
   kept on the device for offline use is public, non-patient information only.
5. **Proof matches the change.** Each behaviour change comes with a test that would fail if the
   behaviour regressed.

## Who else reviews what

Privacy, tenancy, owner scope and any database change go to `supabase-schema-guardian`; merging a
migration reaches the live clinical database within seconds (`AGENTS.md`, "Supabase project
safety"). Clinical wording, sources and sign-off go to `clinical-governance-reviewer`. Page layout
and components go to `frontend-ui-reviewer`.

## Where the detail lives

- The owner's recorded rulings on these features: [`../decisions/`](../decisions/README.md).
- Design notes for individual features, which may be out of date as features move:
  [`../on-call/`](../on-call/), [`../cme/`](../cme/) and the dated specs under
  [`../superpowers/specs/`](../superpowers/specs/).
- How the code fits together: [`../codebase-index.md`](../codebase-index.md).
