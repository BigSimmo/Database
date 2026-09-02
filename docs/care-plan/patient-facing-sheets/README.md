# The three printed sheets, as text

Committed 2 September 2026 so that a session without access to this machine — a cloud session
above all — can read what Care Plan actually puts in a person's hands.

These are **verbatim copies** of the three `paper-*.txt` files the browser evidence capture writes
to `.local/care-plan/atlas/`, which is git-ignored and exists on one disk only. Copying them here
does not un-ignore the atlas: the screenshots, the manifest and the capture harness stay where they
are. Only the text of the three sheets is duplicated, because the text is the part a human needs to
read and the part the outstanding copy pass will rewrite.

| File                        | Who receives it  | Read it as                      |
| --------------------------- | ---------------- | ------------------------------- |
| `paper-patient-plan.txt`    | The patient      | The person the plan is about    |
| `paper-safety-plan.txt`     | The patient      | The person in distress, at 3am  |
| `paper-management-plan.txt` | The ED clinician | A clinician with ninety seconds |

## What is safe about committing these

Everything on them is synthetic by construction, and the prototype cannot hold real patient
information. The people, teams, hospitals, record numbers and web links are fictional — `Rowan
Sample`, `Jess Sample`, `Ari Placeholder`, `Dr Taylor Fiction`, `North River`, `SYN-MRN-0001`,
`example.org`. Each sheet carries its own synthetic-prototype watermark, top and bottom.

The **only real details** are the public crisis numbers, and they are real deliberately, verified on
20 August 2026 and recorded as such in the specification: `000`, MHERL `1300 555 788` (Perth
metropolitan) and `1800 676 822` (Peel), and Rurallink `1800 552 002`.

## Two things to know before using them as evidence

1. **`paper-patient-plan.txt` has no real content.** All eight of its section bodies hold the
   capture harness's filler sentence — _"We wrote this together at the bedside, in your words."_ —
   because no Patient Plan fixture carries real prose and the harness has to write something. The
   file is honest evidence of **structure, framing and resources**, and no evidence at all of
   **content**. Writing that content is the outstanding copy pass.
2. **They are a snapshot, not a live view.** They were captured on 25 August 2026 from the build
   that merged as `e15b250cf`. If a Care Plan surface changes, these files do not move with it.
   Regenerate and re-copy them rather than editing them by hand:

   ```bash
   CARE_PLAN_CAPTURE_EVIDENCE=1 npm run test:e2e:care-plan-mockup
   ```

**Never hand-edit a file in this directory.** It is a capture, and an edited capture is a fabricated
piece of evidence. Change the fixtures or the components, re-capture, and copy the result across.
