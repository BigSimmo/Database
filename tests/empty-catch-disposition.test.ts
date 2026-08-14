import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Every swallowed error states why (ledger #213).
//
// A catch block with no executable body is allowed — plenty of them are correct, and the
// repo uses them for storage failures, optional observability, and teardown races. What is
// not allowed is swallowing SILENTLY: each one must carry a comment saying why discarding
// the error is the right behaviour, so the next reader does not have to re-derive it.
//
// This is a RAW SOURCE-TEXT scan rather than an AST walk, and deliberately so. ESLint's
// `no-empty` (which already accepts a comment as a body) cannot see the last three
// violations this rule was written for, because they lived inside template-literal strings:
// the pre-paint bootstrap scripts in src/lib/theme.ts and src/app/layout.tsx. Those are
// real code — the browser executes them on every page — but to any JS parser they are just
// a string. Scanning text is the only way to cover both populations at once.
//
// When this test goes red, the fix is to disposition the new catch: handle the error, log
// it through the observability path, or add a comment explaining why swallowing is correct.
// Do NOT loosen the scan or exempt a path to get back to green.

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.join(projectRoot, "src");
const extensions = [".ts", ".tsx"];

function sourceFiles(): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(filePath);
      else if (extensions.includes(path.extname(entry.name))) files.push(filePath);
    }
  };
  visit(sourceRoot);
  return files.sort();
}

/**
 * Consumes a balanced pair starting at `open`, returning the index just past its closer.
 * Used for both the optional `(binding)` and the `{ body }`.
 */
function endOfPair(source: string, open: number, opener: string, closer: string): number {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === opener) depth += 1;
    else if (source[i] === closer) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function skipWhitespace(source: string, from: number): number {
  let i = from;
  while (i < source.length && /\s/.test(source[i] ?? "")) i += 1;
  return i;
}

/** Every `catch (…) { … }` in `source` whose body holds no executable statement. */
function undispositionedCatches(source: string, label: string): string[] {
  const violations: string[] = [];

  for (const match of source.matchAll(/\bcatch\b/g)) {
    const keywordAt = match.index;
    let cursor = skipWhitespace(source, keywordAt + "catch".length);

    // The binding is optional: both `catch {` and `catch (error) {` are valid.
    if (source[cursor] === "(") {
      const bindingEnd = endOfPair(source, cursor, "(", ")");
      if (bindingEnd === -1) continue;
      cursor = skipWhitespace(source, bindingEnd);
    }
    if (source[cursor] !== "{") continue;

    const bodyEnd = endOfPair(source, cursor, "{", "}");
    if (bodyEnd === -1) continue;

    const body = source.slice(cursor + 1, bodyEnd - 1);
    const withoutComments = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    const hasStatement = withoutComments.trim() !== "";
    const hasComment = body.trim() !== "";

    if (!hasStatement && !hasComment) {
      const line = source.slice(0, keywordAt).split("\n").length;
      violations.push(`${label}:${line}`);
    }
  }

  return violations;
}

describe("empty catch disposition", () => {
  it("gives every empty catch under src/ a comment saying why the error is discarded", () => {
    const violations = sourceFiles().flatMap((filePath) =>
      undispositionedCatches(
        fs.readFileSync(filePath, "utf8"),
        path.relative(projectRoot, filePath).split(path.sep).join("/"),
      ),
    );

    expect(
      violations,
      violations.length === 0
        ? ""
        : `These catch blocks discard an error with no explanation:\n  ${violations.join("\n  ")}\n` +
            "Handle the error, log it through the observability path, or add a comment saying why swallowing is correct.",
    ).toEqual([]);
  });

  it("flags bare catches, including inside an inline script string, and accepts dispositioned ones", () => {
    // Guards the scanner itself: a weakened matcher would silently pass the assertion above.
    const fixture = [
      "try { a(); } catch (error) {}", // 1: bare, with a binding
      "try { b(); } catch {}", // 2: bare, no binding
      "try { c(); } catch { /* explained */ }", // 3: dispositioned by comment
      "try { d(); } catch (error) { report(error); }", // 4: handled
      "try { e(); } catch {\n  // explained across lines\n}", // 5-7: dispositioned
      "const s = `(function(){try{f();}catch(e){}})();`;", // 8: bare, inside a script string
    ].join("\n");

    expect(undispositionedCatches(fixture, "fixture")).toEqual(["fixture:1", "fixture:2", "fixture:8"]);
  });
});
