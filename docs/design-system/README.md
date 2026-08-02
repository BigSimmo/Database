# Clinical KB design system — document set

The system of record for the v2 design system. **Rules and roles live here; values live
only in the token files.** Source-of-truth ranking: `AGENTS.md` → `ckb-v2-tokens.css` →
committed tests → `.design-sync/conventions.md` → this set. Where this set contradicts a
higher source, the higher source wins and the contradiction is a defect here.

Reading order:

1. [SPEC.md](SPEC.md) — principles, foundations, patterns, degraded states, accessibility,
   content design, the migration playbook (§13) and the authoring definition of done (§14).
2. [TOKENS.md](TOKENS.md) — the reconciled inventory: every role, winner, owner, and the
   per-group allowed/forbidden usage rules (§7).
3. [COMPONENTS.md](COMPONENTS.md) — maturity matrix (§0), the eight safety-component
   specifications (§1–§8), and the binding contract per existing component (§9).
4. [DECISIONS.md](DECISIONS.md) — conflicts C1–C5 resolved, the clinical Q&A record,
   assumptions, and the resolution log.
5. [GATES.md](GATES.md) — every rule paired with its enforcement status. A prohibition
   with no row there is a suggestion.

Canonical code: `src/app/ckb-v2-tokens.css` on `main` (the single token file, merged via
PR #1538; nothing is adopted by product surfaces yet). Design project `08d6f126-3fd0-4764-aedf-0062a467280a` conforms to the repo
file. No visual change ships from this document set — it is the system and its rules.
