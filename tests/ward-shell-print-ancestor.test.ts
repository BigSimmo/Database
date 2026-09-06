import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * THE WHOLE WARD TREE'S PRINT CORRECTNESS RESTS ON ONE COMPOSES EDGE, AND NOTHING PINNED IT.
 *
 * Measured in Chromium 151 on 2026-09-04, under `emulateMedia({ media: "print",
 * colorScheme: "dark" })`, with the reset present ONLY on an ancestor two levels up and the
 * descendant screen composing nothing and carrying no print block of its own:
 *
 *     screen media (control)   tour bg rgb(23,26,29)   caption rgb(244,246,248)   cell rgb(244,246,248)
 *     print media              tour bg rgb(255,255,255) caption rgb(0,0,0)        cell rgb(0,0,0)
 *
 * The chain that produces that, every link read rather than recalled:
 *
 *   1. `src/app/mockups/ward-flow/layout.tsx` wraps `children` — the whole of every route's own
 *      output — in `<WardGround>`. It is the ONLY layout under the ward-flow route tree, so every
 *      ward route is inside it.
 *   2. `WardGround` renders `<div className={styles.shell}>{children}</div>`.
 *   3. `.shell` in `ward-shell.module.css` does `composes: wardTokens from "./ward-tokens.module.css"`,
 *      so the compiled element carries BOTH class names.
 *   4. `ward-tokens.module.css` carries `@media print { .wardTokens, .wardTokens * { … !important } }`.
 *
 * `.wardTokens *` therefore matches every element of every ward route's IN-FLOW content, and
 * `!important` beats a colour or background the element declares on itself — which is the one thing
 * an ordinary ancestor rule cannot do, and the reason the per-screen fixes were needed before this
 * edge existed.
 *
 * ⚠️ IN-FLOW IS LOAD-BEARING IN THAT SENTENCE, AND AN EARLIER VERSION OF THIS COMMENT OMITTED IT.
 * `.wardTokens *` reaches DOM descendants only, and one ward surface is not a DOM descendant of the
 * shell: `ward-management-navigation.tsx` renders the phone drawer through `<Sheet>`, which renders
 * through `OverlayPortal` (`@/components/ui/overlay-root`). Portalled content leaves the shell's
 * subtree entirely, so `.drawerBody` and everything inside it is NOT covered by this chain.
 *
 * That is why `ward-sidebar.module.css`'s own three-root print block — `.panel`, `.drawerBody`,
 * `.phoneBar`, each with its wildcard — is LOAD-BEARING rather than belt-and-braces, and must not be
 * removed as redundant on the strength of the chain below.
 *
 * ⚠️ AND NOTE HOW THE WRONG ANSWER WAS NEARLY REACHED, TWICE. A grep for `createPortal` across
 * `src/components/ward-management/**` returns nothing — the portal is two files away, in a shared
 * `Sheet`. And an import-graph traversal correctly reports that no ward component is reachable from
 * a non-ward route, which is a fact about REACHABILITY and says nothing about DOM CONTAINMENT. Both
 * instruments were sound; both answered a narrower question than the one being asked.
 *
 * ⚠️ WHY THIS FILE EXISTS SEPARATELY FROM `ward-management-print-coverage.test.ts`. That guard asks
 * a PER-FILE question: does this stylesheet carry, or compose, a reset that wins? It would notice
 * the central reset being deleted, because every composing file would go uncovered at once. It
 * would NOT notice link 1, 2 or 3 breaking, because each stylesheet's own text is unchanged — the
 * files keep their own belt-and-braces blocks and stay individually green while the tree silently
 * loses the blanket that covers anything WITHOUT one. A future screen added with no print block is
 * correct on the day it is added because of this chain, and nothing else would say so.
 *
 * ⚠️ AND IT IS PROVED IN BOTH DIRECTIONS, WHICH MUTATION TESTING ALONE DOES NOT GIVE YOU. Every
 * mutation run on this programme had the shape "make the code wrong, watch it go red". Both defects
 * actually found in these guards were the other direction — a guard going red on CORRECT code —
 * and that is the more dangerous half, because the natural repair is to change the working code
 * until the guard is satisfied. So each assertion below accepts every spelling that is equivalent
 * in EFFECT, and the "accepts correct variants" block proves it does.
 */

const REPO_ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/u, "$1");

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

/** CSS comments in this tree discuss `composes`, `print` and this very defect at length. */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, "");
}

/** JS/TS comments, so a doc comment naming `WardGround` cannot stand in for rendering it. */
function stripTsComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");
}

