import { existsSync, type PathLike, type RmOptions } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import * as cleaner from "../scripts/clean-next-build.mjs";

describe("clean Next build script", () => {
  it("is repository-owned instead of relying on a shell-specific recursive delete", () => {
    expect(existsSync(join(process.cwd(), "scripts", "clean-next-build.mjs"))).toBe(true);
  });

  it("targets only this repository's .next directory", async () => {
    expect(cleaner.cleanNextBuild).toBeTypeOf("function");
    if (typeof cleaner.cleanNextBuild !== "function") return;

    const removed: Array<{ path: PathLike; options: RmOptions | undefined }> = [];
    await cleaner.cleanNextBuild({
      remove: async (path: PathLike, options?: RmOptions) => {
        removed.push({ path, options });
      },
    });

    expect(removed).toEqual([
      {
        path: join(process.cwd(), ".next"),
        options: { force: true, recursive: true },
      },
    ]);
  });

  it("rejects command-line target arguments", () => {
    expect(cleaner.validateCliArguments).toBeTypeOf("function");
    if (typeof cleaner.validateCliArguments !== "function") return;

    expect(() => cleaner.validateCliArguments([])).not.toThrow();
    expect(() => cleaner.validateCliArguments(["elsewhere"])).toThrow(/does not accept target arguments/i);
  });
});
