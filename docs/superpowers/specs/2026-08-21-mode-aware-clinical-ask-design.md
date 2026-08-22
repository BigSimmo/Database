# Mode-aware Clinical Ask — binding design specification

**Status:** approved 21 August 2026; repository ownership refreshed 22 August 2026

**Repository baseline:** `origin/main` at `11550416206e8c90900ddeea0993337824873a55`

**Original approval baseline:** `4685547904f544fa9e6e27dd07f44b66ac653383`

**Decision record:** [Use a shared local-first Clinical Ask orchestrator](../../adr/0001-use-a-shared-local-first-clinical-ask-orchestrator.md)
**Domain language:** [Clinical Knowledge Support](../../../CONTEXT.md)

## 1. Outcome and product boundary

Mode-aware Clinical Ask lets a clinician speak or type a natural-language question in Services,
Forms, Differentials, Formulation, DSM-5 Diagnosis, Specifiers, or Therapy and receive a concise,
source-linked answer shaped by that mode. It is clinician-facing reference and decision support. It
is not a patient-record system, diagnostic authority, treatment authority, referral allocator, legal
determination, or substitute for reviewing original sources and patient context.

The product term is **best-supported mode answer**, not “most correct answer.” Every clinically
material claim must be traceable to displayed evidence. Unsupported content becomes an Evidence Gap;
conflicting content remains visible as a conflict. Suggested Case Context, diagnostic wording,
specifier fit, differential fit, service fit, form applicability, formulation hypotheses, and therapy
options require Clinician Confirmation.

The initial release supports exactly seven unique application mode IDs:
`services`, `forms`, `differentials`, `formulation`, `dsm`, `specifiers`, and `therapy-compass`.
The duplicate “Differentials” in the originating request denotes the same mode, not an eighth profile.

## 2. Existing repository ownership

The 22 August refresh compared the original approval baseline with current main (129 commits of drift). The
shared owners below remain correct. Current main has materially evolved their implementations and tests, so the
implementation plan names a bounded drift check and current test owners; this refresh does not change any
approved product, clinical, evidence, privacy, or interaction decision.

The design extends these current owners rather than creating parallel application chrome:

- `GlobalSearchShell` remains the selected-mode, query-draft, navigation, and shared-layout owner.
- `MasterSearchHeader` remains the single mounted composer and receives the voice and Ask controls.
- `app-modes.ts` remains the canonical mode registry and ordinary Search routing owner.
- Universal Search remains the catalogue and indexed-domain discovery layer.
- The existing answer progress, evidence, source, copy, feedback, and follow-up primitives remain the
  visual foundation for a Clinical Ask answer.
- Existing RAG retrieval, access scoping, source governance, rate limiting, and streaming contracts
  are reused where their evidence type applies.

Ordinary Search keeps its existing behaviour and URL contract. Generic Answer keeps its existing
request, prompt, and rendering behaviour. Clinical Ask is an explicit adjacent action, so a short
catalogue lookup never silently becomes a generated clinical answer.

## 3. Clinician interaction

The shared composer exposes two clear actions for supported modes:

1. **Search** runs the mode's existing catalogue or document search.
2. **Ask {Mode}** starts Mode-aware Clinical Ask from typed or reviewed dictated text.

A microphone button is part of the same composer. It does not submit. The clinician taps to record,
taps again to stop, reviews and edits the transcript, confirms or corrects suggested Case Context,
and explicitly presses `Ask {Mode}`. There is no always-on listening, wake word, end-of-speech
auto-submit, or silent mode switch.

The working flow is:

`Dictate or type -> review transcript -> confirm context -> clarify material gaps -> search local evidence -> search approved external authorities only if needed -> compose the mode answer -> follow up or hand off explicitly`

The answer replaces the current mode's normal main-content region through the shared shell rather
than appearing in a modal. The URL may identify the selected mode and an `ask` surface, but it must
never contain the raw question, transcript, Case Context, answer, or follow-up. Refreshing or closing
the tab clears the Clinical Ask Session and returns an empty Ask surface.

## 4. Clinical Ask Session and Case Context

