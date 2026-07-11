const config = {
  test: {
    // Route and RAG tests cold-import large Next.js module graphs inside the test
    // body. Give those transforms headroom on slower worktree filesystems while
    // retaining a finite timeout that still catches genuine hangs.
    testTimeout: 30_000,
    maxWorkers: 2,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/lib/**/*.ts", "src/app/**/route.ts", "src/components/**/*.{ts,tsx}"],
      exclude: [
        "src/app/**/{page,layout,loading,error,not-found}.tsx",
        // Design-exploration mockups are dev-only prototypes (see mockups/README.md).
        "src/**/*mockup*",
        "src/app/mockups/**",
      ],
      // Regression floor set just below current coverage. Raise over time; the point
      // is to fail CI on a meaningful drop, not to chase a target.
      thresholds: {
        statements: 48,
        branches: 38,
        functions: 43,
        lines: 50,
      },
    },
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "server-only": new URL("./tests/stubs/server-only.ts", import.meta.url).pathname,
    },
  },
};

export default config;
