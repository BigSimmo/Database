const config = {
  test: {
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/lib/**/*.ts", "src/app/**/route.ts", "src/components/**/*.{ts,tsx}"],
      exclude: ["src/app/**/{page,layout,loading,error,not-found}.tsx"],
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