One in-memory `ClinicalAskSessionProvider` lives inside `GlobalSearchShell`. It owns the active mode,
draft question, confirmed Case Context, clarification exchange, answer turns, cross-mode handoff, and
clear-session action. It is intentionally not backed by local storage, session storage, a database,
or URL query text.

Case Context contains only clinician-confirmed fields that materially focus the supported profiles:

- age group rather than exact date of birth;
- care setting and jurisdiction;
- working diagnosis when the clinician supplies one;
- presentation features, duration, impairment, exclusions, and relevant course information;
- service location, eligibility, pathway stage, and referral purpose;
- form purpose, legal/clinical stage, and responsible role; and
- therapy goals, population, setting, cautions, availability, and prior response.

Extraction produces editable suggestions. A suggestion is visually distinct from a confirmed value,
cannot drive a final answer before confirmation, and is discarded when rejected. The system must not
derive or request names, initials, dates of birth, addresses, record numbers, phone numbers, email
addresses, or other direct identifiers. It cannot guarantee de-identification, so the point-of-use
privacy notice continues to tell clinicians not to enter identifiable information.

`Clear case`, New chat, sign-out, account change, tab close, and page refresh destroy the session.
Cross-mode handoff transfers only the clinician-confirmed in-memory context fields the target profile
accepts. The clinician reviews that reduced transfer before the target mode runs.

## 5. Shared orchestration architecture

The server exposes two additive routes:

- `POST /api/speech/transcribe` accepts one bounded audio recording and returns transcript text plus
  transcription metadata.
- `POST /api/clinical-ask/stream` accepts the selected mode, natural-language question, confirmed
  Case Context, clarification answers, prior session turns needed for the current follow-up, and the
  external-fallback preference. It streams progress, clarification, evidence preview, and one final
  governed response envelope.

The clinical orchestration layer is divided by responsibility:

- `mode-profiles` declares the exhaustive seven-profile registry.
- `context` validates confirmed context and determines material clarification requirements.
- `catalogue-evidence` retrieves structured records from the current mode without converting model
  output into evidence.
- `indexed-evidence` uses existing access-scoped document retrieval and returns original excerpts.
- `external-evidence` invokes the approved server-side web-search provider under the authority
  registry and normalises attributable evidence.
- `evidence-sufficiency` evaluates whether the directly relevant evidence can support the requested
  response contract. It does not alter retrieval ranking or treat governance metadata as relevance.
- `synthesis` composes the typed mode response using only supplied evidence IDs.
- `response-governance` removes unsupported claims, attaches source and review warnings, and fails
  closed before the response reaches the existing answer renderer.

Catalogue records, raw indexed excerpts, and attributable external extracts are first-class evidence.
A generated generic Answer, search-result label, model summary, or model confidence is never evidence
for a subsequent Clinical Ask answer.

## 6. Binding request and response concepts

`ClinicalAskModeId` is the seven-ID subset of `AppModeId`. A `ClinicalAskModeProfile` binds:

- mode ID and clinician-visible label;
- preferred catalogue and indexed evidence domains;
- accepted Case Context fields and clarification rules;
- a typed response schema and section order;
- mode-specific source and review-state policy;
- allowed follow-ups and Cross-mode Handoffs; and
- prohibited claims or actions.

The request accepts a maximum 2,000-character question, bounded confirmed context, no arbitrary
metadata, and a bounded number of prior in-memory turns. It uses the existing authentication,
owner-scope, abort, rate-limit, structured-validation, server-timing, and synthetic interaction-ID
patterns. Query or clinical content must not appear in logs, traces, error envelopes, metrics, or
provider user IDs.

The final response state is exactly one of:

- `clarification_required`: material questions must be answered before synthesis;
- `answered`: evidence supports a mode-shaped answer;
- `evidence_gap`: the requested clinical conclusion is not supportable, with nearby evidence and
  useful next actions when available; or
- `failed`: no clinical answer is exposed and a safe retry or fallback path is named.

Every answered response contains the concise lead answer, mode sections, Evidence Ladder, claim-to-
evidence citations, the Source Review State of each record, conflicts, missing information, safe
follow-up suggestions, and clinician-triggered handoff actions. It never exposes model
chain-of-thought, hidden prompts, provider internals, retrieval scores, untrusted source instructions,
or raw structured-output keys.

