# Roster maker: implementation plan

Prepared against the local Release 2 implementation on 27 September 2026. This is preparation, not implemented or validated functionality. Keep progress in `2026-09-27-roster-mode-status.md`.

## Outcome and entry conditions

A confirmed team's named managers can prepare a roster, understand staffing gaps, review every change, and publish a reviewed result. Doctors continue to see the published roster until publication succeeds. Draft edits never silently change a doctor's duty.

Before implementation, review the service's actual roster-making workflow, who owns staffing requirements, which rules are authoritative, and how doctors agree to changes after publication. Do not infer a staffing minimum, award interpretation, or authority to change a duty from a filename or grade alone. Release 2's atomic publication and repeated-upload protection must pass local execution and independent review first. Real staff use also retains the documented privacy, hosting and staging-isolation boundaries.

## Existing contracts to reuse

- `roster_read`: `maker` and `draft`, restricted to current managers of a confirmed team.
- `roster_command`: `draft.open`, `draft.change`, `draft.undo`, `needs.set`, `codes.set`, and `agreement.record`. These are deliberately excluded from the Release 2 general API action union.
- Draft operations are add, remove and update; source is grid, typed or upload; at most 500 operations per command and 5,000 assignments per draft. Draft history already records per-operation undo.
- Release 2's publication comparison, strict session-actor APIs, team picker, code chooser, file reader, manager navigation, fairness counts and export.
- Atomic publication preview/freshness checks and approved-change lineage in the proposed follow-up database work. These are written local contracts until SQL replay and deployment are proven.

## 1. Close database concurrency and agreement gaps

Read the current SQL before exposing the existing commands. In the inspected base implementation, `draft.change` does not require an expected draft version. `draft.undo` can restore an older value without proving a later edit has not changed the same row. These need a forward database change before co-manager editing is safe.

Require a draft version on every mutation. Under the team/draft lock, verify that version, validate all operations, apply them together, record the actor and increment the version. A stale edit returns a conflict and a fresh draft; it never retries by overwriting. Undo must prove the affected state still matches the recorded result, or refuse with a clear conflict.

Review `agreement.record`: the base function checks that a service change requires agreement, but does not itself establish that the actor is a doctor affected by that change. Derive affected doctors from trusted before/after records and allow each doctor to record only their own agreement. Manager acknowledgement and a doctor's agreement are different facts. Resolve what changes require agreement with the service before implementing a policy.

Acceptance: two real local database sessions racing edits; stale undo after another manager's edit; rollback of a mixed valid/invalid operation batch; unrelated/current/former-member agreement attempts; manager removal during editing; and foreign-team draft/row identifiers. Replay and schema manifest must use the actual forward migration. Josh controls publication and the production merge window separately.

## 2. Manager draft screen

Add a manager-only Maker section using the existing page header and collapse owner. On a laptop, show people by date, with a labelled shift cell and a side panel for details. On a phone, use a selected-person/date list and sheet rather than squeezing the grid into the viewport. Support keyboard cell navigation and an explicit edit action; colour is supplementary to letters and times.

Opening a period creates or returns its draft, clearly labelled with the publication it started from. Edits are submitted with the current draft version. Show saving, saved, conflict and unavailable states. A conflict preserves the proposed edit in memory while presenting the new server state for an explicit choice. Do not persist drafts or staff data to browser storage.

Recent changes shows who changed what and when, with per-change Undo only when eligible. Leaving the page while a request is pending must not claim it saved. Reopening fetches current permissions and draft state.

Acceptance: ordinary and removed managers cannot open or mutate; keyboard-only editing and undo; phone and laptop layout; concurrent conflict recovery; failed save; reload; no device persistence.

## 3. Deterministic manager change box

Keep parsing on the device. Convert supported input into the same finite operations as the grid, show the proposed people, dates and before/after shifts, and require Apply. Typed words never enter URLs, logs, analytics or request bodies. Requests contain only validated structured operations.

