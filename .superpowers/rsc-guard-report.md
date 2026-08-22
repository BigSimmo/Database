# RSC boundary guard — design, evidence, and limits

Branch `claude/rsc-boundary-guard`, cut from `origin/main` at `2327bd962`.

## What was built

| File | Role |
| --- | --- |
| `tests/helpers/module-graph.ts` | **New.** The import-graph machinery lifted verbatim out of `tests/architecture-boundaries.test.ts`: `sourceFiles`, `parseModuleSource`, `moduleSpecifiersFromSource`, `resolveModule`, `buildRuntimeGraph`, `runtimeGraph`, `relative`, plus a new `hasUseClientDirective`. |
| `tests/architecture-boundaries.test.ts` | **Edited.** Now imports that machinery instead of declaring it. Its six assertions are byte-for-byte unchanged in behaviour; only the duplicated resolver was removed. |
| `tests/rsc-boundary.test.ts` | **New.** Both analysers, their fixtures, and the real-tree assertions. |

There is exactly one import resolver in the repository. The brief was explicit that two resolvers
that drift are worse than none, and the alternative — importing helpers out of a `*.test.ts` file —
would have made a test file load-bearing for another test file.

## Check A — event handlers on the server side

### The walk

Entry points are `src/app/**/{page,layout}.tsx` without a `"use client"` directive. From each, the
guard walks the **render graph**, not the import graph: from a component into the components it
names in its own JSX, resolving each JSX name through that module's imports. It stops at any module
carrying `"use client"`. Every violation is reported with the chain that reaches it
(`src/app/privacy/page.tsx -> <Toolbar>`), because "this file has a handler" is not actionable on
its own.

### Why the render graph and not import reachability

The brief specified import reachability. I built that first and it reported **six violations on a
clean `main`**, none of them a live defect:

```
src/components/mode-home-template.tsx:256 onClick   - reached by src/app/(search-app)/calculators/search/page.tsx
src/components/mode-home-template.tsx:369 onClick   - reached by ...
src/components/mode-home-template.tsx:416 onClick   - reached by ...
src/components/specifiers/specifier-ui.tsx:80 onChange - reached by src/app/(search-app)/specifiers/[slug]/page.tsx
src/components/ui-primitives.tsx:325 onClick        - reached by src/app/(search-app)/dictionary/search/page.tsx
src/components/ui-primitives.tsx:394 onClick        - reached by ...
```

Every one is a shared UI module with no `"use client"` directive that exports **both** a server-safe
helper and an interactive component: `ui-primitives.tsx` exports `cn`, `eyebrowText` and `EmptyState`
alongside `IconButton` and a toggle switch. Server pages import the helpers. Next compiles the
interactive component into the client graph for whichever *client* module renders it. Nothing throws.

An import-reachability check flags essentially every shared UI module in this codebase, forever. That
is the guard-gets-disabled failure the brief warns about, so the walk was re-anchored where React
actually steps.

### Two further narrowings, each removing a measured false positive

**1. The value must be provably a function.** After switching to the render graph, four of the six
findings vanished but two remained:

```
src/components/mode-home-template.tsx:369 onClick in <ModeHomeTemplate>
  - rendered via src/app/mockups/factsheets-home-detailed/page.tsx -> <FactsheetsHomePage> -> <ModeHomeTemplate>
src/components/mode-home-template.tsx:416 onClick in <ModeHomeTemplate>
```

`ModeHomeTemplate` renders `actions.map(action => action.href ? <Link/> : <button onClick={action.onClick}>)`.
`FactsheetsHomePage` passes `actions={[]}`. The branch never renders, and `action.onClick` is
data-dependent even when it does. So the attribute value is now classified:

- **Certain** — an inline arrow/function expression, an identifier bound to a function literal
  anywhere in the module (which covers the common `function handleReset() {}` inside a component),
  or a `.bind(...)` call.
- **Uncertain** — a member expression off props or data, a conditional, an unresolved identifier.
  Not reported.

**2. The attribute must land on a host element or a client component.** Handing a function to
*another Server Component's* `on*`-named prop is legal — it never crosses the boundary. The target
element is resolved: intrinsic lowercase name → always a throw; component imported from a
`"use client"` module → always a throw; locally declared or imported from a non-client module →
legal, skipped. If that server component then puts the value on a host element, the walk catches it
there instead.

