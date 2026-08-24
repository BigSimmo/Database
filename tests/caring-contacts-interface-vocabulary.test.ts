// tests/caring-contacts-interface-vocabulary.test.ts
//
// Item B3 (2026-08-24): extend the prohibited-word scan to interface strings.
//
// Until now, the prohibition on words like "campaign", "engagement score", and "inbox" ran only
// against outgoing messages (message-policy.ts) and the 24 frozen overlay definition rows
// (caring-contacts-overlay-definitions.test.ts). Nothing checked the words on a SCREEN, so the ban
// on interface wording was policy held by people rather than by software. This scans every string
// and template literal under the workspace and caring-contacts app trees for the same wider
// interface vocabulary (CARING_CONTACTS_PROHIBITED_LANGUAGE) already used by the overlay tests.
//
// See docs/caring-contacts/phase-2b-sdd-archive/task-c-brief.md, "B3".
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CARING_CONTACTS_PROHIBITED_LANGUAGE } from "./helpers/caring-contacts-prohibited-language";

// Deliberately narrow roots, not "all of src/components/caring-contacts": this excludes
// src/components/caring-contacts/mockups/** without needing a special-case skip. Mockups are
// frozen design scratch that 404 in production and knowingly contain one prohibited phrase the
// owner ruled (B4) to leave alone -- see task-c-brief.md, "B3", "Scope limits, deliberate".
const SCAN_ROOTS = [
  path.join(process.cwd(), "src", "components", "caring-contacts", "workspace"),
  path.join(process.cwd(), "src", "app", "caring-contacts"),
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory()
      ? walk(full)
      : full.endsWith(".ts") || full.endsWith(".tsx")
        ? [full]
        : [];
  });
}

/**
 * Every quoted string and template literal in `source`, with line/block comments skipped.
 *
 * A naive quote-matching regex over the raw source is unsound here: JSDoc comments in this tree
 * use single backticks for inline code (`` `useSearchParams` ``), and an odd number of them across
 * a comment block pairs a backtick from one inline-code span with one from a much later, unrelated
 * span, capturing the entire stretch between as a single fake "template literal". A small
 * character-by-character scan that recognises both line comments and block comments avoids that,
 * and handles escaped quote characters inside real literals.
 */
function extractStringAndTemplateLiterals(source: string): string[] {
  const literals: string[] = [];
  let i = 0;
  const n = source.length;
  while (i < n) {
    const two = source.slice(i, i + 2);
    if (two === "//") {
      const end = source.indexOf("\n", i);
      i = end === -1 ? n : end + 1;
      continue;
    }
    if (two === "/*") {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let j = i + 1;
      let content = "";
      while (j < n) {
        if (source[j] === "\\") {
          content += source[j] + (source[j + 1] ?? "");
          j += 2;
          continue;
        }
        if (source[j] === quote) {
          j += 1;
          break;
        }
        content += source[j];
        j += 1;
      }
      literals.push(content);
      i = j;
      continue;
    }
    i += 1;
  }
  return literals;
}

/**
 * `className` attribute VALUES are excluded before extraction. This is narrowing which literals
 * reach the scan, not adding a file to an ignore list: a `className` value is CSS/Tailwind tokens,
 * including custom-property names like `var(--safe-area-bottom)`, which contains "safe" as a
 * substring of a CSS identifier with no relationship to interface prose a patient or clinician
 * would read. Both real occurrences of `--safe-area-bottom` in this tree are inside `className`
 * attributes (shell.tsx, overlay-host.tsx) -- confirmed while building this scan.
 */
const CLASSNAME_ATTRIBUTE_VALUE = /className\s*=\s*(?:"[^"]*"|'[^']*'|\{`[^`]*`\})/g;

function extractInterfaceStrings(source: string): string[] {
  return extractStringAndTemplateLiterals(source.replace(CLASSNAME_ATTRIBUTE_VALUE, ""));
}

/** Every `root -> file -> offending literal` combination found under `root`. */
function scanRootForProhibitedLanguage(root: string): string[] {
  const offences: string[] = [];
  for (const file of walk(root)) {
    const source = readFileSync(file, "utf8");
    for (const literal of extractInterfaceStrings(source)) {
      if (CARING_CONTACTS_PROHIBITED_LANGUAGE.test(literal)) {
        offences.push(`${path.relative(process.cwd(), file)}: ${JSON.stringify(literal)}`);
      }
    }
  }
  return offences;
}

describe("caring-contacts interface vocabulary (B3)", () => {
  it("finds a deliberately planted prohibited string in a fixture -- proving the scan can fail", () => {
    // Runs the real file-scanning code path (walk + read + extract + match) against a temporary
    // fixture, not just the extraction function in isolation. "A scan that cannot fail is worse
    // than no scan" (task-c-brief.md) -- this is that proof.
    const fixtureDir = mkdtempSync(path.join(tmpdir(), "caring-contacts-interface-vocabulary-fixture-"));
    try {
      writeFileSync(
        path.join(fixtureDir, "planted-banner.tsx"),
        [
          "export function PlantedBanner() {",
          '  return <p>{"Following up on your sales lead from this campaign."}</p>;',
          "}",
          "",
        ].join("\n"),
        "utf8",
      );

      const offences = scanRootForProhibitedLanguage(fixtureDir);
      expect(offences.length).toBeGreaterThan(0);
      expect(offences.some((offence) => offence.includes("campaign"))).toBe(true);
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("finds nothing in the real workspace and caring-contacts app tree", () => {
    const offences = SCAN_ROOTS.flatMap((root) => scanRootForProhibitedLanguage(root));
    expect(offences).toEqual([]);
  });
});
