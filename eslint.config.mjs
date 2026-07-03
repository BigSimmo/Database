import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Accessibility: eslint-config-next only enables a narrow jsx-a11y subset
  // (alt-text, aria-props, role validity). Add `label-has-associated-control`
  // so a <label> that isn't wired to a control is caught in CI — a real markup
  // smell the default config misses.
  //
  // The sibling rule `control-has-associated-label` (which flags an unlabeled
  // <input>/<select>) is deliberately NOT enabled: it false-positives on this
  // codebase's pervasive `<label><span>text</span><input/></label>` pattern
  // (~13 correctly-labeled controls) and `depth` tuning does not clear them.
  // Precise unlabeled-control detection belongs in a runtime axe-core check.
  {
    files: ["**/*.{jsx,tsx}"],
    rules: {
      "jsx-a11y/label-has-associated-control": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "output/**",
    ".codex-screenshots/**",
    ".qa-smoke/**",
    ".tmp-playwright-*/**",
    ".claude/**",
    "playwright-report/**",
    "test-results/**",
    "node_modules.broken-*/**",
    ".node_modules.stale-*/**",
    ".npm-cache*/**",
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
