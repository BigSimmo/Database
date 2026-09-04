import { readFileSync, writeFileSync } from "node:fs";

const [, , file, which] = process.argv;
let src = readFileSync(file, "utf8");

const LINE_FIRST = String.raw`return source.replace(/^[ \t]*\/\/[^\n]*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");`;
const BLOCK_FIRST = String.raw`return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/[^\n]*$/gm, "");`;

const OLD_EXTRACTOR = `  for (let i = 0; i < source.length; i += 1) {
    if (source[i] !== "\`") continue;
    const literal = readTemplateLiteral(source, i);
    if (literal === null) continue;
    if (literal.body.startsWith("/")) found.push(literal.body);
    i = literal.end;
  }
  for (const pattern of [/"(\\/[^"\\n]*)"/g, /'(\\/[^'\\n]*)'/g]) {`;

const NEW_EXTRACTOR = `  for (const pattern of [/\`(\\/[^\`]*)\`/g, /"(\\/[^"\\n]*)"/g, /'(\\/[^'\\n]*)'/g]) {`;

function must(hay, needle, label) {
  if (!hay.includes(needle)) {
    console.error(`ANCHOR NOT FOUND: ${label}`);
    process.exit(3);
  }
}

if (which === "strip-order") {
  must(src, LINE_FIRST, "line-first strip");
  src = src.replace(LINE_FIRST, BLOCK_FIRST);
  console.log("MUTATION strip-order: stripComments now block-comments-first (the original defect)");
} else if (which === "old-extractor") {
  must(src, OLD_EXTRACTOR, "template scanner loop");
  src = src.replace(OLD_EXTRACTOR, NEW_EXTRACTOR);
  console.log("MUTATION old-extractor: hrefsIn back to the regex that stops at a nested backtick");
} else if (which === "empty-map") {
  const m = src.match(/const LINKED_BUT_INVISIBLE_TO_THIS_SCAN[^=]*=\s*new Map[^;]*;/s);
  if (!m) {
    console.error("ANCHOR NOT FOUND: exception map");
    process.exit(3);
  }
  src = src.replace(m[0], "const LINKED_BUT_INVISIBLE_TO_THIS_SCAN = new Map<string, string>();");
  console.log("MUTATION empty-map: LINKED_BUT_INVISIBLE_TO_THIS_SCAN emptied");
} else if (which === "naive-query-split") {
  const before = '  const withoutQuery = stripQueryAndHash(raw).replace(/\\/$/, "");';
  must(src, before, "hrefShape query strip");
  src = src.replace(before, '  const withoutQuery = raw.split("?")[0].split("#")[0].replace(/\\/$/, "");');
  console.log("MUTATION naive-query-split: hrefShape cuts at the first ? anywhere");
} else {
  console.error("unknown mutation");
  process.exit(3);
}

writeFileSync(file, src);
