import { registerHooks } from "node:module";

export function registerServerOnlyHook() {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "server-only") {
        return { url: new URL("../tests/stubs/server-only.ts", import.meta.url).href, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  });
}
