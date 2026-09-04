# Sources mode extraction prompt

Copy the prompt below and send it together with a batch of documents (PDFs, guideline pages,
policy documents, uploaded references). It returns one record per source in the same fields,
vocabularies and rules the Sources catalogue uses (`src/lib/sources/catalogue-types.ts`,
`src/lib/sources/catalogue-core.ts`, `src/lib/source-authority-registry.ts`), so the output can
be checked against `/sources/search` filters or pasted into a source registration task without
translation.

What the prompt deliberately does not do:

- It never marks a source `approved` or `locally_reviewed`. Clinical validation is a human
  decision, so every extracted record is `unverified` until a clinician reviews it.
- It never invents dates, versions, publishers or URLs. Missing is recorded as `unknown` or left
  empty, which is exactly what the catalogue's warnings expect.
- The quality band it produces is labelled provisional. The catalogue recomputes the band from
  the stored metadata, so the prompt's band is a triage aid, not the rating of record.

## Prompt

```text
You are helping build the Sources catalogue of PsychSift, a private clinical reference
knowledge base for a psychiatrist in Perth, Western Australia. I am sending you a batch of
documents. Extract every clinical source they contain and organise the results using the exact
fields, vocabularies and rules below. Australian spelling throughout.

WHAT COUNTS AS A SOURCE

1. Each document I send is a primary source. Create one record for it.
2. Any guideline, standard, legislation, regulation, systematic review, study or reference that
   a document cites, adopts, adapts or says it is based on is a secondary source. Create one
   record for each, and name the document that cited it. Skip in-text citations that are only
   passing mentions with no identifying detail.
3. If the same source appears in more than one document, produce one record and list every
   citing document. Treat two references as the same source only when title, publisher and
   version agree or one is clearly an alias of the other. If they disagree, keep separate
   records and add the warning metadata_conflict.

RULES OF EVIDENCE

- Take metadata only from what is printed in the document (cover page, footer, version block,
  citation list, references, document control table). Never infer a publisher, version, date or
  jurisdiction from a filename, a URL path or general knowledge.
- Never guess. A field you cannot support from the document is "unknown" (for enumerated
  fields) or null (for free text and dates).
- Dates must be complete ISO dates in the form YYYY-MM-DD. If only month and year are printed,
  leave the date null and put the printed form in notes.
- Canonical URL must be an https address printed in or on the document. Do not construct one.
- Do not rate clinical accuracy. clinical_validation_status is always "unverified" for every
  record because clinical validation is a human decision made later.

FIELDS FOR EVERY RECORD

record_kind: primary or secondary
source_id: a short stable slug you assign (publisher-title-version, lowercase, hyphens)
title: the full printed title
aliases: other names, abbreviations or short titles used for the same source
publisher: the issuing body as printed
publisher_code: one of the recognised codes below, or null if the publisher is not listed.
  Never assign a code to a body that is not on the list.
jurisdiction: use one of these printed forms exactly
  Australia/WA | Australia/National | Australia/NSW | Australia/VIC | Australia/QLD |
  Australia/SA | Australia/TAS | Australia/ACT | Australia/NT | International | Unknown
geography_scope: wa | australian_national | australian_state | international | unknown
source_type: guideline | systematic_review | primary_study | standard | legislation |
  regulatory | professional_reference | consumer_reference | uploaded_document | dataset |
  other | unknown
version: the version, edition or revision label as printed, else null
publication_date: YYYY-MM-DD or null
review_date: the date of last review as printed, YYYY-MM-DD or null
expiry_date: the next review due or expiry date as printed, YYYY-MM-DD or null
document_status: current | review_due | outdated | unknown
  current only if the document states it is within its review period or gives a next review
  date that is still in the future. review_due if it states review is due. outdated if the
  printed expiry or next review date has passed or it is marked withdrawn, rescinded or
  superseded. Otherwise unknown.
clinical_validation_status: unverified (always)
content_mode: indexed_content for a document I sent in full, link_only for a cited source
  with a printed https URL, metadata_only for anything else
lifecycle_status: active | inactive | excluded
  excluded if a replacement is identified in superseded_by, or the document is withdrawn.
supersedes: titles or ids of earlier versions this source replaces, else empty list
superseded_by: titles or ids of the source that replaces this one, else empty list
canonical_url: https URL as printed, else null
topics: two to five plain clinical topic tags in lowercase, for example
  "clozapine", "lithium monitoring", "mental health act", "eating disorders",
  "perinatal", "child and adolescent", "risk assessment", "electroconvulsive therapy"
used_by_document: for secondary sources, the title of each citing document; for primary
  sources, null
warnings: any of ambiguous_identity | metadata_conflict | unsafe_location | invalid_date |
  missing_publisher | missing_version | missing_dates | unknown_jurisdiction |
  unknown_evidence_type | verification_unknown | outdated | superseded
  Apply the rule literally. Every record carries verification_unknown. A record with no
  version carries missing_version. A record with no publication, review or expiry date
  carries missing_dates. Unknown jurisdiction carries unknown_jurisdiction. A URL that is not
  https carries unsafe_location.
provisional_band: A | B | C | D | excluded, computed with the scoring below
notes: printed facts that did not fit a field, for example "Version 3, June 2024" when the
  day is not printed, or the page where the document control table appears

RECOGNISED PUBLISHER CODES (assign only when the printed publisher matches)

Western Australia (geography_scope wa)
  WAHEALTH  WA Health, WA Department of Health
  OCPWA     Office of the Chief Psychiatrist WA
  AKG       Armadale Kalamunda Group
  CAHS      Child and Adolescent Health Service, Perth Children's Hospital
  CAMHS     Child and Adolescent Mental Health Service
  EMHS      East Metropolitan Health Service
  FSFHG     Fiona Stanley Fremantle Hospitals Group
  KEMH      King Edward Memorial Hospital
  NMHS      North Metropolitan Health Service
  PHC       Peel Health Campus
  RKPG      Rockingham Peel Group
  RPBG      Royal Perth Bentley Group
  SMHS      South Metropolitan Health Service
  WACHS     WA Country Health Service
Australian national (geography_scope australian_national)
  ACSQHC    Australian Commission on Safety and Quality in Health Care
  AUSDOH    Australian Government Department of Health and Aged Care
  NHMRC     National Health and Medical Research Council
  NPS       NPS MedicineWise
  PBS       Pharmaceutical Benefits Scheme
  RACGP     Royal Australian College of General Practitioners
  RANZCP    Royal Australian and New Zealand College of Psychiatrists
  TGA       Therapeutic Goods Administration
Australian state (geography_scope australian_state)
  ACTHEALTH NSWHEALTH NTHEALTH QLDHEALTH SAHEALTH TASHEALTH VICHEALTH
International (geography_scope international)
  BMJ       BMJ Best Practice
  NICE      National Institute for Health and Care Excellence
  WHO       World Health Organization

Any other publisher (for example a journal, a university, Black Dog Institute, Beyond Blue,
Maudsley, APA) gets publisher_code null and geography_scope from its printed jurisdiction.

PROVISIONAL BAND SCORING (score out of 100, then band)

accuracy_assurance (max 25): always 5, because every record is unverified
reliability (max 20): 20 if the publisher_code is a WA hospital or health service network
  (AKG, CAHS, EMHS, FSFHG, KEMH, NMHS, PHC, RKPG, RPBG, SMHS, WACHS); 16 for any other
  recognised code; 8 if the publisher is printed but not on the list; 0 if no publisher
evidence_quality (max 20): guideline, standard, legislation, regulatory 20;
  systematic_review 18; primary_study 14; professional_reference 12; consumer_reference 8;
  uploaded_document, dataset 6; other 4; unknown 0
currency (max 15): current 15; review_due 8; unknown 4; outdated 0
australian_applicability (max 15): wa 15; australian_national 13; australian_state 11;
  international 6; unknown 0
traceability (max 5): one point each for a stable identity (publisher plus title, or a URL),
  a version, at least one date, a canonical location, and a named citing document or a
  document I supplied

Band: excluded if lifecycle_status is excluded. Otherwise D if score is below 50 or any of
these warnings is present: ambiguous_identity, metadata_conflict, unsafe_location,
invalid_date, missing_publisher, missing_version, missing_dates, unknown_jurisdiction,
unknown_evidence_type, verification_unknown. Otherwise A at 85 or above, B at 70 to 84, C
below 70.

Because every record is unverified, expect most bands to be D. That is correct. State the
score and the reason for the band so I can see what a clinician review would lift.

OUTPUT FORMAT, IN THIS ORDER

Section 1. Summary table, one row per record, sorted by provisional score descending then
title. Columns: title, publisher, publisher_code, jurisdiction, source_type, version,
publication_date, review_date, expiry_date, document_status, lifecycle_status,
provisional_band, score, warnings.

Section 2. Full records as a JSON array using the field names above, one object per source.
Use null for unknown free text and dates, empty arrays for empty lists.

Section 3. Organised views, each a short list of titles with band in brackets
  a. By quality band: A, B, C, D, excluded
  b. By jurisdiction scope: wa, australian_national, australian_state, international,
     unknown
  c. By source type
  d. By publisher, grouped under its jurisdiction scope
  e. By topic, each topic listing its sources
  f. By currency: current, review_due, outdated, unknown
  g. By lifecycle: active, inactive, excluded
  h. Secondary sources by citing document

Section 4. Review queue. List every record whose metadata a clinician must confirm before it
can be registered, in this order: metadata_conflict or ambiguous_identity first, then
missing_publisher, then missing_dates, then unknown_jurisdiction, then everything else.
For each, name the exact field and where in the document you looked.

Section 5. Anything you could not process, with the reason, for example scanned pages you
could not read, a document with no identifying front matter, or a reference list you could
not separate into individual sources.

Do not add commentary on clinical content. Do not summarise the documents. Only extract,
classify and organise.
```

## After the prompt returns

- Register or update the source only after checking the printed metadata yourself. The
  `clinical_validation_status` stays `unverified` until you decide otherwise.
- The catalogue recomputes the band, warnings and lifecycle from the stored fields, so any
  disagreement between the prompt's band and the catalogue's is expected and the catalogue wins.
- `topics` here are free text. The Topics page groups whatever topic strings a record carries,
  so keep the tags short and reuse existing ones where a matching topic already appears at
  `/sources/topics`.
