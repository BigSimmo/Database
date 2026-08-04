---
name: skills
description: List every unique Database-specific skill with a clear explanation, hide compatibility aliases, and recommend the smallest useful set for the current request. Use when the user asks what skills exist, what they do, or which workflow to choose.
---

# Skills

1. Run `npm run skills` so the validated catalog, not chat memory, is authoritative.
2. Present every canonical skill exactly once under its catalog category with its plain-language purpose.
3. Do not count compatibility aliases as unique skills. Mention an alias only when it helps the user migrate an older command.
4. Recommend the smallest high-yield set for the current request and explain the order in one sentence.
5. Run `npm run check:skills` when catalog integrity is part of the task.
6. Never execute another skill merely because it was listed; follow the normal scope and approval rules.
