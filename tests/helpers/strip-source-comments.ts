// tests/helpers/strip-source-comments.ts
//
// Removes comments from TypeScript/TSX source, leaving string and template literals intact.
//
// WHY THIS EXISTS, AND WHY IT IS NOT A REGEX. Two guards in this repo scan source text for a
// forbidden name -- `tests/caring-contacts-explained-automation.dom.test.tsx` looks for the
// service-state record in a client component's whole module graph, and
// `tests/caring-contacts-plan-draft.dom.test.tsx` looks for `localStorage` anywhere in the
// activation wizard. Both have to read CODE rather than prose, because both files they scan
// explain in comments exactly why the forbidden thing is forbidden, and a raw text match reports
// the explanation as the offence. The fix for that must never be to delete the explanation:
// `tests/route-reachability.test.ts` records the same trap in its own words, having once passed
// with a real link mutated away because a comment satisfied its regex.
//
// The first version stripped block comments with `/\/\*[\s\S]*?\*\//g`. Round 1, finding M-4: that
// regex is not literal-aware, so a `"/*"` inside an ordinary string blanks every line of REAL CODE
// up to the next `*/` -- a silent false negative inside a safety guard, which is the worst shape a
// defect in a check can take. This scans character by character instead and copies literals through
// untouched.
//
// THREE PLACES IT IS DELIBERATELY CONSERVATIVE. Each errs toward LEAVING TEXT IN, which for a guard
// means a false alarm a human reads rather than a missed offence that passes silently. Do not
// "fix" any of them by loosening it:
//
//   * A LINE COMMENT IS STRIPPED ONLY WHEN THE LINE BEGINS WITH `//`. A trailing
//     `import … // service-state` keeps its comment, so a guard still fires on it. That property
//     was in the regex this replaces and was deliberately kept: hardening the block-comment case
//     is not a licence to widen the line-comment one.
//   * A REGULAR-EXPRESSION LITERAL IS NOT MODELLED, so a regex containing an unescaped `/*` or
//     `//` is treated as code and could swallow the rest of its line.
//   * AN UNTERMINATED STRING ENDS AT THE NEWLINE rather than running to the end of the file.

// Named rather than written as backslash escapes. A newline escape inside a source string is
// exactly what a careless scripted rewrite of this file turns into a real line break, and it did —
// twice — while this helper was being written.
const LINE_FEED = String.fromCharCode(10);
const TAB = String.fromCharCode(9);
const CARRIAGE_RETURN = String.fromCharCode(13);

type Frame = { mode: "code" | "template" | "interpolation"; depth: number };

/** True when everything before `index` on this line is whitespace. */
function atLineStart(source: string, index: number): boolean {
  for (let i = index - 1; i >= 0; i -= 1) {
    const ch = source[i];
    if (ch === LINE_FEED) return true;
    if (ch !== " " && ch !== TAB && ch !== CARRIAGE_RETURN) return false;
  }
  return true;
}

export function stripSourceComments(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;
  const stack: Frame[] = [{ mode: "code", depth: 0 }];

  const top = (): Frame => stack[stack.length - 1]!;

  while (i < n) {
    const frame = top();

    if (frame.mode === "template") {
      if (source[i] === "\\") {
        out += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (source.startsWith("${", i)) {
        out += "${";
        i += 2;
        stack.push({ mode: "interpolation", depth: 0 });
        continue;
      }
      if (source[i] === "`") {
        out += "`";
        i += 1;
        stack.pop();
        continue;
      }
      out += source[i];
      i += 1;
      continue;
    }

    // Code, or the code inside a `${ ... }`.
    if (source.startsWith("//", i) && atLineStart(source, i)) {
      const end = source.indexOf(LINE_FEED, i);
      i = end === -1 ? n : end;
      continue;
    }
    if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }

    const ch = source[i]!;
    if (ch === '"' || ch === "'") {
      out += ch;
      i += 1;
      while (i < n) {
        const inner = source[i]!;
        if (inner === "\\") {
          out += source.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += inner;
        i += 1;
        if (inner === ch || inner === LINE_FEED) break;
      }
      continue;
    }
    if (ch === "`") {
      out += ch;
      i += 1;
      stack.push({ mode: "template", depth: 0 });
      continue;
    }
    if (frame.mode === "interpolation") {
      if (ch === "{") frame.depth += 1;
      else if (ch === "}") {
        if (frame.depth === 0) {
          out += ch;
          i += 1;
          stack.pop();
          continue;
        }
        frame.depth -= 1;
      }
    }
    out += ch;
    i += 1;
  }

  return out;
}
