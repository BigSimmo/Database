// tests/caring-contacts-domain-isolation.test.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const DOMAIN_ROOT = path.join(process.cwd(), "src", "lib", "caring-contacts");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith(".ts") ? [full] : [];
  });
}

/**
 * Every module specifier in a file, however it is written.
 *
 * The earlier form required WHITESPACE after the keyword, so `await import("@supabase/supabase-js")`
 * and `require("openai")` -- the two shapes a provider is most likely to arrive through once
 * someone wants it loaded lazily -- were invisible to both assertions below. `\s*\(?\s*` covers the
 * call forms without loosening the quoted-specifier capture that follows.
 */
function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/\b(?:from|import|require)\s*\(?\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

describe("caring-contacts domain isolation", () => {
  it("imports nothing from outside its own directory", () => {
    // An ALLOWLIST, not a denylist, and the difference is the whole property. The claim being made
    // is that this domain is self-contained and provider-free -- and a denylist can only ever say
    // that the six things somebody thought of are absent. It named `@supabase` and `openai`, so
    // `twilio`, `redis` and `stripe` all passed, and a messaging provider is exactly what a
    // caring-contact domain would reach for first.
    //
    // Inverting it is free here rather than aspirational: there is currently not one non-relative
    // specifier anywhere under this tree, not even a `node:` builtin. `tests/caring-contacts-
    // message-policy.test.ts` already holds one file to this shape; this holds the whole tree to it.
    const offences: string[] = [];
    for (const file of walk(DOMAIN_ROOT)) {
      for (const specifier of importSpecifiers(readFileSync(file, "utf8"))) {
        if (specifier.startsWith("node:")) continue;
        if (specifier.startsWith(".")) continue;
        offences.push(`${path.relative(process.cwd(), file)} -> ${specifier}`);
      }
    }
    expect(offences).toEqual([]);
  });

  it("sees a provider arriving through require or a dynamic import, not only a static one", () => {
    // The extractor, tested directly. Every specifier form below was invisible to the previous
    // whitespace-requiring pattern, so a sealed module could have loaded a provider lazily and
    // both assertions in this file would have reported green.
    const source = [
      'import Twilio from "twilio";',
      'const { createClient } = require("redis");',
      'await import("@supabase/supabase-js");',
      'export { send } from "./dispatch";',
      'import "node:crypto";',
    ].join("\n");

    expect(importSpecifiers(source)).toEqual(["twilio", "redis", "@supabase/supabase-js", "./dispatch", "node:crypto"]);
  });

  it("never escapes its directory with a relative import", () => {
    const offences: string[] = [];
    for (const file of walk(DOMAIN_ROOT)) {
      for (const specifier of importSpecifiers(readFileSync(file, "utf8"))) {
        if (!specifier.startsWith(".")) continue;
        const resolved = path.resolve(path.dirname(file), specifier);
        // A bare `startsWith(DOMAIN_ROOT)` is a string-prefix test, not a path-containment test:
        // `.../src/lib/caring-contacts-server/config` satisfies it too, because that sibling
        // directory's name extends this one's as a prefix. Require the separator (or an exact
        // match on the root itself) so a relative import escaping into caring-contacts-server --
        // the reverse-direction dependency the plan forbids absolutely -- cannot pass silently.
        if (resolved !== DOMAIN_ROOT && !resolved.startsWith(DOMAIN_ROOT + path.sep)) {
          offences.push(`${path.relative(process.cwd(), file)} -> ${specifier}`);
        }
      }
    }
    expect(offences).toEqual([]);
  });

  it("keeps caring-contact migrations out of the Clinical KB migration directory", () => {
    const clinicalKbMigrations = path.join(process.cwd(), "supabase", "migrations");
    const strays = readdirSync(clinicalKbMigrations).filter((name) => /caring[-_]?contact/i.test(name));
    expect(strays).toEqual([]);
  });
});

/**
 * Two properties that exist only as SOURCE TEXT, and so can be held only by reading it.
 *
 * They live here, in an offline source-scanning file the default `npm run test` collects, for a
 * reason found the hard way in review round 1. The first of them was originally written in
 * `caring-contacts-postgres-repository.test.ts`, which `vitest.config.mts` lists in
 * `caringContactsDbTestFiles` and excludes from the `node` project outright -- and no workflow under
 * `.github/workflows/` runs the database suite at all. So the guard was real, correct, and could
 * fire only when a human happened to have a Postgres container up. Neither property needs a
 * database: both are a file read and a regular expression.
 *
 * Both carry a positive control. A scan whose pattern stops matching after a rename goes GREEN, not
 * red, so a scan without one is a check that cannot fail -- which is the same defect in a different
 * costume from the one the paragraph above describes.
 */
describe("caring-contacts properties that only a source scan can hold", () => {
  const postgresStore = () => readFileSync(path.join(DOMAIN_ROOT, "db", "postgres-repository.ts"), "utf8");

  const schedule = () => readFileSync(path.join(DOMAIN_ROOT, "schedule.ts"), "utf8");

  const rawFirstContactReasonMigration = () =>
    readFileSync(
      path.join(
        process.cwd(),
        "caring-contacts",
        "supabase",
        "migrations",
        "0005_caring_contacts_first_contact_reason.sql",
      ),
      "utf8",
    );

  /**
   * The migration with its `--` comments stripped.
   *
   * Same precedent, and the same reason, as the CREATE INDEX CONCURRENTLY scan in
   * `caring-contacts-migrations.test.ts`: these migrations discuss their own rules in prose, and a
   * scan that reads its own explanation as SQL reports the wrong thing. Here it matters twice over,
   * because the anchor below is required to be UNIQUE -- so without stripping, a comment that merely
   * MENTIONS `char_length(` would fail the test while changing no behaviour at all.
   */
  const firstContactReasonMigration = () =>
    readFileSync(
      path.join(
        process.cwd(),
        "caring-contacts",
        "supabase",
        "migrations",
        "0005_caring_contacts_first_contact_reason.sql",
      ),
      "utf8",
    ).replace(/--.*/g, "");

  it("never fetches the first-contact reason for a list read", () => {
    // `first_contact_reason` is free text a clinician wrote about one patient. It is deliberately
    // absent from `PLAN_COLUMNS` -- the list `readPlanRecord` and `listPlans` select -- so rendering
    // a caseload never pulls it into the process at all.
    //
    // Nothing observable through the repository can hold that. `toPlanRecord` maps field by field,
    // so adding the column to `PLAN_COLUMNS` fetches a clinical note for every plan in the team and
    // still releases nothing: the behaviour is identical and every behavioural test stays green.
    // The narrowing lives in the QUERY, which is why it takes a scan. Found by mutation, and the
    // invariant rather than the tally: the mutation changed no test's verdict anywhere in the
    // repository until this scan existed.
    const declaration = /const PLAN_COLUMNS = `([\s\S]*?)`;/.exec(postgresStore());

    // Positive control: the constant was found and really is the plan column list.
    expect(declaration).not.toBeNull();
    expect(declaration?.[1]).toContain("patient_name");

    expect(declaration?.[1]).not.toContain("first_contact_reason");
  });

  it("keeps the first-contact reason cap identical in the domain and in its SQL backstop", () => {
    // The domain owns the rule and refuses an over-long reason BY NAME
    // (`first-contact-reason-too-long`); the column's check constraint is a backstop for a write
    // that reached the table another way.
    //
    // The `isAwstCalendarDay` precedent is real but NOT symmetric with this one, and the asymmetry
    // is why this scan exists. That function is strictly stricter than the schema's calendar-day
    // pattern by construction, so drift there can only ever make the SQL redundant. Here the two are
    // the same rule written twice: RAISING the constant without raising the constraint turns a named
    // refusal into a raw constraint violation on a clinical write -- a regression, not a redundancy.
    const migration = firstContactReasonMigration();
    const constant = /FIRST_CONTACT_REASON_MAX_LENGTH = (\d+)/.exec(schedule());

    // ANCHORED ON `char_length(`, NOT ON THE CONSTRAINT NAME, and the difference is the whole
    // robustness of this scan (review round 2).
    //
    // The first version anchored on `plans_first_contact_reason_shape` and took the first `<=` after
    // it. But the FIRST occurrence of that name is the `where c.conname = ...` existence guard, not
    // the constraint body -- so any numeric `<=` inserted between the two would have been read as the
    // cap. That scan reads the right literal today and cannot stay right by construction: a later
    // edit adding, say, `and array_length(c.conkey, 1) <= 500` to the guard would have it compare a
    // number that is not the cap, and agree with the constant while the real cap had drifted. Proving
    // it reads correctly today (M16/M17) is a different claim from proving it will keep reading the
    // right thing.
    //
    // `char_length(` appears only in the constraint body, immediately left of the comparison, so it
    // anchors on the expression that IS the cap rather than on a name that is mentioned twice.
    const sql = /char_length\([\s\S]*?<=\s*(\d+)/.exec(migration);

    // Positive controls, three of them, because each covers a different way this scan could go green
    // while meaning nothing:
    //   * the constraint is still the one this test thinks it is (a rename fails loudly);
    //   * the anchor is UNIQUE -- a second `char_length(` anywhere in the file, including one added
    //     to the existence guard, would silently displace the match, so it must fail instead;
    //   * both literals were actually found, or the comparison is two undefineds being equal.
    expect(migration).toContain("plans_first_contact_reason_shape");
    expect(migration.split("char_length(").length - 1).toBe(1);

    // Control on the stripping itself: the raw file really does carry `--` comment text that the
    // scanned copy must not contain, so a `.replace` that silently stopped working would show up
    // here rather than as a scan quietly reading prose.
    expect(rawFirstContactReasonMigration()).toContain("-- At least one character that is not whitespace.");
    expect(migration).not.toContain("At least one character that is not whitespace.");
    expect(constant?.[1]).toBeDefined();
    expect(sql?.[1]).toBeDefined();

    expect(sql?.[1]).toBe(constant?.[1]);
  });
});
