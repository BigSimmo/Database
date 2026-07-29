import { vitestCacheDirectory } from "./scripts/test-cache-path.mjs";

const liveProviderTests = process.env.ALLOW_PROVIDER_TESTS === "true";

const config = {
  // Codex worktrees commonly share node_modules through a junction. Keep Vite's
  // transform cache outside that shared dependency tree and unique per worktree.
  cacheDir: vitestCacheDirectory(process.cwd()),
  test: {
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
        // Broad regression floor. Re-ratcheted 2026-07-29: the previous values
        // (48/38/43/50) had drifted 14-17pp below measured coverage
        // (63.99/55.29/57.6/66.19), so a change could delete a large amount of
        // coverage and still pass. Each floor now sits ~2pp under measured — enough
        // headroom for a PR that ships an uncovered surface, not enough to hide a
        // regression. Re-measure with `npm run test:coverage` and raise these when
        // the gap grows past ~5pp again; never lower them to make a red gate green.
        "src/{lib/**/*.ts,app/**/route.ts,components/**/*.{ts,tsx}}": {
          statements: 62,
          branches: 53,
          functions: 55,
          lines: 64,
        },
        // Aggregate behavioral floors ratchet the full post-fixture group rather
        // than making individual large RAG modules brittle. Each value is the
        // greater of the measured whole-group floor or the broad floor + 5pp.
        "src/lib/{clinical-search,retrieval-selection,answer-ranking,clinical-value-binding,medication-entities,rag/rag-candidate-sources,rag/rag-context-selection,rag/rag-retrieval-variants,rag/rag-routing}.ts":
          {
            statements: 86,
            branches: 78,
            functions: 88,
            lines: 90,
          },
        "src/lib/{answer-verification,evidence,evidence-relevance,rag/rag-claim-support,rag/rag-evidence-gates,rag/rag-quote-verification,rag/rag-source-segmentation}.ts":
          {
            statements: 92,
            branches: 81,
            functions: 94,
            lines: 94,
          },
        "src/lib/rag/{rag,rag-extractive-answer,rag-comparison,rag-answer-support}.ts": {
          statements: 83,
          branches: 72,
          functions: 90,
          lines: 88,
        },
        "src/lib/{clinical-safety,source-governance,source-review,clinical-review-queue,answer-response}.ts": {
          statements: 94,
          branches: 83,
          functions: 96,
          lines: 97,
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
