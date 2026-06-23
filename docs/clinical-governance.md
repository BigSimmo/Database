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
