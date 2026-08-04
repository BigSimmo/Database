---
name: data
description: Validate Database imports, seeds, transformations, reconciliation, deduplication, integrity, provenance, and rollback controls. Use for dataset changes, bulk operations, registry content, or data migration logic.
---

# Data

1. Identify source format, trust level, schema, identifiers, ownership, transformations, and destination constraints.
2. Test malformed, missing, duplicate, conflicting, oversized, partial, and rerun inputs with local fixtures.
3. Check deterministic normalization, idempotency, transactions, reconciliation, provenance, and rollback.
4. Measure counts and invariants before and after local dry runs without exposing sensitive values.
5. Treat live imports, seeds, backfills, database writes, and production exports as approval-required.
6. Report accepted/rejected records, integrity proof, rollback, and remaining operator action.
