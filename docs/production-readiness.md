# PsychSift Production Readiness & Operational Release Requirements

**Canonical checklist**: [`docs/production-readiness-checklist.md`](production-readiness-checklist.md).
**Privacy authority register**: [`docs/governance/privacy-readiness.v1.json`](governance/privacy-readiness.v1.json).

## Operational Release Gate Mechanics

The production preflight command:

```bash
npm run check:production-readiness
```

is composed of two consecutive verification steps:

1. `npm run check:privacy-readiness:release` — executes `node scripts/check-privacy-readiness.mjs --release` (the script only recognizes `--release`; `--mode=release` is ignored and runs structural mode).
2. `node scripts/run-tsx.mjs scripts/production-readiness.ts` — validates local environment configuration, Supabase target checks, and secret presence.

### Fail-Closed Invariant

In release mode (`--release`), `scripts/check-privacy-readiness.mjs` enforces that every requirement in `docs/governance/privacy-readiness.v1.json` has reached either `"verified"` or `"accepted_decision"` status:

```js
if (release && !["verified", "accepted_decision"].includes(item.status)) {
  errors.push(`${label}: release-blocking status ${item.status}`);
}
```

If any requirement remains `pending` or `partial`, the check exits with code 1 (`PRIVACY_READINESS_FAIL mode=release`). **This fail-closed behavior is non-negotiable** and prevents releasing code before provider, legal, and operational gates are formally verified.

---

## Required Operational Actions Before Production Release

The following three operational actions are tracked in `docs/governance/privacy-readiness.v1.json` and must be executed by designated owners before release mode can pass:

### 1. OpenAI Zero Data Retention (ZDR) Agreement (`PRIV-PROVIDER-OPENAI-ZDR`)

- **Accountable Role**: OpenAI account owner.
- **Evidence Class**: Provider.
- **Current State**: Request submitted and acknowledged; interim controls disabled data sharing, API call logging, and extraneous platform tooling.
- **Release Invariant Requirement**:
  - Full formal execution of the enterprise Zero Data Retention agreement covering Responses, Embeddings, prompt caching, and audio transcription.
  - Verification that production API keys belong to the approved ZDR project.
  - External evidence reference recorded in the register and status transitioned to `"verified"`.

### 2. Railway Data Processing Agreement (DPA) (`PRIV-LEGAL-RAILWAY-DPA`)

- **Accountable Role**: Authorised legal signatory.
- **Evidence Class**: Legal.
- **Current State**: Pending formal execution.
- **Release Invariant Requirement**:
  - Executed Data Processing Agreement with Railway covering ephemeral compute, container execution, and Australian/cross-border data privacy standards.
  - Document reference recorded in `docs/governance/` before status is transitioned to `"verified"`.

### 3. Production HMAC Secret Rotation & Parity (`PRIV-PROVIDER-PRODUCTION-HMAC-SECRET`)

- **Accountable Role**: Production platform owner.
- **Evidence Class**: Provider.
- **Current State**: Partial (names-only parity check completed).
- **Release Invariant Requirement**:
  - High-entropy rotation (>= 32 bytes) of `DOCUMENT_SIGNED_URL_HMAC_SECRET`.
  - Confirmation across production Railway environment variables and GitHub repository secret environments via names-only parity checks (`scripts/check-env-parity.mjs`).
  - Production platform owner attestation recorded before transitioning to `"verified"`.

---

## Local vs. Hosted Verification Boundary

- **Offline / Local Verification**: Developers should run `npm run check:production-readiness:ci` or standard test suites (`npm test`) during routine development.
- **Release Candidates**: Must run `npm run check:production-readiness` with all provider and legal gates satisfied. Do NOT omit `--release` (or use an unrecognized flag such as `--mode=release`) to bypass release requirements.
