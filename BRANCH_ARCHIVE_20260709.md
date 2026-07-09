# Obsolete Branch Archive

This branch preserves the histories of obsolete remote branches before deleting
their scattered refs. The archive merge used Git's `ours` strategy, so this
branch intentionally keeps the current `origin/main` tree while retaining the
listed branch tips as merge parents for recovery.

Archived on 2026-07-09.

Preserved branch tips:

- `origin/claude/ingestion-r24e-stage-fk` -> `a69f09353a44` - chore: trigger CI after prettier fix
- `origin/codex/organize-local-commits` -> `eb8454bfe395` - ci: add image-generation remediation workflow
- `origin/codex/review-throttling-protocol` -> `7024ab977bef` - fix: soft-skip Codex auto-resolve on comment read 403
- `origin/copilot/fix-ci-issue` -> `6c3aacb1bc9d` - Fix Prettier formatting violations
- `origin/copilot/fix-ci-issue-again` -> `9b81894e8b0d` - test(ui): make mode-options smoke assertion mode-agnostic
- `origin/copilot/fix-issue` -> `b411cfbe29df` - fix: run prettier on 6 files failing format check
- `origin/copilot/fix-issue-85246278525` -> `02b785edb234` - Fix: close evidence sheet on follow-up quote to unblock focus trap
- `origin/copilot/fix-issue-again` -> `8df76c9ab385` - merge: apply Supabase Preview migration fix
- `origin/cursor/access-hardening-f048` -> `be3f8e586477` - docs(governance): record public and anonymous API access verification
- `origin/cursor/auto-hide-support-chips-1eb5` -> `24f4cd1c1e23` - Auto-hide answer support chips when content sits below on mobile
- `origin/cursor/ci-boot-smoke-hash-secret-57ce` -> `c8e7baf9bf71` - style: run Prettier on deployment-boot-smoke.mjs
- `origin/cursor/consolidated-platform-fixes-d6c9` -> `6cd0ebda314f` - style: format CI-flagged sources after main sync
- `origin/cursor/content-access-review-a385` -> `d9c9084c3d80` - fix(access): complete public retrieval scope and production access hardening
- `origin/cursor/deploy-production-access-c40b` -> `f67dcd07fb5b` - chore: ignore medications snapshot gitleaks false positives for main deploy
- `origin/cursor/fix-audit-p0-b54f` -> `d8d43301311d` - fix: clear merge markers and align tests with local upload guard
- `origin/cursor/fix-deploy-smoke-query-hash-b681` -> `4b00637eba20` - ci: retrigger checks after Codex feedback fix
- `origin/cursor/merge-access-to-main-5c94` -> `b3cbb48b67df` - style: format access rollout files for CI
- `origin/cursor/mobile-ui-fixes-d6c9` -> `d02885980f11` - merge: sync mobile-ui-fixes with main and resolve launcher/test conflicts
- `origin/cursor/outstanding-fixes-f048` -> `8888f5b0cf98` - fix(access): complete forms fallback, signed-url hardening, upload guard
- `origin/cursor/pr433-comment-fixes-5746` -> `255ca676868b` - fix: address follow-up PR 433 review comments
- `origin/cursor/public-corpus-promotion-d970` -> `5b0cfcb11129` - feat: add public corpus promotion and retrieval-owner verification scripts
