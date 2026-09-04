import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The review subagents under `.claude/agents/` each carry a `## Scope` list of backticked
 * paths and globs telling the agent where to look. Nothing pinned those paths, so when the RAG
 * module moved into `src/lib/rag/` the `rag-retrieval-reviewer` and
 * `clinical-governance-reviewer` scopes kept pointing at `src/lib/rag*.ts` and
 * `src/lib/{...,rag-quote-verification,rag-answer-support,...}.ts` — none of which matched a
 * file, and a `src/lib/rag*.ts` glob does not descend into the directory (audit M35). The
 * clinical-governance reviewer's grounded-evidence checks are the safety surface AGENTS.md
 * "RAG ranking protection" names as `src/lib/rag/**`, so its scope has to reach it.
 *
 * This test brace-expands every backticked scope entry and requires it to match at least one
 * path in the tree, and requires the two RAG-facing reviewers to name `src/lib/rag/**`.
 */

const repoRoot = process.cwd();
const agentsDir = join(repoRoot, ".claude/agents");

function braceExpand(pattern: string): string[] {
  const match = /\{([^{}]*)\}/.exec(pattern);
  if (!match) return [pattern];
  const [whole, inner] = match;
  return inner.split(",").flatMap((alternative) => braceExpand(pattern.replace(whole, alternative.trim())));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === ".next") continue;
    const full = join(dir, entry);
    const rel = full.slice(repoRoot.length + 1).replaceAll("\\", "/");
    if (statSync(full).isDirectory()) {
      out.push(`${rel}/`);
      walk(full, out);
    } else {
      out.push(rel);
    }
  }
  return out;
}

const tree = walk(repoRoot);

function globToRegExp(glob: string): RegExp {
  let source = "";
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === "*") {
      if (glob[i + 1] === "*") {
        source += ".*";
        i += 1;
        if (glob[i + 1] === "/") i += 1;
      } else {
        source += "[^/]*";
      }
    } else if (/[.+?^${}()|[\]\\]/.test(char)) {
      source += `\\${char}`;
    } else {
      source += char;
    }
  }
  return new RegExp(`^${source}$`);
}

function matchesTree(glob: string): boolean {
  const regExp = globToRegExp(glob);
  return tree.some((entry) => regExp.test(entry) || regExp.test(entry.replace(/\/$/, "")));
}

function scopeEntries(markdown: string): string[] {
  const scope = /## Scope\n([\s\S]*?)(?:\n## |$)/.exec(markdown);
  if (!scope) return [];
  return [...scope[1].matchAll(/`([^`]+)`/g)]
    .map((entry) => entry[1])
    .filter((entry) => /^[\w./{}*,-]+$/.test(entry) && isRepoRelative(entry));
}

/**
 * Only repo-root-relative entries are checked. A scope line may also carry a fragment relative
 * to an earlier entry ("esp. `clinical-dashboard/{...}.tsx`" under `src/components/**`), which
 * cannot be resolved without parsing the prose.
 */
function isRepoRelative(entry: string): boolean {
  const head = entry.split("/")[0].replace(/\{.*$/, "");
  return head.length > 0 && tree.includes(`${head}/`);
}

const agents = readdirSync(agentsDir).filter((name) => name.endsWith(".md"));

describe("review-agent scopes", () => {
  it("finds agents with a scope list", () => {
    const withScope = agents.filter((name) => scopeEntries(readFileSync(join(agentsDir, name), "utf8")).length > 0);
    expect(withScope.length).toBeGreaterThan(2);
  });

  for (const name of agents) {
    const entries = scopeEntries(readFileSync(join(agentsDir, name), "utf8"));
    for (const entry of entries) {
      for (const expanded of braceExpand(entry)) {
        it(`${name} scope entry ${expanded} matches a path in the tree`, () => {
          expect(matchesTree(expanded), `${name}: \`${entry}\` names ${expanded}, which matches nothing`).toBe(true);
        });
      }
    }
  }

  it.each(["rag-retrieval-reviewer.md", "clinical-governance-reviewer.md"])(
    "%s scopes the protected src/lib/rag/** tree",
    (name) => {
      const markdown = readFileSync(join(agentsDir, name), "utf8");
      expect(scopeEntries(markdown)).toContain("src/lib/rag/**");
    },
  );

  it("rag-retrieval-reviewer's description points at src/lib/rag/**, not the pre-move src/lib/rag*.ts", () => {
    const markdown = readFileSync(join(agentsDir, "rag-retrieval-reviewer.md"), "utf8");
    expect(markdown).toContain("src/lib/rag/**");
    expect(markdown).not.toContain("src/lib/rag*.ts");
  });
});

/**
 * Cursor loads its own copies of some Claude surfaces. They are the same rules for a different
 * editor, so where the Claude twin carries a safety contract the Cursor copy must carry it too
 * (audit L62, L102, L132): the repo-auditor is triage-only, the Supabase skill's repository
 * override cannot depend on a workstation path, and `.cursorignore` must not start with a BOM
 * (`.editorconfig` is `charset = utf-8`; a BOM on line 1 would silently break a real pattern
 * moved there).
 */
describe("cursor twins of the claude surfaces", () => {
  it("cursor repo-auditor skill is triage-only, like the claude repo-auditor agent", () => {
    const cursor = readFileSync(join(repoRoot, ".cursor/skills/repo-auditor/SKILL.md"), "utf8");
    const claude = readFileSync(join(repoRoot, ".claude/agents/repo-auditor.md"), "utf8");
    for (const contract of [
      "Do not delete or move files during a review",
      "treat as candidates only",
      "is **not** dead even if statically unimported",
    ]) {
      expect(claude, `claude twin lost its contract: ${contract}`).toContain(contract);
      expect(cursor, `cursor repo-auditor must carry the triage contract: ${contract}`).toContain(contract);
    }
    expect(cursor).not.toMatch(/safely remove/i);
  });

  it("cursor supabase skill's repository override does not depend on a workstation path", () => {
    const skill = readFileSync(join(repoRoot, ".cursor/skills/supabase/SKILL.md"), "utf8");
    expect(skill).not.toMatch(/C:\\/);
    expect(skill).toContain("any checkout of BigSimmo/Database");
    // The fragments `npm run check:skills` asserts must survive the rewording.
    for (const contract of [
      "prove the target is a disposable local development database",
      "never use `execute_sql`",
      "require explicit user approval",
    ]) {
      expect(skill).toContain(contract);
    }
  });

  it(".cursorignore has no UTF-8 byte-order mark", () => {
    const bytes = readFileSync(join(repoRoot, ".cursorignore"));
    expect([bytes[0], bytes[1], bytes[2]], ".cursorignore starts with EF BB BF").not.toEqual([0xef, 0xbb, 0xbf]);
  });
});
