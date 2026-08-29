import { describe, expect, it, vi } from "vitest";

import {
  countDarkColorOverridesInSource,
  countHardcodedCssMotionDurations,
  countLegacyPaletteUtilitiesInSource,
  countOnePixelShadowSpreadsInSource,
  countRawCssZIndicesInSource,
  findDebtPathRegressions,
  findCssLayoutTransitionsInSource,
  findDensityRecipeOverridesInSource,
  findErrorStateCountPropsInSource,
  findElevationInversionsInSource,
  findFailedStateResultCountsInSource,
  findHandRolledCommandButtonsInSource,
  findHardcodedMotionClassesInSource,
  findInteractiveTapFloorDeclarationsInSource,
  findInteractiveTapLiteralsInSource,
  findJsxEdgeOwnershipConflictsInSource,
  findLayoutTransitionClassesInSource,
  findRawScaleLiteralClassesInSource,
  findRawScaleLiteralDeclarationsInSource,
  findSameFileTextSmMinusMix,
  findTextSoftConsumersInSource,
  findTypeStepCssUsagesInSource,
  findTypeStepUsagesInSource,
  findUnapprovedZIndexClassesInSource,
  hasLegacyTapClass,
  listPrimitiveRecipeSourcePaths,
  rawColorContractSource,
  readPrimitiveRecipeSources,
  UI_PRIMITIVES_BARREL,
} from "../scripts/design-system-contract-utils.mjs";

