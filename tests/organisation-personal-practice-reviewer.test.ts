import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Personal practice reviewer is defined by the area's job, not by the pages or modes its
 * features happen to use today. Its scope therefore names the area file rather than copying the
 * area's paths: when a feature moves or a mode is renamed, only the area file changes, and this
 * agent keeps pointing at the right files without an edit. It never decides privacy, tenancy or
 * clinical content itself; it hands those to the two reviewers that do.
 */

const repoRoot = path.resolve(__dirname, "..");
const agentPath = path.join(repoRoot, ".claude/agents/personal-practice-reviewer.md");
const agent = fs.readFileSync(agentPath, "utf8");
const AREA_FILE = "docs/organisation/systems/personal-practice.json";

function scopeSection(markdown: string): string {
  return /## Scope\n([\s\S]*?)(?:\n## |$)/.exec(markdown)?.[1] ?? "";
}

function backticked(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

describe("personal practice reviewer scope", () => {
  it("points at the area file, which exists and describes the personal-practice area", () => {
    expect(backticked(scopeSection(agent))).toContain(AREA_FILE);
    const area = JSON.parse(fs.readFileSync(path.join(repoRoot, AREA_FILE), "utf8"));
    expect(area.id).toBe("personal-practice");
  });

  it("copies none of the area's feature paths, so moving a feature never needs an agent edit", () => {
    const paths = backticked(scopeSection(agent)).filter((entry) => entry.includes("/"));
    expect(paths.length).toBeGreaterThan(0);
    for (const entry of paths) {
      expect(entry, `${entry} is a feature path; the area file lists those`).toMatch(
        /^docs\/(?:organisation|decisions)\//,
      );
    }
  });
});

describe("personal practice reviewer hand-offs", () => {
  it.each(["supabase-schema-guardian", "clinical-governance-reviewer"])("hands work to %s, which exists", (name) => {
    expect(agent).toContain(`\`${name}\``);
    expect(fs.existsSync(path.join(repoRoot, ".claude/agents", `${name}.md`))).toBe(true);
  });

  it("sends privacy and tenancy to the schema guardian and clinical content to clinical governance", () => {
    const handOffs = /## Hand-offs\n([\s\S]*?)(?:\n## |$)/.exec(agent)?.[1] ?? "";
    expect(handOffs).toMatch(/Privacy, tenancy[^\n]*`supabase-schema-guardian`/);
    expect(handOffs).toMatch(/Clinical content[^\n]*`clinical-governance-reviewer`/);
  });

  it("declares its name in the front matter to match the file", () => {
    expect(agent).toMatch(/^---\nname: personal-practice-reviewer\n/);
  });
});
