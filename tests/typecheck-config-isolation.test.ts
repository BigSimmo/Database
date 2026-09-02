import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const typecheckConfigPath = path.join(root, "tsconfig.typecheck.json");
const standInPath = path.join(root, "next-env.typecheck.d.ts");
const generatedEnvPath = path.join(root, "next-env.d.ts");

/** The config is JSONC and every comment in it is a whole line. */
function readJsonc(filePath: string) {
  const withoutComments = fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  return JSON.parse(withoutComments) as { include?: string[]; exclude?: string[] };
}

function referenceDirectives(source: string) {
  return [...source.matchAll(/\/\/\/\s*<reference\s+types="([^"]+)"\s*\/>/g)].map((match) => match[1]).sort();
}

/**
 * `tsconfig.typecheck.json` answers one question — "is the source itself
 * sound?" — and it can only answer it if it never reads gitignored build output
 * (`docs/outstanding-issues.md` `#210`). Excluding `.next/**` is not enough on
 * its own: an `exclude` filters what the `include` globs collect, and cannot
 * drop a file that an included file *imports*. Next 16 regenerates
 * `next-env.d.ts` with `import "./.next/dev/types/routes.d.ts"` in it, which
 * reinstated the whole dependency through that back door.
 *
 * Measured on 2026-09-01: with `next-env.d.ts` included, a `next dev` run that
 * left a stray fragment in `.next/dev/types/routes.d.ts` made `npm run
 * typecheck` report 106 syntax errors against sound source. With the stand-in,
 * the identical artefact produced exit 0.
 */
describe("source typecheck stays out of build output", () => {
  const config = readJsonc(typecheckConfigPath);

  it("includes the build-artifact-free stand-in, not Next's generated file", () => {
    expect(config.include).toContain("next-env.typecheck.d.ts");
    expect(config.include).not.toContain("next-env.d.ts");
  });

  it("excludes the generated file by name as well as the build directory", () => {
    // `**/*.ts` matches `.d.ts`, so dropping `next-env.d.ts` from `include`
    // would not keep it out on its own.
    expect(config.exclude).toContain("next-env.d.ts");
    expect(config.exclude).toContain(".next/**");
  });

  it("keeps the stand-in free of any reference into build output", () => {
    const standIn = fs.readFileSync(standInPath, "utf8");
    const code = standIn
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trim().startsWith("*"))
      .join("\n");
    expect(code).not.toContain(".next");
    expect(referenceDirectives(code)).toEqual(["next", "next/image-types/global"]);
  });

  it("carries every reference directive Next puts in its generated file", () => {
    // Gitignored, so it is absent on a fresh checkout and in CI. When a local
    // `next dev`/`next build` has produced it, a Next upgrade that adds a
    // directive must not leave the stand-in behind.
    if (!fs.existsSync(generatedEnvPath)) return;
    const generated = referenceDirectives(fs.readFileSync(generatedEnvPath, "utf8"));
    const standIn = referenceDirectives(fs.readFileSync(standInPath, "utf8"));
    for (const directive of generated) expect(standIn).toContain(directive);
  });
});