const LAYOUT = "src/app/mockups/ward-flow/layout.tsx";
const SHELL_TSX = "src/components/ward-management/ward-shell.tsx";
const SHELL_CSS = "src/components/ward-management/ward-shell.module.css";
const TOKENS_CSS = "src/components/ward-management/ward-tokens.module.css";

/** The print block of a stylesheet, as text, with comments already stripped. */
function printBlock(css: string): string {
  const start = css.search(/@media[^{]*\bprint\b/u);
  if (start < 0) return "";
  let depth = 0;
  let i = css.indexOf("{", start);
  do {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") depth -= 1;
    i += 1;
  } while (depth > 0 && i < css.length);
  return css.slice(start, i);
}

/**
 * Does `block` neutralise `property` for print on `selector`, in ANY spelling that is equivalent in
 * effect? `background` and `background-color` both neutralise a themed fill; `Canvas` and
 * `transparent` both leave paper showing; whitespace and declaration order are free.
 *
 * ⚠️ Accepting the `background` shorthand HERE is not licence to write it in a stylesheet that
 * draws with `background-image` — the shorthand resets `background-image` to none, and blocked /
 * held / past bed states are hatch patterns. This guard's tolerance and a stylesheet's discipline
 * are different questions, and collapsing them is how a guard starts dictating worse CSS.
 */
function neutralisesForPrint(block: string, property: "color" | "background"): boolean {
  const values = property === "color" ? String.raw`CanvasText|WindowText` : String.raw`Canvas|Window|transparent|none`;
  const names = property === "color" ? String.raw`color` : String.raw`background(?:-color)?`;
  return new RegExp(String.raw`(?:^|;|\{)\s*(?:${names})\s*:\s*(?:${values})\b`, "iu").test(block);
}

describe("the shell is the ancestor that carries every ward route into print", () => {
  it("the ward layout wraps every route's output in WardGround", () => {
    const layout = stripTsComments(read(LAYOUT));
    expect(
      /<WardGround[\s>]/u.test(layout),
      `${LAYOUT}: must render <WardGround> — it is what puts the token class on an ancestor of every ward route. ` +
        `Comments are stripped before matching, so naming WardGround in prose does not satisfy this.`,
    ).toBe(true);
    expect(
      /\{\s*children\s*\}/u.test(layout),
      `${LAYOUT}: must render {children} inside WardGround. If a route's output is not a DESCENDANT of ` +
        `the shell, the central print reset cannot reach it — .wardTokens * matches descendants only.`,
    ).toBe(true);
  });

  it("WardGround puts the shell class on a real element", () => {
    const shell = stripTsComments(read(SHELL_TSX));
    expect(
      /className=\{\s*styles\.shell\s*\}/u.test(shell),
      `${SHELL_TSX}: WardGround must apply styles.shell to the element wrapping children. That element is ` +
        `the only ancestor every ward route shares.`,
    ).toBe(true);
  });

  it("the shell class composes the token layer", () => {
    const css = stripCssComments(read(SHELL_CSS));
    const shellRule = /\.shell\s*\{([^}]*)\}/u.exec(css);
    expect(shellRule, `${SHELL_CSS}: expected a top-level .shell rule`).not.toBeNull();
    expect(
      /composes\s*:[^;]*\bwardTokens\b[^;]*ward-tokens\.module\.css/u.test(shellRule?.[1] ?? ""),
      `${SHELL_CSS}: .shell must compose wardTokens. This single edge is what carries the central print ` +
        `reset onto an ancestor of every ward route. Delete it and every screen WITHOUT its own print ` +
        `block silently prints near-white on white paper in dark mode — and the per-file coverage guard ` +
        `stays green, because no stylesheet's own text changed.`,
    ).toBe(true);
  });

  it("the token layer's print block neutralises both colour and background, and wins", () => {
    const block = printBlock(stripCssComments(read(TOKENS_CSS)));
    expect(block, `${TOKENS_CSS}: expected an @media print block`).not.toBe("");
    expect(
      /\.wardTokens\s*\*/u.test(block),
      `${TOKENS_CSS}: the print block must reach DESCENDANTS via a .wardTokens * selector, not only ` +
        `.wardTokens itself. A colour declared on a descendant cannot be overridden by a rule that ` +
        `only names the ancestor.`,
    ).toBe(true);
    expect(
      neutralisesForPrint(block, "color"),
      `${TOKENS_CSS}: the print block must reset colour to a system colour.`,
    ).toBe(true);
    expect(
      neutralisesForPrint(block, "background"),
      `${TOKENS_CSS}: the print block must neutralise the background too. Forcing text to CanvasText while ` +
        `a themed dark fill survives prints black on near-black — measured in Chromium — which is strictly ` +
        `worse than doing neither, because before the colour half the same text was near-white and readable.`,
    ).toBe(true);
    expect(
      /!important/u.test(block),
      `${TOKENS_CSS}: the reset must carry !important. .wardTokens * has specificity (0,1,0) — the universal ` +
        `selector contributes nothing — so a compound selector like .table td at (0,1,1) outranks it, and ` +
        `specificity is settled before source order. Measured: without !important the wildcard fixed a plain ` +
        `span and left every table cell near-white, so a spot-check on ordinary text confirms a broken fix.`,
    ).toBe(true);
  });
});

