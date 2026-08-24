# Task C report — the owner's six approved copy and message-policy changes

Branch: `claude/browser-test-gate-handoff-d5c1db`. Base commit: `e690ad43f` (the branch also
carries an unrelated `ac87293f2 plan(caring-contacts): Task 1 brief` commit from another session,
already on the branch before this work started).

All six items are implemented, test-first, mutation-proven, and committed locally. Nothing was
pushed and no PR was opened, per the brief.

## Commits (in order)

1. `623fc386c` — fix(caring-contacts): drop the unverifiable storage claim from the automated
   reply (A2 + A3)
2. `b7aee30fc` — feat(caring-contacts): refuse an unacknowledged fictional contact detail
   (A1 / Ruling 79)
3. `49ce35ba0` — feat(caring-contacts): refuse loudly when a closing contact has no authored body
   (A4)
4. `a4e3e0281` — fix(caring-contacts): narrow "lead" to its commercial sense only (B2)
5. `bfd868849` — test(caring-contacts): scan interface string literals for prohibited vocabulary
   (B3)
6. `d6780e1a8` — test(caring-contacts): bound the B3 fixture cleanup's rmSync retries (fixes a
   repo-wide static-safety failure the B3 commit introduced — see "Full test run" below)

## A2 + A3 — automated reply wording

`src/lib/caring-contacts/message-copy.ts`, `AUTOMATED_REPLY_RESPONSE`, replaced verbatim per the
brief. Verified: **210 septets, 2 segments, GSM-7 valid** (matches the brief's stated value
exactly; computed independently before writing any test). `EXACT_PATIENT_VISIBLE_MESSAGE` is
untouched (still 252 septets / 2 segments).

Updated two **pre-existing** assertions to the new owner-approved value rather than deleting them:
- `tests/caring-contacts-message-copy.test.ts` — pinned GSM-7 evidence, `septets: 218 → 210`.
- `tests/caring-contact-mockups.dom.test.tsx` — same pinned evidence, same change.

New covering tests in `tests/caring-contacts-message-copy.test.ts` (describe block "A2 + A3"):
exact-text match, segment/septet/valid assertions, "does NOT contain `has not been kept`", "DOES
contain `automatic`", and a guard that `EXACT_PATIENT_VISIBLE_MESSAGE` was not touched.

**Mutation proof:** changed `"and this reply is automatic"` to `"...is definitely automatic"`,
confirmed the mutation landed in the tree (`grep`), ran the tests — 3 went red (exact-text match,
septet count now 221, and the "leaves EXACT_PATIENT_VISIBLE_MESSAGE untouched" assertion's septet
check remained fine but the two direct ones failed) — then restored and reran to green (11 passed).

## A1 — fictional-contact-detail-present (Ruling 79)

Implemented exactly as specified, not the "add 'Fictional' to prohibitedTerms" approach the brief
warns against:

- `MessageValidationIssue` gained `{ code: "fictional-contact-detail-present" }`.
- `GovernedMessageInput` gained `syntheticFictionalContactsAcknowledged?: boolean`.
- `message-rules.ts` gained `fictionalContactMarker`, derived from `crisisSupportContact` via
  `CRISIS_SUPPORT_CONTACT.split(":")[0]` rather than a second hard-coded `"Fictional Support
  Line"` string literal — satisfies "derive from the rules object" without importing
  `synthetic-contacts.ts` into `message-policy.ts` (that import would have broken the existing
  rule-8 test, which restricts `message-policy.ts`'s imports to `node:`, `./model`, and
  `./message-rules` only — I checked this before choosing the approach).
- `validateGovernedMessage` reports the issue whenever the marker is present and the flag is
  absent/false.

**"Update the prototype's existing callers" — a finding, not a gap.** I searched the whole repo
(`grep -rln "validateGovernedMessage\|GovernedMessageInput"`) and found **no caller of
`validateGovernedMessage` anywhere in `src/` today** — only the module itself and its test file.
Phase 2B screens that would call this haven't been built yet. So there was no production call
site to update. I treated "the prototype's existing callers" as the two constants the prototype
actually ships (`EXACT_PATIENT_VISIBLE_MESSAGE`, `AUTOMATED_REPLY_RESPONSE`, both of which
legitimately name the fictional numbers) and added a covering test proving both pass
`validateGovernedMessage` only when `syntheticFictionalContactsAcknowledged: true` is given, and
fail with exactly this issue code otherwise. I also updated six existing tests in
`tests/caring-contacts-message-policy.test.ts` (rule 4 and rule 5 blocks) that build compliant
first/closing messages containing `rules.crisisSupportContact` — these were never testing the A1
rule, so I added the acknowledgement flag to their inputs rather than touch their assertions.
**Flagging for your review:** confirm this interpretation is what you intended, since there was no
literal "existing caller" to update.

**Mutation proof:** changed the guard condition to `if (false)`, confirmed in tree, ran tests — 2
went red (the direct issue-code test and the two-approved-messages test), then restored — 36
passed.

## A4 — closing message body refusal (refusal only, no wording)

