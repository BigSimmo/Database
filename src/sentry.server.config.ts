import * as Sentry from "@sentry/nextjs";

// Node.js server runtime init, loaded from src/instrumentation.ts's register()
// when NEXT_RUNTIME === "nodejs". Inert (no client created, nothing sent) until
// SENTRY_DSN is configured — see docs/outstanding-issues.md #053 for the
// pending DPA/subprocessor review that should land before this carries real
// clinical traffic in production.
//
// dataCollection is intentionally omitted rather than passed as `{}`: per the
// SDK docs, an explicit (even empty) dataCollection object flips unset
// categories to their permissive defaults, while omitting it keeps every
// category off (sendDefaultPii defaults to false). includeLocalVariables is
// also left off — server stack frames in this app's RAG/ingestion code can
// hold clinical query text in local variables, and that must not leave this
// process. enableLogs (Sentry Logs) is a separate signal, deferred until a
// signed-off use case exists.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
