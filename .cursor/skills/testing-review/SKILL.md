---
name: testing-review
description: Reviews unit/integration/E2E coverage, checks for fragile/flaky tests, asserts clinical safety checks, and reviews verification sequence. Use during test addition or refactoring.
---

# Testing Review Skill

Use this skill when reviewing test coverage, testing harnesses, and test execution paths (Vitest + Playwright).

## Repository Review Protocol

Follow `AGENTS.md` review throttling and `docs/codex-review-protocol.md` before starting. Do not review opportunistically, do not mutate files during pure review, and update `docs/branch-review-ledger.md` after completed branch/PR reviews.

## Review Checklist

### 1. Test Harness Coverage

- **Unit Tests:** Ensure new or modified utils, helper scripts, and backend libraries have corresponding Vitest unit tests (`*.test.ts`).
- **E2E/UI Tests:** Verify frontend routes and interactive components are covered by Playwright specs (`ui-*.spec.ts`).
- **Clinical Safety Assertions:** Check that tests verify critical safety boundaries, such as correct citation indexing, fallback behavior on weak RAG evidence, and tenant data isolation.

### 2. Flakiness & Mocking

- **Mocking External APIs:** Ensure test flows do not hit live external APIs (like OpenAI) directly. Mock these services with predictable fixtures.
- **Verification Gates:** Confirm the appropriate check level is used (`verify:cheap` for localized code changes, `verify:ui` for Chromium work, `verify:release` for comprehensive releases).
