# Sources Mode and Clinical Source Catalogue Design

**Status:** Approved design, written 2026-09-01 against `058693b97`.

## Outcome

Create a read-only **Sources** mode at `/sources` that catalogues every production academic or clinical information source used by the application. It organises sources by topic, publisher, location, status and quality; explains a deterministic ranking; retains every known usage location; and automatically incorporates future structured source references.

This feature does not search for new sources, edit source metadata, change RAG retrieval or ranking, copy source content, or claim that an unreviewed source is clinically accurate.

## Scope

Included sources are academic and clinical information authorities used by production content, including:

- uploaded or indexed clinical documents visible to the current user;
- structured references used by Dictionary, Therapy, Medication, Forms, Services, DSM, Specifiers, Formulation, calculators and other production clinical catalogues;
- legislation, regulatory material, guidelines, standards, systematic reviews, primary studies, professional references and approved link-only references; and
- incomplete or legacy source references, which remain visible as review-required rather than being omitted or automatically trusted.

Excluded from discovery are build documentation, developer documentation, tests, fixtures used only by tests, mockups, design references, package metadata, issue trackers and incidental URLs in prose that is not a production clinical source field.

## Information architecture

Sources is a namespace-isolated application mode with the visible label **Sources** and subtitle **Clinical source catalogue**.

| Route                 | Purpose                                                                         |
| --------------------- | ------------------------------------------------------------------------------- |
| `/sources`            | Ranked catalogue, summary counts, search, sorting and filters                   |
| `/sources/topics`     | Clinical topics with source counts and direct filtered catalogue links          |
| `/sources/publishers` | Publisher and authority coverage, grouped by jurisdiction                       |
| `/sources/method`     | Plain-language rating method, limitations and status definitions                |
| `/sources/[sourceId]` | One source's identity, locations, rating breakdown, status, versions and usages |

The secondary mode navigation is **Catalogue · Topics · Publishers · Method**. The mode reuses `app-modes.ts`, `RegistryModeNav`, the shared mode composer, the tools catalogue, universal navigation, information-page shells, responsive tokens and existing accessibility contracts. It does not create parallel navigation or search chrome.

`/dictionary/sources` redirects to `/sources?usedBy=dictionary`, preserving the existing entry point while making `/sources` the canonical catalogue.

## Catalogue contract

One canonical entry represents one distinct document or resource version. Entries are grouped by publisher; older, withdrawn and superseded versions are retained with explicit inactive or excluded status.

```ts
type ClinicalSourceCatalogueEntry = {
  id: string;
  title: string;
  version: string | null;
  publisher: string | null;
  publisherCode: string | null;
  sourceType: ClinicalSourceType;
  canonicalLocation: SourceCanonicalLocation;
  jurisdiction: SourceJurisdiction;
  topics: string[];
  publicationDate: string | null;
  reviewDate: string | null;
  expiryDate: string | null;
  documentStatus: "current" | "review_due" | "outdated" | "unknown";
  validationStatus: "approved" | "locally_reviewed" | "unverified" | "unknown";
  contentMode: "indexed_content" | "link_only" | "metadata_only";
  lifecycleStatus: "active" | "inactive" | "excluded";
  supersedes: string[];
  supersededBy: string[];
  usedBy: SourceUsage[];
  rating: ClinicalSourceRating;
  warnings: SourceCatalogueWarning[];
};
```

The three source locations are all retained and shown:

1. **Canonical location:** allowlisted HTTPS URL, accessible document route, or structured dataset identity.
2. **Geographic location:** WA/local, Australian national, another Australian state, international or unknown.
3. **Application location:** every clinical mode, record or dataset that uses the source.

Private source entries obey the same owner/public visibility rules as their documents. The catalogue must not expose inaccessible private document titles, metadata, counts or usage relationships.

## Identity and deduplication

Identity is deterministic and conservative:

1. an existing stable document or source ID is preferred;
2. otherwise use a canonical URL plus explicit version;
3. otherwise use publisher, normalised title and explicit version;
4. otherwise retain the normalised reference text as a provisional review-required identity.

Aliases and repeated citations resolve to one canonical entry. `usedBy` retains every occurrence. Conflicting publishers, jurisdictions or versions do not merge; they produce separate entries and a warning.

Titles, filenames and source prose cannot grant authority. Authority comes only from existing structured publisher metadata or the canonical authority registry.

## Rating and ranking

The catalogue ranking is organisational only and never enters RAG retrieval, answer generation or clinical decision ranking.

Every entry exposes six deterministic dimensions totalling 100 points:

| Dimension                | Weight | Meaning                                                                           |
| ------------------------ | -----: | --------------------------------------------------------------------------------- |
| Accuracy assurance       |     25 | Evidence that the source version was reviewed, validated or explicitly checked    |
| Reliability              |     20 | Publisher authority, provenance and independence                                  |
| Evidence quality         |     20 | Guideline, systematic review, study, standard, professional review or weaker type |
| Currency                 |     15 | Publication, review, expiry and supersession state                                |
| Australian applicability |     15 | WA/local, Australian national, other Australian jurisdiction or international     |
| Traceability             |      5 | Identity, version, date, canonical location and usage completeness                |

User-facing bands are:

- **A · Preferred:** 85–100
- **B · Strong:** 70–84
- **C · Supplementary:** 50–69
- **D · Review required:** below 50, or any material identity/verification uncertainty
- **Excluded:** rejected, decommissioned, forbidden, withdrawn, or superseded by an identified current replacement

