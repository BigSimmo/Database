---
name: choose-model
description: Recommends which Claude model (Opus 4.8, Sonnet 5, Haiku 4.5, Fable 5) and what effort/reasoning level to use for an upcoming task, by weighing complexity, error cost, ambiguity, scope, latency/cost sensitivity, and creativity-vs-precision against each other. Use this whenever the user asks "which model should I use", "what model for this", wants help picking a model/effort before running something, is about to switch models via /model, or is about to delegate work to a subagent via the Agent tool and needs a model/effort recommendation first. Also trigger on softer phrasing like "is this overkill for Opus", "can Haiku handle this", or "how much reasoning effort does this need" — don't wait for the word "model" specifically.
---

# Choose Model

Recommend a model + effort level for a task the user describes, by explicitly trading off the factors that pull in different directions — instead of defaulting to "use the biggest model to be safe."

## When invoked

The user gives a task description as the argument — sometimes a single sentence, sometimes a longer brief. If no task description is given (bare `/choose-model` with nothing to go on), ask one brief clarifying question about what the task actually is rather than guessing.

## The lineup

- **Opus 4.8** (`claude-opus-4-8`) — deepest reasoning, highest cost/latency. Reserve for genuine complexity or high stakes.
- **Sonnet 5** (`claude-sonnet-5`) — the default workhorse. Strong reasoning at moderate cost; right for most substantive coding and analysis tasks.
- **Haiku 4.5** (`claude-haiku-4-5-20251001`) — fast and cheap. Right for mechanical, well-specified, low-stakes work, or high-volume/repeated calls where speed compounds.
- **Fable 5** (`claude-fable-5`) — tuned for creative/narrative/conversational output rather than precise technical execution.

If exact model IDs or pricing may have drifted, the `claude-api` skill is the source of truth — consult it rather than trusting a hardcoded number here.

"Effort" means whatever lever is actually in play for the context: the `reasoning_effort` parameter on an Agent subagent call, an extended-thinking/fast-mode toggle in an interactive session, or an explicit effort flag on a skill that supports one (e.g. `low`/`medium`/`high`/`max` on `code-review`). Recommend it as a level (low/medium/high) and let the user map it to whichever mechanism applies.

## The rubric

Don't score every factor out loud every time — read the task, note which factors actually matter for *this* task, and let those drive the call. The factors, and which way each one pushes:

- **Complexity / reasoning depth** — multi-step logic, architectural tradeoffs, non-obvious bugs, math/algorithmic work → pushes toward Opus. Mechanical, single-step, well-trodden work → pushes toward Haiku.
- **Error cost / correctness sensitivity** — production data migrations, security-sensitive code, clinical/compliance-sensitive output, anything hard to reverse → pushes up the model tier even if the task itself looks simple, because the cost of a wrong answer dominates the cost of the call. Throwaway drafts, exploration, easily-reverted edits → pushes down.
- **Ambiguity** — requirements that need inference, judgment calls, or filling gaps → pushes up (a bigger model makes better judgment calls). A precisely specified instruction → pushes down, since there's little judgment left to exercise.
- **Scope / token volume** — large multi-file refactors or long-context synthesis benefit from Opus's reasoning over that volume; a small single-file edit or short answer doesn't need it.
- **Latency / cost sensitivity** — a tight interactive loop or many small repeated calls (e.g. batch-classifying items, parallel subagent fan-out) makes the cheaper/faster model's savings compound; a one-shot deep task makes quality dominate cost.
- **Creativity vs precision** — open-ended generation, tone, narrative → consider Fable. Deterministic, verifiable, technical output → Sonnet or Opus, never Fable.

These factors often conflict (e.g. "high scope, low error cost" or "high ambiguity, latency-sensitive batch job"). When they do, say which factor won and why — that's the useful part of the recommendation, not the raw list.

## Defaults, so you're not starting from scratch each time

| Task shape | Model | Effort |
|---|---|---|
| Rename, formatting, boilerplate, single well-specified small edit | Haiku 4.5 | low |
| Typical feature implementation or bug fix with a clear repro | Sonnet 5 | medium |
| Ambiguous requirements needing real judgment, multi-file refactor, non-obvious bug | Sonnet 5 or Opus 4.8 | medium–high |
| Security-sensitive, production-data, or clinical/compliance-sensitive work | Opus 4.8 (even if the task itself looks small) | high |
| High-volume repeated/parallel subagent calls over independent items | Haiku 4.5 | low–medium |
| Creative writing, narrative, conversational tone work | Fable 5 | — |

Treat this table as a prior, not a lookup — let the specific task override it when the factors point elsewhere.

## Output format

Keep it short:

```
Model: <model> · Effort: <level>
- <deciding factor 1, one line>
- <deciding factor 2, one line>
- <optional 3rd/4th factor, only if it actually mattered>
```

Only name the factors that actually drove the call — not a rote restatement of all six every time. If the task is a toss-up between two reasonable choices, say so in one line and pick the cheaper option (favor cost/latency when stakes are genuinely tied).
