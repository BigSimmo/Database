import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { changedFilesForRange } from "../scripts/guard-push.mjs";

const ZERO = "0000000000000000000000000000000000000000";
const originalPath = process.env.PATH;
const cleanups: string[] = [];

function installGitStub() {
  const root = mkdtempSync(join(tmpdir(), "guard-push-git-stub-"));
  cleanups.push(root);
  const stub = String.raw`
const args = process.argv.slice(2);
if (args[0] === "rev-parse") {
  console.log("origin-main");
} else if (args[0] === "diff" && args[2]?.includes("...")) {
  process.exit(1);
} else if (args[0] === "diff" && args[2]?.includes("..")) {
  console.log("README.md\nscripts/feature.mjs");
} else {
  process.exit(2);
}
`;
  const executable = join(root, "git");
  writeFileSync(executable, `#!/usr/bin/env node\n${stub}`);
  chmodSync(executable, 0o755);
  process.env.PATH = `${root}${delimiter}${originalPath ?? ""}`;
}

afterEach(() => {
  if (originalPath === undefined) delete process.env.PATH;
  else process.env.PATH = originalPath;
  for (const root of cleanups.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("changedFilesForRange without a merge base", () => {
  // Node cannot launch a .cmd PATH stub through execFileSync, so this fixture is POSIX-only.
  it.runIf(process.platform !== "win32")(
    "falls back to a conservative endpoint-tree diff for a new branch",
    () => {
      installGitStub();

      expect(
        changedFilesForRange(
          {
            localSha: "feature-sha",
            remoteSha: ZERO,
          },
          process.cwd(),
        ),
      ).toEqual(["README.md", "scripts/feature.mjs"]);
    },
  );
});
