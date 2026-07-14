// Runs on the client after the HTML loads but before React hydration (see
// node_modules/next/dist/docs/.../instrumentation-client.md), so this preempts
// the first client-side Zod schema compile.
//
// Why: the production CSP (src/lib/security-headers.ts) has no 'unsafe-eval'.
// Zod 4's JIT compiler probes for eval with `new Function("")` inside a try/catch
// (node_modules/zod/src/v4/core/util.ts) — the throw is swallowed and validation
// still works, but the browser reports the caught eval as a
// `securitypolicyviolation` on every page. Disabling JIT skips the probe entirely
// (validation stays correct, just interpreted rather than compiled). The server
// has no CSP, so it keeps the faster JIT path — this is client-only by design.
import { config } from "zod";

config({ jitless: true });
