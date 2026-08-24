# Care Plan — verification report (Task 11)

Exact commands, exit codes, result lines, failures, and — just as important — the checks
that were **not** run and why.

Two rules were applied throughout, both learned expensively on this project:

- **A run is scored on its own summary line, never on an exit code.** A Vitest run with no
  `Test Files N passed (N)` line is a run-coordinator lease refusal, not a result; it exits
  0 or 75 either way. A `gate-receipts` `REUSED` line is a replay of an earlier verdict, not
  a fresh run. Every Vitest run below was made with `GATE_RECEIPTS=refresh` and retried in
  a loop until it produced a real summary line.
- **A wrapper's exit code is not the gate's exit code.** Run 2 of the browser suite is
  recorded below as `EXIT=1`, and the surrounding shell reported 0, because the compound
  command ended in `tail`. The summary line is the evidence.

---

## Environment

| Item | Value |
| ---- | ----- |
| Worktree | `D:\Worktrees\Database\care-plan-impl` |
| Branch | `claude/care-plan-stage-b-9-11` |
| Base commit at start | `157c48f33` |
| Dev server | `npm run ensure` → `http://localhost:3488`, identity confirmed via `/api/local-project-id` (`clinical-kb:4573c0c0381a`) |
| Browser suite server | `scripts/run-playwright.mjs` builds and starts its **own isolated production server**, which resolved to `http://localhost:3489` and verified the same project identity. The suite therefore measures a production build, not the dev server |

## Browser suite — the new evidence

```
npm run test:e2e:care-plan-mockup
```

which is exactly `node scripts/run-playwright.mjs --project=chromium-mockups tests/ui-care-plan-mockup.spec.ts`.

| Run | Result line | What it was |
| --- | ----------- | ----------- |
| 1 | `9 failed` / `20 passed (19.7m)`, `EXIT=1` | First rendering of this application, ever |
| 2 | `4 failed` / `1 skipped` / `25 passed (6.5m)`, `EXIT=1` | After repairing what run 1 exposed |
| 3 | **`RUN3_SUMMARY`** | After repairing the last four |

Run 1's nine failures were **all in the new suite, not in the product**, and each is worth
recording because each is a class of mistake this file now documents rather than repeats:

1. **CSS-module class resolution assumed the dev-server shape.** `next dev` emits
   `care-plan-module__<hash>__<name>`; a production build emits `care-plan_<name>__<hash>`.
   The link-affordance gate therefore found nothing in the only build it actually measures.
2. **Role switches landed before hydration.** Every control is server-rendered, so a
   `selectOption` a frame early set the native value, React never saw the event, and the
   next reconcile silently restored the previous clinician. It looked exactly like "the
   role switcher does not work". `gotoRoute` now waits for a React root, and `switchRole`
   retries until the identity block agrees.
3. **`locator.all()` does not wait.** A fill loop one frame early wrote nothing, and the
   test failed four minutes later on a control that was still, correctly, unavailable.
4. **Capability boundaries are real.** Worklist resolution, contact verification and formal
   review are not the emergency physician's to perform; the default synthetic user is
   correctly offered nothing.
5. **A new Personal Safety Plan version cannot inherit how it came about.** That field is
   required and blocks making the version current — correct behaviour, missing from the test.
6. **The shared checkbox hides its native input** under a decorative box that owns the
   pointer events, so it is activated through its label.
7. **Two assertions were written against remembered copy rather than the copy on screen** —
   including one negative assertion that failed on the sentence *denying* the very claim it
   was guarding, which is a guard pointing the wrong way.

### What the browser proved

- **All 21 routes** render from their own address with one first-level heading, the
  synthetic marker, the reset notice, and no sideways scrolling at 1440 px.
- **The pinned safety boundary** is painted above the first-minute sections — measured
  geometrically, not by document order — at 320, 390, 768, 1024 and 1440 px, in dark mode,
  and in forced colours, where its outline is asserted to be drawn in opaque ink. It is
  asserted not collapsed (`height > 8`), not clipped (`scrollHeight - clientHeight <= 1`),
  not `display: none`, not `visibility: hidden`, and not line-clamped. The full fifth
  section is present beside it and there is no disclosure element on the page.
- **The clinician Management Plan prints**: the synthetic marker survives inside the printed
  subtree, the printed-at stamp and the record-goes-stale warning are on the paper, the rail,
  dock and print button are hidden, up to forty sampled elements resolve to pure black on
  pure white — so the monochrome rule genuinely wins the cascade against every Tailwind
  utility and CSS-module rule in the subtree — and every `PrintSection` computes
  `break-inside: avoid`.
- **The Personal Safety Plan prints** with all seven of the person's own headings present,
  the marker on the paper, `000` and the not-an-emergency-service caveat visible, and — the
  assertion that matters most on this surface — **no `Not recorded` anywhere on it**.
- **The Patient Plan** is created, shows its gaps, refuses approval with the unfilled
  sections named, is approved by the default non-senior clinician, and prints with nothing
  clinical and no `Not recorded` on it. A newer Management Plan Version then marks it
  `needs updating` while it stays fully readable.
- **Ruling 57's replacement** passes on all six named affordances (below).
- **The `portal={false}` amendment sheet**, Task 7's deferred first look, renders inside the
  Care Plan subtree — which is why it exists — with its multi-line field measured above 48 px
  rather than collapsed to the shared one-line height, and returns focus on `Escape`.
