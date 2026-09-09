// Survey: user-facing control labels on the Ward Flow screens that NO test pins by text.
//
// The question is NOT "does any test mention this string" — that is the check that would find
// `"Discharged today"` pinned among the discharge board's group headings and conclude the whole
// vocabulary is covered. The question is per-control: for THIS button's visible words, does any
// assertion anywhere fail if the words change?
//
// Read-only. Prints a list and a count; changes nothing.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p.replaceAll("\\", "/"));
  }
  return out;
}

const srcFiles = walk("src/components/ward-management");
const testFiles = walk("tests").filter((p) => /ward/i.test(p));
const testBlob = testFiles.map((p) => readFileSync(p, "utf8")).join("\n");

// A control's visible words: the text between a <button ...> and its </button>, when that text is
// a plain literal rather than an expression. Deliberately conservative — anything interpolated is
// skipped rather than guessed at, so the count under-reports rather than inventing findings.
const buttonText = /<button\b[^>]*>\s*([A-Z][^<>{}]{2,60}?)\s*<\/button>/gs;

const found = [];
for (const file of srcFiles) {
  const source = readFileSync(file, "utf8");
  for (const m of source.matchAll(buttonText)) {
    const label = m[1].replace(/\s+/g, " ").trim();
    if (!label || /^\{/.test(label)) continue;
    const line = source.slice(0, m.index).split("\n").length;
    found.push({ file, line, label });
  }
}

const unpinned = [];
const pinned = [];
for (const item of found) {
  // Pinned = the exact visible words appear inside a ward test file at all. Generous on purpose:
  // anything this calls pinned might still be a weak pin, so a control it calls UNPINNED is
  // unpinned by a wide margin.
  (testBlob.includes(item.label) ? pinned : unpinned).push(item);
}

console.log(`ward component files scanned : ${srcFiles.length}`);
console.log(`ward test files scanned      : ${testFiles.length}`);
console.log(`plain-literal button labels   : ${found.length}`);
console.log(`  pinned by text somewhere    : ${pinned.length}`);
console.log(`  NO test pins the words      : ${unpinned.length}`);
console.log("");
for (const u of unpinned) console.log(`  ${u.file}:${u.line}  "${u.label}"`);
