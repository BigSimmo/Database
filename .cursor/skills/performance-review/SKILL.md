---
name: performance-review
description: Reviews model latency/cost, cache policies, duplicate query coalescing, and heavy asset load performance. Use during optimization or profiling.
---

# Performance Review Skill

Use this skill when reviewing query bottlenecks, database RPC latencies, client bundle sizes, or API cost overhead.

## Review Checklist

### 1. Database & API Latency

- **Query Caching:** Verify that repetitive/expensive database fetches and RAG queries leverage caching layers (e.g. `rag_response_cache`).
- **Index Optimization:** Ensure queries leverage appropriate indices (e.g., trigram/lexical text indexes, vector HNSW).

### 2. LLM & Asset Loading

- **Token Overhead:** Check that prompt sizes and context window limits are optimized to keep API costs down.
- **Resource Streaming:** Ensure heavy document rendering, search lists, and PDF asset previews load incrementally or use lazy-loading controls.
