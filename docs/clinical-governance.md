# Clinical Governance Workstream

Clinical KB is currently a source-backed clinical reference prototype. Before production clinical use, complete and record the following governance decisions.

## Deployment Classification

- Confirm whether the product is reference retrieval, clinical decision support, documentation assistance, patient-facing software, or a combination.
- Complete local TGA Software as a Medical Device screening before using generated clinical output in care.
- Name the clinical owner responsible for source approval, review cadence, incident review, and decommission decisions.

## Source Governance

- Define allowed source types, jurisdictions, and publisher hierarchy.
- Record source title, publisher, jurisdiction, version, publication date, review date, source status, local validation status, and extraction quality for every document.
- Treat unknown source metadata as unverified, not current.
- Define a review cycle for outdated, review-due, and unknown sources.

## Data And Privacy

- Do not upload patient-identifiable documents unless local governance and privacy approvals explicitly allow it.
- Confirm OpenAI and Supabase data-processing arrangements are acceptable for the intended clinical setting.
- Define audit requirements for uploads, document access, user queries, generated answers, copied drafts, and source opening.

## Clinical Use Rules

- Generated answers and copied drafts must be verified against linked source text, local policy, and patient context before use.
- Do not add dose calculators, diagnostic scores, patient-facing recommendations, or automated treatment recommendations without dedicated clinical validation.
- Keep demo content clearly synthetic and separated from real clinical content.

## Pull Request Preflight

Use the `.github/pull_request_template.md` clinical governance section for any change that touches ingestion, answer generation, search/ranking, source rendering, document access, privacy, production environment behavior, or clinical output.

- Confirm the Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`).
- Confirm service-role credentials and private document access remain server-only.
- Confirm unknown or outdated source metadata is treated conservatively.
- Confirm demo/synthetic content remains separated from real clinical sources.
- Confirm clinical decision-support behavior changes have deployment classification and TGA SaMD impact reviewed before production use.

## Verification Records

### RLS & access scoping — 2026-06-28

- Supabase **security advisors: 0 findings** for `Clinical KB Database` (`sjrfecxgysukkwxsowpy`). The linter specifically flags missing RLS / insecure policies, so a clean run confirms RLS is enabled and policy-covered across `public` tables.
- Supabase **performance advisors: INFO only** — unused indexes (expected on a low-traffic database; do not drop pre-launch) and one auth connection-strategy tip (switch to percentage-based allocation when scaling instance size).
- Supabase unused-index advisor items are a watchlist, not a removal queue. Keep search/RAG support indexes such as document-label, title, chunk, summary, RAG logging, and audit indexes unless production query evidence plus local verification shows they are genuinely dead.
- Document organization coverage is an operational invariant: after ingestion or generated-label reclassification, run `npm run check:document-label-coverage` and require zero indexed documents missing generated `site` or `document_type` labels.
- **Application-layer cross-owner denial** (service-role routes enforce `owner_id` scoping in code) is covered by `tests/private-access-routes.test.ts` and `tests/private-rag-access.test.ts` (unowned document detail/signed-url/rename rejected; listing and search scoped to the authenticated owner).
- **Follow-up:** add a live DB-level RLS integration test that connects as two real authenticated users via the publishable (anon) key and asserts owner B cannot read owner A's rows. This needs a seeded test project/harness and is tracked as a remaining item.

## Source Provenance Taxonomy

Source provenance is an issuer-identity signal only. It is independent from currency, local validation, extraction quality, document type, and clinical relevance; combinations such as `Official · Outdated` and `Trusted · Unverified` are valid and must stay visible as separate caveats.

- **Official**: authenticated documents issued by a recognised Western Australian hospital or WA health-service network, including CAHS, WACHS, EMHS, NMHS, and SMHS. Official does not mean current, locally approved, or clinically relevant.
- **Trusted**: every other recognised authority, including BMJ, NICE, WHO, Australian national bodies, other Australian state health departments, generic WA Health material, and WA specialty services such as CAMHS.
- **Unclassified**: unknown authority, ambiguous identity, conflicting metadata, publisher aliases without compatible jurisdiction, or registry summaries. Registry summaries retain their separate identity and never inherit Official or Trusted provenance from linked or nearby authorities.

Authority must come from registered publisher codes or compatible canonical publisher/jurisdiction metadata. Arbitrary title, body, or extracted text claims do not establish source authority.
