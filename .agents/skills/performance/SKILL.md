---
name: performance
description: Profile Database query, retrieval, rendering, bundle, worker, queue, memory, and capacity bottlenecks with reproducible local evidence. Use for latency, throughput, resource, scaling, or bundle-budget work.
---

# Performance

1. Define the user-visible metric, baseline, workload, environment, and target before optimizing.
2. Use deterministic local fixtures and existing profiling or budget tools first.
3. Isolate CPU, memory, I/O, query, network, bundle, rendering, concurrency, and cache effects.
4. Make one scoped change at a time and compare before/after distributions, not a single run.
5. Keep live query profiling, provider latency, production traffic, and external load tests approval-gated.
6. Report methodology, variance, improvement, tradeoffs, and remaining capacity risk.
