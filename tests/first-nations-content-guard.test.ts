import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = "src/data/first-nations";
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
}
const all = files(ROOT).map((path) => ({ path, text: readFileSync(path, "utf8") }));
const pages = JSON.parse(readFileSync(join(ROOT, "pages.json"), "utf8")) as {
  pages: { id: string; sections: { modules: { id: string; blocks: unknown[] }[] }[] }[];
  situations: { id: string; phrases: { sourceId?: string; checkedAt?: string }[]; plan: string[] }[];
  statewideContacts: { name: string }[];
};
const approvals = JSON.parse(readFileSync(join(ROOT, "approvals.json"), "utf8")) as {
  approvals: { subjectId: string; role: string; reference: string }[];
};

function walk(value: unknown, visit: (o: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) value.forEach((v) => walk(v, visit));
  else if (value && typeof value === "object") {
    visit(value as Record<string, unknown>);
    Object.values(value).forEach((v) => walk(v, visit));
  }
}

describe("First Nations content guard", () => {
  it("contains no mobile numbers", () => {
    for (const { path, text } of all) expect(text, path).not.toMatch(/\b04\d{2}[\s-]?\d{3}[\s-]?\d{3}\b|\+614\d{8}/);
  });
  it("never claims sign-off inside content", () => {
    for (const { path, text } of all)
      if (!path.endsWith("approvals.json"))
        expect(text, path).not.toMatch(/"(reviewed|signedOff|signed_off|verified)"|"approved"\s*:\s*true/i);
  });
  it("names no individual staff (contacts are teams, services or lines)", () => {
    for (const c of pages.statewideContacts)
      expect(c.name).toMatch(/team|service|line|switchboard|liaison|interpreting|13YARN|health|council|clinic/i);
  });
  it("ships the EMHS layer disabled", () => {
    expect(JSON.parse(readFileSync(join(ROOT, "profiles/emhs.json"), "utf8")).enabled).toBe(false);
  });
  it("gives every block and phrase a source and a checked date", () => {
    walk(pages, (o) => {
      if ("kind" in o || "say" in o) {
        expect(typeof o.sourceId, JSON.stringify(o)).toBe("string");
        expect(o.checkedAt, JSON.stringify(o)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });
  it("has exactly six situations with three phrases and a 3–5 step plan", () => {
    expect(pages.situations.map((s) => s.id)).toEqual([
      "new-admission",
      "wants-to-leave",
      "family-meeting",
      "mental-health-act",
      "sorry-business",
      "going-home",
    ]);
    for (const s of pages.situations) {
      expect(s.phrases, s.id).toHaveLength(3);
      expect(s.plan.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.plan.length, s.id).toBeLessThanOrEqual(5);
    }
  });
  it("has five checks in Before you go in", () => {
    const bedside = pages.pages.find((p) => p.id === "bedside");
    const checks = bedside?.sections.flatMap((s) => s.modules).find((m) => m.id === "before-you-go-in");
    expect(checks?.blocks).toHaveLength(5);
  });
  it("records the risk line's approval only as the owner's typed OK in the thread", () => {
    for (const a of approvals.approvals.filter((r) => r.subjectId === "wants-to-leave-risk")) {
      expect(a.role).toBe("Owner");
      expect(a.reference).toMatch(/^cmsg_/);
    }
  });
});