/**
 * ⚠️ THE OTHER DIRECTION. A guard that goes red on correct code is worse than one that misses a
 * defect, because the natural repair is to change the working code until the guard is satisfied —
 * the guard wins, the code gets worse, and every gate is green afterwards. Mutation testing cannot
 * see this: a mutant is by construction wrong code, so the method asks only "does it notice
 * wrongness?" and is structurally silent on "does it accept rightness?".
 */
describe("the matcher accepts every spelling that is equivalent in effect", () => {
  const EQUIVALENT_PRINT_BLOCKS = [
    ".wardTokens, .wardTokens * { color: CanvasText !important; background-color: Canvas !important; }",
    ".wardTokens, .wardTokens * { color: CanvasText !important; background: Canvas !important; }",
    ".wardTokens,.wardTokens *{background-color:Canvas!important;color:CanvasText!important}",
    ".wardTokens, .wardTokens * { background: transparent !important; color: CanvasText !important; }",
  ];

  it.each(EQUIVALENT_PRINT_BLOCKS)("accepts %s", (body) => {
    const block = `@media print { ${body} }`;
    expect(neutralisesForPrint(block, "color"), "colour half must be accepted").toBe(true);
    expect(neutralisesForPrint(block, "background"), "background half must be accepted").toBe(true);
  });

  it("still rejects a block that neutralises only the colour", () => {
    const block = "@media print { .wardTokens, .wardTokens * { color: CanvasText !important; } }";
    expect(neutralisesForPrint(block, "color")).toBe(true);
    expect(
      neutralisesForPrint(block, "background"),
      "a colour-only reset must NOT satisfy the background half — that combination is the measured regression",
    ).toBe(false);
  });

  it("is not satisfied by a themed value that merely mentions the property", () => {
    const block = "@media print { .wardTokens, .wardTokens * { background-color: var(--surface); } }";
    expect(
      neutralisesForPrint(block, "background"),
      "var(--surface) resolves DARK under the .dark class, which survives printing — it neutralises nothing",
    ).toBe(false);
  });
});

describe("the fixtures this guard reads are the real ones", () => {
  it("reads four real files, so the assertions above cannot pass over an empty string", () => {
    for (const path of [LAYOUT, SHELL_TSX, SHELL_CSS, TOKENS_CSS]) {
      expect(read(path).length, `${path}: expected real content, not an empty or missing file`).toBeGreaterThan(200);
    }
    expect(REPO_ROOT.length).toBeGreaterThan(0);
  });
});

/**
 * ⚠️ THE PORTAL SURFACE IS A CLOSED SET OF ONE, AND NOTHING PINNED IT.
 *
 * The chain above covers in-flow content. Portalled content leaves the shell's subtree, so the ONLY
 * thing covering it is the portalling file's own stylesheet. Today that is exactly one file:
 *
 *     ward-management-navigation.tsx  ->  @/components/ui/sheet  ->  overlay-root (createPortal)
 *
 * and `ward-sidebar.module.css` covers its content with `.drawerBody, .drawerBody *`.
 *
 * The hazard is a SECOND portal. Add a sheet, dialog or overlay to any ward screen and its content
 * silently leaves the shell — the central reset stops reaching it, every existing guard stays green,
 * and the page prints near-white on white paper in dark mode. Nothing in the diff says so, because
 * the diff is a component change and the defect is in the DOM.
 *
 * So this pins the SET, two-sided: a new portal-importing file goes red and is told what to do; a
 * file that stops portalling must be removed from the list rather than left as permanent amnesty.
 *
 * ⚠️ A RED HERE IS A DECISION REQUIRED, NOT A DEFECT. The repair is never "remove the Sheet". It is
 * "give the portalled content its own print reset, then add the file here" — the same shape as
 * `ward-sidebar`'s three-root block, which exists for exactly this reason and is load-bearing.
 *
 * Detection resolves imports two hops deep rather than matching names: a module counts as portalling
 * if it calls `createPortal`, or imports a module under `src/components/ui/` that does. Matching the
 * NAME would be defeated the way `<SheetPerson` and `<SheetGroup` in `board/ward-daily-sheet.tsx`
 * already defeat it — a file whose whole vocabulary is the word "sheet" and which imports no Sheet
 * at all.
 */
