import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    ".claude/**",
    "playwright-report/**",
    "test-results/**",
    ".tmp-visual/**",
    "sample-documents/**",
    "scratch/**",
    ".claude/**",
    "**/.claude/**",
    ".tmp-visual/**",
    "**/.tmp-visual/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
