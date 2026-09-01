/**
 * Token-layer divergence contract.
 *
 * `layout.tsx` mounts `.ckb-v2` unconditionally on <html>, and `.ckb-v2.ckb-v2`
 * (0,2,0) outranks `:root` (0,1,0) on that same element. So for any role BOTH
 * `globals.css` and `ckb-v2-tokens.css` declare, the v2 value is the one that
 * paints and the globals.css declaration is dead — editing it changes nothing,
 * silently, with no lint, no type error and no failing screenshot.
 *
 * The v2 migration is deliberate and unfinished (see docs/design-system/TOKENS.md),
 * so divergence is not banned. It is PINNED: the set below is the reviewed set,
 * and any name that starts diverging, or stops, fails until the pin is updated.
 * That turns an invisible trap into a deliberate, reviewable one.
 *
 * Refresh with: npm run design-system:token-divergence:update
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const GLOBALS = fileURLToPath(new URL("../src/app/globals.css", import.meta.url));
const V2 = fileURLToPath(new URL("../src/app/ckb-v2-tokens.css", import.meta.url));
export const PIN_PATH = fileURLToPath(new URL("../docs/design-system/token-layer-divergences.json", import.meta.url));

/** Slice from `marker` to the first line-initial `}` that closes it. */
function block(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) return null;
  const end = source.indexOf("\n}", start);
  if (end === -1) return null;
  return source.slice(start, end);
}

/** Every block for one selector, including grouped (`.sel,`) openers, concatenated. */
function allBlocks(source, selector) {
  const opener = `\n${selector} {`;
  const grouped = `\n${selector},`;
  let start = source.indexOf(opener);
  if (start === -1) start = source.indexOf(grouped);
  let combined = "";
  while (start > -1) {
    const end = source.indexOf("\n}", start);
    // A missing terminator would restart the scan at 0 and loop forever.
    if (end === -1) break;
    combined += source.slice(start, end);
    const nextOpener = source.indexOf(opener, end + 1);
    const nextGrouped = source.indexOf(grouped, end + 1);
    if (nextOpener === -1) start = nextGrouped;
    else if (nextGrouped === -1) start = nextOpener;
    else start = Math.min(nextOpener, nextGrouped);
  }
  return combined;
}

function declarations(source) {
  const map = new Map();
  if (!source) return map;
  for (const [, name, value] of source.matchAll(/^ {2}(--[a-z0-9-]+)\s*:\s*([^;]+);/gim)) {
    map.set(name, value.trim().replace(/\s+/g, " "));
  }
  return map;
}

/**
 * Both layers, per theme. Missing a block is a hard error rather than an empty
 * comparison: an empty map would report "no divergence" and pass loudly-green.
 */
export function readLayers() {
  const globals = readFileSync(GLOBALS, "utf8");
  const v2 = readFileSync(V2, "utf8");
  // `@theme` and `:root` both land at (0,1,0) on <html>, so within globals.css the
  // later block wins — `:root` follows `@theme`, so `:root` is overlaid second.
  // `@theme` carries the structural roles (radius, spacing, type scale), which is
  // exactly where a silent mismatch is most expensive, so it cannot be skipped.
  const themeConfig = block(globals, "\n@theme {");
  const root = block(globals, "\n:root {");
  const darkRoot = block(globals, "\n.dark {");
  if (!themeConfig) throw new Error("globals.css is missing its @theme block");
  if (!root) throw new Error("globals.css is missing its :root block");
  if (!darkRoot) throw new Error("globals.css is missing its .dark block");

  const lightCompat = declarations(themeConfig);
  for (const [name, value] of declarations(root)) lightCompat.set(name, value);

  const themes = {
    light: [lightCompat, allBlocks(v2, ".ckb-v2.ckb-v2")],
    dark: [declarations(darkRoot), allBlocks(v2, ".dark .ckb-v2.ckb-v2")],
  };
  const out = {};
  for (const [theme, [compat, v2Source]] of Object.entries(themes)) {
    if (!v2Source) throw new Error(`ckb-v2-tokens.css is missing its ${theme} token block`);
    out[theme] = { compat, v2: declarations(v2Source) };
  }
  return out;
}

/** `{ light: { "--surface": { compat, v2 } }, dark: {...} }` for every shared, differing role. */
export function computeDivergences() {
  const layers = readLayers();
  const result = {};
  for (const [theme, { compat, v2 }] of Object.entries(layers)) {
    const diverging = {};
    for (const [name, compatValue] of compat) {
      if (!v2.has(name)) continue;
      const v2Value = v2.get(name);
      if (v2Value !== compatValue) diverging[name] = { compat: compatValue, v2: v2Value };
    }
    result[theme] = Object.fromEntries(
      Object.keys(diverging)
        .sort()
        .map((k) => [k, diverging[k]]),
    );
  }
  return result;
}

export function readPin() {
  return JSON.parse(readFileSync(PIN_PATH, "utf8"));
}

export function writePin(divergences) {
  const payload = {
    $comment:
      "Roles declared in BOTH globals.css and ckb-v2-tokens.css with different values. " +
      "The v2 value paints; the globals.css value is dead. Reviewed set — refresh with " +
      "`npm run design-system:token-divergence:update` and say in the PR why each change is right.",
    generatedBy: "scripts/token-layer-divergences.mjs",
    counts: Object.fromEntries(Object.entries(divergences).map(([theme, roles]) => [theme, Object.keys(roles).length])),
    divergences,
  };
  writeFileSync(PIN_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

/** Human-readable drift between the pinned set and the stylesheets, or []. */
export function diffAgainstPin(divergences = computeDivergences(), pin = readPin()) {
  const problems = [];
  for (const theme of Object.keys(divergences)) {
    const actual = divergences[theme];
    const pinned = pin.divergences?.[theme] ?? {};
    for (const name of Object.keys(actual)) {
      if (!(name in pinned)) {
        problems.push(
          `${theme}: ${name} newly diverges (globals.css "${actual[name].compat}" vs v2 "${actual[name].v2}"). ` +
            `The v2 value paints, so the globals.css edit does nothing. Change both together, or pin it deliberately.`,
        );
        continue;
      }
      if (pinned[name].v2 !== actual[name].v2 || pinned[name].compat !== actual[name].compat) {
        problems.push(`${theme}: ${name} still diverges but its values changed; re-review and refresh the pin.`);
      }
    }
    for (const name of Object.keys(pinned)) {
      if (!(name in actual)) {
        problems.push(`${theme}: ${name} no longer diverges — remove it from the pin so the count keeps falling.`);
      }
    }
  }
  return problems;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const divergences = computeDivergences();
  const counts = Object.entries(divergences)
    .map(([theme, roles]) => `${theme} ${Object.keys(roles).length}`)
    .join("; ");
  if (process.argv.includes("--write")) {
    writePin(divergences);
    console.log(`Token-layer divergence pin written (${counts}).`);
  } else {
    const problems = diffAgainstPin(divergences);
    if (problems.length > 0) {
      console.error("Token-layer divergence pin is out of date:");
      for (const problem of problems) console.error(`  - ${problem}`);
      console.error("\nRefresh with: npm run design-system:token-divergence:update");
      process.exit(1);
    }
    console.log(`Token-layer divergence pin matches (${counts}).`);
  }
}
