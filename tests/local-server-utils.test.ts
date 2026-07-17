import { describe, expect, it } from "vitest";

import {
  circularProjectPortRange,
  localProjectId,
  normalizeProjectRoot,
  projectPortEnd,
  projectPortStart,
  stableProjectPort,
} from "../src/lib/local-server-utils.mjs";

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

    expect(normalizeProjectRoot(upperCaseRoot, "linux")).not.toBe(normalizeProjectRoot(lowerCaseRoot, "linux"));
    expect(normalizeProjectRoot(backslashRoot, "linux")).toContain("\\");
    expect(normalizeProjectRoot(backslashRoot, "linux")).not.toBe(normalizeProjectRoot(slashRoot, "linux"));

    for (const root of [upperCaseRoot, lowerCaseRoot, backslashRoot, slashRoot]) {
      const projectId = localProjectId(root, "linux");
      const port = stableProjectPort(root, "linux");
      expect(projectId).toBe(localProjectId(root, "linux"));
      expect(projectId).toMatch(/^clinical-kb:[0-9a-f]{12}$/);
      expect(port).toBe(stableProjectPort(root, "linux"));
      expect(port).toBeGreaterThanOrEqual(3100);
      expect(port).toBeLessThanOrEqual(4599);
    }
  });

  it("scans the full port range circularly from the preferred port", () => {
    const ports = circularProjectPortRange(projectPortEnd);
    expect(ports.slice(0, 3)).toEqual([projectPortEnd, projectPortStart, projectPortStart + 1]);
    expect(new Set(ports).size).toBe(projectPortEnd - projectPortStart + 1);
    expect(ports.at(-1)).toBe(projectPortEnd - 1);
  });
});
