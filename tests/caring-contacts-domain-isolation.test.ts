// tests/caring-contacts-domain-isolation.test.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const DOMAIN_ROOT = path.join(process.cwd(), "src", "lib", "caring-contacts");
const FORBIDDEN = [/^@\/components/, /^@\/app/, /^@\/lib\//, /^@supabase/, /^openai$/, /^next(\/|$)/];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith(".ts") ? [full] : [];
  });
}

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((match) => match[1]);
}

describe("caring-contacts domain isolation", () => {
  it("imports nothing from outside its own directory", () => {
    const offences: string[] = [];
    for (const file of walk(DOMAIN_ROOT)) {
      for (const specifier of importSpecifiers(readFileSync(file, "utf8"))) {
        if (specifier.startsWith("node:")) continue;
        if (specifier.startsWith(".")) continue;
        if (FORBIDDEN.some((pattern) => pattern.test(specifier))) {
          offences.push(`${path.relative(process.cwd(), file)} -> ${specifier}`);
        }
      }
    }
    expect(offences).toEqual([]);
  });

  it("never escapes its directory with a relative import", () => {
    const offences: string[] = [];
    for (const file of walk(DOMAIN_ROOT)) {
      for (const specifier of importSpecifiers(readFileSync(file, "utf8"))) {
        if (!specifier.startsWith(".")) continue;
        const resolved = path.resolve(path.dirname(file), specifier);
        // A bare `startsWith(DOMAIN_ROOT)` is a string-prefix test, not a path-containment test:
        // `.../src/lib/caring-contacts-server/config` satisfies it too, because that sibling
        // directory's name extends this one's as a prefix. Require the separator (or an exact
        // match on the root itself) so a relative import escaping into caring-contacts-server --
        // the reverse-direction dependency the plan forbids absolutely -- cannot pass silently.
        if (resolved !== DOMAIN_ROOT && !resolved.startsWith(DOMAIN_ROOT + path.sep)) {
          offences.push(`${path.relative(process.cwd(), file)} -> ${specifier}`);
        }
      }
    }
    expect(offences).toEqual([]);
  });

  it("keeps caring-contact migrations out of the Clinical KB migration directory", () => {
    const clinicalKbMigrations = path.join(process.cwd(), "supabase", "migrations");
    const strays = readdirSync(clinicalKbMigrations).filter((name) => /caring[-_]?contact/i.test(name));
    expect(strays).toEqual([]);
  });
});
