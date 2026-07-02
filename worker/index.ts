import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { safeErrorLogDetails } from "../src/lib/privacy";

async function startWorker() {
  await import("./main");
}

startWorker().catch((error) => {
  console.error("Worker bootstrap failed", safeErrorLogDetails(error));
  process.exit(1);
});
