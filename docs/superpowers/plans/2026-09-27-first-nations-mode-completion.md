# First Nations Mode: Plan to Complete

The build in `docs/superpowers/plans/2026-09-26-first-nations-mode.md` is done and ships in one PR (#3116). This file lists what is still needed before the mode is complete, who owns each step, and the order to do them in. The spec is `docs/superpowers/specs/2026-09-26-first-nations-mode-design.md`.

## Where it stands

- Every tip, phrase and number is credited to a recorded source and shows "Example only · wording awaiting approval". `src/data/first-nations/approvals.json` is empty.
- The "Wants to leave" immediate-risk line is in content but has no approval record, so it renders nowhere.
- The EMHS service layer (`src/data/first-nations/profiles/emhs.json`) ships `enabled: false`, so only statewide numbers show.
- No database change, no provider calls, nothing stored on the device beyond public information.

## Steps, in order

### 1. Owner decisions (Josh only)

- [ ] **Risk line.** Josh reviews the "Wants to leave" immediate-risk line and types OK in the First Nations planning thread. Then record its approval (step 3 format) so it renders.
- [ ] **Service agreement.** Josh confirms the written agreement with the EMHS Aboriginal health team before the EMHS layer is switched on (step 4).

### 2. Check the unverified sources (any thread, no provider spend)

Check each against its official page, record it with the `sources` skill, and only then add the content that depends on it:

- [ ] Aboriginal Interpreting WA booking number (the contact shows "See website" until then) and the languages it books in each region.
- [ ] Lin, Green and Bessarab 2016 clinical yarning paper, then add the Yarning tab on Talking.
- [ ] Guidance on asking about Indigenous status; consent, visitors and family safety; restraint; Coroner's Court information for families.
- [ ] AHCWA member-service list; phone numbers for regional community-controlled health services and WA Country Health Service mental health teams.
- [ ] Aboriginal-produced patient materials; the Services link with the Aboriginal filter; region names in the Health Regions (HEALTH-003) dataset.
- [ ] Confirm the MHERL and Rurallink source links (currently on emhs.health.wa.gov.au, where the statewide services are hosted).

### 3. Record wording approval (after the service approves)

- [ ] The EMHS Aboriginal health team approves the wording outside PsychSift (Indigenous content is never signed off inside PsychSift).
- [ ] For each approved section, situation or contact, add a record to `approvals.json` whose `contentSha256` is `stableHash` of that item (see `approvalFor` in `tests/fixtures/first-nations-content.ts`). Any later edit to that item changes its hash and puts it back to "awaiting approval" automatically.

### 4. Switch on the EMHS layer (after step 1's agreement)

- [ ] Fill team and switchboard numbers only (no names, no mobiles) in `profiles/emhs.json`, set `enabled: true`, and set the approved Acknowledgement wording.
- [ ] Wire the stored hospital choice into Bedside so the liaison hero follows the chosen hospital (`src/components/first-nations/hospital-choice.ts` exists but is not yet used).

### 5. Shared mode kit additions (one small kit PR, then First Nations adopts them)

- [ ] A footer slot on `ModeDialSheet`, then add "Save to phone" (`vcardFor`) and a per-contact "Report a wrong number" (`reportHref`) to the First Nations contact sheet.
- [ ] A live tone with the one-off 600 ms pulse on `ModeStateLabel`, replacing First Nations' local `FnLiveStatus`.
- [ ] A labelled `ModeActionButton` variant, replacing the local `FnButton`.
- [ ] Share falling back to copy when the browser has no share sheet.

### 6. Rechecks (standing)

- [ ] Phone numbers are rechecked every 90 days and everything else every 12 months; the hero already says "Due for a check" and stops claiming "Open now" once a recheck is overdue.

## Done means

All content approved (no "awaiting approval" labels), the EMHS layer on with approved numbers, the risk line shown after Josh's OK, the verified-source list empty, and the kit follow-ups adopted.
