---
name: sources
description: Find, capture, score and index clinical sources for this knowledge base. Use whenever the user asks to search for or add new clinical information, adds content that makes a clinical claim, uploads a document, asks what a source is worth or where it came from, or types "/sources". Runs the WA-first locality ladder, records every source pulled including rejections, and proves the register is complete before the work is called done.
---

# sources — pull it, log it, score it, index it

Full protocol: [`docs/source-acquisition-protocol.md`](../../../docs/source-acquisition-protocol.md).
This skill is how to run it. The rules are in `src/lib/sources/acquisition-ledger.ts` and are
enforced by `npm run check:source-acquisitions`.

**Rule: no clinical claim enters this repository without a source in the register, and no source
enters the register without a publisher, a jurisdiction, a date and a reason it was pulled.**

## The three verbs

### `find <topic>` — run a search

1. **Search in locality order and do not skip a rung.** WA local, WA state, Australian national,
   other Australian state, international. Searching rung 5 first because it indexes better is the
   failure this ladder exists to stop.
2. **Stop when the claim is covered by a current rung 1, 2 or 3 source.** Go to rungs 4 and 5 only
   when the first three do not cover it, and say so in `notes` when you do.
3. **Read the publisher's own page for the metadata.** Take the title, publisher, version and dates
   from the source, never from a search result summary and never from memory.
4. **Capture everything you looked at** into `src/data/source-acquisitions.json`, including what you
   rejected and why. A rejection with a reason is what stops the same ground being searched again.
5. **Run `npm run check:source-acquisitions`** and fix what it names.
6. **Report the table**: rung, publisher, title, date, band, disposition.

### `add` — content was just written

1. Every clinical claim in the new content must resolve to a register record.
2. Any source the content actually cites must be `adopted`, which means it must be reviewed first.
   If it has not been reviewed, say so and leave it as `candidate` rather than adopting it quietly.
3. Run `npm run check:source-acquisitions` then `npm run check:source-catalogue`.

### `review` — show the state

Run `npm run check:source-acquisitions`. It prints the register by rung and disposition, the
sign-off queue most-local-first, and the band each reviewed capture reaches.

## Rules that are not negotiable

- **Never infer a date, version or publisher.** A source whose metadata cannot be established is a
  rejection with a reason, not a guess. Fabricated provenance is the worst failure this system can
  produce, because it looks exactly like real provenance.
- **Never adopt an unreviewed source.** `validationStatus` becomes `locally_reviewed` only after
  someone has actually read the source and confirmed it says what the content claims. You may
  capture and score on the owner's behalf. You may not sign off on their behalf.
- **Never register a new publisher to make a gate pass.** Adding to
  `src/lib/source-authority-registry.ts` changes `classifySourceAuthority`, which retrieval
  selection uses to tier results. That is a RAG behaviour change under `AGENTS.md`, needing the
  owner's decision and an eval canary. Report the blocked publisher and stop.
- **Never widen `GOVERNED_SOURCE_HOSTS` casually.** It is pinned to equal the hosts actually
  emitted. Adding one means adding the host and updating the pinned count in
  `tests/source-catalogue-providers.test.ts`, and it widens what the app will render as a source
  link. Say so when you do it.

## Reading the result

An unreviewed capture sits at D band. **That is the queue, not a fault.** The register separates
two things the old catalogue conflated:

- **Awaiting sign-off** (`verification_unknown`) is a governance state. Expected on every fresh pull.
- **Metadata defect** (missing publisher, version, date, jurisdiction or evidence type, a malformed
  date, an ungoverned URL, contradictory identity) is a fault, and the gate refuses it.

A complete WA capture scores 76 unreviewed and 91 once signed off. If a capture scores below that
band on review, read the reasons on its `/sources` entry before assuming the source is weak: it is
usually a missing field.

## When a publisher is not in the register

The catalogue derives jurisdiction only from the authority register, so an unregistered publisher
has no jurisdiction and is forced to D permanently. Therapeutic Guidelines, the Australian Medicines
Handbook, Australian Prescriber, RACP, Cochrane, AIHW, HealthyWA and the Mental Health Commission WA
are all currently unregistered.

The gate names the publisher when this happens. Report it to the owner as a decision they need to
make, with the note that registering it moves retrieval selection. Do not work around it by filing
the source at a different rung.
