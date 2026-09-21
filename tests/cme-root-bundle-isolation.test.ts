import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

/**
 * CME analogue of `tests/on-call-root-bundle-isolation.test.ts`.
 *
 * `src/lib/cme/module-order-keys.ts` exists so that anything which only needs
 * the dashboard reorder preference's storage key or its change event name —
 * a future sign-out clear, the root layout, anything mounted on every page —
 * can read it without pulling in `client-store-factory`, `useSyncExternalStore`
 * and the whole reorder store. That is exactly the shape of the regression
 * the On Call suite this mirrors exists for: one import of the heavy module,
 * for the sake of one string, cost route `/` 21 KiB gzip and 168 ms of LCP.
 *
 * CME is not yet wired into the sign-out path this repository already has —
 * that wiring lives in `src/lib/supabase/client.tsx`, owned by a different
 * task. This suite still holds the two things this task can guarantee on its
 * own: the key module stays import-free, and the heavier store reads its
 * constants from it rather than keeping its own copy — plus a guard that
 * nothing mounted on every page has quietly reached for the heavy module
 * already.
 */
describe("the CME module-order store stays out of every page's bundle", () => {
  it("keeps module-order-keys.ts free of imports, since it can load everywhere", () => {
    const source = read("src/lib/cme/module-order-keys.ts");
    const imports = source.match(/^\s*import\s/gm) ?? [];
    expect(imports, "src/lib/cme/module-order-keys.ts must import nothing — it is safe to load on every page").toEqual(
      [],
    );
  });

  it("defines the storage key and the change event exactly once, in the import-free module", () => {
    const keysSource = read("src/lib/cme/module-order-keys.ts");
    expect(keysSource).toContain("cmeModuleOrderStorageKey");
    expect(keysSource).toContain("cmeModuleOrderChangedEvent");

    // The heavy store must read those constants from the light module rather
    // than redeclaring its own copy of the same strings — two copies is
    // exactly how a key and a future "clear on sign-out" caller drift apart.
    const storeSource = read("src/lib/cme/module-order.ts");
    expect(storeSource).toContain('from "@/lib/cme/module-order-keys"');
    expect(storeSource.match(/"clinical-kb-cme-module-order/g) ?? []).toHaveLength(0);
  });

  it("never reaches the reorder store, its heavier dependency, or CME components from the root layout", () => {
    const layoutSource = read("src/app/layout.tsx");
    for (const forbidden of ['"@/lib/cme/module-order"', "@/lib/client-store-factory", "@/components/cme/"]) {
      expect(layoutSource, `src/app/layout.tsx must not import ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("never reaches the CME reorder store or CME components from the sign-out path", () => {
    const authProvider = read("src/lib/supabase/client.tsx");
    expect(authProvider, "src/lib/supabase/client.tsx must not import the CME reorder store directly").not.toContain(
      '"@/lib/cme/module-order"',
    );
    expect(authProvider, "src/lib/supabase/client.tsx must not import CME components").not.toContain(
      "@/components/cme/",
    );
  });
});
