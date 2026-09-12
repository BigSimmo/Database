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

  it.each(["src/lib/on-call/entry-cache-keys.ts", "src/lib/on-call/recent-storage-keys.ts"])(
    "keeps %s free of imports, since it loads everywhere",
    (modulePath) => {
      const source = read(modulePath);
      const imports = source.match(/^\s*import\s/gm) ?? [];
      expect(imports, `${modulePath} must import nothing — it is in every page's bundle`).toEqual([]);
    },
  );

  it("still exposes the storage key and clear function from the store, for existing callers", () => {
    const store = read("src/lib/on-call/entry-store.ts");
    expect(store).toContain("export { clearOnCallEntryCache");
  });

  it("re-exports Recent's key and clear from its store too, so callers have one import", () => {
    const store = read("src/lib/on-call/recent-storage.ts");
    expect(store).toContain("export { clearOnCallRecent");
  });
});
