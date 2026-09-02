# Services Safety and Provenance Foundation — Design

**Date:** 2026-09-01  
**Repository base:** `058693b9734bb273c6f88c574e30820803140ba5`  
**Scope:** Services mode only

## Problem

The Services mode has a useful 219-record WA catalogue, but the source package itself records 145 services as needing verification. The runtime model also conflates confidence with verification, turns evidence URLs into generic contact websites, lacks active/planned/closed lifecycle states, and currently injects the rejection criterion `Non-crisis routine referral only` into every `crisis_high` service.

## Approved design

1. Preserve all legacy records.
2. Overlay 88 current, source-checked WA pathways from the 2026-08-23 canonical review.
3. Quarantine unmatched legacy records as `legacy_unverified` and `availability=unknown` rather than deleting them.
4. Append verified new services that did not exist in the May 2026 snapshot.
5. Keep service websites separate from evidence sources.
6. Persist lifecycle, source, review and claim metadata through the registry JSON payload.
7. Use deterministic urgent routing before ordinary text relevance for high-risk queries.
8. Keep broad browse groups while adding explicit specialist and availability facets.
9. Never present planned, closed, superseded or temporarily unavailable services as active referrals.
10. Keep authoritative-source review separate from local clinical approval.

## Data model

Each governed record carries:

- stable service ID and aliases
- presentation tier
- availability lifecycle and note
- jurisdiction, catchment and population
- best use and explicit `notFor`
- structured referral routes and required documents
- structured contacts and hours
- service website
- evidence sources with issuer, source class, date, URL and access date
- verification status, last verified and next review
- specialist groups and urgent-route intents
- supersession and unresolved issues
- claim-level provenance generated for availability, contact, hours, catchment, population and best use

## Ranking

Urgent routing injects explicit service IDs for:

- immediate medical danger
- general metropolitan mental-health crisis
- child/youth crisis
- regional/remote crisis
- Aboriginal crisis support
- suicide crisis
- urgent AOD support
- after-hours homelessness
- family/domestic violence
- recent sexual assault

The urgent route is ranked before semantic relevance. Active verified services receive a modest quality bonus. Unknown legacy content is penalised. Planned, unavailable, superseded and closed services receive progressively larger penalties and visible warnings.

## Compatibility

The original `loadServicesSnapshot()` remains the 219-record historical package for audit and legacy tests. `loadGovernedServicesSnapshot()` is the live catalogue used by default registry fixtures. New facet dimensions are optional in `ServiceFacetSelection`, preserving existing callers and stored URLs.

## Non-goals

- no deployment
- no database schema migration
- no claim that web verification equals local telephone confirmation
- no automatic approval of clinical content
- no removal of legacy records