### What Check A deliberately does not flag

All of these are fail-open — misses, never false alarms:

- a handler arriving through props rather than defined locally (the `ModeHomeTemplate` shape);
- a component handed over as a value rather than named in JSX (`<Shell render={Toolbar} />`);
- a component reached through `next/dynamic`;
- a default export wrapped in a higher-order call (`export default withThing(Page)`);
- spread props (`{...handlers}`), which carry no statically visible attribute name;
- an `on*` prop on a component from a bare package specifier (`next/link`) — the resolver does not
  follow into `node_modules`, so `<Link onClick={fn}>` in a Server Component is not caught.

## Check B — server modules reading client data

For any module on the server side of the **import** graph (module granularity is right here: a
server-side module holds a client-reference proxy no matter which function reads it), the guard looks
at bindings imported from `"use client"` modules and flags **member access** (`binding.something`) or
a **call** (`binding()`).

Deliberately not flagged:

- a client component used as a JSX element name — Babel models `<ClientCard />` as `JSXIdentifier`,
  never `Identifier`, so JSX names are structurally excluded;
- a compound client component (`<Tabs.List />`), likewise a JSX name;
- a binding passed along as a value (`<Slot render={ClientCard} />`, `export { ClientCard }`,
  `register(ClientCard)`);
- `import type` and `{ type X }` specifiers, at declaration and specifier level — these vanish at
  runtime and would otherwise false-positive on every file importing a type from a client module;
- identifiers in TypeScript type positions — the AST walker skips `typeAnnotation`, `returnType`,
  `typeParameters` and friends, and descends into `TS*` nodes only for the expression-wrapping
  family (`as`, `satisfies`, `!`);
- shadowed names — if the module declares its own binding with the same name anywhere, that name is
  dropped entirely rather than risk attributing an inner-scope variable's member access to the
  import.

I did **not** conclude Check B needs type information. Every discrimination it makes is syntactic:
type-only imports are marked in the AST, and JSX element names are a distinct node type. It shipped.

## Fixture evidence — both directions

`npm run test -- tests/rsc-boundary.test.ts tests/architecture-boundaries.test.ts` → **32 passed**.

**Check A must report:**

- a handler rendered directly by a Server Component page (`target: "host element"`);
- a handler in a module the server page renders through — asserted with the full chain
  `via === ["page.tsx", "<Toolbar>"]`;
- every handler-shaped attribute (`onSubmit`, `onChange`, `onFocus`), not just `onClick`;
- a function handed to a **client** component's prop (`target: "<ClientCard>"`);
- a sibling export **once a server page actually renders it** — the same `SHARED_UI_MODULE` fixture
  that is silent in the test below, proving the render-graph anchoring is a real discrimination and
  not a blanket exemption.

**Check A must stay silent for:**

- the same handler in a file that carries `"use client"`;
- a handler module reached only *through* a client module;
- a sibling export in a module the page imports but never renders (`EmptyState` from a module that
  also exports `IconButton`);
- a data-dependent handler in a generic template — the `ModeHomeTemplate` shape reproduced as a
  fixture, `actions={[]}` and all;
- a function handed to another **Server** Component's prop;
- a lowercase or valueless attribute (`online`, `ononsense="x"`, bare `onClick`);
- a client entry point, which is never walked out of.

Also asserted: a default export aliased to a local declaration (`export default Page`) and a barrel
re-export (`export { Toolbar } from "./toolbar"`) are both followed.

**Check B must report:** the exact class-2 bug (`MODE_ROWS.flatMap(...)`), a call on a client export,
and namespace member access.

**Check B must stay silent for:** a client component rendered as JSX; a compound client component;
a binding passed as a value; a type-only import (both `import type` and `{ type X }` forms, with a
qualified type reference `CatalogRow.Nested` that a naive walker would flag as member access); member
access on a non-client module; a same-named property key; a shadowing local; and a reading module
that is itself a client module.

## Real-tree evidence

**The tree is clean under both checks.**

```
 Test Files  2 passed (2)
      Tests  32 passed (32)
```