Hard exclusions run before the score. A high location or authority score cannot rescue an excluded source. Australian applicability is bounded: equally credible Australian sources are preferred, but weak Australian material does not automatically outrank substantially stronger international evidence.

The interface leads with the band and dimension explanations, not a percentage. A numeric score is secondary and exists to make sorting reproducible. The label is **Accuracy assurance**, never a claim that software measured factual truth.

Missing fields remain `unknown`. The catalogue never invents publisher, location, currency, evidence type or approval from prose. Newly discovered incomplete sources appear automatically as **D · Review required**, unless an existing governance rule requires exclusion.

## Automatic future coverage

The automatic system has three layers:

1. **Typed reference contract.** New structured production clinical information uses one `ClinicalSourceReferenceInput` shape for source ID, title, publisher, URL/document ID, version, dates, jurisdiction, evidence type and usage context.
2. **Adapters for existing sources.** Narrow adapters project current repository datasets and accessible Supabase document metadata into the same input. Free-text legacy references are preserved as provisional entries rather than parsed into invented citations.
3. **Coverage enforcement.** A focused repository check inventories recognised production source-bearing paths, validates every structured reference, rejects dangling source IDs, and reports provisional or incomplete entries. Known source-bearing schemas cannot add a new source field without an adapter or an explicit exclusion reason.

The catalogue is a generated view over existing source ownership, not a second manually maintained master file. Adding or changing upstream structured source metadata therefore changes the catalogue and rating automatically. No in-app catalogue editor is included.

The check distinguishes:

- **failure:** a structured production source reference cannot be normalised, has an unsafe location, or bypasses a registered source-bearing contract;
- **review debt:** a source is captured but publisher, version, dates, jurisdiction, evidence type or validation remains unknown; and
- **excluded scope:** tests, mockups, developer docs and non-clinical build references.

## Supabase document projection

The Sources mode consumes metadata only for documents visible to the current user, using the configured runtime Supabase project and existing RLS/owner-public scope. It does not require a new table or migration.

Allowed projection fields are limited to document identity, safe title/file name, accessible source route, source metadata, status, dates and safe clinical labels needed for catalogue topics. Document text, chunks, embeddings, summaries, generated answers, queries, user identifiers, storage paths and patient data are excluded.

When Supabase is unavailable, the repository catalogue remains available and the interface truthfully labels the hosted-document portion unavailable. It does not present a partial result as complete.

## Interface behaviour

### Catalogue

- Default sort: quality band, score, Australian applicability, currency, then title.
- Search: title, publisher, aliases and topics.
- Filters: band, jurisdiction, source type, publisher, topic, lifecycle status, currentness, validation and application usage.
- Desktop: dense accessible table/list with explicit column labels.
- Phone: stacked source rows with the same information hierarchy and 48px controls.
- Counts distinguish all visible sources, Australian sources, review-required sources and excluded/inactive sources.

### Topics and publishers

These are derived views, not manually maintained collections. Topics come from existing structured source labels and the clinical records in `usedBy`. Publishers use the canonical authority registry when recognized and remain unclassified when ambiguous.

### Source details

The detail page shows identity, three locations, rating explanations, warnings, dates, lifecycle, content mode, version relationships and usages. It links to the canonical location only when access is permitted. It does not reproduce source excerpts or document content.

### Method

The method page publishes the weights, bands, hard exclusions, Australian preference, missing-data behavior and limitations. It explicitly states that catalogue quality is not query relevance, patient-specific guidance, specialist sign-off or RAG ranking.

## Accessibility and responsive behaviour

- Reuse existing shared mode and information-page navigation owners.
- Preserve one shared composer and one phone header collapse owner.
- Every filter, sort and source action has an accessible name and keyboard path.
- Bands and warnings use text and icons as well as colour.
- Search/filter result counts use restrained live-region updates.
- Verify phone and desktop layouts, keyboard navigation, focus, reduced motion and forced colours.

## Error and degraded states

- Missing metadata: captured as review debt with exact field reasons.
- Ambiguous identity: separate provisional source; never silently merge.
- Unsafe or malformed URL: no outbound link; review warning.
- Supabase unavailable: repository sources remain, hosted source coverage is labelled unavailable.
- Access denied: source is absent without leaking its identity or aggregate count.
- Empty filtered state: preserve filters and offer a clear reset.

## Verification

The smallest credible evidence includes:

- unit tests for normalisation, identity, deduplication, score dimensions, bands, hard exclusions, Australian ordering and missing metadata;
- adapter and coverage tests for recognised production source-bearing datasets;
- access-projection tests proving private source metadata is not leaked;
- mode, navigation, redirect and route-reachability contracts;
- DOM tests for search, filters, sorting, method explanations and accessible band/warning labels;
- focused browser proof for `/sources`, a source detail, phone/desktop overflow, keyboard access, reduced motion and forced colours; and
- the existing source-governance audit where its fixtures cover the changed metadata behavior.

No provider evaluation or live RAG canary is required because retrieval and answer behavior remain unchanged. A metadata-only hosted read can verify integration after local behavior passes, but local fixtures remain the repeatable contract.

## Delivery boundaries

- No database migration or new Supabase table.
- No writes to hosted source metadata.
- No source-content ingestion or new-source internet research.
- No in-app editor, approval workflow or analytics dashboard.
- No RAG score, retrieval, prompt, citation or answer-generation change.
- No deployment, push or pull request without separate authorization.
