// Cross-platform wrapper for `ANALYZE=true npm run build` (Windows shells cannot
// set inline env vars). Reuses the normal build script so the guard and heap
// settings stay in one place; next.config.ts picks up ANALYZE and wraps the
// config with @next/bundle-analyzer, which writes .next/analyze/*.html.
import { spawnSync } from "node:child_process";

const result = spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, ANALYZE: "true" },
});

process.exit(result.status ?? 1);
