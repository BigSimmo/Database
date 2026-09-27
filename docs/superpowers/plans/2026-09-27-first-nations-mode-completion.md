# First Nations mode completion checkpoint

## Current state — 27 September 2026

The original build in PR #3116 is merged into the base used here. This continuation is **local and uncommitted**, on `codex/chat-first-nations-completion-first-nations-completion`, based on `b77828b1504f98e67a07f125e5f97fc4fe3f9ec4`. The primary checkout was preserved. There has been no publication, deployment, migration, provider call or contact report sent.

**Local implementation verification finished after Josh requested continuation.** The saved production build was reused and only the 161 unfinished browser tests were run. No completed browser test or build was repeated. No task-owned test runner remains active.

The mode is still an example awaiting cultural/content approval. `approvals.json` remains empty; `profiles/emhs.json` remains disabled. The immediate-risk sentence remains hidden. Source verification is not cultural approval or clinical sign-off.

## Implemented locally

- Configured the user-supplied correction address, `support@psychsift.com`. Missing-number and per-contact correction links open an email draft with public contact information and a warning to exclude patient details, staff names and personal numbers. PsychSift does not store a report.
- Added a shared dial-sheet footer and a primary Call action. First Nations uses it for public-only vCard downloads, wrong-number reporting and the 90-day review date. Sharing falls back to copying the labelled contact; cancellation does not copy it. vCard names escape CR/LF to prevent extra fields.
- Moved the labelled button and the one-off, reduced-motion-aware live status into `mode-kit`; the First Nations names are compatibility re-exports. Existing icon buttons and muted/warning state labels retain their contracts.
- Wired the existing workplace-hospital preference into Bedside and its liaison context. Only the public hospital id persists. The selector appears only when an enabled profile has multiple hospitals; it does not activate EMHS.
- Added evidence-based review dates to contact sheets and content blocks. Pocket cards use the oldest underlying check date, not the print date, and distinguish hospitals when several are listed.
- Added Yarning, Indigenous-status enquiry, consent, family-safety and Coroner resources with source attribution and approval labels. Added AIWA language, AHCWA member/publication and WACHS directory links.
- Added six location-labelled public community-controlled service contacts to Where is home: BRAMS (Broome), Wirraka Maya (South Hedland), GRAMS (Geraldton), Bega (Kalgoorlie), Derbarl (East Perth option) and SWAMS (Bunbury). They are examples of services in an area, not a complete directory or an assertion of catchment eligibility. No unverified opening hours were added.
- Linked Contacts directly to `/services/search?specialist_groups=aboriginal_torres_strait_islander`. The general `/services` redirect only opens search home; browser testing established that the directory route is required. The reverse First Nations link already exists in Services.

## Source evidence checked on 27 September 2026

Exact URLs, publishers and checked dates are recorded in `src/data/first-nations/sources.json`; content-level dates identify only the items actually refreshed.

