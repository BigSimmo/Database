import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Invariants of the Clinical Sky token system in `src/app/globals.css`.
 *
 * These are the properties the design review found broken and fixed — a
 * disordered surface scale, an elevation set that did not sort by name, status
 * colours bunched in one contrast band, a dark border at ~1.35:1, and a
 * duplicated accent ramp step. Every one of them was invisible to lint, to
 * typecheck, and to a screenshot diff, so they are asserted here instead of
 * trusted to review.
 *
 * Values are read out of the stylesheet rather than duplicated, so retuning a
 * token is allowed — breaking the RELATIONSHIP between tokens is not.
 */

const globals = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

function themeBlock(marker: string) {
  const start = globals.indexOf(marker);
  expect(start, `${marker} block is missing from globals.css`).toBeGreaterThan(-1);
  const end = globals.indexOf("\n}", start);
  return globals.slice(start, end);
}

const lightBlock = themeBlock("\n:root {");
const darkBlock = themeBlock("\n.dark {");
const themeConfigBlock = themeBlock("\n@theme {");

function declarations(block: string) {
  const map = new Map<string, string>();
  for (const [, name, value] of block.matchAll(/^ {2}(--[a-z0-9-]+)\s*:\s*([^;]+);/gim)) {
    map.set(name, value.trim());
  }
  return map;
}

const light = declarations(lightBlock);
const dark = declarations(darkBlock);
const themes = [
  { name: "light", tokens: light },
  { name: "dark", tokens: dark },
] as const;

/** Resolves `var(--x)` chains within one theme so aliases can be compared. */
function resolve(tokens: Map<string, string>, name: string, depth = 0): string {
  const value = tokens.get(name);
  expect(value, `${name} is not defined`).toBeTruthy();
  const match = /^var\((--[a-z0-9-]+)\)$/i.exec(value!);
  if (!match || depth > 8) return value!;
  return resolve(tokens, match[1], depth + 1);
}

