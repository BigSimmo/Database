---
name: ai-architecture-review
description: Reviews RAG flows, context assembly, model routing, structured outputs, safety filters, provenance, fallbacks, evals, cost, and latency. Use during retrieval or answer generation changes.
---

# AI Architecture Review Skill

Use this skill when reviewing or modifying the RAG (Retrieval-Augmented Generation) pipeline, document retrieval, and LLM integrations.

## Review Checklist

### 1. Retrieval Quality & Provenance

- **Hybrid Search:** Confirm queries use proper hybrid search patterns (pgvector + semantic/trigram matching) and respect user/organization boundaries.
- **Provenance / Citations:** Ensure generated answers are strongly tied to source documents and include clean, traceable citation references.
- **Fail-Closed Policy:** If no relevant documents are retrieved or verification fails, the system must degrade gracefully or return a clear "No evidence found" response rather than hallucinating.

### 2. Model Routing & Timeout Logic

- **Routing Rules:** Check that routing between fast and strong models follows defined rules (e.g. `RAG_PROVIDER_MODE`).
- **Timeouts:** Ensure LLM calls are bounded by client and server-side timeouts (e.g., `OPENAI_ANSWER_TIMEOUT_MS`).

### 3. Structured Output & Safety

- **Schema Conformity:** Validate that LLM responses use strict schema structures (e.g., OpenAI structured JSON output) to prevent parsing errors.
- **Safety Filters:** Check that toxicity, safety filters, and prompt injection mitigations are active on user inputs and LLM outputs.
