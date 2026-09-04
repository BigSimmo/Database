# What the three Builder-activation receipts require

**Measured:** 2026-08-31, against `scripts/ward-flow/chat-control.mjs`. First written at `9d2edecbf`;
corrected at `9fa7456a9` after Ward Verifier found it stale at `89d7f99ec` — see "Corrections" below.
**Status:** none of the three receipts exists. `system-state.json` still has `transitionEvidence: []`
and `activationSnapshot: null`, so `recreate --role builder` refuses with:

    role builder is inactive in recovery mode: Activate only after the three committed,
    content-addressed transition receipts validate.

This file is derived from the validator's code, not from the prose in `README.md`. Where it and the
code ever disagree, the code wins and this file is wrong.

## Corrections

**A measurement in this file has a shelf life, and this one expired within the hour.** As first
written it said the six chat logs were the blocker, that only one existed, and that `live-state.json`
carried no provenance or export fields. All three statements were true when written and false by the
next commit. Ward Verifier caught it at `89d7f99ec` and returned it unrepaired, correctly, rather
than editing a file its role forbids it to touch.

The risk it named is the reason this section exists rather than a silent edit: a successor reading
the stale text would have re-run the chat-log capture — the most expensive and most
human-dependent step in the whole sequence — because a completed step still read as blocking.

Every claim below now carries the SHA it was measured at. Treat any claim without one as unverified.

## Why there are three, and why they are not interchangeable

They answer three different questions, and Builder stays gated until all three are answered:

1. **recovery-bundle** — if this machine's repository were lost right now, could the work be brought
   back? Proven by actually restoring it, not by asserting a backup exists.
2. **current-truth** — is every Ward source accounted for, with exactly one place that is current?
   Proven by classifying a mechanically generated inventory, so nothing can be quietly omitted.
3. **control-plane** — does the control system itself still pass its own validator and test at this
   exact tree? Proven by a receipt the test runner produced, not by a claim that it was run.

## Rules that apply to all three

- Each receipt is a committed JSON file whose shape follows `transition-receipt.example.json`, with
  `outcome: "passed"`, an `acceptanceCriterion`, a `falsifier` and `decisiveEvidence`.
- Every receipt records a `sourceSha`. **All three must record the same one**
  (`assertCommonTransitionSourceSha`), and it must resolve and remain on the integration branch.
- Everything a receipt points at must be committed under `docs/ward-flow/control/evidence/`, and its
  recorded SHA-256 must match the committed bytes.
- After the shared source SHA, only additions under `docs/ward-flow/control/evidence/` may occur
  before the recorded `activationSnapshot`. Any other change invalidates the whole window
  (`assertTransitionEvidenceWindow`), so the three receipts must be assembled as one push of work,
  not accumulated across unrelated commits.

## 1. recovery-bundle

Requires a Git bundle committed under `docs/ward-flow/control/evidence/bundles/`, plus, in
`gateEvidence`:

- `bundleSha256` matching the committed bytes.
- `independentBundlePath` — a second, byte-identical copy at an absolute path that physically
  resolves **outside every repository checkout and the shared Git directory**, and is a single-link
  regular file.
- `bundleRef` — a full `refs/heads/...` name that the bundle **advertises** as pointing at
  `sourceSha`.
- `requiredObjects` — must include both the full `sourceSha` and the `integrationBase` commit ids,
  and each must be present in the restore.
- `restoreCheckout` / `restoreHead` — a real checkout, on an **independent Git object database**,
  whose HEAD equals `sourceSha`.
- `bundleHashVerified: true`, `requiredObjectsVerified: true`, `restoreResult: "passed"`.

The validator additionally runs `git bundle verify` itself, and clones the bundle into a newly
created empty repository to prove it needs no external objects.

**Already banked, but not sufficient as it stands.** `C:/Users/joshs/Backups/claude-work/2026-08-31T062543Z/`
holds a verified bundle (`e0af8ea64074b4c9dfb276cd8d4f34a419d33533d22c6fb948ab1b9ba2e22fe0`) and a
successful restore at `C:/Users/joshs/Backups/claude-work/restore-tests/ward-flow-control-e7dafff2d`.
That restore is at `e7dafff2d`. `restoreHead` must equal the receipt's `sourceSha`, which will be a
later commit, so **a fresh bundle and a fresh restore are needed at the final source SHA** — and the
bundle bytes must additionally be committed into the repository, which the current backup is not.

## 2. current-truth

