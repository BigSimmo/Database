import { PassThrough } from "node:stream";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { confirm } from "../scripts/lib/confirm.mjs";
import { findOwnerIdByEmail, OWNER_LOOKUP_PAGE_SIZE } from "../scripts/lib/find-owner-id-by-email";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function scriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : scriptFiles(full);
    return /\.(?:ts|mjs|mts)$/.test(name) ? [full] : [];
  });
}

function fakeClient(pages: Array<Array<{ id: string; email: string | null }>>) {
  const calls: number[] = [];
  return {
    calls,
    auth: {
      admin: {
        async listUsers({ page }: { page: number; perPage: number }) {
          calls.push(page);
          return { data: { users: pages[page - 1] ?? [] }, error: null };
        },
      },
    },
  };
}

describe("scripts share one owner lookup", () => {
  it("matches a trimmed, case-insensitive email across pages", async () => {
    const firstPage = Array.from({ length: OWNER_LOOKUP_PAGE_SIZE }, (_, index) => ({
      id: `user-${index}`,
      email: `person${index}@example.com`,
    }));
    const client = fakeClient([firstPage, [{ id: "owner-42", email: "Owner@Example.com" }]]);
    await expect(findOwnerIdByEmail(client, "  owner@example.com ")).resolves.toBe("owner-42");
    expect(client.calls).toEqual([1, 2]);
  });

  it("stops at a short page and names the caller's purpose when nobody matches", async () => {
    const client = fakeClient([[{ id: "u1", email: "someone@example.com" }]]);
    await expect(findOwnerIdByEmail(client, "missing@example.com", { purpose: "importing" })).rejects.toThrow(
      /No Supabase Auth user found for missing@example.com\. Sign in once before importing\./,
    );
    expect(client.calls).toEqual([1]);
    await expect(findOwnerIdByEmail(client, "   ")).rejects.toThrow(/owner email is required/);
  });

  it("surfaces the auth error instead of scanning on", async () => {
    const failing = {
      auth: {
        admin: {
          async listUsers() {
            return { data: { users: [] }, error: { message: "service role rejected" } };
          },
        },
      },
    };
    await expect(findOwnerIdByEmail(failing, "a@example.com")).rejects.toThrow("service role rejected");
  });

  it("defines findOwnerIdByEmail exactly once under scripts/", () => {
    const definitions = scriptFiles(path.join(repositoryRoot, "scripts")).filter((file) =>
      /(?:async )?function findOwnerIdByEmail\(/.test(readFileSync(file, "utf8")),
    );
    expect(definitions.map((file) => path.relative(repositoryRoot, file).replace(/\\/g, "/"))).toEqual([
      "scripts/lib/find-owner-id-by-email.ts",
    ]);
  });
});

describe("scripts share one interactive prompt helper", () => {
  it("defaults to No without reading when stdin is not a TTY", async () => {
    const input = Object.assign(new PassThrough(), { isTTY: false });
    let written = "";
    const output = Object.assign(new PassThrough(), { write: (chunk: string) => ((written += chunk), true) });
    await expect(confirm("Delete everything?", { input, output })).resolves.toBe(false);
    expect(written).toContain("Non-interactive input detected; defaulting to No.");
  });

  it("accepts only an explicit yes on a TTY", async () => {
    for (const [answer, expected] of [
      ["y\n", true],
      ["YES\n", true],
      ["n\n", false],
      ["\n", false],
      ["yep\n", false],
    ] as const) {
      const input = Object.assign(new PassThrough(), { isTTY: true });
      const output = new PassThrough();
      output.resume();
      const pending = confirm("Proceed?", { input, output });
      input.write(answer);
      await expect(pending, JSON.stringify(answer)).resolves.toBe(expected);
    }
  });

  it("creates readline interfaces only inside the shared helper", () => {
    const creators = scriptFiles(path.join(repositoryRoot, "scripts")).filter((file) =>
      /createInterface\(/.test(readFileSync(file, "utf8")),
    );
    expect(creators.map((file) => path.relative(repositoryRoot, file).replace(/\\/g, "/"))).toEqual([
      "scripts/lib/confirm.mjs",
    ]);
  });
});

// Node's default ESM loader accepts a POSIX absolute path as a dynamic import
// specifier but rejects a Windows one ("Received protocol 'd:'"). A script that
// builds a specifier with path.join()/resolve() therefore runs green on Linux CI
// and throws on a Windows machine — and because check:cross-mode-index sits
// mid-chain in verify:pr-local, the fourteen gates after it (lint, typecheck,
// test, build) were never reached at all. Observed 2026-09-17 in
// build-cross-mode-differentials-index.mjs. pathToFileURL(...).href is correct
// on both platforms, so the guard is a straight ban on the bare-path shape.
const BARE_PATH_IMPORT_SPECIFIER = /\bimport\s*\(\s*(?:path\s*\.\s*)?(?:join|resolve)\s*\(/;

describe("scripts build dynamic import specifiers as file:// URLs", () => {
  it("never passes a bare path.join()/resolve() result to import()", () => {
    const offenders = scriptFiles(path.join(repositoryRoot, "scripts")).filter((file) =>
      BARE_PATH_IMPORT_SPECIFIER.test(readFileSync(file, "utf8")),
    );
    expect(offenders.map((file) => path.relative(repositoryRoot, file).replace(/\\/g, "/"))).toEqual([]);
  });

  it("recognises the exact shape that broke Windows, and clears the fix for it", () => {
    expect(
      BARE_PATH_IMPORT_SPECIFIER.test(
        'const { curatedDifferentials } = await import(join(root, "src", "lib", "differential-curated.ts"));',
      ),
    ).toBe(true);
    expect(BARE_PATH_IMPORT_SPECIFIER.test('await import(path.resolve(root, "a.mjs"));')).toBe(true);
    expect(BARE_PATH_IMPORT_SPECIFIER.test('await import(\npathToFileURL(join(root, "a.mjs")).href);')).toBe(false);
  });
});
