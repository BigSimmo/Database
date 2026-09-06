import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE CHEAP HALF OF THE EXPECTED-RED GATE.
 *
 * `scripts/check-ward-expected-reds.mjs` runs the whole ward population and compares its failing set
 * to the manifest in both directions. That takes minutes. **This file is what runs in every ordinary
 * suite**: it checks the manifest is well formed, that every entry names a real file, and — the part
 * that matters — **that the script's floors still have headroom against the real population.**
 *
 * ⚠️ **A FLOOR THAT DRIFTS UP TO MEET REALITY STOPS BEING A FLOOR.** The script refuses to compare
 * anything until it has walked at least 200 files and run at least 2500 tests, because set equality
 * against an empty manifest is vacuous on a broken run — discover nothing, run nothing, fail
 * nothing, report success. Those numbers are only protective while the true population is
 * comfortably above them. If the suite ever shrinks toward the floor, the honest response is to
 * understand why, not to lower the number, and this test is what forces that conversation.
 */

const ROOT = process.cwd();
const MANIFEST_PATH = join(ROOT, "tests/ward-expected-reds.json");
const SCRIPT_PATH = join(ROOT, "scripts/check-ward-expected-reds.mjs");

type Entry = {
  file: string;
  kind: string;
  reason: string;
  owner: string;
  retiredWhen: string;
  /** How many tests in this file are expected to be failing. See the count check below. */
  failing: number;
};

type Manifest = { kinds: Record<string, string>; expected: Entry[] };

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
const script = readFileSync(SCRIPT_PATH, "utf8");

/** The same union the script and the handover use, so the two cannot drift apart silently. */
function wardPopulation(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(test|spec)\.tsx?$/u.test(entry.name)) files.push(full);
    }
  };
  walk(join(ROOT, "tests"));

  const chosen = new Set<string>();
  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/gu, "/");
    if (rel.startsWith("tests/ui-")) continue;
    if (/^tests\/ward-/u.test(rel)) {
      chosen.add(rel);
      continue;
    }
    const executable = readFileSync(file, "utf8")
      .split("\n")
      .some((line) => /ward-(management|flow)/u.test(line) && !/^\s*(\*|\/\/|\/\*)/u.test(line));
    if (executable) chosen.add(rel);
  }
  return [...chosen].sort();
}

describe("the expected-red manifest", () => {
  it("declares its kinds, and every entry uses one of them", () => {
    expect(Object.keys(manifest.kinds), "the manifest declares no kinds at all").not.toHaveLength(0);
    for (const entry of manifest.expected) {
      expect(
        Object.keys(manifest.kinds),
        `${entry.file} has kind "${entry.kind}", which the manifest does not declare. The kinds are ` +
          "not decoration: an owner-question and a backlog item are different objects, and only the " +
          "first must never be cleared to make a build green.",
      ).toContain(entry.kind);
    }
  });

  it("gives every entry a reason, an owner, and what would retire it", () => {
    for (const entry of manifest.expected) {
      for (const field of ["reason", "owner", "retiredWhen"] as const) {
        expect(
          (entry[field] ?? "").trim().length,
          `${entry.file} has no ${field}. An entry without one is a red nobody can act on — it reads ` +
            "as sanctioned and is really just unexplained. Whoever owns the question writes this, not " +
            "whoever noticed the red.",
        ).toBeGreaterThan(10);
      }
    }
  });

  /*
   * 🔴 THE COUNT IS NOT BOOKKEEPING — it is what makes file-level keying safe enough to use.
   *
   * Keying on file alone, a listed file with one expected red and one NEW real red is
   * indistinguishable from a listed file with one expected red: the new failure hides inside an entry
   * somebody already approved. Pinning test NAMES would close it and reopen the wording-pin trap,
   * where a rename reads as a fix. An integer closes most of it for the price of one field.
   */
  it("records how many tests each entry expects to be failing", () => {
    for (const entry of manifest.expected) {
      expect(
        Number.isInteger(entry.failing) && entry.failing > 0,
        `${entry.file} does not record how many of its tests are expected to fail. Without it, a ` +
          "second red appearing in this file is invisible — the entry sanctions the file rather than " +
          "the specific reds it was filed for.",
      ).toBe(true);
    }
  });

  it("names only files that exist and are in the ward population", () => {
    const population = new Set(wardPopulation());
    for (const entry of manifest.expected) {
      expect(
        population,
        `${entry.file} is in the manifest but is not in the ward population, so the gate will report ` +
          "it as 'no longer failing' forever. Either the file was renamed or the entry is stale.",
      ).toContain(entry.file);
    }
  });

  /*
   * 🔴 THE ONE THAT PROTECTS THE GATE ITSELF. Everything above checks the manifest; this checks that
   * the SCRIPT's vacuity floors are still floors.
   */
  it("keeps the script's floors well below the real population", () => {
    const fileFloor = Number(/const FLOOR_FILES = (\d+);/u.exec(script)?.[1]);
    const testFloor = Number(/const FLOOR_TESTS = (\d+);/u.exec(script)?.[1]);
    expect(Number.isFinite(fileFloor), "FLOOR_FILES is no longer readable from the script").toBe(true);
    expect(Number.isFinite(testFloor), "FLOOR_TESTS is no longer readable from the script").toBe(true);

    const population = wardPopulation().length;
    expect(
      population,
      `the ward population is ${population} files and the script refuses to compare below ${fileFloor}. ` +
        "The floor has caught up with reality, so it now fails on a healthy suite and the reflex will " +
        "be to lower it. Find out why the population shrank before touching the number.",
    ).toBeGreaterThan(fileFloor);

    // Headroom, not just order. A floor one file below the population is arithmetically satisfied
    // and practically useless — it would pass a run that discovered almost nothing.
    expect(
      population - fileFloor,
      `only ${population - fileFloor} files of headroom between the population and the floor. A floor ` +
        "this close cannot tell a broken discovery from a slightly smaller suite.",
    ).toBeGreaterThan(20);

    expect(testFloor, "FLOOR_TESTS is not set to anything meaningful").toBeGreaterThan(100);
  });
});
