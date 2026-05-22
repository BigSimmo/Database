<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:local-server-safety -->

# Local server safety

- If the user says `run`, execute `npm run ensure` and return the printed URL.
- If the user asks for UI/frontend changes, browser QA, screenshots, mobile checks, or a local app link, run `npm run ensure` before opening or testing the app, even if the user did not say `run`.
- Never assume `localhost:3000`, `localhost:3001`, or `localhost:3002`.
- Never attach to a local server unless `/api/local-project-id` confirms it is this project.
- Do not kill or modify other projects' local servers. If the stable project port is busy, let `npm run ensure` choose the next safe project URL.
- Do not run a permanent watcher. Only start or verify the server when the current chat task needs the app or the user asks to run it.
<!-- END:local-server-safety -->