Added `resolveClosingContactMessageBody(authoredClosingBody: string | undefined)` to
`message-policy.ts`, returning `{ ok: true; body }` or `{ ok: false; issue: { code:
"closing-message-body-not-authored" } }`. No closing-message wording is drafted anywhere in this
change.

**On "find the seam":** I checked `schedule.ts`, `simulation.ts`, `repository.ts`, and `model.ts`
for an existing place a contact's message body gets resolved. **None exists.**
`PlannedContact` carries `messageType` but no body content anywhere in the domain today, and
nothing supplies one. Wiring this function into `schedule.ts`/`simulation.ts` would have meant
inventing where an authored closing body comes from — exactly the decision A4 says is not this
task's to make — so I left the function standalone in `message-policy.ts`, documented as the
mechanism a future sender will call once that seam is built. **Flagging for your review:** if you
intended an actual wiring point (e.g., extending `PlannedContact` with an optional body field now,
even with no content behind it), that's a larger, more invasive change I did not make because the
brief scoped this to "the refusal ONLY."

Covering tests in `tests/caring-contacts-message-policy.test.ts` ("rule 5b"): refuses with its own
code for `undefined`, empty string, and whitespace-only input; does not refuse a real body; never
returns a `body` field on the failure branch (proves no fallback); and one test proving this code
is distinguishable from `closing-message-missing-ending-statement` (a body that exists but lacks
the required statement is a `validateGovernedMessage` failure with a different code entirely).

**Mutation proof:** changed the function to always return `{ ok: true, body: authoredClosingBody
?? "" }` (silently succeeding with an empty string — the exact failure mode A4 forbids), confirmed
in tree, ran tests — 4 went red, then restored — 41 passed.

## B2 — narrow "lead" to its commercial sense

