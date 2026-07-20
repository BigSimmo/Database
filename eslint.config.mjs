import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

import requireLucideIconAria from "./eslint-rules/require-lucide-icon-aria.mjs";

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
  // A lucide-react icon rendered as JSX must be decorative (aria-hidden) or
  // carry an accessible name. Enforces the codebase's own convention so a glyph
  // can't silently reach the a11y tree. Mockups are design-scratch and exempt.
  {
    files: ["**/*.{jsx,tsx}"],
    ignores: ["**/*mockup*", "**/mockups/**"],
    plugins: {
      local: { rules: { "require-lucide-icon-aria": requireLucideIconAria } },
    },
    rules: {
      "local/require-lucide-icon-aria": "error",
    },
  },
  // Import boundary: production source must not import design-scratch mockup
  // modules. Every legitimate mockup import lives under `src/app/mockups/**` (all
  // 404 in production) or inside the `*-mockups` component sources themselves;
  // everything else is fenced off so a mockup can't leak into a shipped route.
  // Verified 2026-07-20: zero violations outside the exempt directories.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/app/mockups/**", "**/*-mockups/**", "**/*-mockups.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/*-mockups", "**/*-mockups/*", "**/*mockup*"],
              message:
                "Production code must not import mockup modules (design-scratch, 404 in production). Mockup routes live under src/app/mockups/**.",
            },
          ],
        },
      ],
    },
  },
  // next/og image routes render <img> through Satori (rasterised server-side,
  // not DOM); next/image cannot run there. Turn the rule off for these files via
  // config rather than a per-file disable directive — the Next plugin reports
  // this rule inconsistently across environments (it fires with a local .next
  // present but not on a fresh CI checkout), so a disable directive flips
  // between "used" and "unused" and trips `--max-warnings 0`.
  {
    files: ["src/lib/brand-image.tsx", "src/app/opengraph-image.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
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
    // Recursive `**/` variants cover nested worktrees; the bare globs above already
    // ignore the repo-root dirs, so only the recursive forms are kept here.
    "**/.claude/**",
    "**/.tmp-visual/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
