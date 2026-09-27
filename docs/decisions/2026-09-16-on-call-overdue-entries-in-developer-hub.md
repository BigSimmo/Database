# Decision: Overdue On Call entries are reported in the developer hub, not the front end

- **Status:** decided 2026-09-16
- **Source:** `src/components/on-call/on-call-home.tsx`, find "removed on the owner's instruction (2026-09-16)"

Overdue On Call entries never appear on the front end: they are reported in the developer hub for whoever maintains the content. Each overdue row still carries its own badge inside its section.

If this summary and the source ever differ, the source wins.