describe("the set of ward files that render through a portal", () => {
  const PORTALLING_WARD_FILES: Record<string, string> = {
    "ward-management-navigation.tsx":
      "renders the phone drawer through <Sheet> -> OverlayPortal. Its content is covered by " +
      "ward-sidebar.module.css's `.drawerBody, .drawerBody *` print reset, which is LOAD-BEARING.",
  };

  /** Comment-stripped import specifiers of a file. */
  function importsOf(absPath: URL): string[] {
    const source = stripTsComments(readFileSync(absPath, "utf8"));
    return [...source.matchAll(/from\s+"([^"]+)"/gu)].map((m) => m[1]);
  }

  function resolveUi(specifier: string): URL | null {
    if (!specifier.startsWith("@/components/ui/")) return null;
    const base = specifier.replace(/^@\//u, "src/");
    for (const candidate of [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`]) {
      const url = new URL(`../${candidate}`, import.meta.url);
      try {
        readFileSync(url, "utf8");
        return url;
      } catch {
        /* try the next candidate */
      }
    }
    return null;
  }

  /** Does this ui module portal, directly or one hop further in? */
  function portals(url: URL, depth = 0): boolean {
    const source = stripTsComments(readFileSync(url, "utf8"));
    if (/createPortal/u.test(source)) return true;
    if (depth >= 2) return false;
    return importsOf(url).some((spec) => {
      const next = resolveUi(spec);
      return next !== null && portals(next, depth + 1);
    });
  }

  function wardTsxFiles(): string[] {
    const root = new URL("../src/components/ward-management/", import.meta.url);
    const out: string[] = [];
    const walk = (dir: URL, prefix: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`);
        else if (entry.name.endsWith(".tsx")) out.push(`${prefix}${entry.name}`);
      }
    };
    walk(root, "");
    return out;
  }

  const found = wardTsxFiles().filter((rel) => {
    const url = new URL(`../src/components/ward-management/${rel}`, import.meta.url);
    return importsOf(url).some((spec) => {
      const target = resolveUi(spec);
      return target !== null && portals(target);
    });
  });

  it("walks a real population", () => {
    expect(
      wardTsxFiles().length,
      "fewer than 40 ward .tsx files means the walk is broken, and an empty walk finds no portals",
    ).toBeGreaterThan(40);
  });

  it("no ward file renders through a portal without being listed here", () => {
    const unlisted = found.filter((rel) => !(rel.split("/").pop()! in PORTALLING_WARD_FILES));
    expect(
      unlisted,
      `these ward files render content through a portal, which leaves the shell's DOM subtree, so the ` +
        `central print reset in ward-tokens.module.css CANNOT reach it: ${unlisted.join(", ")}. ` +
        `The repair is NOT to remove the portal. Give the portalled content its own @media print reset ` +
        `in the owning stylesheet — see ward-sidebar.module.css's .drawerBody, .drawerBody * block — ` +
        `then add the file to PORTALLING_WARD_FILES with the reason.`,
    ).toEqual([]);
  });

  it("no listed file has stopped portalling", () => {
    const names = found.map((rel) => rel.split("/").pop()!);
    const stale = Object.keys(PORTALLING_WARD_FILES).filter((name) => !names.includes(name));
    expect(
      stale,
      `these files no longer render through a portal — remove them from PORTALLING_WARD_FILES so the ` +
        `list cannot rot into permanent amnesty: ${stale.join(", ")}`,
    ).toEqual([]);
  });

  it("the one portalling file's content is actually covered by its own stylesheet", () => {
    const sidebar = stripCssComments(read("src/components/ward-management/ward-sidebar.module.css"));
    const block = printBlock(sidebar);
    expect(
      /\.drawerBody\s*\*/u.test(block),
      `ward-sidebar.module.css: the print block must cover .drawerBody AND its descendants. The drawer ` +
        `renders through a portal, so the shell chain never reaches it and this block is the only cover.`,
    ).toBe(true);
    expect(neutralisesForPrint(block, "color")).toBe(true);
    expect(neutralisesForPrint(block, "background")).toBe(true);
  });
});
