const config = {
  test: {
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/lib/**/*.ts", "src/app/**/route.ts", "src/components/**/*.{ts,tsx}"],
      exclude: ["src/app/**/{page,layout,loading,error,not-found}.tsx"],
      // Regression floor set just below current coverage. Raise over time; the point
      // is to fail CI on a meaningful drop, not to chase a target.
      thresholds: {
        statements: 48,
        branches: 38,
        functions: 44,
        lines: 50,
      },
    },
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
};

export default config;