The heaviest of the three, and the only one with an unavoidable human dependency.

It needs two committed canonical-JSON files: an **inventory** and a **disposition manifest**.

The inventory is not authored. It is regenerated by `buildExpectedSourceInventory` and compared
byte-for-byte, so it can only be produced, never argued with. It enumerates:

- every `docs/**` path containing "ward" (outside `control/`) at **each** ref named by
  `live-state.json` — the source SHA, the integration base, the working line, all five auxiliary
  checkout heads, and every `sourceDocuments` ref;
- the working line and each auxiliary checkout, **including its dirty-artifact manifest**;
- every chat-log export, **including its owner provenance decision**;
- the prior process audit.

**Measured size, confirmed by generating it at `9fa7456a9`: 895 sources — 882 ward documents across
7 refs, 6 chat-log exports, 5 auxiliary checkouts, the working line, and the process audit.** That
run is also the first machine confirmation that all six chat exports and their owner-provenance
bindings validate, because the generator checks each one on the way past.

The manifest must then classify **every one of those 895, exactly once, in inventory order**, with
`unclassifiedSources: 0`. Each entry needs a `disposition` of `canonical`, `historical`,
`superseded`, `parked` or `rejected`, and a written `rationale`.

- `canonical` requires a `canonicalPath` that exists at the activation commit **and whose blob
  matches the source exactly** — so canonical status is checkable, not asserted.
- `superseded` requires a `supersededBy` pointing at another inventory id; chains must not cycle and
  must **terminate at a canonical source**.
- A metadata-only source (a checkout, not a document) cannot be canonical.

Most of the 882 are mechanically decidable: if that exact blob is at that exact path at the
activation commit it is canonical, otherwise it is historical or superseded. The rationale text and
the supersession chains are judgement.

**No longer blocked on chat exports — done at `89d7f99ec`.** All six exports are committed under
`evidence/chat-exports/`, all six owner provenance decisions under `evidence/owner-decisions/`, and
every `chatLogs` entry in `live-state.json` carries `provenanceDecision: "owner-confirmed"` plus its
`ownerDecisionId`, `ownerDecisionPath`, `ownerDecisionSha256`, `exportPath` and `exportSha256`.

**One thing had to be fixed before the inventory would build at all**, and it is worth knowing
because it looked like a tooling error rather than an evidence problem. Committing the six envelopes
made `buildExpectedSourceInventory` fail with `spawnSync git ENOBUFS`: the `git` helper set no
`maxBuffer` and inherited Node's 1 MiB default, while five of the six envelopes are 1.7–2.6 MB. The
evidence the receipt requires was therefore large enough to prevent the receipt being built. Fixed at
`9fa7456a9`; no regression test pins it, because provoking it needs a >1 MiB committed fixture.

## 3. control-plane

The smallest, and it cannot be faked. `gateEvidence` must record, verbatim:

- `validatorCommand: "node scripts/ward-flow/chat-control.mjs validate"`, `validatorOutcome: "passed"`,
  and a `validatorDecisiveLine` starting `[ward-flow-chat] VALID:`;
- `focusedTestCommand: "node scripts/run-vitest.mjs run tests/ward-flow-chat-control.test.ts"` with
  `focusedTestOutcome: "passed"`.

The validator then calls `assertRunnerProducedFocusedTestReceipt`, which reads the local gate-receipt
store at `node_modules/.cache/database-gate-receipts.json` and requires a receipt whose input hash
matches **the exact committed tree** being activated. Recording the outcome by hand is not enough;
the test must actually have been run by `scripts/run-vitest.mjs` at that clean commit, and any later
change to the tree invalidates it.

## The order the work has to happen in

1. ~~Add the provenance and export fields to `live-state.json`, and capture the five remaining chat
   logs.~~ **Done at `89d7f99ec`. Do not repeat it** — re-capturing costs the owner a second
   provenance judgement for six sessions he cannot open, and buys nothing.
2. Generate the inventory, then author the 895-entry disposition manifest. **This is now the head of
   the queue.**
3. Freeze the tree. From here the source SHA is fixed and only evidence additions may follow.
4. Build the bundle at that SHA, copy it outside every checkout, restore it, and commit it.
5. Run the validator and the focused test at that exact tree, last, so the receipt matches.
6. Commit all three receipts, add them to `transitionEvidence`, and set `activationSnapshot`.

Step 5 must be last, because step 4's commits change the tree and would invalidate a receipt taken
earlier.
