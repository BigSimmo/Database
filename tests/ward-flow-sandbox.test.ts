import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DEVELOPER_GATED_PATH_PREFIXES } from "@/lib/developer-area/headers";

// Anchored on this file's own location (`__dirname`), never on `process.cwd()`.
// A cwd-relative `fs.existsSync("src/app/ward-management")` passes or fails
// depending on where the test runner happened to start — a half-finished move
// could report clean if vitest's cwd ever drifted from the repo root. Resolving
// from `__dirname` makes the check independent of invocation directory, matching
// the pattern already proven in tests/search-results-band-adoption.test.ts.
const REPO_ROOT = path.resolve(__dirname, "..");

describe("Ward Flow is a developer-gated sandbox", () => {
  it("is on the developer-gated prefix list, so production reaches the admin gate not a 404", () => {
    expect(DEVELOPER_GATED_PATH_PREFIXES).toContain("/mockups/ward-flow");
  });

  it("no longer exists as a public app route", () => {
    expect(existsSync(path.join(REPO_ROOT, "src", "app", "ward-management"))).toBe(false);
  });
});
