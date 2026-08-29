// tests/source-control-bytes.test.ts
//
// No stray control byte in the repository's own source.
//
// WHY THIS EXISTS, and it is a count rather than a worry: the same hazard landed three times in one
// week. A backspace escape ate a character in a worktree path in `task-8-report.md`; the same
// report's sentence EXPLAINING that escape still carried two literal `0x08` bytes months later; and
// `tests/caring-contacts-plan-wizard.dom.test.tsx` shipped a regex family whose every `\b` reached
// the file as a backspace, so the patterns read `/<BS>the one write<BS>/i` and matched nothing —
// an assertion that could not fail, in a check written to catch stale claims.
//
// The third one is the argument for a durable guard rather than more care. It passed lint,
// typecheck, Prettier, the workspace guard set and the full suite, because a control byte inside a
// string or a regex is syntactically fine and semantically invisible. Only mutation testing found
// it, and only because someone happened to write a mutation aimed at something else.
//
// WHY A TEST RATHER THAN A LINT RULE OR A HOOK. ESLint only sees what it lints — not Markdown, not
// JSON, not shell — and the two of the three occurrences that reached the tree were in a Markdown
// report. A pre-commit hook does not run in CI, and `core.hooksPath` is per-checkout, so an agent
// pushing from its own environment bypasses it. The precedent is already here: the CR-byte check on
// the Claude hook scripts lives in `tests/session-start-hook.test.ts`, for the same reason.
//
// WHAT IT DELIBERATELY DOES NOT POLICE. The carriage return. `.gitattributes` sets `* text=auto
// eol=lf` and the hook-script test already fails on CR in the blobs where it is dangerous. Widening
// here would put two guards on one rule and make the second one's failures somebody else's to
// interpret — so CR is permitted by this check and owned by those.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Permitted anywhere: horizontal tab, line feed, carriage return.
 *
 * Tab and newline are ordinary text. The carriage return is out of scope rather than approved — see
 * the module note.
 */
const PERMITTED_EVERYWHERE: ReadonlySet<number> = new Set([0x09, 0x0a, 0x0d]);

/**
 * Files that legitimately hold a control byte, with the byte and the reason.
 *
 * AN ALLOWLIST, NOT A DENYLIST, AND IT IS DELIBERATELY PER-FILE-PER-BYTE. A blanket "this file is
 * exempt" would let a second, accidental byte in beside the deliberate one, in the one file nobody
 * would look at again.
 *
 * Each entry is also proved STILL NECESSARY below, so an exception cannot outlive the code it was
 * written for and quietly become permission.
 */
const PERMITTED_BY_FILE: Readonly<Record<string, { readonly bytes: readonly number[]; readonly reason: string }>> = {
  "tests/upload-structure.test.ts": {
    bytes: [0x03, 0x04],
    reason:
      "The four bytes 50 4B 03 04 are the ZIP local-file-header signature, and a .docx is a zip. " +
      "The fixture embeds the real magic number so the check under test sees what a genuine upload " +
      "would carry; writing it as an escape would test a different string from the one that arrives.",
  },
};

/** Every text file git tracks. Extensions rather than a denylist, so a new binary type is out by default. */
const TEXT_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".md",
  ".json",
  ".css",
  ".sql",
  ".sh",
  ".yml",
  ".yaml",
  ".py",
] as const;

export type ControlByteFinding = { readonly byte: number; readonly offset: number };

/**
 * Every byte in `contents` that is a C0 control or DEL and is not permitted.
 *
 * Byte-wise over a Buffer rather than character-wise over a decoded string, for two reasons: it is
 * twenty times faster across five thousand files, and a decode would turn an invalid sequence into
 * a replacement character and hide it.
 */
export function forbiddenControlBytes(contents: Buffer, alsoPermitted: readonly number[] = []): ControlByteFinding[] {
  const permitted = new Set([...PERMITTED_EVERYWHERE, ...alsoPermitted]);
  const findings: ControlByteFinding[] = [];
  for (let offset = 0; offset < contents.length; offset += 1) {
    const byte = contents[offset];
    if (byte >= 0x20 && byte !== 0x7f) continue;
    if (permitted.has(byte)) continue;
    findings.push({ byte, offset });
  }
  return findings;
}

/** The bytes around a finding, with the offending byte named — so a failure says where to look. */
export function describeFinding(path: string, contents: Buffer, finding: ControlByteFinding): string {
  const start = Math.max(0, finding.offset - 60);
  const before = contents.subarray(start, finding.offset).toString("utf8");
  const after = contents.subarray(finding.offset + 1, finding.offset + 40).toString("utf8");
  const line = contents.subarray(0, finding.offset).toString("utf8").split("\n").length;
  return `${path}:${line} carries 0x${finding.byte.toString(16).padStart(2, "0")} between ${JSON.stringify(
    before.slice(-40),
  )} and ${JSON.stringify(after)}`;
}

/**
 * Every text file git tracks, PLUS every untracked file it would not ignore.
 *
 * The untracked half is not thoroughness, it is the point. A control byte arrives when a file is
 * WRITTEN, and a plain `git ls-files` cannot see a file until it is committed — so the guard would
 * stay green through the entire session that introduced the byte and only speak up on the next run,
 * against someone else's diff. `--exclude-standard` keeps `.gitignore` in force, so `node_modules`,
 * `.next` and `coverage` stay out.
 */