function relativeLuminance(hex: string) {
  const normalised = hex.trim().toLowerCase();
  expect(normalised, `${hex} is not a 6-digit hex colour`).toMatch(/^#[0-9a-f]{6}$/);
  const channels = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(normalised.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(firstHex: string, secondHex: string) {
  const [darker, lighter] = [relativeLuminance(firstHex), relativeLuminance(secondHex)].sort((a, b) => a - b);
  return (lighter + 0.05) / (darker + 0.05);
}

const colourOf = (tokens: Map<string, string>, name: string) => resolve(tokens, name);

describe("theme token symmetry", () => {
  it("defines every per-theme value in both themes", () => {
    // A value that reaches through var() stays theme-reactive without being
    // redeclared; everything else must be answered in both blocks or dark
    // silently inherits a light-mode colour.
    const perTheme =
      /^--(neutral|primary|surface|text|border|clinical|type|tone|info|success|warning|danger|command|background|app-shell|disabled|overlay|panel|glow|shadow|e[0-4]$)/;
    const missingInDark = [...light.keys()].filter(
      (name) => perTheme.test(name) && !dark.has(name) && !light.get(name)!.includes("var("),
    );
    const missingInLight = [...dark.keys()].filter((name) => perTheme.test(name) && !light.has(name));

    expect(missingInDark, "light-only per-theme tokens").toEqual([]);
    expect(missingInLight, "dark-only per-theme tokens").toEqual([]);
  });
});

describe("surface scale", () => {
  // The planes must stay ordered. When --surface-raised drifted below
  // --surface, raised cards read as recesses.
  const ladder = ["--surface-inset", "--surface-wash", "--surface-subtle", "--surface", "--surface-raised"] as const;

  // Both themes run darkest → lightest: light lifts white-ward, dark lifts out
  // of the black canvas, so raised is the lightest plane either way.
  it.each(themes)("orders inset → wash → subtle → surface → raised in $name", ({ tokens, name }) => {
    const luminances = ladder.map((token) => relativeLuminance(colourOf(tokens, token)));

    expect(luminances, `${name} surface ladder is out of order`).toEqual([...luminances].sort((a, b) => a - b));
    expect(new Set(luminances).size, `${name} surface steps collapsed onto each other`).toBe(ladder.length);
  });

  it.each(themes)("keeps both border weights visible and separable in $name", ({ tokens }) => {
    // The dark --border used to track --neutral-300, which left it effectively
    // invisible against --surface. A hairline is meant to be quiet, so the
    // floor is low — but the two weights must stay meaningfully apart, or
    // "strong border" stops communicating anything.
    const hairline = contrastRatio(colourOf(tokens, "--border"), colourOf(tokens, "--surface"));
    const strong = contrastRatio(colourOf(tokens, "--border-strong"), colourOf(tokens, "--surface"));

    expect(hairline, "--border must remain perceptible").toBeGreaterThanOrEqual(1.2);
    expect(strong, "--border-strong must read as a deliberate weight").toBeGreaterThanOrEqual(1.45);
    expect(strong / hairline, "--border-strong is not distinguishable from --border").toBeGreaterThanOrEqual(1.2);
  });
});

describe("elevation ladder", () => {
  it.each(themes)("aliases every shadow role onto an --e tier in $name", ({ tokens }) => {
    const aliases = {
      "--shadow-tight": "--e1",
      "--shadow-card": "--e2",
      "--shadow-soft": "--e2",
      "--shadow-hover": "--e3",
      "--shadow-elevated": "--e4",
    } as const;

    for (const [role, tier] of Object.entries(aliases)) {
      expect(tokens.get(role), `${role} must point at ${tier}, not a hand-rolled shadow`).toBe(`var(${tier})`);
    }
    // --shadow-lux may add a top highlight, but its body is still a tier.
    expect(tokens.get("--shadow-lux")).toContain("var(--e4)");
    expect(tokens.get("--e0")).toBe("none");
  });

  it("flattens the ladder itself under forced colors, not only the role aliases", () => {
    const forced = globals.slice(globals.indexOf("@media (forced-colors: active)"));
    for (const tier of ["--e1", "--e2", "--e3", "--e4"]) {
      expect(forced, `${tier} must be neutralised in forced-colors mode`).toContain(`${tier}: none;`);
    }
  });
});

describe("status colour ranking", () => {
  // Every status pair used to sit in a 4.6–5.2:1 band, so nothing read as more
  // urgent than anything else.
  it("clears 5.5:1 for every light-mode status pair", () => {
    for (const status of ["info", "success", "warning", "danger"]) {
      const ratio = contrastRatio(colourOf(light, `--${status}-text`), colourOf(light, `--${status}-bg`));
      expect(ratio, `light --${status}-text on --${status}-bg`).toBeGreaterThanOrEqual(5.5);
    }
  });

  it.each(themes)("keeps identity and tone chips quieter than every status colour in $name", ({ tokens, name }) => {
    // A blue "Document" chip used to out-shout an "Outdated" badge because the
    // categorical anchors were raw Tailwind hues at 2–3× the accent's chroma.
    // What makes a swatch shout is colourfulness, not luminance contrast, so
    // that is what is capped: every categorical anchor stays below the calmest
    // status colour. Status always wins the attention contest.
    const chroma = (hex: string) => {
      const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
      return Math.max(...channels) - Math.min(...channels);
    };
    const quietestStatus = Math.min(
      ...["info", "success", "warning", "danger"].map((status) => chroma(colourOf(tokens, `--${status}-text`))),
    );

    const categorical = [
      ...["document", "table", "search", "source", "service", "form"].map((type) => `--type-${type}`),
      ...["purple", "indigo", "rose", "slate"].map((tone) => `--tone-${tone}`),
    ];
    for (const token of categorical) {
      expect(chroma(colourOf(tokens, token)), `${name} ${token} must not out-shout the status set`).toBeLessThan(
        quietestStatus,
      );
    }
  });

  it.each(themes)("ships a complete triad for every categorical tone in $name", ({ tokens }) => {
    for (const tone of ["purple", "indigo", "rose", "slate"]) {
      for (const suffix of ["", "-soft", "-border"]) {
        expect(tokens.has(`--tone-${tone}${suffix}`), `--tone-${tone}${suffix} is missing`).toBe(true);
      }
    }
  });
});

describe("accent ramp", () => {
  it.each(themes)("has ten distinct steps in $name", ({ tokens, name }) => {
    // Dark shipped --primary-600 and --primary-700 as the same hex, which
    // silently collapsed every hover state onto its resting colour.
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((step) =>
      colourOf(tokens, `--primary-${step}`),
    );
    expect(new Set(steps).size, `${name} accent ramp has a duplicated step`).toBe(steps.length);
  });

  it("keeps the accent legible as both a fill and a text colour", () => {
    expect(contrastRatio(colourOf(light, "--primary-500"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    for (const { tokens, name } of themes) {
      expect(
        contrastRatio(colourOf(tokens, "--clinical-accent"), colourOf(tokens, "--clinical-accent-contrast")),
        `${name} accent fill vs its own label colour`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(themes)("moves a real step on hover and settles on active in $name", ({ tokens }) => {
    const rest = colourOf(tokens, "--clinical-accent");
    const hover = colourOf(tokens, "--clinical-accent-hover");
    const active = colourOf(tokens, "--clinical-accent-active");
    expect(hover, "hover must not repeat the resting colour").not.toBe(rest);
    expect(active, "active must not repeat the hover colour").not.toBe(hover);
  });
});

describe("disabled and pre-paint values", () => {
  it.each(themes)("keeps disabled text readable in $name", ({ tokens }) => {
    // WCAG exempts disabled controls, but a clinician still has to read WHICH
    // action is unavailable.
    expect(contrastRatio(colourOf(tokens, "--disabled"), colourOf(tokens, "--surface"))).toBeGreaterThanOrEqual(3);
  });

  it("keeps the pre-paint theme colours equal to --background", () => {
    // APP_THEME_COLORS paints before any stylesheet loads; a drift here is a
    // flash of the wrong page colour and a mismatched browser chrome bar.
    const theme = readFileSync(new URL("../src/lib/theme.ts", import.meta.url), "utf8");
    const appThemeColors = theme.slice(theme.indexOf("export const APP_THEME_COLORS"));
    expect(appThemeColors).toContain(`light: "${colourOf(light, "--background")}"`);
    expect(appThemeColors).toContain(`dark: "${colourOf(dark, "--background")}"`);
  });

  it("keeps the brand mark on the current accent", () => {
    // The favicon and generated icon routes render outside any stylesheet, so
    // they hard-code the accent and can silently keep a retired brand colour.
    const brand = readFileSync(new URL("../src/lib/brand-mark.ts", import.meta.url), "utf8");
    expect(brand).toContain(`tile: "${colourOf(light, "--clinical-accent")}"`);
    expect(brand).toContain(`tile: "${colourOf(dark, "--clinical-accent")}"`);
  });
});

describe("radius ladder", () => {
  it("keeps every rung on the 4px grid and distinct", () => {
    // --radius-lg sat at 10px and broke the rhythm. Moving it to 12 collided
    // with --radius-xl, so the upper ladder shifted a rung — two names must
    // never share one value, or the lg/xl role split stops meaning anything.
    const rungs = ["xs", "sm", "md", "lg", "xl", "2xl"].map((step) => {
      const value = new RegExp(`--radius-${step}:\\s*([\\d.]+)rem;`, "i").exec(themeConfigBlock);
      expect(value, `--radius-${step} is not defined in @theme`).toBeTruthy();
      return Math.round(Number.parseFloat(value![1]) * 16);
    });

    expect(rungs, "radius ladder must ascend").toEqual([...rungs].sort((a, b) => a - b));
    expect(new Set(rungs).size, "two radius names share one value").toBe(rungs.length);
    // 6px `sm` is the one sanctioned half-step; everything else is a multiple of 4.
    for (const rung of rungs.filter((value) => value !== 6)) {
      expect(rung % 4, `${rung}px is off the 4px grid`).toBe(0);
    }
  });
});

describe("type scale floor", () => {
  it("leaves no orphaned utility for the retired step", () => {
    // Retiring a --text-* token silently kills its utility: Tailwind stops
    // emitting the rule, every `text-4xs` class becomes a no-op, and the text
    // falls back to inherited size with nothing failing. Two files carrying
    // `text-4xs` landed from main while this port was in flight and were dead on
    // arrival. Mockups are NOT exempt here — a dead class breaks them too.
    const tracked = execFileSync("git", ["ls-files", "src"], { encoding: "utf8" })
      .split("\n")
      .filter((file) => /\.(tsx?|css)$/.test(file));

    const orphans = tracked.flatMap((file) => {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      return (
        source
          .split(/\r?\n/)
          .map((line, index) => ({ line, number: index + 1 }))
          // Skip comment lines: the retirement is documented by name in a few places.
          .filter(({ line }) => !/^\s*(\/\/|\/\*|\*)/.test(line))
          .filter(({ line }) => /\btext-4xs\b/.test(line))
          .map(({ number }) => `${file}:${number}`)
      );
    });

    expect(orphans, "text-4xs is retired — Tailwind emits no such rule").toEqual([]);
  });

  it("has no sub-10px step", () => {
    // The 8px --text-4xs step is retired: indefensible at any density in a
    // clinical product.
    expect(themeConfigBlock).not.toContain("--text-4xs");
    const steps = [...themeConfigBlock.matchAll(/^ {2}--text-([a-z0-9-]+):\s*([\d.]+)rem;/gim)];
    expect(steps.length).toBeGreaterThan(0);
    for (const [, name, size] of steps) {
      expect(Number.parseFloat(size) * 16, `--text-${name} is below the 10px floor`).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("leading vocabulary", () => {
  it("has no arbitrary leading-[…] left in production", () => {
    // Nine ad-hoc values (leading-[15px], [0.95rem], [1.05]…[1.62]) used to sit
    // alongside the named steps. They are now Tailwind's own steps plus
    // --leading-display / --leading-prose for the two contexts those could not
    // express. Mockups are design-scratch and exempt, as everywhere else.
    const production = execFileSync("git", ["ls-files", "src"], { encoding: "utf8" })
      .split("\n")
      .filter((file) => /\.(tsx?|css)$/.test(file))
      .filter((file) => !/mockup/i.test(file));

    const offenders = production.flatMap((file) => {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      return [...source.matchAll(/\bleading-\[[^\]]+\]/g)].map((match) => `${file}: ${match[0]}`);
    });

    expect(offenders).toEqual([]);
  });

  it("does not redefine Tailwind's own leading steps", () => {
    // Redefining --leading-tight/-snug in :root would silently retune every
    // existing leading-tight / leading-snug call site in the app.
    for (const reserved of ["--leading-tight", "--leading-snug", "--leading-normal", "--leading-relaxed"]) {
      expect(light.has(reserved), `${reserved} belongs to Tailwind — do not shadow it`).toBe(false);
      expect(themeConfigBlock, `${reserved} belongs to Tailwind — do not shadow it`).not.toContain(`${reserved}:`);
    }
    expect(themeConfigBlock).toContain("--leading-display:");
    expect(themeConfigBlock).toContain("--leading-prose:");
  });
});

describe("focus ring", () => {
  it("stays a single affordance", () => {
    // One focus owner: the outline. A companion box-shadow ring here would
    // stack a second affordance AND replace whatever resting elevation the
    // control had, since a blanket rule cannot know it. tests/ui-smoke.spec.ts
    // asserts the rendered consequence; this asserts the rule itself.
    const rule = globals.slice(globals.indexOf(':where(button, a, summary, input[type="checkbox"]'));
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).toContain("outline: 2px solid var(--focus)");
    expect(body, "the shared focus rule must not paint a box-shadow").not.toContain("box-shadow");
  });
});