Because a clean tree proves nothing on its own, I mutated a real Server Component
(`src/app/privacy/page.tsx`) with one instance of each bug — an inline `onClick` on a `<button>`,
and a call to `hasRenderableAccessibleTable` imported from `src/components/AccessibleTable.tsx`
(a real `"use client"` module) — and re-ran:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
+ "src/app/privacy/page.tsx:15 onClick in <default> - rendered via src/app/privacy/page.tsx"
+ "src/app/privacy/page.tsx:12 call on hasRenderableAccessibleTable from @/components/AccessibleTable - reached by src/app/privacy/page.tsx"
      Tests  2 failed | 24 passed (26)
```

The file was restored from a byte copy and `git status` confirmed a clean working tree afterwards.

## Mockup scoping decision: mockups are IN

`eslint.config.mjs` defines `MOCKUP_IGNORES = ["src/app/mockups/**", "**/*-mockups/**", "**/*-mockups.tsx", "**/*-mockup.tsx"]`,
and mockups are exempt from the button-wiring and route-reachability gates. I did not follow that
here, for two reasons.

1. **Two mockup subtrees do not 404 in production.**
   `src/lib/developer-area/headers.ts` declares
   `DEVELOPER_GATED_PATH_PREFIXES = ["/mockups/development", "/mockups/caring-contacts"]`, and
   `src/app/mockups/layout.tsx` calls `notFound()` only when `!mockupsEnabled() && !isDeveloperGatedArea`.
   `src/proxy.ts` marks those two prefixes so they reach a signed-in-administrator gate instead of a
   404. A boundary violation there is a live 500 on a real production route.
2. **For the other 101 mockup routes, the failure mode is a hard runtime throw** that breaks the page
   for the design-review audience the mockups exist to serve. The mockup exemptions elsewhere are
   about *product* concerns (a dead button is a UX defect; an unlinked route is an orphan) — neither
   applies to a page that cannot render at all.

The one repository finding that came from mockup scope (`factsheets-home-detailed`) turned out to be
a false positive of the analyser, not a reason to narrow the scope; it was fixed in the analyser.

## Known false-positive risk

Low, and I looked for it specifically — every candidate the coarser versions produced was traced to
source and either fixed in the analyser or confirmed benign. The residual risks:

- **A `.bind(...)` call on a non-function.** `provablyFunctionValue` accepts any `x.bind(...)` as a
  function. A property genuinely named `bind` that returns something else would be misread. I judged
  this vanishingly rare against the value of catching `onClick={this.handle.bind(this)}`.
- **Cross-component name collision in `functionValuedNames`.** Function-literal names are gathered
  module-wide, so if component A declares `const handleClick = () => {}` and component B references
  an unrelated prop also called `handleClick`, B's reference is treated as certain. This can only
  produce a false positive within a single module, and the flagged line would still be a
  `<button onClick={handleClick}>` in server code — worth a human look either way.
- **`import * as ns` in Check B.** Every `ns.anything` is member access, so a namespace import used
  only to render `<ns.Card />` is safe (JSX name), but `ns.CONSTANT` in a type-adjacent runtime
  position would be flagged. No instance exists in the tree.

The larger risk in the opposite direction is under-reporting: the fail-open list above is long, and
deliberately so. This guard catches the bug that was actually shipped, not every conceivable boundary
violation.

## Commands run

```
npm run test -- tests/rsc-boundary.test.ts tests/architecture-boundaries.test.ts
  → Test Files  2 passed (2) / Tests  32 passed (32)     [GATE_RECEIPTS=refresh on the final run]

npm run typecheck:source
  → tsc -p tsconfig.typecheck.json --noEmit ... TYPECHECK_EXIT_CODE=0

npx prettier --check tests/rsc-boundary.test.ts tests/helpers/module-graph.ts tests/architecture-boundaries.test.ts
  → All matched files use Prettier code style!
```

Repository-wide `npm run format` was **not** run — only the three changed files were formatted and
checked. Per `AGENTS.md`, a per-file Prettier check is not the repository-wide check; if this branch
is pushed, the whole-tree format should be run first.

Not run, by instruction: `npm run lint`, `npm run build`, `verify:pr-local`, `test:focused`, the full
`npm run test`. No dev server, no install, no provider-backed command. The run coordinator refused
admission repeatedly (another worktree, `D:\Worktrees\Database\cc-2a-live`, held the focused-test
lease); every gate above was retried inside a single bounded loop until it was admitted, and the
reported exit codes are from real runs, not from a refusal.

`tests/gate-receipts.test.ts` is known to fail on this Windows Dev Drive for environmental reasons
and was not in any filtered run.