function scannableTextFiles(): string[] {
  const listed = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    encoding: "buffer",
  }).toString("utf8");
  return listed.split("\0").filter((path) => path !== "" && TEXT_EXTENSIONS.some((ext) => path.endsWith(ext)));
}

describe("the control-byte detector", () => {
  // THE POSITIVE CONTROLS. A scan for something that is almost never present is exactly the check
  // that can be written so it cannot fail — which is what happened to the regex family this guard
  // exists because of. Every byte below is CONSTRUCTED rather than typed, so this file does not
  // itself contain one and cannot be the thing it is looking for.
  const BACKSPACE = 0x08;

  it("finds a backspace that a source file should not contain", () => {
    const planted = Buffer.concat([Buffer.from("the one write"), Buffer.from([BACKSPACE]), Buffer.from("has got to")]);
    const findings = forbiddenControlBytes(planted);
    expect(findings, "the detector missed a planted backspace").toHaveLength(1);
    expect(findings[0].byte).toBe(BACKSPACE);
    expect(findings[0].offset).toBe("the one write".length);
  });

  it("finds a NUL and a DEL, which bracket the range it claims to cover", () => {
    expect(forbiddenControlBytes(Buffer.from([0x41, 0x00, 0x42]))).toHaveLength(1);
    expect(forbiddenControlBytes(Buffer.from([0x41, 0x7f, 0x42]))).toHaveLength(1);
    // And the byte either side of the range is ordinary text, so the bound is a bound.
    expect(forbiddenControlBytes(Buffer.from([0x1f]))).toHaveLength(1);
    expect(forbiddenControlBytes(Buffer.from([0x20]))).toHaveLength(0);
    expect(forbiddenControlBytes(Buffer.from([0x7e]))).toHaveLength(0);
  });

  it("permits tab and newline, and leaves the carriage return to the guards that own it", () => {
    expect(forbiddenControlBytes(Buffer.from("a\tb\nc\r\nd"))).toHaveLength(0);
  });

  it("permits an allowed byte only where it is allowed, and only that byte", () => {
    const zipMagic = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    expect(forbiddenControlBytes(zipMagic), "the ZIP magic number is not a control byte here").toHaveLength(2);
    expect(forbiddenControlBytes(zipMagic, [0x03, 0x04])).toHaveLength(0);
    // An exception is per byte: allowing one does not allow its neighbour.
    expect(forbiddenControlBytes(zipMagic, [0x03])).toHaveLength(1);
    // And it does not become a general amnesty for that file.
    expect(forbiddenControlBytes(Buffer.concat([zipMagic, Buffer.from([BACKSPACE])]), [0x03, 0x04])).toHaveLength(1);
  });

  it("says where the byte is, so a failure is actionable", () => {
    const planted = Buffer.concat([Buffer.from("line one\nthe one write"), Buffer.from([BACKSPACE]), Buffer.from("s")]);
    const described = describeFinding("some/file.ts", planted, forbiddenControlBytes(planted)[0]);
    expect(described).toContain("some/file.ts:2");
    expect(described).toContain("0x08");
    expect(described).toContain("the one write");
  });
});

describe("the repository's own source", () => {
  it("carries no stray control byte", () => {
    const offences: string[] = [];
    const scanned: string[] = [];
    for (const path of scannableTextFiles()) {
      let contents: Buffer;
      try {
        contents = readFileSync(path);
      } catch {
        // A listed path that cannot be read is somebody else's problem (a submodule, a broken
        // link); this guard reports on bytes it can see rather than failing on absence.
        continue;
      }
      scanned.push(path);
      const exception = PERMITTED_BY_FILE[path];
      for (const finding of forbiddenControlBytes(contents, exception?.bytes ?? [])) {
        offences.push(describeFinding(path, contents, finding));
      }
    }
    expect(offences, "a control byte is invisible in review and survives lint, typecheck and Prettier").toEqual([]);

    // AND THE SCAN ACTUALLY RAN. Everything above is satisfied by examining nothing at all: an empty
    // file list produces an empty offence list and a green tick. That is the same shape of defect
    // this guard exists to catch, so the guard is not allowed to have it. The floor is far below the
    // ~5,100 files present so ordinary deletion cannot trip it, and it is a floor rather than a
    // count so it needs no maintenance.
    expect(scanned.length, "the scan examined almost nothing, so its green means nothing").toBeGreaterThan(1000);
    // Named files, so a filter that silently stops matching a whole extension is visible: one source
    // file, one Markdown file (two of the three real occurrences were in Markdown), and this file.
    expect(scanned).toContain("tests/upload-structure.test.ts");
    expect(scanned).toContain("docs/caring-contacts/phase-2b-sdd-archive/task-8-report.md");
    expect(scanned).toContain("tests/source-control-bytes.test.ts");
  });

  it("keeps no exception it no longer needs", () => {
    // An allowlist that outlives its reason stops being an exception and becomes permission. Each
    // entry must still be earning its place, byte by byte.
    for (const [path, exception] of Object.entries(PERMITTED_BY_FILE)) {
      const contents = readFileSync(path);
      const stillPresent = new Set(forbiddenControlBytes(contents).map((finding) => finding.byte));
      for (const byte of exception.bytes) {
        expect(
          stillPresent.has(byte),
          `${path} is allowed 0x${byte.toString(16)} and no longer contains it, so the exception is stale`,
        ).toBe(true);
      }
    }
  });
});
