---
status: accepted
date: 2026-08-21
---

# Use a shared local-first orchestrator for Mode-aware Clinical Ask

Mode-aware Clinical Ask will extend the repository's one shared composer and governed answer surfaces through one local-first orchestration boundary. It will search the selected mode's catalogue, then indexed organisational evidence, and use approved external-authority evidence only for a remaining evidence gap. This preserves mode semantics, source traceability, and one privacy boundary while leaving ordinary catalogue Search and generic Answer behaviour intact.

## Considered options

- A voice shortcut into generic Answer was rejected because it discards the active mode's clinical purpose and output contract.
- Separate assistants inside each mode were rejected because they duplicate speech, privacy, retrieval, evidence, and rendering ownership.
- An autonomous cross-mode clinical agent was rejected because automatic routing and action would exceed the clinician-confirmed decision-support boundary.

## Consequences

All seven supported modes must define a typed Mode Answer Profile and use the same ephemeral Clinical Ask Session, evidence envelope, source-governance rules, and clinician-confirmed handoff contract. Provider-backed speech and external search remain server-only, metered, and independently fail-closed.
