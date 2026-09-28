import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const oldPath = "supabase/migrations/20260926225309_on_call_service_items.sql";
const newPath = "supabase/migrations/20260927202500_on_call_named_cover.sql";
const commandStart = "create or replace function public.on_call_service_command";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

describe("optional named On Call cover migration", () => {
  const previous = read(oldPath).slice(read(oldPath).indexOf(commandStart));
  const migration = read(newPath);
  const replacement = migration.slice(migration.indexOf(commandStart));

  it("preserves the prior command and grants except for the optional name validation", () => {
    expect(replacement).toContain("(v_content->'cover') - array['grade','team','window','staffName']");
    expect(replacement).toContain(
      "(v_content->'cover' ? 'staffName' and (jsonb_typeof(v_content->'cover'->'staffName') is distinct from 'string' or length(btrim(v_content->'cover'->>'staffName', U&'\\0009\\000A\\000B\\000C\\000D\\0020\\00A0\\1680\\2000\\2001\\2002\\2003\\2004\\2005\\2006\\2007\\2008\\2009\\200A\\2028\\2029\\202F\\205F\\3000\\FEFF')) not between 1 and 80))",
    );
    const withoutName = replacement
      .replace("Role and shift window, with an optional staff name.", "Role and shift window only.")
      .replace("array['grade','team','window','staffName']", "array['grade','team','window']")
      .replace(/^        or \(v_content->'cover' \? 'staffName'.*\n/m, "");
    expect(withoutName).toBe(previous);
  });

  it("projects the final command into schema.sql", () => {
    expect(read("supabase/schema.sql").endsWith(migration)).toBe(true);
  });

  it("trims the complete JavaScript whitespace set for staff names", () => {
    const trimSet = replacement.match(/staffName', U&'([^']+)'/)?.[1];
    expect(trimSet).toBeDefined();
    const codePoints = [...trimSet!.matchAll(/\\([0-9A-F]{4})/g)].map((match) => Number.parseInt(match[1], 16));
    expect(codePoints).toEqual([
      0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x00a0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005,
      0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
    ]);
    expect(codePoints.every((point) => String.fromCodePoint(point).trim() === "")).toBe(true);
  });
});