## 7. Mode Answer Profiles

| Mode            | Required answer shape                                                                                                                                                                        | Clarify when material                                                                                       | Prohibited outcome                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Services        | Potentially matching services; fit reasons; eligibility and referral requirements; access pathway; missing information; direct records and official contacts                                 | Location, population, urgency/pathway stage, referral purpose, or eligibility facts are absent              | Automatic allocation, referral acceptance, eligibility determination, or claim that a service is currently available without evidence    |
| Forms           | Potentially applicable forms; jurisdiction and stage; purpose; prerequisites; responsibility; completion or submission pathway; official links                                               | Jurisdiction, legal/clinical stage, intended action, or responsible role is absent                          | Legal determination, automatic form completion, signature, submission, or claim that one form is mandatory without supporting authority  |
| Differentials   | Candidate possibilities ordered by evidence fit; supporting and contradicting clues; discriminators; must-not-miss considerations; missing assessment information; next questions            | Core presentation, time course, setting, or explicit exclusions needed to distinguish candidates are absent | Final diagnosis, patient-specific probability, inferred severity, or automatic escalation/disposition                                    |
| Formulation     | Testable mechanism hypotheses; predisposing, precipitating, perpetuating, and protective clues where supplied; evidence for and against; missing domains; questions that test the hypotheses | The requested formulation focus or enough contextual domains to form a testable hypothesis are absent       | Presenting a hypothesis as fact, inventing history, or making a diagnosis or treatment directive                                         |
| DSM-5 Diagnosis | Candidate criteria mapping; criteria apparently supported; duration, impairment, exclusion, and differential gaps; source-linked diagnostic wording for review                               | The candidate diagnosis, duration, impairment, exclusion, or required contextual information is absent      | Definitive diagnosis, inferred criterion satisfaction, copyrighted criteria reproduction beyond authorised content, or autonomous coding |
| Specifiers      | Potential specifiers; base diagnosis applicability; features for and against; missing criteria; mutually exclusive or incompatible combinations; clinician-review wording                    | Base diagnosis, episode/course context, severity/remission inputs, or differentiating features are absent   | Establishing the base diagnosis, presenting a specifier as confirmed, or representing diagnostic fields as psychotherapy guidance        |
| Therapy         | Potentially fitting options; rationale; evidence and review status; population and setting fit; cautions; practical requirements; alternatives; source links                                 | Goal, population, setting, important cautions, availability, or prior response needed for fit is absent     | Automatic treatment plan, patient-specific recommendation, unsupported efficacy comparison, or hiding a `needs review` record state      |

Candidate ordering communicates evidence fit, not probability, clinical severity, institutional
priority, or automatic action. Urgent-risk notices are permitted only when the clinician explicitly
states a supported red-flag condition; they use non-diagnostic language and do not suppress the rest
of the answer or decide disposition.

## 8. Evidence Ladder and sufficiency

The orchestrator searches in this order:

1. **Catalogue Evidence** from the active mode.
2. **Indexed Evidence** from authorised organisational documents.
3. **External Authority Evidence** only for a remaining Evidence Gap.

All relevant local evidence remains visible even when external evidence is added. External evidence
cannot overwrite, silently reconcile, or lend authority to an unreviewed local record. Conflicting
jurisdictions, dates, thresholds, definitions, and recommendations are displayed as conflicts.
Australian and WA-specific evidence is presented first when relevant, without pretending locality
is a relevance score.

Evidence sufficiency is a deterministic contract over direct relevance, evidence coverage for the
profile's required fields, source attribution, review state, currentness metadata, and unresolved
conflicts. An LLM confidence value cannot make evidence sufficient. Unknown source metadata remains
unknown. Review state may restrict claims and trigger an external evidence check, but it must not add
boosts or penalties to existing retrieval comparators.

Every numerical value, duration, threshold, diagnostic criterion, eligibility condition, form
requirement, service contact, and therapy claim must cite the smallest sufficient evidence set. If
that support is absent or internally inconsistent, the claim is omitted and the Evidence Gap or
conflict is explicit.

