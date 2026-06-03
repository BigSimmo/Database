import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function startWorker() {
  await import("./main");
}

startWorker().catch((error) => {
  console.error(error);
  process.exit(1);
});
