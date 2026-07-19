---
name: run
description: Start or verify the correct local Database application with repository identity checks and return its actual URL. Use when the user says run, asks for the local app, or needs browser work against this project.
---

# Run

1. Run the task-start preflight if needed and inspect active repo-owned server state.
2. Execute `npm run ensure`; do not assume ports 3000, 3001, or 3002.
3. Trust only a URL whose `/api/local-project-id` identity check matches this project.
4. Do not stop or modify another project's server.
5. Return the verified URL briefly and report any environment blocker.