## 9. Governed external-authority fallback

External fallback is server-only and uses the approved OpenAI web-search capability behind a feature
flag. It runs only after local sufficiency evaluation and only against a repository-owned authority
registry. The initial registry may include authenticated WA health-service publishers, WA Health,
Australian government and national clinical authorities, RANZCP, TGA, NICE, and WHO. Each mode
declares the subset it may use. Additions or removals require source-governance review and tests.

DSM and Specifiers external search must not scrape or reproduce unlicensed diagnostic criteria.
When no licensed or approved authority can support the question, the correct result is an Evidence
Gap with a link to the authorised source or local review process.

Each external evidence unit retains canonical URL, page title, publisher, jurisdiction, publication
or update date when stated, retrieval time, exact attributable extract, and provider citation
metadata. The initial release keeps this evidence only in the active session and does not import the
page into the local index. Full page bodies, tracking parameters, arbitrary third-party assets, and
the clinician's query are not durably stored.

External pages are untrusted data. Their titles, markup, metadata, and text cannot change system
instructions, authority rules, mode profile, source order, or output schema. Redirects, non-HTTPS
targets, domains outside the final allowlist, unverifiable citations, unsafe URLs, oversized content,
and provider results without an attributable source are rejected. An unavailable external provider
degrades to a local answer or Evidence Gap; it never produces an uncited model-knowledge answer.

## 10. Speech capture and transcription

The app captures audio with browser media APIs and sends it to the approved server-side OpenAI
transcription path. The application security policy changes microphone permission from disabled to
self-origin only. No provider origin is added to browser connection policy because provider calls
remain server-side.

The recording contract is:

- explicit tap to start and stop;
- prominent listening state and elapsed time;
- hard stop at 60 seconds;
- one bounded audio blob of at most 10 MiB;
- accepted browser-generated audio MIME types only;
- permission, capability, size, rate, authentication, abort, and timeout validation;
- no audio file name, clinical text, or account identifier in logs;
- audio held only in memory, discarded after transcription or cancellation, and never cached;
- provider stored-response history disabled where supported by the transcription API; and
- editable transcript returned without automatic submission.

The UI states are `idle`, `requesting_permission`, `listening`, `stopping`, `transcribing`,
`ready_to_review`, `permission_denied`, `unsupported`, `failed`, and `cancelled`. A failed request may
retry the same in-memory blob while the review surface remains open; leaving or cancelling destroys
it. Keyboard typing remains fully functional when recording is unsupported or denied.

## 11. Privacy, security, and data handling

Clinical Ask strengthens the current point-of-notice boundary: do not enter identifiable patient
details; questions and selected evidence may be processed in Singapore and by OpenAI outside
Australia; and the operator must verify provider retention, region, contract, and cross-border
controls. The privacy page must describe transcription, external web search, ephemeral Clinical Ask
Sessions, audio disposal, external citations, and the absence of raw query text from URLs and client
history without claiming governance approval or provider zero retention.

The application does not promise de-identification or use a lossy automatic redactor that could
silently alter clinical meaning. It may detect obvious identifier-shaped patterns and pause with a
privacy reminder. Ordinary local Search remains available, but provider-backed Clinical Ask cannot
continue until the clinician edits the identifier-shaped input or abandons the request. Raw question,
transcript, context, answer, and external extracts are excluded from Sentry, analytics, server logs,
query logs, feedback text, route names, cache keys visible outside the protected server boundary, and
browser history.

Provider calls use a synthetic interaction ID, server-held credentials, explicit timeouts, bounded
retries, `store: false` or the closest supported non-history option, and the existing pseudonymous
provider-user contract when applicable. The provider-backed code paths are authorised for this
feature. Live provider verification, production configuration, deployment, contractual claims, real
patient data, and provider-backed release canaries remain separately governed repository actions.

External evidence, transcript output, and context suggestions are untrusted input and receive schema,
length, URL, authority, and display-text validation. Authentication and owner-scope checks occur
before retrieval. Cancellation aborts downstream transcription, retrieval, external search, and
synthesis work.

## 12. Answer presentation and accessibility

