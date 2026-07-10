import { describe, expect, it } from "vitest";

import { localProjectId, normalizeProjectRoot, stableProjectPort } from "../src/lib/local-server-utils.mjs";

describe("local server project identity", () => {
  it("normalizes Windows roots case-insensitively", () => {
    const first = "C:\\Work\\Clinical-KB";
    const second = "c:/work/clinical-kb";

    expect(normalizeProjectRoot(first, "win32")).toBe(normalizeProjectRoot(second, "win32"));
    expect(localProjectId(first, "win32")).toBe(localProjectId(second, "win32"));
    expect(stableProjectPort(first, "win32")).toBe(stableProjectPort(second, "win32"));
  });

  it("preserves POSIX case and backslash semantics", () => {
    const upperCaseRoot = "/work/Clinical-KB";
    const lowerCaseRoot = "/work/clinical-kb";
    const backslashRoot = "/work/Clinical\\KB";
    const slashRoot = "/work/Clinical/KB";

    expect(normalizeProjectRoot(backslashRoot, "linux")).toContain("\\");
    expect(localProjectId(upperCaseRoot, "linux")).not.toBe(localProjectId(lowerCaseRoot, "linux"));
    expect(stableProjectPort(upperCaseRoot, "linux")).not.toBe(stableProjectPort(lowerCaseRoot, "linux"));
    expect(localProjectId(backslashRoot, "linux")).not.toBe(localProjectId(slashRoot, "linux"));
  });
});
