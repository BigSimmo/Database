import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routeFiles = [
  "src/app/mockups/caring-contacts/page.tsx",
  "src/app/mockups/caring-contacts/patients/page.tsx",
  "src/app/mockups/caring-contacts/patients/[patientId]/page.tsx",
  "src/app/mockups/caring-contacts/plans/new/page.tsx",
  "src/app/mockups/caring-contacts/plans/[planId]/page.tsx",
  "src/app/mockups/caring-contacts/schedule/page.tsx",
  "src/app/mockups/caring-contacts/contacts/[contactId]/page.tsx",
  "src/app/mockups/caring-contacts/templates/page.tsx",
  "src/app/mockups/caring-contacts/templates/[pathwayId]/page.tsx",
  "src/app/mockups/caring-contacts/team/page.tsx",
  "src/app/mockups/caring-contacts/guidance/page.tsx",
  "src/app/mockups/caring-contacts/reports/page.tsx",
  "src/app/mockups/caring-contacts/system-states/page.tsx",
] as const;

describe("Caring Contact mockup route registration", () => {
  it("registers every approved page inside the synthetic mockup namespace", () => {
    for (const file of routeFiles) {
      expect(existsSync(resolve(process.cwd(), file)), `${file} is missing`).toBe(true);
    }
    expect(existsSync(resolve(process.cwd(), "src/app/mockups/caring-contacts/layout.tsx"))).toBe(true);
  });

  it("keeps the Caring Contact shell independent from shared mockup search chrome", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/mockups/mockups-layout-client.tsx"), "utf8");
    expect(source).toContain('pathname.startsWith("/mockups/caring-contacts/")');
    expect(source).toContain("!isCaringContactMockup");
  });

  it("keeps the prototype memory-only and provider-free inside its mockup namespace", () => {
    const roots = ["src/app/mockups/caring-contacts", "src/components/caring-contacts/mockups"].map((path) =>
      resolve(process.cwd(), path),
    );
    const sourceFiles = roots.flatMap((root) =>
      readdirSync(root, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name))
        .map((entry) => readFileSync(resolve(entry.parentPath, entry.name), "utf8")),
    );
    const source = sourceFiles.join("\n");

    expect(source).not.toMatch(/\b(?:localStorage|sessionStorage|indexedDB)\b|document\.cookie/);
    expect(source).not.toMatch(/from\s+["'][^"']*(?:openai|supabase|twilio|analytics)[^"']*["']/i);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(existsSync(resolve(process.cwd(), "src/app/caring-contacts"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/app/plans"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/app/contacts"))).toBe(false);
  });
});
