import { readFileSync } from "node:fs";
import ts from "typescript";

/**
 * Every string-shaped literal the TypeScript parser sees in one file — plain string literals
 * (`"…"` and `'…'` alike, since the AST does not care which quote character was used), plain
 * no-substitution template literals (`` `…` `` with no `${…}`), and the static head/middle/tail
 * text of a template literal that DOES carry a substitution (`` `label ${x}` ``).
 *
 * Lifted out of `tests/ward-legal-figure-guard.test.ts` (unchanged behaviour) so
 * `tests/ward-morning-page.dom.test.tsx` can reuse the exact same extraction rather than a second
 * hand-rolled one — two literal scanners that drift apart are worse than one, and this is
 * genuinely the same job: "does this file's source contain a specific rendered string, no matter
 * which JS literal syntax produced it". A quote-based `source.includes(JSON.stringify(label))`
 * substring check only ever sees the double-quoted form — a single-quoted string, or a template
 * literal (which Prettier does not rewrite to quotes), both defeat it silently.
 *
 * WHAT THIS CANNOT SEE: a label built at runtime by concatenating two literal fragments that
 * individually differ from the whole label (`"Expected" + " today"`), or one assembled from a
 * non-literal expression. Callers that need to catch a label's text arriving as part of a longer
 * literal (a hardcoded label with an interpolated suffix, e.g. `` `Expected today ${x}` ``) use
 * a substring check (`literal.includes(label)`) against each returned literal, not an equality
 * check — this function only extracts candidates, it does not decide what counts as a match.
 */
export function literalsIn(path: string): string[] {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const literals: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      literals.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return literals;
}
