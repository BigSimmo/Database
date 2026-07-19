---
name: operations
description: Turn pending Database operator, provisioning, configuration, and provider work into a deduplicated dependency-ordered batch with explicit approvals and evidence. Use for operator debt, manual runbooks, or deferred external actions.
---

# Operations

1. Inventory pending actions from docs, evidence, logs, and current change without executing them.
2. Deduplicate by outcome and order prerequisites, local proof, approval, execution, verification, and rollback.
3. Separate local/offline actions from GitHub, Supabase, OpenAI, hosting, credentials, and production work.
4. Ask for approval only when the batch is precise enough to execute safely.
5. After approval, run `npm run workflow:operator-closeout -- --write-evidence` and record owner, command, expected result, evidence, rollback, and unresolved dependency for each item.
