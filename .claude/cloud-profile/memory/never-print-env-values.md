---
name: never-print-env-values
description: "When inspecting a .env file, mask every value by default — a partial-mask script leaked a staging sb_secret_ key into a transcript on 2026-08-18"
metadata:
  node_type: memory
  type: feedback
  originSessionId: e184e33f-a8c2-420c-b8f0-dbb9ddd6fc4d
  modified: 2026-08-18T05:59:12.504Z
---

When inspecting any `.env*` file, print **variable names and value _shapes_ only** (length, prefix, set/unset). Mask **every** value by default — never allowlist "the sensitive ones".

**Why:** on 2026-08-18 an env-inspection script special-cased only `SUPABASE_SERVICE_ROLE_KEY` and printed every other line raw. That dumped a live staging `sb_secret_…` key, the publishable key, and the anon JWT into the transcript, forcing a key rotation. The masking logic was correct for the one variable it anticipated and wrong for the file as a whole — an allowlist fails open on exactly the variable you did not think of. A denylist-by-default is the only safe shape, because you cannot enumerate in advance what a user has put in their env file.

**How to apply:** mask unconditionally, e.g. `printf "%s = <%d chars>\n" "$k" "${#v}"` for every key, and only unmask a specific variable when the user asks for that one and it is provably non-secret (a URL, a project ref, a boolean). Ask for verification of a credential by _shape_ (prefix, length, decoded JWT `ref`/`role` claim) rather than by printing it — decoding a JWT's claims to prove which project it targets is safe and was the right call in that same session. Also: deleting the line afterwards does not undo exposure; the value persists in the session transcript on disk, so rotation is the only real remedy — say so plainly and immediately rather than burying it. Related: [[db-remediation-coordination-state]].
