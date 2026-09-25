import { describe, expect, it } from "vitest";

import { normalizeSourceAuthorityText, sourceAuthorityRegistry } from "@/lib/source-authority-registry";

// The register is indexed by `new Map(...)` over its entries, so a repeated key,
// code or publisher name is not an error at runtime: whichever entry is written
// later silently answers every lookup. #T9MZ7V found two entries keyed
// american-psychiatric-association with different jurisdictions. Each of these
// must identify exactly one entry.
function duplicates(values: Array<[string, string]>) {
  const owners = new Map<string, Set<string>>();
  for (const [value, key] of values) owners.set(value, (owners.get(value) ?? new Set()).add(key));
  return [...owners].filter(([, keys]) => keys.size > 1).map(([value, keys]) => `${value} -> ${[...keys].join(", ")}`);
}

describe("source authority register identity", () => {
  it("has one entry per key", () => {
    const counts = new Map<string, number>();
    for (const entry of sourceAuthorityRegistry) counts.set(entry.key, (counts.get(entry.key) ?? 0) + 1);
    expect([...counts].filter(([, count]) => count > 1).map(([key]) => key)).toEqual([]);
  });

  it("gives each publisher code to one entry only", () => {
    const codes = sourceAuthorityRegistry.flatMap((entry, index) =>
      entry.codes.map((code) => [code.trim().toUpperCase(), `${entry.key}#${index}`] as [string, string]),
    );
    expect(duplicates(codes)).toEqual([]);
  });

  it("gives each publisher name to one entry only", () => {
    const names = sourceAuthorityRegistry.flatMap((entry, index) =>
      entry.publisherAliases.map(
        (name) => [normalizeSourceAuthorityText(name), `${entry.key}#${index}`] as [string, string],
      ),
    );
    expect(duplicates(names)).toEqual([]);
  });
});
