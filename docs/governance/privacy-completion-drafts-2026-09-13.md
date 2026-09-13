# Privacy completion drafts — 2026-09-13

**Status: prepared, unsigned and not approved for release.** The owner requested creation of missing
records on 2026-09-13. That request authorises drafting; it does not establish a legal entity,
provider agreement, retention entitlement or clinical/privacy decision. The canonical status remains
[`privacy-readiness.v1.json`](privacy-readiness.v1.json). Use the existing
[role-attestation pack](privacy-role-attestation-pack-2026-09-01.md) for evidence and requirement IDs.
Do not publish these drafts as an approved privacy policy or submit provider requests automatically.

## Proposed initial use and limits

Proposed release scope: clinician education and general guideline questions using approved public
sources, synthetic examples or fully de-identified material. Guests and signed-in users receive the
same answer capabilities; authentication does not approve patient information or access to another
user's documents. Individual patient identifiers and real-patient case details are outside this
proposed initial scope. Clinical decisions remain with the treating clinician.

This is a proposed restriction, not proof of technical enforcement. Public free-text entry can still
contain personal or health information. Account, request and operational data also require a privacy
basis. A restricted-use decision must address these residual flows and any controls needed before
activation; describing the corpus as public does not resolve them.

## Draft privacy notice for APP 1 / APP 5 review

> PsychSift is operated by **[actual legal entity or individual operator; jurisdiction]**. For privacy,
> access, correction, deletion or complaints, contact **[monitored privacy contact]**.
>
> PsychSift helps clinicians find and summarise clinical guidance. Do not enter patient names,
> identifiers or information that could identify a patient. Answers may be incomplete or incorrect;
> check the cited guidance and apply clinical judgment.
>
> We process questions and relevant evidence to retrieve sources and generate answers. Account and
> technical information support authentication, security and service operation. Our documented service
> uses Supabase storage in Sydney, Railway application/worker processing in Singapore and OpenAI API
> processing outside Australia. **[Confirm the current recipients, countries and contractual basis
> before publication.]** Queries may be sent to service providers even where durable query logging is
> disabled. We do not promise that free-text input is automatically de-identified or that providers
> retain no data.
>
> Server retention controls include a 30-day query-record purge, 90-day retrieval-log and query-miss
> purges, and expiry with a bounded hourly response-cache purge. Durable raw query and generated-answer
> logging are disabled by default; confirm the deployed settings. Audit records have a separate
> indefinite retention policy. Browser session storage and in-memory conversation state have separate
> retention limits and clearing controls described in the privacy assessment.
> **[Approve retention purposes and confirm provider-side retention.]**
>
> To request access, correction or deletion, contact the privacy channel. We will verify your identity
> proportionately, record the request, identify the information and systems involved, explain any
> applicable limits, and provide the outcome. Raise complaints with the same channel; unresolved
> complaints follow **[named escalation process and applicable external complaint body]**.
> **[Approve acknowledgement and response targets supported by actual staffing.]**
>
> Effective date: **[date]**. Review owner: **[role]**. Next review: **[date]**.

The privacy adviser must determine applicability, collection/consent authority, cross-border basis,
exceptions and final wording. This draft does not make that determination. Its technical statements
derive from [`privacy-impact-assessment.md`](../privacy-impact-assessment.md); historical configuration
evidence must be refreshed where necessary. Do not replace the product privacy page with placeholders.

## Provider requests — drafts only, not sent

### OpenAI account and agreement evidence

> Please identify the agreement governing **[actual customer entity]** and the production account/project
> used by PsychSift, including the applicable DPA version, effective date and acceptance record. Please
> confirm the current retention controls for our deployed Responses and Embeddings models, whether ZDR
> is approved and configured, and how our requested prompt-cache TTL behaves under those controls.
> Include relevant endpoint exclusions, processing locations and account scope. A prior sales-request
> acknowledgement is not confirmation of entitlement. Please provide a secure reference we may record
> without publishing account credentials or confidential correspondence.

The public [OpenAI DPA](https://openai.com/policies/data-processing-addendum/) and
[Services Agreement](https://openai.com/policies/services-agreement/) explain the contractual route.
A separate countersigned DPA is not universally required; evidence must establish this customer's
actual agreement and acceptance. [API data controls](https://developers.openai.com/api/docs/guides/your-data)
describe available controls, not this account's entitlement. Reuse the existing September request
thread if the account owner supplies it; avoid duplicate requests.

### Railway agreement and data scope

> Please confirm the binding DPA for **[actual customer entity]** and PsychSift's production service,
> including execution status, regions and subprocessors. The public DPA's Exhibit A states
> "Sensitive Data or Special Categories of Data: None"; this does not by itself establish coverage for
> our intended incidental-health-data flow. Please confirm or provide a negotiated schedule covering
> the actual application/worker data flow and incidental health information, with retention/deletion,
> security, incident notification and subprocessor-change terms. If that scope cannot be supported,
> please identify the supported processing limits so the owner can choose an appropriate deployment.

Use Railway's actual [DPA process](https://railway.com/legal/dpa). This draft is neither a submitted
agreement nor a representation that Railway accepted health-data processing.

## Reusable role decision record

Complete one decision for each remaining requirement in sections 3–8 of the role-attestation pack.
One document may hold several decisions, but each must have its own accountable role, scope and basis.
Store the completed sanitized record under `docs/governance/`; confidential originals stay outside Git.

| Field                     | Required content                                                                  |
| ------------------------- | --------------------------------------------------------------------------------- |
| Requirement ID            | Exact pending/partial ID from the canonical register                              |
| Decision                  | `verified`, `accepted_decision`, or rejected; no default approval                 |
| Role holder and authority | Actual authorised role; record identity privately where appropriate               |
| Scope                     | Production service, intended audience, permitted data and excluded uses           |
| Evidence                  | Sanitized agreement/provider/technical references and observation dates           |
| Rationale                 | What the evidence establishes, remaining uncertainty and residual risk            |
| Conditions                | Controls required before activation, limits, escalation and stop/revisit triggers |
| Accountable owner         | Person or role that actually owns follow-through                                  |
| Decision date / expiry    | Actual decision date and justified review date; do not backdate                   |
| Secure record reference   | Traceable location of actual approval; no confidential attachments in Git         |

For `accepted_decision`, use the validator's supported role and `decisionReference` fields only after
an authorised role actually makes the decision. This route cannot assert an absent contract or ZDR
approval, override a provider's terms, or silently authorise unrestricted patient use. Preserve any
unmet facts and restrictions explicitly. No status is promoted merely by creating this draft.

## Completion order

1. The owner supplies the actual operator identity and a working privacy contact, and identifies who
   can make the privacy, contract and clinical decisions. An individual operator may be appropriate;
   do not invent a company, incorporation or professional role.
2. Those role holders review the proposed scope and notice. Obtain or establish the applicable
   agreements and actual provider retention position using the drafts above.
3. Record each real decision and its evidence in the existing register and role pack. Keep unresolved
   requirements pending/partial. Run the structural privacy check and strict readiness check once.
4. Activate adaptive answers only after the separate governed-source publication/coverage prerequisites
   and release conditions pass. The present corpus has no eligible governed publications; drafting
   privacy records does not supply source licence, clinical review or publication approval.