- **Focus containment** in the phone `More` sheet across twelve `Tab` presses, with
  `Escape` and focus restoration; the same for a `ConfirmDialog`.
- **Every control reached by 40 `Tab` presses on the patient overview draws a visible focus
  ring** — a non-zero outline in opaque ink, or a box shadow.
- **All eleven degraded specimens** render a stated reason at 390 px rather than a blank
  screen, with `identity-uncertain` withholding plan content outright.
- **Reflow** with no sideways scrolling at all five widths and at the 200 %-zoom equivalent
  (640 × 512).
- **Reduced motion** removes the sheet animation without removing the state change, and the
  same journey works again with motion enabled.
- **The four-tab Reviews queue strip at 320 px** — Task 10's deferred first look — has every
  tab visible, above the tap-target floor, switchable, with no sideways scrolling.

### Probes against the new link-affordance gate

Ruling 57 froze the static guard and named Task 11 as the owner of the replacement. A guard
nobody has attacked is a guard nobody has tested, so the replacement was attacked with
working mutations rather than reasoned about.

PROBE_TABLE

## Focused unit and DOM suites

FOCUSED_SUITE_RESULTS

## Privacy and source scans

Run verbatim from the brief.

| Scan | Result |
| ---- | ------ |
| `frequent flyer\|high utili[sz]er\|problem patient\|risk score\|automatic enrol\|automatically identif` | **No matches** (exit 1) |
| `localStorage\|sessionStorage\|indexedDB\|document\.cookie\|\bfetch\s*\(` | **No matches** (exit 1) |
| `openai\|anthropic\|completion\|llm\|gpt\|prompt` | 8 matches, all classified as unrelated: seven are the `left_before_completion` disposition enum and its label, one is the section heading `What should prompt a review`. No provider reference exists |
| `should not be admitted\|do not admit\|admission is not indicated` | 3 matches, all inside `BANNED_ADMISSION_CONSTRUCTIONS` in `domain.ts` — the guard list itself. No fixture, interface string or example contains one |
| `\b(sent\|delivered\|read\|replied\|contact completed)\b` | Many matches, every one classified by hand. All are either explicit negations (`Nothing was sent, and no message exists.`, `never that anything was sent, delivered, read, answered, or completed`), the ordinary verb *to read* (`Read this plan and the triage note first`), or `read-only`. **No overclaim** |

## The mailto privacy assertion

`buildCmhtMailto` takes a contact and nothing else, so it is structurally incapable of
carrying patient data — but that is a property of today's signature, not a guarantee. The
existing cross-product identity sweep was extended in `tests/care-plan-domain.test.ts` to
cover **content** as well: every patient is paired with every contact, and every contact URI
is asserted to equal the contact-only builder output and to contain no opening fragment of
any Management Plan field, any ED Presentation note, or any person's own safety-plan words.
The collection is asserted non-empty first, so the sweep cannot pass by matching nothing.

## Reading the patient-facing surfaces as their recipient

RECIPIENT_READ

## Checks NOT run, by user instruction

The user directed that this task stay local and focused on building, and that the release
gates below are theirs to run. Each is listed as unrun rather than omitted, because a gap
recorded is evidence and a gap hidden is not.

| Not run | Why |
| ------- | --- |
| `npm run verify:pr-local` | Not run, by user instruction |
| `npm run verify:cheap` | Not run, by user instruction |
| `npm run verify:release` | Not run, by user instruction — and provider-backed |
| `npm run build` | Not run directly, by user instruction. Note that `scripts/run-playwright.mjs` performs its **own** isolated production `next build` on every browser run, and all three runs built successfully; that is not the same as the repository build gate and does not include `check:bundle-budget` |
| `npm run check:production-readiness` | Not run, by user instruction |
| `npm run docs:update` | Not run, by user instruction. Task 11 adds no route, and all 21 Care Plan routes are already present in `docs/site-map.md`, so no generated diff is expected — but that is an expectation, not a verified fact |
| whole-tree `npm run format` | Not run, by user instruction. Every file this task touched was formatted individually with `npx prettier --write`; a repository-wide check may still find an unrelated file |
| `npm run lint` | Not run. It has not been run on this branch since the `origin/main` merge, and must not be reported as green |
| `npm run typecheck` (repository gate) | Not run as the gate. `npx tsc --noEmit` was run once and reported **zero diagnostics** for `tests/ui-care-plan-mockup.spec.ts` |
| `eval:*`, `check:supabase-project`, anything touching live Supabase, OpenAI or hosted CI | Not run — provider-backed and out of scope |
| Push, pull request, merge, deploy | Not performed |

## Acceptance criteria

ACCEPTANCE_TABLE

## Carried forward

The reviewed Task 3 design-sweep evidence is carried forward unchanged. No shared UI
foundation outside the Care Plan namespace was touched by this task — the three production
edits are all inside `src/components/care-plan/mockups/` — so the design preflight was not
re-run.

## Known noise in the test output

The output of the focused Vitest suites is **not pristine**, and this has been true since
Stage A:

- A React controlled/uncontrolled warning from the shared `src/components/ui/select.tsx`
  (Ruling 50). That file is untouched by this branch and the defect is repository-wide: it
  passes both `value` and a `defaultValue` fallback whenever a `placeholder` is supplied.
  It belongs in `/issues`, not in a prototype pull request, and it was **not** fixed here.
- A React `act` warning and a jsdom `Not implemented: navigation to another Document`
  notice, both test hygiene rather than product defects.

They are recorded rather than fixed, and they mean a genuinely new warning could be masked.
