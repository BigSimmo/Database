---
name: operations
description: Turn pending Database operator, provisioning, configuration, and provider work into a deduplicated dependency-ordered batch with explicit approvals and evidence. Use for operator debt, manual runbooks, or deferred external actions.
---

# Operations

1. Run `npm run workflow:operator-closeout -- --write-evidence`.
2. Inventory pending actions from docs, evidence, logs, and current change without executing them.
3. Deduplicate by outcome and order prerequisites, local proof, approval, execution, verification, and rollback.
4. Separate local/offline actions from GitHub, Supabase, OpenAI, hosting, credentials, and production work.
5. Ask for approval only when the batch is precise enough to execute safely.
6. Record owner, command, expected result, evidence, rollback, and unresolved dependency for each item.
