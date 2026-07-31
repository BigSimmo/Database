---
name: api
description: Review Database route and function contracts for validation, authentication, authorization, errors, retries, idempotency, compatibility, and safe provider boundaries. Use for API route, edge function, webhook, or public contract work.
---

# API

1. Identify callers, request schema, authentication, authorization, response contract, status codes, and side effects.
2. Test invalid, empty, oversized, duplicate, stale, unauthorized, timeout, retry, and dependency-failure cases.
3. Check stable error envelopes, cache behavior, rate assumptions, idempotency, and backwards compatibility.
4. Use route-unit tests and mocks locally; never send live requests without approval.
5. Verify secrets and privileged clients remain server-only.
6. Report contract changes, compatibility risk, focused proofs, and untested live integrations.
