---
name: repo-auditor
description: Reviews module dependencies, broken imports, unused files, and structural cleanup. Use during repo-wide audits or refactoring.
---

# Repo Auditor Skill

Use this skill when auditing the workspace layout, folder structures, imports, and dependencies.

## Repository Review Protocol

Follow `AGENTS.md` review throttling and `docs/codex-review-protocol.md` before starting. Do not review opportunistically, do not mutate files during pure review, and update `docs/branch-review-ledger.md` after completed branch/PR reviews.

## Review Checklist

### 1. Structural Audits

- **Broken Imports:** Scan modified files for broken relative imports, incorrect library names, or obsolete modules.
- **Unused Files:** Identify and safely remove files that are truly dead and not part of route mappings, active scripts, migrations, or test resources.
- **Consolidation:** Check for identical or redundant configuration keys, environment variables, or scripts that can be safely merged.
