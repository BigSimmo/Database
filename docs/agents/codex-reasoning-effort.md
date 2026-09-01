# Codex Reasoning Effort Calibration

<!-- BEGIN:reasoning-effort-calibration -->

# Reasoning effort calibration

**Repository baseline.** Use `gpt-5.6-sol` with `high` reasoning effort unless the user explicitly
chooses another supported model or effort. `.codex/config.toml` records this default for trusted
Codex clients that honor repository configuration; a task-level selection can override it.

**Cloud xhigh gate.** A running Cloud task cannot raise its own reasoning effort. Before substantive
inspection, planning, tool use, or edits, classify the request against the table and the risk rules
below. If `xhigh` is required and the prompt does not contain the exact marker `[xhigh-confirmed]`,
stop and ask the user to select `xhigh` in the Cloud reasoning control, then resubmit the same request
with `[xhigh-confirmed]`. Do not begin the work at `high`, and do not claim the runtime changed. When
the marker is present, treat it as the user's confirmation that `xhigh` was selected and proceed.
Requests classified as `high` or lower proceed without this gate.

Reasoning effort is a budget in the same way verification is a budget, and it is misspent the same
way — by defaulting to the maximum instead of matching the spend to the risk. **Scale effort to how
expensive the mistake is to undo (irreversibility × branching factor), never to the phase label.**
"Plan high, build lower" is a good default, not a rule; it is wrong often enough that it must be
chosen deliberately rather than assumed.

**Why it is a good default.** Planning errors compound and implementation errors stay local: a wrong
approach throws away the build, a wrong identifier is one edit. A plan is also a few thousand output
tokens against a build's many long turns, so effort is cheapest exactly where it has the most leverage.

**The mechanism that makes it work — do not skip this part.** A lower-effort build only succeeds
against a plan concrete enough to execute: named files, named symbols, ordered steps, and the gate
that will prove it. Downgrading the build against a vague plan does not save effort, it relocates the
thinking into the expensive phase. If the plan cannot name those things, the build is not eligible for
the downgrade.

| Situation                                                                                      | Plan        | Build       |
| ---------------------------------------------------------------------------------------------- | ----------- | ----------- |
| Architecture, Supabase migrations/RLS, RAG ranking surfaces, auth/privacy, ingestion contracts | xhigh       | high        |
| Ordinary feature or UI work with a clear shape                                                 | high        | medium–high |
| Mechanical and fully specified — ledger append, docs edit, rename (not dependency maintenance) | low or skip | medium      |
| Debugging an unknown failure                                                                   | low         | high        |

**Where the default inverts and the build needs more than the plan.** These are plan-light and
execution-heavy; treating them as plan-heavy spends the budget in the wrong place:

- **Debugging.** The plan is "find why X fails." The real reasoning is hypothesis-forming over local
  runtime, logs, and repro state during the build — hosted providers still need explicit confirmation.
- **Constraint-dense implementation.** A one-sentence plan whose edit must simultaneously satisfy
  button wiring, design tokens, the one-composer rule, unlayered CSS, and the tap-target and
  phone-chrome contracts. Holding all of it at once is the hard part, not deciding what to do.
- **Areas where training data is stale.** Next 16 is the standing case. Effort does not repair a wrong
  prior — reading `node_modules/next/dist/docs/` does. Raising effort instead of reading is itself the
  failure mode.

**Constrain xhigh planning output, not just its effort.** Extra-high planning over-produces:
alternatives, contingency branches, and surveys that are never used, paid for twice — once generating
and once reading. Ask for the chosen approach, the files, and the gate, not a survey.

**State the split before non-trivial planning work.** One line before starting: plan effort, build
effort, and the risk that justifies them. It is cheap, it makes a wrong allocation visible while it is
still free to change, and it stops the blanket default from being applied silently.

<!-- END:reasoning-effort-calibration -->