`prohibitedTerms` still contains the string `"lead"` unchanged (so the existing "seeds from Global
Constraints vocabulary" test needed no change). `message-rules.ts` gained
`prohibitedTermPatternOverrides: Readonly<Partial<Record<string, RegExp>>>`, with one entry:
`lead` maps to a pattern requiring a commercial-specific co-occurring word (`sales lead`, `a new
lead`, `lead generation`, `lead conversion`, etc.). `message-policy.ts`'s matching loop checks for
an override per term and falls back to the original substring behaviour when none exists — every
other term is provably unaffected.

**Why not bare word-boundary matching:** I checked this before implementing. `\blead\b` alone does
NOT solve the job-title problem — "the incident lead" and "the clinical programme lead" both
contain "lead" as a complete, boundary-delimited word. The fix has to additionally require a
commercial-specific form, which is what `COMMERCIAL_LEAD_PATTERN` does.

**Out-of-scope finding, not fixed here (per the brief's own instruction to report rather than
fix):** `tests/helpers/caring-contacts-prohibited-language.ts` — the wider interface-vocabulary
regex used by the two existing overlay tests and now by the new B3 scan — has `\bleads?\b`, which
has the identical job-title collision (e.g., a future screen saying "Contact the team lead" would
trip it). It's a separate list governing interface copy, out of B2's scope (`message-rules.ts`
only), so I left it exactly as it was and am reporting it here.

Covering tests ("rule 3c"): accepts both job-title phrases; rejects three commercial-sense
examples; and a data-driven loop over every OTHER term in `rules.prohibitedTerms` (excluding
"lead") proving each one's substring behaviour is byte-for-byte unchanged, including two
deliberately-embedded-in-another-word cases (`"safe"` inside `"unsafe"`, `"conversion"` inside
`"reconversion"`) to prove substring (not word-boundary) matching survives for every other term.

**Mutation proof:** changed the matching line to always use plain substring inclusion (dropping
the override), confirmed in tree, ran tests — 1 went red (the job-title acceptance test — the
other two new describe-block tests happened to still pass coincidentally, since substring matching
already caught the commercial examples and the other-terms loop doesn't touch "lead"), then
restored — 44 passed.

## B3 — interface vocabulary static scan

New file `tests/caring-contacts-interface-vocabulary.test.ts`. Scans every `.ts`/`.tsx` file under
`src/components/caring-contacts/workspace/**` and `src/app/caring-contacts/**` for
`CARING_CONTACTS_PROHIBITED_LANGUAGE` (the existing, wider interface-vocabulary regex already used
by the overlay tests).

`src/components/caring-contacts/mockups/**` is excluded **by construction** — it's simply not one
of the two scan roots — rather than via a special-case skip, satisfying "excluding anything else
[besides mockups] is not correct" without needing an ignore-list entry at all.

**Two false-positive problems I found and solved by narrowing the match, not adding file
exclusions**, exactly as the brief directs:

1. A naive "extract everything between matching quotes/backticks" regex over the raw file text
   caught JSDoc inline-code backticks (`` `useSearchParams` ``) as fake template-literal
   delimiters, and an odd count of them across one comment block paired unrelated spans together,
   capturing most of `workspace-overlays.tsx` as one giant fake literal. Fixed by writing a small
   character-by-character extractor that recognises `//` and `/* */` comments and skips them,
   rather than a bare regex over raw source.
2. `className="…var(--safe-area-bottom)…"` in `shell.tsx` and `overlay-host.tsx` contains "safe"
   as a substring of a CSS custom-property name — a real match for `\bsafe\b` (bounded by hyphens)
   but not interface prose. Fixed by stripping `className=…` attribute VALUES before extraction —
   this narrows which literals reach the scan (as instructed), it does not exclude a file.

I verified both fixes empirically with throwaway dry-run scripts against the real tree before
writing the final test (documented in my working notes, not committed) — the final scan reports
zero false positives on the real tree and catches both real occurrences of `--safe-area-bottom`.

Covering tests: a fixture-based test that plants `"...sales lead from this campaign."` in a
temporary directory and runs the **actual file-scanning code path** (`walk` + `readFileSync` +
extract + match) against it, proving the scan can genuinely fail — not just the extraction
function in isolation; and the real-tree scan, asserting zero offences.

**Mutation proof:** changed `scanRootForProhibitedLanguage` to `return []` unconditionally,
confirmed in tree, ran tests — the fixture test went red (`expected 0 to be greater than 0`), then
restored — 2 passed.

**Self-inflicted issue found and fixed in a follow-up commit:** the fixture's cleanup used
`rmSync(fixtureDir, { recursive: true, force: true })` without `maxRetries`/`retryDelay`, which
`tests/test-runner-safety.test.ts`'s repo-wide static scan requires for every recursive `rmSync`
in a test fixture (guards Windows file-lock flakiness on cleanup). Caught by the FULL `npm run
test` run, not by focused testing of only the files I touched — exactly the kind of failure the
brief warned "lives in files your diff will not contain." Fixed with a follow-up commit
(`d6780e1a8`) adding `maxRetries: 5, retryDelay: 100`, matching the pattern already used elsewhere
(e.g. `tests/bundle-budget.test.ts`).

## Full test run

`npm run test` (full suite, not focused):

```
Test Files  1 failed | 811 passed | 3 skipped (815)
     Tests  2 failed | 9778 passed | 74 skipped (9854)
```

The 2 failures are **pre-existing and environmental**, in `tests/gate-receipts.test.ts` > "gate
receipts — file modes (Codex review, PR #2216)": `chmodSync(path, 0o755)` on this Windows/NTFS
workstation does not change the file's working-tree executable bit the way POSIX `chmod` does, so
`computeInputSignature`'s hash correctly stays the same and the tests (written for a POSIX
environment) fail. **Verified independently of my diff**: ran `git stash` (fully reverting every
change from this task) and reran just that test file — same two failures, same messages,
reproduced byte-for-byte. Popped the stash afterward and confirmed my files were unchanged. These
two tests do not touch anything in `src/lib/caring-contacts/**` or `tests/caring-contacts-*` and
are unrelated to this task's scope.

Every `caring-contacts` test file passed, including the full domain-isolation and rule-8
import-boundary tests.

`npm run typecheck`:
```
[gate-receipts] recorded a pass for "typecheck:internal" (5209 input files).
```
(`tsc --noEmit` produced no error output — a fresh, non-reused run since the content changed.)

`npm run lint`:
```
[gate-receipts] recorded a pass for "lint:internal" (5209 input files).
```
(`eslint --max-warnings 0` produced no error output — a fresh, non-reused run.)

## Constraints checked

- **Domain isolation:** no new imports were added to `src/lib/caring-contacts/**` from outside
  its own directory. `message-rules.ts` still has zero imports; `message-policy.ts` still imports
  only `./model` and `./message-rules` (verified this explicitly before choosing the A1 design,
  because importing `synthetic-contacts.ts` there would have broken the existing rule-8 test).
  `tests/caring-contacts-domain-isolation.test.ts` passed in the full run.
- **No assertion deleted or loosened.** Every pre-existing assertion I touched was updated to the
  new owner-approved value (the two 218→210 septet pins) or given a new required input
  (`syntheticFictionalContactsAcknowledged: true` on six existing rule-4/rule-5 test inputs that
  were never testing the A1 rule) — none were deleted, and no assertion's expected value was
  weakened.
- **Test-first, with mutation proof for every item**, each confirmed to land in the tree before
  trusting the red result (all six mutations verified via direct file inspection, not just belief
  that an edit tool succeeded).
- Nothing was pushed; no PR was opened.

## Open items for your review (not blockers, just flagged per "stop and report")

1. A1's "update the prototype's existing callers" — there were none to update (see above); I
   substituted the closest faithful interpretation and want confirmation that's what you meant.
2. A4's seam — deliberately not wired into `schedule.ts`/`simulation.ts` since no body-content
   concept exists there yet; confirm this is the intended scope.
3. B2's out-of-scope finding — `CARING_CONTACTS_PROHIBITED_LANGUAGE`'s `\bleads?\b` in
   `tests/helpers/caring-contacts-prohibited-language.ts` has the same job-title collision risk
   for interface copy that B2 fixed for messages. Reported, not fixed, per the brief's own
   instruction.
