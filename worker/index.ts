import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

await import("./main").catch((error) => {
  console.error(error);
  process.exit(1);
});
