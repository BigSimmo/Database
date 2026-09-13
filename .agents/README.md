# Repository agent skills

Start with [AGENTS.md](../AGENTS.md) and the [task navigator](../docs/agents-guide.md).
This directory packages repository skills; it is not a replacement instruction
hierarchy, a personal memory store or a list of tasks to run automatically.

## Find and apply a skill

- [skills/catalog.json](skills/catalog.json) is the canonical catalog.
- Run `npm run skills` when a catalog is needed; use `npm run check:skills` when
  changing the skill surfaces. Do not run either merely to answer a simple question.
- Select the minimum relevant skill from its description and read its `SKILL.md`
  before applying it. Follow explicitly named skills and applicable instructions.
- Compatibility aliases preserve older names; they are not independent skills.
- [Skill and ledger guidance](../docs/agents/repository-skills-and-issues.md#repository-productivity-skills)
  explains workflow planners and approval boundaries; [outstanding-work guidance](../docs/agents/repository-skills-and-issues.md#outstanding-work-memory-issues)
  owns the issue-capture process.

## Keep ownership clear

Edit a skill's canonical source and follow the catalog/checker contract for its
platform surfaces. Do not hand-edit a generated copy or add a second skill merely
because a name differs. Existing aliases and compatibility paths must remain valid.
Use the task's instruction hierarchy and permission boundaries: loading a skill
does not authorise provider calls, delegation, publication or extra work.

Project rules belong in root AGENTS.md and its referenced documents. Durable
personal preferences belong in the user's global instructions. Current task status
belongs in its existing checkpoint. Keep credentials and private local state out of
all tracked skill and plugin files.
