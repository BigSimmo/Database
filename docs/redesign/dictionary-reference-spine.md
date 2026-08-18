# Dictionary Reference Spine

## Product goal

Dictionary is a source-governed psychiatric terminology reference. It supports rapid lookup, abbreviation resolution, governed topic discovery, term distinction and field-aligned comparison. It does not generate clinical synthesis or patient-specific guidance.

## Production routes

- `/dictionary` — shared mode home and in-flow composer.
- `/dictionary/search` — mixed definitions, grouped abbreviations and topic hits.
- `/dictionary/browse` — A–Z and abbreviation catalogue views.
- `/dictionary/topics` — governed clinical collections.
- `/dictionary/topics/[slug]` — searchable collection detail.
- `/dictionary/[slug]` — canonical definition and sources.
- `/dictionary/compare` — empty, partial, picker and populated comparison states.
- `/dictionary/sources` — source method, coverage, review and corrections.

## Visual grammar

The accepted Reference Spine is the primary system:

- open ruled lists, not card walls or responsive tables;
- a three-pixel categorical spine for definition, abbreviation and topic identity;
- definitions remain visually primary while badges, metadata and source state remain compact;
- clinical blue identifies canonical entries, violet abbreviations and teal topic collections;
- phone controls have a 48-pixel minimum target and preserve readable body type;
- definition pages use one prominent definition block, one quiet source summary and progressive disclosure below it;
- desktop rails hold contextual metadata only and never duplicate the primary reading canvas.

## Shared owners

Dictionary extends the existing app-mode, mode navigation, universal search, search shell, information-page, launcher, tools-catalogue and site-map registries. Search, Browse, Topic detail and Definition reuse the shared composer/header owners. `InPageNavHeader` and `PhoneHeaderCollapsePortal` are the only phone in-page header owner on definition and topic-detail routes.

## Content and governance

`src/lib/dictionary-data.ts` is the static governed catalogue. UI counts are derived from its records. Every published entry has direct HTTP(S) source references, a source-link date, a scheduled source review and internal `clinicalApproval: "pending"`. Source linking records which authoritative document a collection was built from; attribution is at collection level, is not verified sentence by sentence, and never claims specialist clinical approval.

Aliases may map to more than one canonical sense. ACT intentionally resolves to Acceptance and commitment therapy and Assertive community treatment. Curated relationship summaries appear only for explicitly sourced comparison pairs; arbitrary comparison aligns stored fields without interpretation.

## Responsive behaviour

- Search uses the shared submitted-search phone dock and never adds a second composer.
- Topic and definition pages portal their in-page header into the universal phone collapse row.
- Definition Meaning is expanded by default; other sections are 48-pixel disclosure rows on phone.
- Comparison stacks A and B within accordion sections on phone.
- Desktop-only columns and rails become disclosure content, never compressed phone tables.

## Safety statement

All catalogue copy is static and paraphrased from direct public authorities. The implementation makes no provider call, uses no patient data, reproduces no proprietary criteria or rating instrument, and retains the footer: reference terminology, not patient-specific guidance.