`ClinicalAskWorkspace` reuses the current staged answer, evidence, source actions, copy, feedback,
follow-up, and progress primitives. Mode-specific content is provided through typed sections rather
than bespoke page layouts. The first layer is a concise direct answer. Progressive disclosure then
shows mode sections, what fits, what does not fit, missing information, conflicts, evidence tiers,
source review state, and original-source actions.

The composer and workspace meet the repository's 48px target, keyboard, focus, heading, reduced-
motion, forced-colours, dark-mode, screen-reader status, and phone safe-area contracts. Recording
state is never communicated by colour or animation alone. Starting recording announces the state;
stopping moves focus to transcript review; submitting moves focus to progress; clarification focuses
the first question; completion announces a short status without reading the whole clinical answer.

Phone layouts keep the microphone and Search/Ask actions reachable above the effective bottom safe
area and never cover transcript validation or the active recording controls. The transcript editor,
context confirmation, source evidence, and handoff review reflow at 320px without horizontal page
scroll. Physical iPhone Safari and installed-PWA microphone acceptance remains distinct from
Chromium emulation and is required before the feature is considered complete for iPhone.

Copy and print include the question only when the clinician explicitly includes it. They always
include mode, answer, visible caveats, conflicts, source citations, retrieval date for external
evidence, and a verification reminder. Audio and rejected context suggestions are never exportable.

## 13. Failure and fallback behaviour

- Microphone unavailable or denied: preserve typed Ask and explain how to enable permission without
  repeatedly prompting.
- Transcription unavailable: keep the recording only for an explicit in-memory retry; otherwise let
  the clinician type or cancel.
- Material context missing: return `clarification_required`; do not compose a partial clinical
  conclusion first.
- Catalogue adapter failure: disclose the missing evidence tier and continue only if remaining
  evidence independently supports the profile.
- Indexed retrieval unavailable or empty: use supported catalogue content or an external fallback;
  otherwise return an Evidence Gap.
- External provider unavailable, rejected, or outside the authority registry: use local evidence or
  return an Evidence Gap without provider knowledge.
- Synthesis timeout or invalid structured output: present directly relevant evidence and links with
  a no-answer explanation; never expose stitched fragments as a complete answer.
- Conflicting evidence: preserve both attributed positions and request clinician review.
- Offline: provide ordinary local catalogue Search and a clear notice that Clinical Ask requires its
  server evidence path; do not simulate a generated answer.
- Session refresh or expiry: clear all clinical content and show an empty Ask surface.

## 14. Feedback, observability, and auditability

Feedback reuses the existing answer-feedback token and accepts structured, non-clinical reasons:
wrong mode, missed source, unsupported conclusion, important information missing, source conflict,
outdated source, or presentation problem. There is no free-text clinical feedback field in the
initial release.

Metrics are content-free counts and timings: selected mode, input transport (`typed` or `voice`),
clarification occurrence, evidence tiers used, external fallback attempted/result, response state,
abort/failure class, and latency buckets. They contain no question, transcript, context value, answer,
source extract, URL query, or direct account identifier. Audit records state that a provider-backed
operation occurred and which governed tier it used, not the clinical content.

## 15. Verification and clinical evaluation

The implementation requires synthetic evidence and presentation fixtures for all seven profiles.
Evaluation covers exact mode shape, clarification behaviour, missing evidence, contradictory
evidence, negation, time course, reviewed versus unreviewed records, jurisdiction conflicts,
unsupported numerical claims, external prompt injection, unsafe redirects, transcription errors,
aborted recording, and provider failure.

Required proof categories are:

- exhaustive profile and schema contracts;
- context-confirmation and clarification-gate unit tests;
- no raw clinical content in URL, browser storage, telemetry, logs, errors, feedback, or screenshots;
- source-authority, redirect, citation, review-state, and evidence-sufficiency tests;
- speech state-machine, permission, size, MIME, abort, timeout, and disposal tests;
- focused API auth, owner-scope, rate-limit, validation, and streaming tests;
- synthetic offline RAG and answer-quality fixtures for every profile;
- browser journeys for typed Ask, mocked voice, clarification, evidence expansion, failure, clear
  case, and Cross-mode Handoff at 320, 390, 768, and 1440px;
