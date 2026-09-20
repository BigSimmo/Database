import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

/**
 * `src/app/layout.tsx` mounts the Supabase auth provider on every page, so
 * anything that provider imports is downloaded by someone who only opens the
 * home page and never touches On Call.
 *
 * It clears the On Call cache on sign-out and on an account switch, and it
 * once did so by importing `clearOnCallEntryCache` from `entry-store` — which
 * pulls in `entry-model` and its six per-section Zod schemas. Measured cost:
 * route `/` at 265.3 KiB gzip against main's 244.0 KiB, and a desktop LCP of
 * 940 ms against main's 772 ms on identical hardware, which is what CI's
 * Lighthouse budget caught. Moving the key and the clear function into an
 * import-free module returned `/` to 244.2 KiB.
 *
 * This test is the guard, because nothing else would notice the import
 * creeping back: it is one line, it typechecks, and every unit test passes.
 */
describe("the On Call domain model stays out of every page's bundle", () => {
  const authProvider = "src/lib/supabase/client.tsx";

  it("clears the cache through the import-free module, not the entry store", () => {
    const source = read(authProvider);
    expect(source).toContain('from "@/lib/on-call/entry-cache-keys"');
    expect(source).not.toContain('from "@/lib/on-call/entry-store"');
  });

  it("clears Recent through its own import-free module, not the recent store", () => {
    // Recent joined the sign-out path after the cache did, and it is the exact
    // shape that regressed once: a one-line import of a module that pulls in Zod
    // and the entry schema, for the sake of removing one localStorage key.
    const source = read(authProvider);
    expect(source).toContain('from "@/lib/on-call/recent-storage-keys"');
    expect(source).not.toContain('from "@/lib/on-call/recent-storage"');
  });

  it("clears the orientation ticks through its own import-free module", () => {
    // Third store on the sign-out path, same trap as the first two: one line,
    // it typechecks, every unit test passes, and `/` grows by the whole On
    // Call domain model.
    const source = read(authProvider);
    expect(source).toContain('from "@/lib/on-call/checklist-storage-keys"');
    expect(source).not.toContain('from "@/lib/on-call/checklist-storage"');
  });

  it("never reaches the domain model or the store from the auth provider", () => {
    const source = read(authProvider);
    for (const forbidden of [
      "@/lib/on-call/entry-model",
      "@/lib/on-call/entry-store",
      "@/lib/on-call/repository",
      "@/lib/on-call/entry-chips",
      "@/lib/on-call/card-selection",
      "@/lib/on-call/linked-documents",
      "@/components/on-call/",
    ]) {
      expect(source, `${authProvider} must not import ${forbidden}`).not.toContain(forbidden);
    }
  });

  it.each([
    "src/lib/on-call/entry-cache-keys.ts",
    "src/lib/on-call/recent-storage-keys.ts",
    "src/lib/on-call/checklist-storage-keys.ts",
  ])("keeps %s free of imports, since it loads everywhere", (modulePath) => {
    const source = read(modulePath);
    const imports = source.match(/^\s*import\s/gm) ?? [];
    expect(imports, `${modulePath} must import nothing — it is in every page's bundle`).toEqual([]);
  });

  /**
   * The SECOND door into every page's bundle, found on PR #2900 and missed by
   * every test above — they all watch `src/lib/supabase/client.tsx`, and this
   * leak did not go through it.
   *
   * `MasterSearchHeader` is the shared search chrome on `/` and
   * `/documents/search`, the two routes CI's Lighthouse budget measures. It
   * imports `mode-nav-icons.ts` for the per-mode glyphs, and that file was
   * given an import of `on-call-section-identity.ts` so On Call's sections
   * could carry their own icons. Harmless in itself — the identity module is
   * titles, hrefs and glyphs — except that it also held the one pair of
   * functions needing the domain model at runtime, so the home page started
   * downloading six Zod schemas to draw a moon icon.
   *
   * The fix was to move that pair into `on-call-entry-view.ts`. This is the
   * guard, and it is written as a REACHABILITY walk rather than a check on one
   * file, because the last two versions of this leak each came through a door
   * the previous guard was not watching.
   */
  it("cannot reach the On Call domain model from the shared search header", () => {
    const DOMAIN_MODULES = [
      "@/lib/on-call/entry-model",
      "@/lib/on-call/compliance",
      "@/lib/on-call/who-is-who",
      "@/lib/on-call/entry-store",
      "@/lib/on-call/repository",
    ];
    // Type-only imports erase at build time and cost nothing, so only value
    // imports count. `import type {...}` and `import { type X }` are both fine.
    const valueImportsOf = (relative: string): string[] => {
      const source = read(relative);
      const specifiers: string[] = [];
      const importRe = /import\s+(type\s+)?(?:([\w*{][^"']*?)\s+from\s+)?["']([^"']+)["']/g;
      for (const match of source.matchAll(importRe)) {
        const [, typeKeyword, clause, specifier] = match;
        if (typeKeyword) continue;
        // A clause whose every named binding is `type X` is also erased.
        const named = clause?.match(/\{([^}]*)\}/)?.[1];
        if (named !== undefined && clause && !clause.trim().startsWith("{")) {
          // default or namespace import alongside names: keep it
        } else if (named !== undefined) {
          const bindings = named
            .split(",")
            .map((binding) => binding.trim())
            .filter(Boolean);
          if (bindings.length > 0 && bindings.every((binding) => binding.startsWith("type "))) continue;
        }
        specifiers.push(specifier);
      }
      return specifiers;
    };
    const toPath = (specifier: string): string | null => {
      if (!specifier.startsWith("@/")) return null;
      const base = `src/${specifier.slice(2)}`;
      for (const extension of [".ts", ".tsx"]) {
        try {
          read(base + extension);
          return base + extension;
        } catch {
          // try the next extension
        }
      }
      return null;
    };

    const seen = new Set<string>();
    const trail = new Map<string, string>();
    const queue = ["src/components/clinical-dashboard/master-search-header.tsx"];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const specifier of valueImportsOf(current)) {
        if (DOMAIN_MODULES.includes(specifier)) {
          const chain: string[] = [current];
          let step = trail.get(current);
          while (step) {
            chain.push(step);
            step = trail.get(step);
          }
          throw new Error(
            `MasterSearchHeader can reach ${specifier} at runtime, which puts the On Call ` +
              `domain model in the bundle for / and /documents/search. Import chain (nearest first):\n  ` +
              chain.join("\n  ") +
              `\nMake the import type-only, or move the value into a module the header does not reach ` +
              `(see src/components/on-call/on-call-entry-view.ts).`,
          );
        }
        const next = toPath(specifier);
        if (next && !seen.has(next)) {
          trail.set(next, current);
          queue.push(next);
        }
      }
    }
    // The walk is only meaningful if it actually traversed the graph.
    expect(seen.size).toBeGreaterThan(5);
    expect(seen).toContain("src/components/mode-nav/mode-nav-icons.ts");
  });

  it("still exposes the storage key and clear function from the store, for existing callers", () => {
    const store = read("src/lib/on-call/entry-store.ts");
    expect(store).toContain("export { clearOnCallEntryCache");
  });

  it("re-exports Recent's key and clear from its store too, so callers have one import", () => {
    const store = read("src/lib/on-call/recent-storage.ts");
    expect(store).toContain("export { clearOnCallRecent");
  });

  it("re-exports the checklist key and clear from its store as well", () => {
    const store = read("src/lib/on-call/checklist-storage.ts");
    expect(store).toContain("export { clearOnCallChecklists");
  });

  it("wires all three On Call stores into the one sign-out path", () => {
    // A store added to the mode but not to `clearAccountScopedBrowserState`
    // survives an account switch on a shared ward computer, which is the whole
    // hazard this list exists for.
    const source = read(authProvider);
    for (const call of ["clearOnCallEntryCache()", "clearOnCallRecent()", "clearOnCallChecklists()"]) {
      expect(source, `sign-out must call ${call}`).toContain(call);
    }
  });
});
