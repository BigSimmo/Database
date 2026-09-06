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

  it("never reaches the domain model or the store from the auth provider", () => {
    const source = read(authProvider);
    for (const forbidden of [
      "@/lib/on-call/entry-model",
      "@/lib/on-call/entry-store",
      "@/lib/on-call/repository",
      "@/lib/on-call/search",
      "@/lib/on-call/card-selection",
      "@/lib/on-call/linked-documents",
      "@/components/on-call/",
    ]) {
      expect(source, `${authProvider} must not import ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("keeps the cache-keys module free of imports, since it loads everywhere", () => {
    const source = read("src/lib/on-call/entry-cache-keys.ts");
    const imports = source.match(/^\s*import\s/gm) ?? [];
    expect(imports, "entry-cache-keys.ts must import nothing — it is in every page's bundle").toEqual([]);
  });

  it("still exposes the storage key and clear function from the store, for existing callers", () => {
    const store = read("src/lib/on-call/entry-store.ts");
    expect(store).toContain("export { clearOnCallEntryCache");
  });
});