- keyboard, axe, dark mode, reduced motion, forced colours, print, and phone safe-area proof;
- physical iPhone Safari and installed-PWA microphone acceptance; and
- synthetic provider-backed transcription and approved-domain web-search checks under the
  repository's live-provider guard.

This feature changes clinical answer behaviour and touches protected RAG surfaces when indexed
evidence is adapted. Its pull request must declare `RAG impact: behaviour change`, pass the smallest
relevant clinical/RAG/privacy/UI domains, run production-readiness, and retain the repository's
approved live baseline/post canary requirement. Offline-green evidence does not establish live
retrieval or production clinical safety.

## 16. Delivery sequence

1. Freeze shared schemas, glossary, privacy contracts, mode-profile registry, synthetic fixtures,
   and no-content-leak tests.
2. Build typed Clinical Ask with catalogue and indexed evidence for Specifiers and Differentials;
   validate clarification, response shape, and evidence rendering.
3. Add Services, Forms, Formulation, DSM-5 Diagnosis, and Therapy profiles through the same registry.
4. Add the allowlisted external-authority adapter, evidence normalisation, prompt-injection defences,
   and source display.
5. Add speech capture, transcription, transcript review, permission handling, and phone ergonomics.
6. Complete all seven end-to-end journeys, cross-mode handoffs, privacy copy, evaluation, visual QA,
   physical-device acceptance, and governed provider evidence before enabling the feature broadly.

Feature flags protect incomplete stages, but no supported profile is represented as complete until
its full local, indexed, external-fallback, typed, voice, privacy, accessibility, and failure
contracts pass. The initial release exposes all seven modes together; Specifiers/Differentials may
lead internal implementation and verification but are not a partial public launch. One master flag
disables Clinical Ask without affecting ordinary Search, external fallback has an independent flag,
and an emergency per-mode denylist can contain a mode-specific defect.

## 17. Explicit non-goals

- patient-identifiable input, stored patient profiles, EHR integration, or durable case memory;
- always-on listening, wake words, automatic speech submission, or default spoken answers;
- automatic diagnosis, probability, severity classification, treatment selection, form completion,
  referral, allocation, escalation, or disposition;
- arbitrary open-web browsing, user-supplied source domains, silent source ingestion, or external
  pages entering the local index;
- changing ordinary Search, generic Answer, existing app-mode routing, or current catalogue detail
  workflows; and
- claiming clinical validation, governance approval, WA Health endorsement, TGA classification,
  provider zero retention, deployment, or production readiness from repository implementation.

## 18. Approved grill decisions

The post-specification design grill resolved the remaining high-yield decisions:

- Access gating is intentionally deferred. Implementation preserves the repository's current public-access
  behaviour and a server-side gate seam; it does not hard-code a new clinician-only or institution-only policy.
- Context extraction uses the existing fast-answer model and final clinical synthesis uses the existing
  strong-answer model. Evidence sufficiency and response governance remain deterministic. A complete Clinical
  Ask request has a 45-second deadline and at most one explicit bounded retry.
- External fallback runs after a material coverage gap and also when directly relevant local support is only
  `needs_review`, materially stale/unknown for a time-sensitive claim, or conflicted. Local evidence remains
  visible and is never silently upgraded or replaced.
- A session may send at most six prior messages (about three user/assistant exchanges) plus the current question.
  Every clinically material follow-up reruns evidence sufficiency; earlier generated answers never become evidence.
- Cross-mode transfer uses only the curated handoff map in the mode profiles and requires clinician review of the
  reduced confirmed context before the target mode runs.
- Implementation completion means the code is merged after the hosted migration and zero-critical-failure
  synthetic provider canaries pass against an explicitly confirmed protected staging environment. Production
  activation, clinical/privacy/source-governance sign-off, and physical-device acceptance remain separate gates.

## 19. Approval boundary

Approval of this specification authorises detailed implementation planning for the repository code
and synthetic verification described here. It does not authorise production deployment, migrations,
real patient data, source-governance sign-off, contractual or privacy claims, or external clinical
communications. The implementation plan must name every file, interface, focused proof command, RAG
impact gate, and live-provider boundary before code begins.
