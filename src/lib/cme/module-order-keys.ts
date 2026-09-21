/**
 * The CME dashboard module order's storage key and its change event, alone in
 * a module that imports nothing.
 *
 * Sibling of `src/lib/on-call/checklist-storage-keys.ts`, and here for the
 * same measured reason (see `tests/cme-root-bundle-isolation.test.ts`):
 * `src/lib/cme/module-order.ts` pulls in `createBrowserStore` and
 * `useSyncExternalStore` for the sake of one persisted string. Anything that
 * only needs the key or the event name — a future sign-out clear, a root
 * layout, anything mounted on every page — must read it from here instead, or
 * it pulls the whole reorder store into a bundle that never renders the CME
 * dashboard. On Call's own version of this file exists because that exact
 * substitution regressed `/` by 21 KiB gzip and 168 ms of LCP.
 *
 * Keep this file free of imports. Anything added here loads everywhere.
 */

export const cmeModuleOrderStorageKey = "clinical-kb-cme-module-order";
export const cmeModuleOrderChangedEvent = "clinical-kb-cme-module-order-changed";