- [AIWA](https://aiwaac.org.au/) supports the booking number **1800 330 331**. Its [language list](https://aiwaac.org.au/languages/) does not establish availability by health region, so regional language lists remain empty and readers are directed to confirm with AIWA.
- [Clinical yarning paper](https://doi.org/10.1071/PY16051): Lin, Green and Bessarab (2016), social, diagnostic and management yarn. The new text is a brief paraphrase with attribution, awaiting cultural approval.
- [WA Language Services Guidelines](https://www.health.wa.gov.au/~/media/Corp/Policy-Frameworks/System-governance-risk-and-assurance/Language-Services-Policy/Supporting/Language-Services-Guidelines.pdf), pp. 15–17: limitations of telephone interpreting for sensitive/complex interviews and AIWA's role.
- [MHERL](https://emhs.health.wa.gov.au/Hospitals-and-Services/Mental-Health-Alcohol-and-Other-Drugs/Inpatient-and-Other-Services/MHERL): Perth 1300 555 788 and Peel 1800 676 822, 24 hours; not an emergency service. [Rurallink](https://emhs.health.wa.gov.au/Hospitals-and-Services/Mental-Health-Alcohol-and-Other-Drugs/Inpatient-and-Other-Services/Rurallink): 1800 552 002, weekday evenings/nights and all weekend/public holidays. It is not labelled 24/7.
- Official 13YARN, WA consent policy MP 0175/22, CAHS Indigenous-status guidance, WA family/domestic-violence resources, Coroner's Court next-of-kin information, PATS and Closing the Gap PBS material were read. Their use remains subject to the displayed wording-approval gate.
- Public contact evidence: [BRAMS](https://www.brams.org.au/), [Wirraka Maya](https://www.wmhsac.com/), [GRAMS](https://www.grams.asn.au/contact-us/contact-geraldton.aspx), [Bega](https://bega.org.au/contact-us/contact-bega/), [Derbarl](https://www.dyhs.org.au/blog/east-perth-saturday-clinic/), [SWAMS](https://www.swams.com.au/). The [AHCWA member list](https://www.ahcwa.org.au/member-services/) supports community-controlled membership and geographic grouping.
- The seven country-region names are supported by [WACHS Our Regions](https://wacountry.health.wa.gov.au/Our-services). The existing map remains a schematic, not a validated boundary map; Perth metro is a separate practical grouping.

## Concrete remaining boundaries

1. **Josh's risk-line decision:** exact current text is “Immediate risk? Follow your hospital's Mental Health Act and security process first.” Keep hidden unless Josh explicitly approves the wording. No response is not approval.
2. **EMHS agreement and cultural approval:** obtain the written agreement and approved wording, team/switchboard numbers and Acknowledgement outside PsychSift. No personal staff names or mobiles. Only then enter approval hashes and enable the profile. Changed content invalidates its approval hash.
3. **Regional interpreter availability:** public AIWA material gives languages, not confirmed region-by-region bookings. Obtain that mapping from AIWA before populating regional language lists.
4. **Restraint guidance:** the old WA physical/mechanical-restraint URL returned 404; Chief Psychiatrist material returned 503; an available WACHS PDF had a 2023 review-due date and expressly referred readers to the current internal policy. None was promoted as current guidance. A current authorised source is required.
5. **Direct WACHS mental-health numbers and complete regional coverage:** the public Great Southern page labels 08 9892 2440 as its consumer/carer advisory group contact, so it was not relabelled as clinical intake. Other discovered numbers were from old brochures or mixed-service directories. Keep the official regional directories and statewide support lines until current clinical-team numbers are confirmed. The six ACCHO contacts are not exhaustive.
6. **Patient resource selection and region boundaries:** AHCWA's publications link is available; a clinically appropriate patient pack still needs Aboriginal health-team selection. HEALTH-003 metadata was accessible but boundary downloads required sign-in; no geometry or language/Country boundaries were inferred.
7. **Release privacy gate:** the local release check reports pending OpenAI ZDR/DPA, Railway DPA, APP8 cross-border basis and APP1/APP5 notice records, plus partial PHI-minimisation status. These project-wide records were preserved.

## Verification

- Initial focused run: 25 files, 179 passed and 2 failed. Failures exposed a fixture expectation missing contact context and cancellation falling through to copy; both corrected.
- Focused retest: **5 files / 30 tests passed**, covering number-sheet fallbacks, cancelled share, vCard field safety, hospital selection, source schema and content guards.
- Final route/pocket-card regression check: `npm test -- tests/first-nations-design.dom.test.tsx tests/first-nations-pocket-card.dom.test.tsx` — **2 files / 13 tests passed**, exit 0, 7.59 seconds. This covers the final directory-route assertion and pocket-card wording.
- `npm run typecheck`: exit 0. No TypeScript diagnostics.
- `npm run check:production-readiness`: exit 1 at `PRIVACY_READINESS_FAIL mode=release review-dates=strict` for the six records above; the downstream production-readiness script did not run.
- `npm run plan:browser`: level `full` because the shared UI files have no attributable browser specs. `npm run verify:ui` passed runtime, installed-lock parity and the production build, then ended with exit 1 during test 528 without a failed assertion or final report. Output establishes **526 passed and 1 skipped**; this is partial evidence, not a passing full gate. The cause of the interruption is unconfirmed. The saved `local-browser-cache` build was created after the final source edits and is retained for continuation.
- The continuation listing confirmed **161 tests in 11 files**, starting with the interrupted dark Sources accessibility case. Running that exact selection against the unchanged saved build completed with **161 passed (6.3m)**, exit 0. The browser scope is therefore covered across two runs: **687 passed and 1 skipped out of 688**. This is combined evidence, not a claim that the original interrupted command exited successfully. The skipped test is the iPhone install hint in this Chromium project. The continuation JSON report is `test-results/first-nations-resume-results.json`; artifacts are separate under `test-results/first-nations-resume/`.
- Manual local browser: 390×844 phone contact sheet inspected in light and dark appearance; checked Call, public-only vCard href, reporting destination and privacy text, 90-day date, Escape dismissal. The corrected Services link shows six offline fixture results with the Aboriginal/Torres Strait Islander filter active and a reverse First Nations link.
- The Goldfields journey exposed Bega, Rurallink and 13YARN with the expected numbers/hours; the contact sheet exposed the public save/report actions. Talking/Yarning was inspected at 1280×900. Screenshots were saved in the task's visualization directory. Temporary viewport/media settings were reset, the original dark theme restored and the browser tab closed. The task-owned preview server was stopped to release memory.
- Encoding failure found by full browser reload was repaired; JSON parsed and formatted successfully afterward.
- Not established: native phone-call completion, native contact import, real email delivery, physical Safari/device behaviour, production operation or cultural approval. The original remote design artifact was unavailable; the repository design specification was used.

## Completed continuation and remaining decision

Josh explicitly instructed: never restart the cycle; continue from the last unfinished test. This was followed using `PLAYWRIGHT_BUILD_ROOT_ID=local-browser-cache`, `PLAYWRIGHT_KEEP_BUILD_ROOT=true` and `PLAYWRIGHT_REUSE_BUILD=true`. The successful continuation command was:

```powershell
node scripts/run-playwright.mjs --project=chromium --grep-invert '@quarantine|@mockup' --grep 'ui-sources.spec.ts.*\(dark\)|ui-(specifiers|stress|style-contract|therapy-nav-scroll|therapy-pathways|token-layer-resolution|tools|tools-show-all|universal-search|visual-artifacts)\.spec\.ts' --output test-results/first-nations-resume --reporter=list,json
```

`PLAYWRIGHT_JSON_OUTPUT_FILE` was set to `test-results/first-nations-resume-results.json`. The runner stopped its own production server after completion and retained the build. Earlier capacity-blocked attempts ran no tests; the queued listing was cancelled when Josh requested a pause. No retries of completed tests are outstanding.

Full product completion still requires the explicit human/source boundaries above. Local checks do not grant cultural approval, enable EMHS or resolve the project privacy release records. Keep the changes local and uncommitted until publication is authorised; do not mark this plan fully complete or enable EMHS on the basis of these tests.
