const liveProviderTests = process.env.ALLOW_PROVIDER_TESTS === "true";

const config = {
  test: {
    passWithNoTests: true,
    // Route and RAG tests cold-import large Next.js module graphs inside the test
    // body. Give those transforms headroom on slower worktree filesystems while
    // retaining a finite timeout that still catches genuine hangs.
    testTimeout: 30_000,
    // CI runners and dev containers here have 4 cores / ~16 GB; the node suite is
    // CPU-bound (cold-imports large Next module graphs), so 2 workers left cores
    // idle. Scale to the host but cap so a smaller runner cannot oversubscribe,
    // and honour an explicit override for constrained environments.
    maxWorkers: process.env.VITEST_MAX_WORKERS ? Number(process.env.VITEST_MAX_WORKERS) : 4,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      // Inventory every executable TypeScript surface, including pages/layouts,
      // mockups, scripts, the worker, and Supabase Edge Functions. The existing
      // core threshold remains scoped to its historical files so expanding the
      // inventory cannot weaken that regression floor.
      include: ["src/**/*.{ts,tsx}", "scripts/**/*.{ts,mjs,cjs}", "worker/**/*.ts", "supabase/functions/**/*.ts"],
      exclude: ["src/lib/supabase/database.types.ts"],
      thresholds: {
        "src/{lib/**/*.ts,app/**/route.ts,components/**/*.{ts,tsx}}": {
          statements: 48,
          branches: 38,
          functions: 43,
          lines: 50,
        },
      },
    },
    // Two projects run under one `npm run test` invocation. `extends: true` makes
    // each inherit the shared root config above (coverage, timeouts, resolve.alias
    // below), so only the environment/include/setup differ.
    projects: [
      {
        extends: true,
        test: {
          // The long-standing suite: pure logic + route + SSR-string component tests.
          // Node environment, unchanged glob — existing tests behave exactly as before.
          name: "node",
          environment: "node",
          include: liveProviderTests ? ["tests/**/*.live.test.ts"] : ["tests/**/*.test.ts"],
          exclude: liveProviderTests ? [] : ["tests/**/*.live.test.ts"],
        },
      },
      ...(!liveProviderTests
        ? [
            {
              extends: true,
              test: {
                // Interactive component tier: @testing-library/react under jsdom. Kept on a
                // distinct `*.dom.test.tsx` glob so it can never collect the node suite's
                // `*.test.ts` files (and vice versa).
                name: "jsdom",
                environment: "jsdom",
                include: ["tests/**/*.dom.test.tsx"],
                setupFiles: ["tests/setup/jsdom.setup.ts"],
              },
            },
          ]
        : []),
    ],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "server-only": new URL("./tests/stubs/server-only.ts", import.meta.url).pathname,
    },
  },
};

export default config;
