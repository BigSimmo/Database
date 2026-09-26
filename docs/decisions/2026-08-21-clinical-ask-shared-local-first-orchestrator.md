# Decision: Mode-aware Clinical Ask uses one shared local-first orchestrator

- **Status:** decided 2026-08-21
- **Source:** `docs/adr/0001-use-a-shared-local-first-clinical-ask-orchestrator.md`, find "Mode-aware Clinical Ask will extend the repository's one shared composer"

Mode-aware Clinical Ask runs through one local-first orchestration boundary: the selected mode's catalogue first, then indexed evidence, and approved external evidence only for a remaining gap. A voice shortcut into generic Answer, separate per-mode assistants and an autonomous cross-mode agent were rejected.

If this summary and the source ever differ, the source wins.