describe("design-system contract helpers", () => {
  it("blocks literal and dynamic result counts in ErrorState copy", () => {
    expect(
      findErrorStateCountPropsInSource(
        "src/example.tsx",
        [
          'const literal = <ErrorState title="0 matches" />;',
          "const dynamic = <ErrorState body={`${results.length} results could not load`} />;",
          'const valid = <ErrorState title="Results unavailable" body="Try again." />;',
        ].join("\n"),
      ),
    ).toEqual(["src/example.tsx:1 (title)", "src/example.tsx:2 (body)"]);
  });

  it("ignores ErrorState references outside TSX and non-count copy", () => {
    expect(findErrorStateCountPropsInSource("src/example.ts", 'const component = "ErrorState 0 results";')).toEqual([]);
    expect(
      findErrorStateCountPropsInSource(
        "src/example.tsx",
        '<ErrorState title="Unable to load results" body="The request failed." />',
      ),
    ).toEqual([]);
  });

  it("blocks result counts rendered by error and failed branches", () => {
    expect(
      findFailedStateResultCountsInSource(
        "src/example.tsx",
        [
          "const logical = error && <p>{results.length} results</p>;",
          'const conditional = status === "error" ? <p>{resultCount} matches</p> : <Results />;',
          "if (failed) return <Results count={0} />;",
          "const validError = error && <p>Results unavailable</p>;",
          "const validSuccess = ready && <p>{results.length} results</p>;",
        ].join("\n"),
      ),
    ).toEqual(["src/example.tsx:1", "src/example.tsx:2", "src/example.tsx:3"]);
  });

  it("detects variant-prefixed tap literals inside composed interactive classes", () => {
    expect(hasLegacyTapClass("sm:h-11")).toBe(true);
    expect(hasLegacyTapClass("dark:md:min-w-11")).toBe(true);
    expect(
      findInteractiveTapLiteralsInSource(
        "src/example.tsx",
        '<button className={cn("h-11", active && "md:w-11", `focus:min-h-11`)}>Save</button>',
      ),
    ).toEqual(["src/example.tsx:1"]);
    expect(
      findInteractiveTapLiteralsInSource(
        "src/example.tsx",
        '<div className={cn("h-11", active && "md:w-11")}>Decoration</div>',
      ),
    ).toEqual([]);
  });

  it("flags interactive controls declaring a sub-floor min-height, and only those (Gate 2)", () => {
    const find = (source: string) => findInteractiveTapFloorDeclarationsInSource("src/example.tsx", source);

    // The violation: an interactive element declaring its own floor under 48px.
    expect(find('<button className="min-h-9 px-3">Reset</button>')).toEqual(["src/example.tsx:1"]);
    expect(find('<button className={cn("inline-flex min-h-10", active && "px-3")}>Reset</button>')).toEqual([
      "src/example.tsx:1",
    ]);
    expect(find('<summary className="min-h-8">Details</summary>')).toEqual(["src/example.tsx:1"]);
    expect(find('<summary className="min-h-[42px]">Details</summary>')).toEqual(["src/example.tsx:1"]);
    expect(find('<button className="min-h-[2.5rem]">Reset</button>')).toEqual(["src/example.tsx:1"]);
    expect(find('<button className={compact ? "min-h-10" : "min-h-12"}>Reset</button>')).toEqual(["src/example.tsx:1"]);
    expect(find('<button className={cn("min-h-12", compact && "min-h-10")}>Reset</button>')).toEqual([
      "src/example.tsx:1",
    ]);

    // The repo's correct responsive pattern must NOT be flagged: 48px on
    // phones, released to the 40px compact-meta step-down from `sm` up.
    expect(find('<button className="min-h-12 sm:min-h-10">Save</button>')).toEqual([]);
    expect(find('<button className="min-h-tap lg:min-h-[2.5rem]">Save</button>')).toEqual([]);
    expect(find('<button className="min-h-[48px]">Save</button>')).toEqual([]);

    // TOKENS.md §2 bans `--row-compact` (36px) as a tap target with no
    // breakpoint carve-out, so a prefixed band below the 40px compact-meta
    // floor is the defect — not a "deliberate desktop release". Reading the
    // unprefixed token alone made this class of violation unreachable.
    expect(find('<button className="min-h-tap sm:min-h-9">Save</button>')).toEqual(["src/example.tsx:1"]);
    expect(find('<button className="min-h-12 lg:min-h-9">Save</button>')).toEqual(["src/example.tsx:1"]);
    expect(find('<summary className="min-h-tap lg:min-h-8">Details</summary>')).toEqual(["src/example.tsx:1"]);
    expect(find('<button className={cn("min-h-tap", "md:min-h-9 px-2")}>Save</button>')).toEqual(["src/example.tsx:1"]);

    // The band cascade: a later band restores the floor for itself and every
    // band above it, but not for the one that was already short.
    expect(find('<button className="min-h-tap sm:min-h-9 lg:min-h-12">Save</button>')).toEqual(["src/example.tsx:1"]);
    expect(find('<button className="min-h-tap sm:min-h-10 lg:min-h-12">Save</button>')).toEqual([]);

    // A band that turns the control inert has no tap target to floor. Narrow by
    // construction: `pointer-events-none` must win in the SAME band.
    expect(find('<button className="min-h-tap sm:pointer-events-none sm:min-h-0">Header</button>')).toEqual([]);
    expect(find('<button className="min-h-tap sm:min-h-0">Header</button>')).toEqual(["src/example.tsx:1"]);
    expect(
      find('<button className="pointer-events-none min-h-tap sm:pointer-events-auto sm:min-h-9">X</button>'),
    ).toEqual(["src/example.tsx:1"]);

    // A `:` inside an arbitrary value is not a variant separator.
    expect(find('<button className="min-h-[calc(100dvh-2rem)] text-[color:var(--text)]">Save</button>')).toEqual([]);
    expect(find('<button className="min-h-[3rem]">Save</button>')).toEqual([]);
    expect(find('<button className={compact ? "min-h-tap" : "min-h-12"}>Save</button>')).toEqual([]);

    // A short height on a NON-interactive element is layout, not a tap target.
    expect(find('<div className="min-h-9">Panel</div>')).toEqual([]);

    // Scoped to `min-h-*`: a short `h-*`/`size-*` is routinely the visible box
    // of a control whose hit area belongs to a tap-sized wrapper, so flagging
    // it would pad the baseline with non-defects (GATES.md §5).
    expect(find('<input type="checkbox" className="h-4 w-4" />')).toEqual([]);
  });

  it("finds whitespace, fallback, URL, string and template --text-soft consumers in TypeScript", () => {
    const source = [
      'const spacedClose = "text-[color:var(--text-soft )]";',
      'const spacedOpen = "text-[color:var( --text-soft )]";',
      'const fallback = "text-[color:var( --text-soft , var(--text-muted))]";',
      'const url = "bg-[url(https://example.test/a//b)] text-[color:var(--text-soft)]";',
      "const runtime = `x // color:var(--text-soft )`;",
      "// const lineComment = 'var(--text-soft)';",
      "/* const blockComment = 'var( --text-soft )'; */",
      'const declaration = "--text-soft: #8894a6";',
    ].join("\n");

    expect(findTextSoftConsumersInSource("src/example.tsx", source)).toEqual([
      "src/example.tsx:1",
      "src/example.tsx:2",
      "src/example.tsx:3",
      "src/example.tsx:4",
      "src/example.tsx:5",
    ]);
  });

  it("parses CSS declarations while ignoring declarations, comments and quoted content", () => {
    const source = [
      ":root { --text-soft: #8894a6; --decoration-soft: #8894a6; }",
      ".spaced { color: var( --text-soft ); }",
      '.url { background-image: url("https://example.test/a//b"); color: var(--text-soft, CanvasText); }',
      '.quoted { content: "var(--text-soft)"; }',
      "/* .commented { color: var(--text-soft ); } */",
      ".inline-comment { color: /* var(--text-soft) */ var(--text-muted); }",
      ".safe { color: var(--decoration-soft); }",
    ].join("\n");

    expect(findTextSoftConsumersInSource("src/example.css", source)).toEqual([
      "src/example.css:2",
      "src/example.css:3",
    ]);
  });

  it("detects border and ring width ownership on the same JSX literal without merging exclusive branches", () => {
    expect(
      findJsxEdgeOwnershipConflictsInSource(
        "src/example.tsx",
        [
          '<button className="border border-[color:var(--border)] focus-visible:ring-4 focus-visible:ring-[color:var(--focus)]" />',
          '<button className={cn("border", active && "ring-2")} />',
          '<div className={`border ${active ? "ring-2" : ""}`} />',
          '<div className={clsx("border", { "ring-2": active })} />',
          '<div className={clsx("border", { ...{ "ring-2": active } })} />',
          '<button className={active ? "border" : "ring-1"} />',
          '<span className="ring-1 ring-[color:var(--border)]" />',
          'const base = "border";',
          'const stateEdge = active && "ring-2";',
          "<div className={cn(base, stateEdge)} />",
        ].join("\n"),
      ),
    ).toEqual([
      "src/example.tsx:1",
      "src/example.tsx:2",
      "src/example.tsx:3",
      "src/example.tsx:4",
      "src/example.tsx:5",
      "src/example.tsx:10",
    ]);
  });

  it("resolves same-name edge recipes within their declaring function", () => {
    const safeThenConflict = [
      "function Safe() {",
      '  const edge = "bg-red-500";',
      '  return <div className={cn(edge, active && "ring-2")} />;',
      "}",
      "function Conflict() {",
      '  const edge = "border";',
      '  return <div className={cn(edge, active && "ring-2")} />;',
      "}",
    ].join("\n");
    const conflictThenSafe = [
      "function Conflict() {",
      '  const edge = "border";',
      '  return <div className={cn(edge, active && "ring-2")} />;',
      "}",
      "function Safe() {",
      '  const edge = "bg-red-500";',
      '  return <div className={cn(edge, active && "ring-2")} />;',
      "}",
    ].join("\n");

    expect(findJsxEdgeOwnershipConflictsInSource("src/example.tsx", safeThenConflict)).toEqual(["src/example.tsx:7"]);
    expect(findJsxEdgeOwnershipConflictsInSource("src/example.tsx", conflictThenSafe)).toEqual(["src/example.tsx:3"]);
  });

  it("honours nested edge shadows and blocks later declarations from leaking backwards", () => {
    const nestedShadow = [
      'const edge = "border";',
      "function Component() {",
      '  const outer = <div className={cn(edge, active && "ring-2")} />;',
      "  {",
      '    const edge = "bg-red-500";',
      '    const nested = <div className={cn(edge, active && "ring-2")} />;',
      "  }",
      "  return outer;",
      "}",
    ].join("\n");
    const declarationAfterUse = [
      "function Component() {",
      '  const before = <div className={cn(edge, active && "ring-2")} />;',
      '  const edge = "border";',
      "  return before;",
      "}",
    ].join("\n");

    expect(findJsxEdgeOwnershipConflictsInSource("src/example.tsx", nestedShadow)).toEqual(["src/example.tsx:3"]);
    expect(findJsxEdgeOwnershipConflictsInSource("src/example.tsx", declarationAfterUse)).toEqual([]);
  });

  it("keeps switch CaseBlock bindings inside the switch lexical scope", () => {
    const source = [
      'const edge = "border";',
      "function Component(kind: string) {",
      "  switch (kind) {",
      '    case "safe":',
      '      const edge = "bg-red-500";',
      '      const safe = <div className={cn(edge, active && "ring-2")} />;',
      "      break;",
      "  }",
      '  return <div className={cn(edge, active && "ring-2")} />;',
      "}",
    ].join("\n");

    expect(findJsxEdgeOwnershipConflictsInSource("src/example.tsx", source)).toEqual(["src/example.tsx:9"]);
  });

  it("blocks Chip and metadata density overrides while allowing layout-only classes", () => {
    const source = [
      'const ok = <Chip className="whitespace-nowrap shrink-0" />;',
      'const badChip = <Chip className={cn("h-6", active && "text-xs")} />;',
      'const badPill = <span className={cn(metadataPillDensity.compact, "sm:min-h-8")} />;',
      "const pill = metadataPillDensity.compact;",
      'const badAlias = <span className={clsx(pill, "h-8 text-sm")} />;',
      'const badObject = <span className={cn(metadataPillDensity.compact, { "h-8": active })} />;',
      'const exclusive = <span className={active ? metadataPillDensity.compact : "h-8 text-sm"} />;',
    ].join("\n");

    expect(findDensityRecipeOverridesInSource("src/example.tsx", source)).toEqual([
      "src/example.tsx:2 (h-6, text-xs)",
      "src/example.tsx:3 (min-h-8)",
      "src/example.tsx:5 (h-8, text-sm)",
      "src/example.tsx:6 (h-8)",
    ]);
  });

  it("resolves metadataPill aliases lexically across functions and nested blocks", () => {
    const source = [
      'import { metadataPillDensity as pillDensity } from "@/components/ui";',
      "function Safe() {",
      '  const pill = "text-red-500";',
      '  return <span className={cn(pill, "h-8")} />;',
      "}",
      "function Conflict() {",
      "  const pill = pillDensity.compact;",
      '  const outer = <span className={cn(pill, "h-8")} />;',
      "  {",
      '    const pill = "text-red-500";',
      '    const nested = <span className={cn(pill, "h-8")} />;',
      "  }",
      "  return outer;",
      "}",
    ].join("\n");

    expect(findDensityRecipeOverridesInSource("src/example.tsx", source)).toEqual(["src/example.tsx:8 (h-8)"]);
  });

  it("does not resolve a metadataPill alias declared after its use", () => {
    const source = [
      "function Component() {",
      '  const before = <span className={cn(pill, "h-8")} />;',
      "  const pill = metadataPill.compact;",
      "  return before;",
      "}",
    ].join("\n");

    expect(findDensityRecipeOverridesInSource("src/example.tsx", source)).toEqual([]);
  });

  it("recognises metadata density element access without misclassifying a local object", () => {
    const source = [
      'const conflict = <span className={cn(metadataPillDensity["compact"], "h-8")} />;',
      "function Safe() {",
      '  const metadataPillDensity = { compact: "text-red-500" };',
      '  return <span className={cn(metadataPillDensity["compact"], "h-8")} />;',
      "}",
    ].join("\n");

    expect(findDensityRecipeOverridesInSource("src/example.tsx", source)).toEqual(["src/example.tsx:1 (h-8)"]);
  });

  it("recognises destructured metadata density aliases without crossing function scope", () => {
    const source = [
      "const { compact: pill } = metadataPillDensity;",
      'const conflict = <span className={cn(pill, "h-8")} />;',
      "function Safe() {",
      '  const { compact: pill } = { compact: "text-red-500" };',
      '  return <span className={cn(pill, "h-8")} />;',
      "}",
    ].join("\n");

    expect(findDensityRecipeOverridesInSource("src/example.tsx", source)).toEqual(["src/example.tsx:2 (h-8)"]);
  });

  it("recognises namespace metadata exports without misclassifying a shadowed namespace", () => {
    const source = [
      'import * as UI from "@/components/ui";',
      'const conflict = <span className={cn(UI.metadataPill.compact, "h-8")} />;',
      "function Safe() {",
      '  const UI = { metadataPill: "text-red-500" };',
      '  return <span className={cn(UI.metadataPill, "h-8")} />;',
      "}",
    ].join("\n");

    expect(findDensityRecipeOverridesInSource("src/example.tsx", source)).toEqual(["src/example.tsx:2 (h-8)"]);
  });

  it("finds hardcoded motion utilities but accepts named duration tokens", () => {
    const source = [
      'export const help = "Do not use transition-all or duration-200 in components";',
      'const good = <div className="transition-transform duration-[var(--duration-fast)]" />;',
      'const bad = <div className="transition-all duration-200 delay-[75ms]" />;',
    ].join("\n");

    expect(findHardcodedMotionClassesInSource("src/example.tsx", source)).toEqual([
      "src/example.tsx:3 (transition-all)",
      "src/example.tsx:3 (duration-200)",
      "src/example.tsx:3 (delay-[75ms])",
    ]);
  });

  it("reports layout-property transition utilities and CSS declarations", () => {
    expect(
      findLayoutTransitionClassesInSource(
        "src/example.tsx",
        '<div className="transition-[height,background-color] sm:transition-[grid-template-rows] transition-transform" />;',
      ),
    ).toEqual([
      { relativePath: "src/example.tsx", line: 1, property: "height" },
      { relativePath: "src/example.tsx", line: 1, property: "grid-template-rows" },
    ]);
    expect(
      findCssLayoutTransitionsInSource(
        "src/example.css",
        [
          ".a { transition: padding-bottom var(--duration-fast) ease }",
          ".b { transition-property: opacity, top }",
          '.c { --menu-transition: height 100ms; content: "transition: bottom 2s;" }',
        ].join("\n"),
      ),
    ).toEqual([
      { relativePath: "src/example.css", line: 1, property: "padding-bottom" },
      { relativePath: "src/example.css", line: 2, property: "top" },
    ]);
  });

  it("rejects arbitrary layout transitions outside the paint-safe allowlist", () => {
    expect(
      findLayoutTransitionClassesInSource(
        "src/example.tsx",
        '<div className="transition-[max-height] transition-[min-width] transition-[margin] transition-[padding-left] transition-[right] transition-[bottom] transition-[inset] transition-[flex-basis] transition-[opacity,transform]" />',
      ).map(({ property }) => property),
    ).toEqual(["max-height", "min-width", "margin", "padding-left", "right", "bottom", "inset", "flex-basis"]);
  });

  it("enforces named z-index rungs across standard and arbitrary utilities", () => {
    expect(
      findUnapprovedZIndexClassesInSource(
        "src/example.tsx",
        '<div className="z-40 z-[95] z-[var(--z-modal)] z-(--z-toast) sm:z-[77] hover:z-50 -z-10 z-[calc(90+1)] z-[var(--arbitrary)]" />',
      ),
    ).toEqual([
      "src/example.tsx:1 (sm:z-[77])",
      "src/example.tsx:1 (hover:z-50)",
      "src/example.tsx:1 (-z-10)",
      "src/example.tsx:1 (z-[calc(90+1)])",
      "src/example.tsx:1 (z-[var(--arbitrary)])",
    ]);
    expect(
      findUnapprovedZIndexClassesInSource("src/example.tsx", "const dynamic = <div className={`z-[${level}]`} />;"),
    ).toEqual(["src/example.tsx:1 (z-[)"]);
  });

  it("counts legacy palette utilities and dark color overrides from static class strings", () => {
    const source =
      '<div className="bg-white text-slate-700 dark:bg-black/50 dark:text-center dark:text-balance dark:border-collapse hover:bg-[color:var(--surface)]" />;';
    expect(countLegacyPaletteUtilitiesInSource("src/example.tsx", source)).toBe(3);
    expect(countDarkColorOverridesInSource("src/example.tsx", source)).toBe(1);
  });

  it("counts only a true fourth 1px shadow length as a forbidden spread", () => {
    const source = [
      ".a { box-shadow: 0 1px 2px rgb(0 0 0 / 20%); }",
      ".b { box-shadow: inset 0 0 0 1px var(--border), 0 2px 4px -1px black }",
      ".c { --shadow-card: 0 0 1px rgb(0 0 0 / 20%); }",
      '.d { --menu-shadow: 0 0 0 1px red; content: "box-shadow: 0 0 0 1px" }',
    ].join("\n");
    expect(countOnePixelShadowSpreadsInSource(source)).toBe(1);
  });

  it("counts hardcoded CSS durations and delays, including reduced-motion sentinels", () => {
    const source = [
      ".a { transition: opacity 150ms ease, transform var(--duration-fast) ease; }",
      ".b { animation-duration: 0.01ms !important; }",
      ".c { transition-duration: 0.2s; }",
      ".d { transition-delay: 75ms }",
      '.e { --menu-transition: height 100ms; content: "transition: height 2s" }',
    ].join("\n");
    expect(countHardcodedCssMotionDurations(source)).toBe(4);
  });

  it("counts numeric CSS z-index declarations but not auto or token values", () => {
    expect(
      countRawCssZIndicesInSource(
        '.a{z-index:95}.b{z-index: -1}.c{z-index:auto}.d{z-index:var(--z-modal)}.e{--menu-z-index:999;content:"z-index: 999"}',
      ),
    ).toBe(2);
    expect(countRawCssZIndicesInSource(".a{z-index: 95;}.b{z-index:-1;}")).toBe(2);
  });

  it("pins the globals.css raw CSS z-index exception baseline at 4 (DS-P3-06)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const globals = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
    expect(countRawCssZIndicesInSource(globals)).toBe(4);
    expect(countRawCssZIndicesInSource(`${globals}\n.ds-p3-06-probe{z-index:9999}`)).toBe(5);
  });

  it("counts a same-file text-sm + text-sm-minus mix as one warn/ratchet hit, not a hard zero", () => {
    expect(
      findSameFileTextSmMinusMix(
        "src/probe.tsx",
        'export const probe = <p className="text-sm text-sm-minus text-[color:var(--text)]" />;',
      ),
    ).toEqual(["src/probe.tsx"]);
    expect(
      findSameFileTextSmMinusMix("src/probe.tsx", 'export const onlySm = <p className="text-sm leading-5" />;'),
    ).toEqual([]);
    expect(
      findSameFileTextSmMinusMix(
        "src/probe.tsx",
        'export const onlyMinus = <p className="text-sm-minus leading-5" />;',
      ),
    ).toEqual([]);
    expect(
      findSameFileTextSmMinusMix(
        "src/probe.ts",
        'const copy = "Prefer text-sm over text-sm-minus without a className";',
      ),
    ).toEqual([]);
  });

  it("counts bare padding, radius and line-height literals in classes but not computed values", () => {
    const found = findRawScaleLiteralClassesInSource(
      "src/probe.tsx",
      'export const probe = <div className="px-[22px] rounded-[7px] leading-[1.35]" />;',
    );
    expect(found.padding).toEqual(["src/probe.tsx:1 (px-[22px])"]);
    expect(found.radius).toEqual(["src/probe.tsx:1 (rounded-[7px])"]);
    expect(found.lineHeight).toEqual(["src/probe.tsx:1 (leading-[1.35])"]);

    // Arbitrary-property spellings reach the same CSS properties and must not
    // bypass the named-utility matchers.
    const arbitraryProperty = findRawScaleLiteralClassesInSource(
      "src/probe.tsx",
      'export const probe = <div className="[padding:22px] [border-radius:7px] [line-height:1.35]" />;',
    );
    expect(arbitraryProperty.padding).toEqual(["src/probe.tsx:1 ([padding:22px])"]);
    expect(arbitraryProperty.radius).toEqual(["src/probe.tsx:1 ([border-radius:7px])"]);
    expect(arbitraryProperty.lineHeight).toEqual(["src/probe.tsx:1 ([line-height:1.35])"]);

    // The sanctioned computed forms production actually ships. A `(?!var\()`
    // lookahead would flag every one of these, because they open with `env(`,
    // `max(`, `clamp(` or `calc(` rather than `var(`.
    const exempt = findRawScaleLiteralClassesInSource(
      "src/probe.tsx",
      'export const probe = <div className="p-[var(--pad-card)] pb-[env(safe-area-inset-bottom)] pt-[max(0.5rem,var(--safe-area-top))] px-[clamp(1rem,2vw,2rem)] pl-[calc(7rem+1px)] rounded-[var(--radius-lg)] leading-[var(--leading-prose)] [padding:var(--pad-card)] [border-radius:calc(0.5rem+1px)]" />;',
    );
    expect(exempt.padding).toEqual([]);
    expect(exempt.radius).toEqual([]);
    expect(exempt.lineHeight).toEqual([]);
  });

  // A literal margin has four spellings and the ratchet must see all of them.
  // The first pass of this metric caught only the positive class utility, so a
  // negative utility, an arbitrary-property utility, or a plain stylesheet
  // declaration each cleared `check:design-system-contract` untouched - which
  // would have made the metric read as coverage it did not have.
  it("counts every spelling of a literal margin, and still exempts zero and tokens", () => {
    const positive = findRawScaleLiteralClassesInSource(
      "src/probe.tsx",
      'export const probe = <div className="mt-[22px]" />;',
    );
    expect(positive.margin).toEqual(["src/probe.tsx:1 (mt-[22px])"]);

    const negative = findRawScaleLiteralClassesInSource(
      "src/probe.tsx",
      'export const probe = <div className="-mt-[22px]" />;',
    );
    expect(negative.margin).toEqual(["src/probe.tsx:1 (-mt-[22px])"]);

    const arbitraryMarginProperty = findRawScaleLiteralClassesInSource(
      "src/probe.tsx",
      'export const probe = <div className="[margin-top:22px]" />;',
    );
    expect(arbitraryMarginProperty.margin).toEqual(["src/probe.tsx:1 ([margin-top:22px])"]);

    // The stylesheet half, so a literal cannot simply move out of a class.
    expect(findRawScaleLiteralDeclarationsInSource(".probe{margin-top:22px}").margin).toHaveLength(1);
    expect(findRawScaleLiteralDeclarationsInSource(".probe{margin-inline-start:9px}").margin).toHaveLength(1);

    // Zero and token-valued margins are not literals and must stay uncounted,
    // or the ratchet would flag the correct spelling alongside the wrong one.
    expect(findRawScaleLiteralDeclarationsInSource(".probe{margin:0}").margin).toEqual([]);
    expect(findRawScaleLiteralDeclarationsInSource(".probe{margin:var(--gap-stack)}").margin).toEqual([]);
    expect(
      findRawScaleLiteralClassesInSource(
        "src/probe.tsx",
        'export const probe = <div className="mt-[var(--gap-stack)]" />;',
      ).margin,
    ).toEqual([]);
  });

  it("reports bare text-* selections without deciding which names are type steps", () => {
    const usages = findTypeStepUsagesInSource(
      "src/probe.tsx",
      'export const probe = <div className="text-sm-minus sm:text-2xs text-[color:var(--text)] text-[12px] text-balance" />;',
    );
    // Variant prefixes are stripped, so `sm:text-2xs` counts as selecting the
    // step. Arbitrary and colour forms are not bare names and are left to
    // check:type-scale, which is the half that already ships.
    expect(usages).toContain("sm-minus");
    expect(usages).toContain("2xs");
    expect(usages).not.toContain("[color:var(--text)]");
    // Non-size `text-*` utilities share the namespace; the caller filters them
    // out by intersecting with the @theme block rather than this module
    // guessing, so they are reported here unfiltered.
    expect(usages).toContain("balance");
  });

  it("counts the same three literals in CSS declarations, exempting zero, keywords and tokens", () => {
    const found = findRawScaleLiteralDeclarationsInSource(".a{padding:13px 9px;border-radius:7px;line-height:1.35;}");
    expect(found.padding).toEqual(["source.css:1 (padding: 13px 9px)"]);
    expect(found.radius).toEqual(["source.css:1 (border-radius: 7px)"]);
    expect(found.lineHeight).toEqual(["source.css:1 (line-height: 1.35)"]);

    const exempt = findRawScaleLiteralDeclarationsInSource(
      ".a{padding:0;padding-inline:0dvh;border-radius:0svw;line-height:0lh;padding-block:var(--pad-card);border-top-left-radius:inherit;line-height:normal;margin:5px;--radius-xs:0.25rem;}",
    );
    expect(exempt.padding).toEqual([]);
    expect(exempt.radius).toEqual([]);
    expect(exempt.lineHeight).toEqual([]);
  });

  it("reports direct var(--text-*) consumers for the shared unused-step predicate", () => {
    expect(
      findTypeStepCssUsagesInSource(
        '.a{font-size:var(--text-2xl-minus)}.b{font-size:var(--text-hero, 2rem)}.c{--text-sm-minus:1rem;content:"var(--text-sm-minus)"}',
        "src/probe.css",
      ),
    ).toEqual(["2xl-minus", "hero"]);
    expect(
      findTypeStepCssUsagesInSource(
        'const style = { fontSize: "var(--text-2xl-minus)" };\n// var(--text-hero)\n',
        "src/probe.tsx",
      ),
    ).toEqual(["2xl-minus"]);
  });

  it("rejects debt moved to a new path even when its global total is unchanged", () => {
    expect(findDebtPathRegressions("legacy", { "src/new.tsx": 1 }, { "src/old.tsx": 1 })).toEqual([
      "legacy at src/new.tsx increased from 0 to 1",
    ]);
    expect(findDebtPathRegressions("legacy", { "src/old.tsx": 1 }, { "src/old.tsx": 2 })).toEqual([]);
  });

  it("masks raw colours only inside the fixed-paper factsheet rendering scope", () => {
    const reportFailure = vi.fn();
    // Therapy paper tokens now live in globals.css, which is whole-file exempt.
    const factsheetSource = [
      'const appChrome = "#123456";',
      'function FactsheetPrintSheet() { return <div style={{ color: "#ffffff" }} />; }',
    ].join("\n");
    const scopedFactsheet = rawColorContractSource(
      "src/components/factsheets/factsheet-detail-page.tsx",
      factsheetSource,
      reportFailure,
    );
    expect(scopedFactsheet).toContain("#123456");
    expect(scopedFactsheet).not.toContain("#ffffff");
    expect(reportFailure).not.toHaveBeenCalled();
  });

  it("masks only the pre-paint theme-color constant, not the rest of theme.ts", () => {
    const reportFailure = vi.fn();
    const source = [
      "export const APP_THEME_COLORS = {",
      '  light: "#ffffff",',
      '  dark: "#060708",',
      "} as const satisfies Record<ResolvedTheme, string>;",
      "",
      "// A later, unrelated raw colour in this file must stay countable — the",
      "// whole-file exemption this replaced would have hidden it.",
      'export const UNRELATED_ACCENT = "#0f766e";',
      'export const SCRIPT = `var c=d?"${APP_THEME_COLORS.dark}":"${APP_THEME_COLORS.light}";`;',
    ].join("\n");

    const scoped = rawColorContractSource("src/lib/theme.ts", source, reportFailure);

    expect(scoped).not.toContain("#ffffff");
    expect(scoped).not.toContain("#060708");
    expect(scoped).toContain("#0f766e");
    // The interpolating bootstrap script holds no literals of its own and must
    // survive masking intact.
    expect(scoped).toContain("APP_THEME_COLORS.dark");
    expect(reportFailure).not.toHaveBeenCalled();
  });

  it("anchors the theme-color boundary on the declaration, not a passing mention", () => {
    const reportFailure = vi.fn();
    // A doc comment naming the constant sits ABOVE an unrelated raw colour. A
    // bare "APP_THEME_COLORS" marker would anchor on that mention and mask
    // everything from the comment through the block, silently swallowing the
    // unrelated colour with no failure reported. Masking runs before comments
    // are stripped, so comment-stripping does not rescue it.
    const source = [
      "// Pre-paint values live in APP_THEME_COLORS below.",
      'export const UNRELATED_ACCENT = "#0f766e";',
      "export const APP_THEME_COLORS = {",
      '  light: "#ffffff",',
      '  dark: "#060708",',
      "} as const;",
    ].join("\n");

    const scoped = rawColorContractSource("src/lib/theme.ts", source, reportFailure);

    expect(scoped).toContain("#0f766e");
    expect(scoped).not.toContain("#ffffff");
    expect(scoped).not.toContain("#060708");
    expect(reportFailure).not.toHaveBeenCalled();
  });

  it("fails closed when the pre-paint theme-color boundary disappears", () => {
    const reportFailure = vi.fn();
    // The constant was renamed/removed but the exemption still matches the path.
    const source = 'export const THEME_COLORS = { light: "#ffffff" };';

    // Unmasked, so both literals are counted and the ratcheted baseline goes red
    // rather than silently exempting the file.
    expect(rawColorContractSource("src/lib/theme.ts", source, reportFailure)).toBe(source);
    expect(reportFailure).toHaveBeenCalledWith("pre-paint theme-color boundary is missing");
  });

  it("does not mistake a renamed/suffixed declaration for the real APP_THEME_COLORS boundary", () => {
    const reportFailure = vi.fn();
    const source = 'export const APP_THEME_COLORS_V2 = { light: "#ffffff" };';

    expect(rawColorContractSource("src/lib/theme.ts", source, reportFailure)).toBe(source);
    expect(reportFailure).toHaveBeenCalledWith("pre-paint theme-color boundary is missing");
  });

  it("masks only the medication accent-default swatch, not other hex in the same file", () => {
    const reportFailure = vi.fn();
    const source = ['export const UNRELATED = "#123456";', 'accent: row.accent ?? "#0f766e",'].join("\n");
    const scoped = rawColorContractSource("src/lib/medication-records.ts", source, reportFailure);
    expect(scoped).toContain("#123456");
    expect(scoped).not.toContain("#0f766e");
    expect(reportFailure).not.toHaveBeenCalled();
    const meds = rawColorContractSource(
      "src/lib/medications.ts",
      'accent: record.accent?.trim() || "#0f766e",',
      reportFailure,
    );
    expect(meds).not.toContain("#0f766e");
  });

  it("fails closed when the medication accent-default swatch disappears", () => {
    const reportFailure = vi.fn();
    const source = 'export const UNRELATED = "#123456";';
    expect(rawColorContractSource("src/lib/medications.ts", source, reportFailure)).toBe(source);
    expect(reportFailure).toHaveBeenCalledWith("medication accent default boundary is missing");
  });

  it("fails closed when a fixed-paper factsheet boundary disappears", () => {
    const reportFailure = vi.fn();
    const source = 'const appChrome = "#123456";';

    expect(rawColorContractSource("src/components/factsheets/factsheet-detail-page.tsx", source, reportFailure)).toBe(
      source,
    );
    expect(reportFailure).toHaveBeenCalledWith("printable factsheet paper boundary is missing");
  });

  it("flags an intrinsic command-fill button that bypasses Button/primaryControl", () => {
    const source = [
      "export function Demo() {",
      '  return <button type="button" className="bg-[color:var(--command)] text-[color:var(--command-contrast)]">Go</button>;',
      "}",
    ].join("\n");
    expect(findHandRolledCommandButtonsInSource("src/components/demo.tsx", source)).toEqual([
      "src/components/demo.tsx:2",
    ]);
  });

  it("does not flag Link + primaryControl or the Button primitive file", () => {
    const link = [
      'import { primaryControl } from "@/components/ui-primitives";',
      "export function Demo() {",
      '  return <a className={primaryControl} href="/x">Go</a>;',
      "}",
    ].join("\n");
    expect(findHandRolledCommandButtonsInSource("src/components/demo.tsx", link)).toEqual([]);
    expect(
      findHandRolledCommandButtonsInSource(
        "src/components/ui/button.tsx",
        '<button className="bg-[color:var(--command)]">X</button>',
      ),
    ).toEqual([]);
  });

  it("still flags an intrinsic command-fill button whose className literally contains the word Button", () => {
    const source = [
      "export function Demo() {",
      '  return <button type="button" className="bg-[color:var(--command)] Button">Go</button>;',
      "}",
    ].join("\n");
    expect(findHandRolledCommandButtonsInSource("src/components/demo.tsx", source)).toEqual([
      "src/components/demo.tsx:2",
    ]);
  });

  it("flags a child with a heavier resting elevation than its in-flow parent", () => {
    const source = [
      "export function Card() {",
      "  return (",
      '    <section className="shadow-[var(--e0)]">',
      '      <div className="shadow-[var(--e2)]">heavy</div>',
      "    </section>",
      "  );",
      "}",
    ].join("\n");
    expect(findElevationInversionsInSource("src/components/demo.tsx", source)).toEqual(["src/components/demo.tsx:4"]);
  });

  it("does not flag lux overlay elevation against a parent surface", () => {
    const source = [
      "export function Overlay() {",
      "  return (",
      '    <section className="shadow-[var(--e1)]">',
      '      <div className="shadow-[var(--shadow-lux)]">sheet</div>',
      "    </section>",
      "  );",
      "}",
    ].join("\n");
    expect(findElevationInversionsInSource("src/components/demo.tsx", source)).toEqual([]);
  });

  it("does not flag an absolutely positioned popover with heavier elevation than its in-flow ancestor", () => {
    const source = [
      "export function Card() {",
      "  return (",
      '    <section className="shadow-[var(--e0)]">',
      '      <div className="absolute shadow-[var(--e2)]">popover</div>',
      "    </section>",
      "  );",
      "}",
    ].join("\n");
    expect(findElevationInversionsInSource("src/components/demo.tsx", source)).toEqual([]);
  });

  it("does not flag a fixed-positioned child (e.g. a toast) with heavier elevation than its in-flow ancestor", () => {
    const source = [
      "export function Card() {",
      "  return (",
      '    <section className="shadow-[var(--e0)]">',
      '      <div className="fixed shadow-[var(--e2)]">toast</div>',
      "    </section>",
      "  );",
      "}",
    ].join("\n");
    expect(findElevationInversionsInSource("src/components/demo.tsx", source)).toEqual([]);
  });

  it("masks only the medication accent default, not other hex in the same file", () => {
    const reportFailure = vi.fn();
    const source = [
      "export function rowToMedicationRecord(row) {",
      '  return { accent: row.accent ?? "#0f766e", tag: row.tag };',
      "}",
      'export const UNRELATED = "#123456";',
      'export const ALSO_TEAL = "#0f766e";',
    ].join("\n");

    const records = rawColorContractSource("src/lib/medication-records.ts", source, reportFailure);
    expect(records).not.toMatch(/accent: row\.accent \?\? "#0f766e"/);
    expect(records).toContain('export const ALSO_TEAL = "#0f766e"');
    expect(records).toContain("#123456");
    expect(reportFailure).not.toHaveBeenCalled();

    const medications = rawColorContractSource(
      "src/lib/medications.ts",
      'export function normalizeRecord(record) { return { accent: record.accent?.trim() || "#0f766e" }; }\nexport const OTHER = "#abcdef";',
      reportFailure,
    );
    expect(medications).not.toContain("#0f766e");
    expect(medications).toContain("#abcdef");
    expect(reportFailure).not.toHaveBeenCalled();
  });

  it("does not treat accentColor or a comment mention as the medication accent default", () => {
    const reportFailure = vi.fn();
    const source = [
      'export const accentColor = "#0f766e";',
      '// fallback accent: row.accent ?? "#0f766e"',
      'export const UNRELATED = "#123456";',
    ].join("\n");

    expect(rawColorContractSource("src/lib/medications.ts", source, reportFailure)).toBe(source);
    expect(reportFailure).toHaveBeenCalledWith("medication accent default boundary is missing");
  });

  it("fails closed when the medication accent default boundary disappears", () => {
    const reportFailure = vi.fn();
    const source = 'export const FALLBACK = "#0f766e";';

    expect(rawColorContractSource("src/lib/medication-records.ts", source, reportFailure)).toBe(source);
    expect(reportFailure).toHaveBeenCalledWith("medication accent default boundary is missing");
  });
});

describe("primitive recipe source walkers", () => {
  it("lists the barrel plus every primitive-recipes module", () => {
    const paths = listPrimitiveRecipeSourcePaths();
    expect(paths[0]).toBe(UI_PRIMITIVES_BARREL);
    expect(paths).toEqual(
      expect.arrayContaining([
        "src/components/primitive-recipes/recipes.ts",
        "src/components/primitive-recipes/composer.ts",
        "src/components/primitive-recipes/clinical.tsx",
        "src/components/primitive-recipes/feedback.tsx",
      ]),
    );
  });

  it("still sees recipes that moved out of the barrel", () => {
    const sources = readPrimitiveRecipeSources();
    expect(sources).toContain("export const controlDisabled");
    expect(sources).toContain('export const chatComposerInput = "chat-composer-input"');
    expect(sources).toContain("export function AsyncButton");
    expect(sources).toContain("statusDotReady");
  });
});
