import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * On Call has ONE emergency control: `NowEmergencyPin`, in the page flow,
 * which renders nothing when the hospital has no verified emergency entry —
 * the app never invents an emergency number.
 *
 * PR #3206 shipped a second, floating control (`EmergencyThumbArc`) that
 * fell back to a hard-coded "55" when nothing was set up, so a reader at a
 * hospital with a different code could have dialled the wrong number. It was
 * removed on 2026-10-03; these checks stop it, or a guessed number, returning.
 */
const onCallComponents = path.resolve(__dirname, "../src/components/on-call");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe("On Call emergency control", () => {
  it("mounts no second, floating emergency speed-dial on Now", () => {
    const home = readFileSync(path.join(onCallComponents, "on-call-home.tsx"), "utf8");
    expect(home).toContain("<NowEmergencyPin");
    expect(home).not.toMatch(/EmergencyThumbArc|emergency-thumb-arc/);
  });

  it("never falls back to a literal phone number when a dial is missing", () => {
    // A `?? "<digits>"` or `|| "<digits>"` fallback is a guessed number.
    const guessed = /(\?\?|\|\|)\s*["'`]\+?\d[\d\s]*["'`]/;
    const offenders = sourceFiles(onCallComponents).filter((file) => guessed.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => path.relative(onCallComponents, file))).toEqual([]);
  });
});
