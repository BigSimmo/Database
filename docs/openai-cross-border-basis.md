# Cross-border disclosure basis — OpenAI (PIA-1)

**Status:** Decision-ready — awaiting the operator/legal step · **Date:** 2026-07-13
**Owner of the open step:** account holder for `OPENAI_API_KEY` + privacy adviser
**Closes:** the contractual half of **PIA-1** in [docs/privacy-impact-assessment.md](privacy-impact-assessment.md) §10.
**Companion:** the `/privacy` collection notice ([src/app/privacy/page.tsx](../src/app/privacy/page.tsx)) and composer reminder ([src/lib/ui-copy.ts](../src/lib/ui-copy.ts)) satisfy the APP 5 / APP 1 half.

> **Not legal advice.** This records the current, verifiable facts about OpenAI's data-handling
> terms and maps them to APP 8 so a qualified privacy adviser can sign off the cross-border basis.
> The APP-8 reasoning below is an engineering interpretation and must be confirmed by counsel before
> real patient use.

---

## 1. Why this exists

The app's only cross-border flow is the query text + retrieved excerpts sent to OpenAI in the United
States for embedding and answer synthesis (PIA §3–4; verified still true in code —
[src/lib/openai.ts:75-79](../src/lib/openai.ts) builds a plain `new OpenAI({ apiKey, timeout, maxRetries })`
with no `baseURL`/ZDR header and `store:false` by default. GPT-5.6 requests
`prompt_cache_options.ttl="30m"`; explicitly configured pre-5.6 models retain the legacy
retention field ([openai.ts](../src/lib/openai.ts)).

Two obligations attach to that flow:

- **APP 8 (cross-border disclosure).** Before disclosing personal information overseas the entity must
  take **reasonable steps** to ensure the recipient handles it consistently with the APPs. Under
  **s16C** of the _Privacy Act 1988_ (Cth) the discloser stays **accountable** for the overseas
  recipient's acts unless an APP 8.2 exception applies. Health/mental-health data is _sensitive
  information_ — the highest-protection category — so this is the launch-critical item.
- **APP 5 (notification).** Individuals must be told their information is disclosed overseas.
  **Already shipped** in the `/privacy` page and composer notice (see §7).

The code-side controls cannot _by themselves_ discharge APP 8 — the "reasonable steps" are largely
**contractual**. That contract is the open step this document tracks.

## 2. What actually crosses the border

| Egress    | Payload                                                          | Endpoint                                                      | Reference                                                                           |
| --------- | ---------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Embedding | Raw query text (normalized)                                      | `POST /v1/embeddings` (`text-embedding-3-small`)              | [openai.ts embedText](../src/lib/openai.ts)                                         |
| Answer    | Raw query verbatim + retrieved chunk text + static system prompt | `POST /v1/responses` (Terra fast / Sol strong, `store:false`) | [rag.ts](../src/lib/rag.ts) · [rag-source-block.ts](../src/lib/rag-source-block.ts) |

The app **adds no raw patient or owner identifiers** and stores queries only as a keyed hash locally.
When configured, authenticated Responses requests include a stable HMAC-SHA256
`safety_identifier`; anonymous and background requests omit it. The app does **not scrub** PHI a
clinician types. Everything else (documents, embeddings, logs, auth) stays at rest in
**Sydney — AWS `ap-southeast-2`** (PIA §7).

## 3. OpenAI's current terms (verified 2026-07-13)

Facts pulled from OpenAI's public policy/docs pages on 2026-07-13. **Re-verify at execution time** —
these terms change; the PIA (2026-07-06) already predates the Australia data-residency option below.

| Item                          | Current position                                                                                                                                                                                                                                                                                                                                        | Source                                                                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **DPA available**             | OpenAI executes a Data Processing Addendum for API customers; OpenAI acts as **processor**, and binds each sub-processor to comparable obligations. Current version `v.010126` (1 Jan 2026).                                                                                                                                                            | [DPA](https://openai.com/policies/data-processing-addendum/) · [DPA PDF](https://cdn.openai.com/pdf/openai-data-processing-addendum.pdf)                                                                           |
| **Training**                  | API inputs/outputs are **not used to train models** by default (API opt-out since 1 Mar 2023).                                                                                                                                                                                                                                                          | [Data controls](https://developers.openai.com/api/docs/guides/your-data)                                                                                                                                           |
| **Default retention**         | Inputs/outputs retained **up to 30 days** for abuse monitoring, then deleted.                                                                                                                                                                                                                                                                           | [Data controls](https://developers.openai.com/api/docs/guides/your-data)                                                                                                                                           |
| **Zero Data Retention (ZDR)** | Removes the 30-day abuse-monitoring retention; **not self-serve** — prior approval by OpenAI, configured per **project**. Apply via the account/sales team.                                                                                                                                                                                             | [Data controls](https://developers.openai.com/api/docs/guides/your-data)                                                                                                                                           |
| **Data residency**            | API data residency now covers **Australia** (among US, Europe, UK, Canada, Japan, Korea, Singapore, India, UAE). Enabled by creating a **new Project** and selecting the country; eligibility via sales. **Australia = storage at rest only** — regional _processing/inference_ is US/Europe/UAE only. ~10% uplift for models released from 5 Mar 2026. | [Data residency (API)](https://help.openai.com/en/articles/10503543-data-residency-for-the-openai-api) · [Announcement](https://openai.com/index/expanding-data-residency-access-to-business-customers-worldwide/) |
| **Sub-processors**            | Published list of sub-processors that may process Customer Data. Review for the APP 8 accountability chain.                                                                                                                                                                                                                                             | [Sub-processor list](https://openai.com/policies/sub-processor-list/) · [platform](https://platform.openai.com/subprocessors)                                                                                      |
| **Prompt caching**            | GPT-5.6 requests `prompt_cache_options.ttl="30m"` by default and never receives the deprecated retention field. The TTL is a minimum, not a guaranteed deletion deadline. Explicit pre-5.6 deployments retain the legacy retention behavior. ZDR interaction must be **confirmed in writing** (see §6, PIA-6).                                          | [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) · [Data controls](https://developers.openai.com/api/docs/guides/your-data)                                                          |

## 4. This app's endpoints are ZDR-eligible

ZDR **excludes** stateful products: Conversations, Assistants/threads, ChatKit, `/v1/files`, vector
stores, fine-tuning, video, vision fine-tuning. This app uses **only** `/v1/responses` (stateless,
`store:false`) and `/v1/embeddings` — **neither is on the exclusion list**. So the two egress points
that carry PHI are exactly the ones ZDR is designed to cover. This is the strongest lever available.

## 5. Recommended basis to satisfy APP 8 _(engineering interpretation — counsel to confirm)_

Relying on **APP 8.1 "reasonable steps"** (a binding contract that holds the recipient to
APP-comparable handling) is the mainstream, defensible path — **not** consent under APP 8.2(b), which
is fragile as a sole basis for sensitive health information. The "reasonable steps" package:

1. **Executed OpenAI DPA** — the contractual spine (processor obligations, sub-processor flow-down,
   security, breach notice, SCC-equivalent terms). **Required.**
2. **ZDR on the project** behind the production key — removes the 30-day retention for both egress
   points (§4). **Strongly recommended.**
3. **Australia data residency** for storage at rest — keeps stored content onshore (inference still
   crosses; PHI-minimisation reduces what inference sees). **Optional but high-value** for a WA
   clinical posture; weigh against the ~10% cost uplift.
4. **No-training default** (already OpenAI's API default) — confirm in the executed contract.
5. **The app's own minimisation** as documented "reasonable steps" under APP 11: query hashing at
   rest, `store:false`, Sydney residency, and the shipped PHI reminder (do-not-enter-identifiers).

Items 1–2 (plus documenting 4–5) are what turn PIA-1 from open to closed. Item 3 strengthens it.

## 6. Open question to pin with OpenAI

**What is the effective prompt-cache deletion behavior under ZDR for GPT-5.6 requests that specify
the 30-minute TTL, and for requests where the app omits the extended TTL option?** Get this in
writing — it determines whether **PIA-6** is fully resolved by ZDR or merely mitigated. Record the
answer in the status block.

## 7. Consistency with the shipped user-facing notice

The `/privacy` page and composer notice already tell users: data is stored in **Sydney**; question
text + excerpts go to **OpenAI in the US** ("the only point where data leaves Australia"); OpenAI is
**asked not to retain** requests (`store:false`); retention is 30d/90d. This document must stay
consistent with those claims.

- **Merge status:** the APP-5 half is **live on `main`** — `src/app/privacy/page.tsx` and the composer
  notice landed via **PR #513** (`eeb2340ad`). So APP 5/1 is met; only the APP 8 contractual basis below
  remains.
- **Follow-up:** if **Australia data residency** is enabled, the `/privacy` copy ("the only point where
  data leaves Australia") stays accurate for _processing_, but the "where stored" section can be
  strengthened to note US/AU storage — update copy if residency is adopted.

## 8. Operator action checklist

Actions **1–3 must be performed by the account holder** in OpenAI's dashboard/legal process — they
involve accepting agreements and changing account settings, which an automated agent must not do.

- [ ] **1. Execute the OpenAI DPA** for the org behind the production `OPENAI_API_KEY`
      → [openai.com/policies/data-processing-addendum](https://openai.com/policies/data-processing-addendum/).
      Store the countersigned copy; record version + date below.
- [ ] **2. Apply for ZDR** on the production project via the OpenAI account/sales team. Confirm it
      covers `/v1/responses` + `/v1/embeddings`. Record project id + approval date.
- [ ] **3. Decide on Australia data residency** (new Project + country selection; sales-gated).
      Record region + date, or record an explicit decision not to adopt it and why.
- [ ] **4. Confirm the ZDR ↔ prompt-cache behaviour** in writing (§6); record the answer.
- [ ] **5. Review the sub-processor list** for anything counsel should note in the APP 8 chain.
- [ ] **6. Legal sign-off** that the §5 package satisfies APP 8 for sensitive health information.
- [ ] **7. Keep `/privacy` copy in sync** if AU residency is adopted (§7) — note US/AU storage.
- [ ] **8. Code follow-ups** once the above land (§9), if adopted.

> APP 5/1 (the collection notice + `/privacy` page) is **already done** — live on `main` via PR #513.
> This checklist covers only the remaining **APP 8** contractual basis.

### Status record — fill in as steps complete

| Field                               | Value                     | Date | Evidence |
| ----------------------------------- | ------------------------- | ---- | -------- |
| OpenAI org / production project id  | _tbd_                     |      |          |
| DPA executed (version)              | _no (v.010126 available)_ |      |          |
| ZDR approved (project)              | _no_                      |      |          |
| ZDR covers /responses + /embeddings | _tbd_                     |      |          |
| ZDR zeroes prompt cache? (§6)       | _tbd_                     |      |          |
| Australia data residency            | _not enabled_             |      |          |
| No-training confirmed in contract   | _API default_             |      |          |
| Counsel sign-off (APP 8)            | _pending_                 |      |          |

## 9. Code follow-ups triggered by the outcome

These touch the OpenAI request path — do them **only after** the legal decision, and treat them as
provider-path changes (confirm before running against live).

- **ZDR granted:** no code change strictly required (ZDR is account/project-side). Revisit
  `OPENAI_PROMPT_CACHE_TTL` depending on the §6 answer and note the resolution against **PIA-6**.
- **Australia data residency adopted:** the client currently has no `baseURL` override
  ([openai.ts:75-79](../src/lib/openai.ts)). Data-residency Projects route via the standard API with a
  region-scoped project key; confirm whether a `baseURL`/project-key change is needed and wire an
  `OPENAI_BASE_URL` env only if OpenAI's residency setup requires it.
- **Defence-in-depth (optional, PIA-1 fix #4):** a lightweight outbound PHI/entity strip on the query
  before egress. Larger change; not required to close PIA-1.

## 10. Sources

- OpenAI — [Data controls in the OpenAI platform](https://developers.openai.com/api/docs/guides/your-data)
- OpenAI — [Data Processing Addendum](https://openai.com/policies/data-processing-addendum/) · [PDF v.010126](https://cdn.openai.com/pdf/openai-data-processing-addendum.pdf)
- OpenAI — [Sub-processor list](https://openai.com/policies/sub-processor-list/)
- OpenAI — [Data residency for the OpenAI API](https://help.openai.com/en/articles/10503543-data-residency-for-the-openai-api) · [Expanding data residency worldwide](https://openai.com/index/expanding-data-residency-access-to-business-customers-worldwide/)
- OAIC — Australian Privacy Principles (APP 8 cross-border disclosure; s16C accountability), _Privacy Act 1988_ (Cth)
- Internal — [Privacy Impact Assessment](privacy-impact-assessment.md) (PIA-1, PIA-6)