Start with one person, explicit dates and one shift change. Ambiguous names, relative dates, negation, exceptions, multiple possible codes and conflicting instructions require a choice or manual editing. An unsupported sentence changes nothing. Do not guess that a similarly named person is the intended one.

Acceptance: parser corpus for supported and refused sentences; names shared by two people; overnight dates; invalid dates; Perth, UTC and New York test environments; no mutation before confirmation; no raw text transmission.

## 4. Upload to update a draft

Reuse the in-memory Excel/text-PDF/CSV readers and row matching. Compare the upload with both the current draft and published assignments. Identify changes made since the draft's baseline, including approved swaps and claimed open shifts. Preserve those changes unless a manager explicitly reviews the affected duty and chooses otherwise.

Apply reviewed differences as a versioned atomic draft mutation. Split batches only if a reviewed transaction protocol preserves all-or-nothing behaviour; do not silently apply the first 500 operations. Unknown rows, unknown codes and unresolved conflicts block Apply. Scanned PDFs remain unsupported; no AI extraction is activated.

Acceptance: two successive stale uploads preserve approved changes; draft edits survive a repeated file; explicit override is audited; stale preview conflicts; removals are visible per person; named rows remain separate; TBA rows keep genuine vacancy semantics.

## 5. Staffing needs, rules and cover suggestions

Let managers enter service-approved date/weekday, site, grade, shift kind and required count. Make dated overrides and recurring defaults explicit, and define their precedence before summing counts. Display rostered/needed with written gap descriptions. No invented start/end times for a gap.

Rules show source and date and are labelled as the team's configured rules. An optional AMA WA starter checklist requires current primary-source verification and service review; it is not an automatically enforced legal interpretation. Separate hard eligibility from advisory warnings. Cover suggestions show the concrete reason for eligibility and use published availability, grade and configured rules without exposing colleagues' private reasons.

Acceptance: overlapping needs and date overrides; overnight cover; missing grade; unknown rule; leave and availability boundaries; explanation matches the enforced decision. Confirm ranking criteria before adding any fairness-based ordering.

## 6. Publish and record agreement

Present the latest live comparison, affected doctors, unresolved conflicts and required agreements. Full publication reuses the atomic Release 2 RPC. Single-change publication requires a dedicated reviewed atomic contract: expected live version, structured changes, trusted affected users, retained change lineage and the agreed consent rule. Never implement it as several independent metadata, assignment and notification writes.

Only a successful trusted receipt can trigger generic alerts. The receipt must distinguish saved draft, published duty and recorded agreement. Repeated submission must not duplicate a change or alert. Show partial external alert delivery separately from publication success.

Acceptance: rollback; stale live version; removed manager; malicious actor IDs; changed/unchanged recipients; required agreement enforcement; duplicate submission; calendar reflects published duties only.

## 7. Export and optional AI boundary

Reuse Excel export for the reviewed roster. Add noticeboard/payroll formats only after the service supplies required columns, audience and handling rules. Include period, version and publication time; clearly mark draft exports. Confirm print appearance with synthetic data.

The optional AI helper stays off. It needs separate service consent, privacy/provider approval, cost approval and a reviewed name-replacement/minimisation design. No placeholder provider call, hidden fallback or telemetry is part of this implementation plan.

## Verification and delivery

Use synthetic data. Run focused helper/API/DOM tests while building and one consolidated typecheck/lint pass after integration. Reuse unchanged passing evidence. Execute SQL concurrency/permissions tests locally, then one independent review of the complete changed scope. Prove manager journeys at phone and laptop sizes, dark appearance, keyboard access and conflict recovery; inspect screenshots against the approved design. Browser emulation does not establish physical-device or installed-PWA behaviour.

Before real staff use, run the separately approved staging two-user isolation proof and record service acceptance. Commit, publication, CI observation, merge and deployment each retain their applicable authority boundaries. Completion evidence must distinguish local implementation, local checks, hosted checks, migration application and observed service use.
