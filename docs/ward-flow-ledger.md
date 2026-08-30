# Ward Flow ledger — where it lives

The Ward Flow register of record is **not** in this branch. It lives at:

```
claude/Ward-design:docs/ward-flow-ledger.md
```

Read it with:

```bash
git show claude/Ward-design:docs/ward-flow-ledger.md
```

## Why this is a pointer and not a copy

The register is owned by one session, on one branch, and it must stay that way.
A copy here would be a second register: two files claiming to record the same
decisions, edited by different sessions, drifting apart with nothing to catch it.
That is the exact failure the single-owner split exists to prevent.

A pointer is "write it in one place" in a form a reader on this branch can still
follow, and it cannot go stale, because it carries no decisions to go stale.

**Do not paste ledger content into this file.** If you need a ruling while
working here, read it at the address above and cite it by its namespaced id.
