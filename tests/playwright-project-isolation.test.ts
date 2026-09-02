import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { playwrightArgsForPrUiShard, prUiShardGroups } from "../scripts/playwright-pr-shards.mjs";

/**
 * Pull a named regex literal out of playwright.config.ts and rebuild it.
 *
 * The config cannot be imported here: it calls getPlaywrightBaseUrl at module
 * scope, which refuses to resolve without a runner-owned local server. Reading
 * the source is the only way a unit test can see these patterns, so the
 * extraction fails CLOSED — a renamed or restructured constant is reported
 * rather than quietly turning the assertions below into no-ops.
 */
function configPattern(source: string, name: string): RegExp {
  const match = source.match(new RegExp(`const ${name} =\\s*(/.*/);`));
  if (!match) {
    throw new Error(
      `playwright.config.ts: could not read the \`${name}\` regex literal. If it moved or changed shape, ` +
        "update this helper — do not delete the assertions that depend on it.",
    );
  }
  return new RegExp(match[1].slice(1, -1));
}

describe("Playwright production-project isolation", () => {
  it("excludes advisory mockup cases from every required browser project", () => {
    const source = readFileSync(resolve(process.cwd(), "playwright.config.ts"), "utf8");

    for (const project of ["chromium", "firefox", "webkit"]) {
      expect(source).toMatch(
        new RegExp(`name: ["']${project}["'],\\s+testMatch: productionSpecPattern,\\s+grepInvert: mockupTag,`, "m"),
      );
    }

    expect(source).toMatch(/name: ["']chromium-mockups["'],\s+testMatch: mockupSpecPattern,\s+grep: mockupTag,/m);
  });

  it("collects the linked caring-contact prototype only in the advisory mockup project", () => {
    const source = readFileSync(resolve(process.cwd(), "playwright.config.ts"), "utf8");
    const productionSpecPattern = configPattern(source, "productionSpecPattern");
    const mockupSpecPattern = configPattern(source, "mockupSpecPattern");
    const testMatch = source.match(/testMatch:\s*(\/.*\/),/);
    expect(testMatch, "playwright.config.ts: could not read the top-level testMatch regex").not.toBeNull();
    const testMatchPattern = new RegExp(testMatch![1].slice(1, -1));
    const spec = "tests/ui-caring-contact-mockup.spec.ts";

    expect(existsSync(resolve(process.cwd(), spec)), `${spec} is missing`).toBe(true);
    expect(testMatchPattern.test(spec), `${spec} is not collected by top-level testMatch`).toBe(true);
    expect(mockupSpecPattern.test(spec), `${spec} is not collected by chromium-mockups`).toBe(true);
    expect(productionSpecPattern.test(spec), `${spec} leaked into required production projects`).toBe(false);

    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.["test:e2e:caring-contact-mockup"]).toBe(
      "node scripts/run-playwright.mjs --project=chromium-mockups tests/ui-caring-contact-mockup.spec.ts",
    );
  });

  /**
   * The production Caring Contacts workspace spec is the surface's only browser
   * proof, and it is what `docs/design-system/adoption-contract.json` cites for
   * all five proof categories. A spec listed in only one of the two
   * hand-maintained regexes does not fail — it silently never runs, and the
   * adoption declaration it backs becomes a claim nothing checks. Pin both, and
   * pin that it stays out of the advisory mockup project.
   */
  it("collects the production caring-contacts workspace spec in the chromium project only", () => {
    const source = readFileSync(resolve(process.cwd(), "playwright.config.ts"), "utf8");
    const productionSpecPattern = configPattern(source, "productionSpecPattern");
    const mockupSpecPattern = configPattern(source, "mockupSpecPattern");
    const testMatch = source.match(/testMatch:\s*(\/.*\/),/);
    expect(testMatch, "playwright.config.ts: could not read the top-level testMatch regex").not.toBeNull();
    const testMatchPattern = new RegExp(testMatch![1].slice(1, -1));

    const spec = "tests/ui-caring-contacts-workspace.spec.ts";
    expect(existsSync(resolve(process.cwd(), spec)), `${spec} is missing`).toBe(true);
    expect(testMatchPattern.test(spec), `${spec} is not collected by top-level testMatch`).toBe(true);
    expect(
      productionSpecPattern.test(spec),
      `${spec} is not collected by productionSpecPattern, so the workspace has no browser gate at all`,
    ).toBe(true);
    expect(mockupSpecPattern.test(spec), `${spec} leaked into the advisory mockup project`).toBe(false);
  });

  /**
   * The Caring Contacts activation journey (#JZA0XK) is the repository's ONE spec that runs against
   * a different server: `run-playwright.mjs` starts a second `next start` with
   * `CARING_CONTACTS_DEMO_SEED=on`, and `chromium-caring-contacts-seeded` is the only project
   * pointed at it.
   *
   * Both directions matter and both fail silently rather than loudly:
   *
   *  - Missed by `seededSpecPattern` or the top-level `testMatch`, it never runs, and the wizard
   *    goes back to having zero browser evidence on a green pull request.
   *  - Caught by `productionSpecPattern`, it runs in the projects aimed at the UNSEEDED server,
   *    where `demo-seed-referral-wren` does not exist. The wizard would render the same
   *    `PlanStartStateNotice` the workspace spec already pins, and the journey would fail for a
   *    reason that has nothing to do with the wizard.
   *
   * The gate wiring is pinned here too: a spec collected by a project no gate ever selects is the
   * same defect as a spec collected by nothing.
   */
  it("collects the seeded caring-contacts activation spec only in the seeded project", () => {
    const source = readFileSync(resolve(process.cwd(), "playwright.config.ts"), "utf8");
    const productionSpecPattern = configPattern(source, "productionSpecPattern");
    const mockupSpecPattern = configPattern(source, "mockupSpecPattern");
    const seededSpecPattern = configPattern(source, "seededSpecPattern");
    const testMatch = source.match(/testMatch:\s*(\/.*\/),/);
    expect(testMatch, "playwright.config.ts: could not read the top-level testMatch regex").not.toBeNull();
    const testMatchPattern = new RegExp(testMatch![1].slice(1, -1));

    const spec = "tests/ui-caring-contacts-activation.spec.ts";
    expect(existsSync(resolve(process.cwd(), spec)), `${spec} is missing`).toBe(true);
    expect(testMatchPattern.test(spec), `${spec} is not collected by top-level testMatch`).toBe(true);
    expect(
      seededSpecPattern.test(spec),
      `${spec} is not collected by seededSpecPattern, so the activation wizard has no browser gate at all`,
    ).toBe(true);
    expect(
      productionSpecPattern.test(spec),
      `${spec} leaked into the projects pointed at the UNSEEDED server, where its referral does not exist`,
    ).toBe(false);
    expect(mockupSpecPattern.test(spec), `${spec} leaked into the advisory mockup project`).toBe(false);

    // The seeded project exists, matches only that pattern, and reads its own base URL from the
    // second server rather than inheriting the primary one.
    expect(source).toMatch(
      /name: ["']chromium-caring-contacts-seeded["'],\s+testMatch: seededSpecPattern,\s+grepInvert: mockupTag,/m,
    );
    expect(source).toContain("const seededBaseURL = process.env.PLAYWRIGHT_SEEDED_BASE_URL;");
    expect(source).toContain("baseURL: seededBaseURL ?? baseURL,");

    // No production spec may be pulled into the seeded project either: it would then run against a
    // populated store while its own assertions describe an empty one.
    for (const file of readdirSync(resolve(process.cwd(), "tests")).filter((entry) => entry.endsWith(".spec.ts"))) {
      if (`tests/${file}` === spec) continue;
      expect(seededSpecPattern.test(`tests/${file}`), `${file} was pulled into the seeded project`).toBe(false);
    }

    // GATE WIRING. A focused script, the `verify:ui` PR gate, and CI's Production UI shards.
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.["test:e2e:caring-contacts-activation"]).toBe(
      "node scripts/run-playwright.mjs --project=chromium-caring-contacts-seeded tests/ui-caring-contacts-activation.spec.ts",
    );
    expect(packageJson.scripts?.["test:e2e:pr"]).toContain("--project=chromium-caring-contacts-seeded");
    expect(prUiShardGroups[1]).toContain(spec);
    expect(playwrightArgsForPrUiShard(1)).toContain("--project=chromium-caring-contacts-seeded");
    // ...and only the shard that holds it pays for the second server.
    expect(playwrightArgsForPrUiShard(2)).not.toContain("--project=chromium-caring-contacts-seeded");
  });

  /**
   * `run-playwright.mjs` owns both servers, and the primary one must stay EMPTY: the workspace
   * spec's empty-caseload assertions (including its wizard count of 0) are observations of a real
   * production state, and seeding that server would delete them rather than add anything.
   */
  it("starts the seeded server separately and leaves the primary server's environment alone", () => {
    const runner = readFileSync(resolve(process.cwd(), "scripts/run-playwright.mjs"), "utf8");

    expect(runner).toContain('CARING_CONTACTS_DEMO_SEED: "on"');
    // Exactly ONE environment object sets it, and it is the seeded server's. A second assignment
    // would be the primary server's, which is how the workspace spec's empty-caseload assertions
    // would start observing a fixture instead of a state.
    expect(runner.match(/CARING_CONTACTS_DEMO_SEED\s*:/g)?.length).toBe(1);
    expect(runner).toContain("testEnv.PLAYWRIGHT_SEEDED_BASE_URL = seededBaseUrl;");
    // Started only when the seeded project is selected, and torn down with the primary server on
    // every exit path — `cleanup()` is registered for exit, SIGINT and SIGTERM above.
    expect(runner).toContain("if (seededServerRequested) {");
    expect(runner).toContain("stopOwnedProcessTree(seededServer);");
    // The same readiness probe, not a second weaker one.
    expect(runner).toContain("await waitForServer(seededBaseUrl, seededServer);");
  });

  /**
   * The Care Plan prototype's only browser proof. Ten tasks of structural
   * checking ran under `css: false` in jsdom, so this spec is the first and
   * only thing that can see the prototype paint: the pinned safety boundary,
   * the three print surfaces, and whether a link looks like a link. A regex
   * edit that dropped it would not fail — it would silently leave the whole
   * route family with no rendered evidence at all, on a green pull request.
   */
  it("collects the Care Plan prototype only in the advisory mockup project", () => {
    const source = readFileSync(resolve(process.cwd(), "playwright.config.ts"), "utf8");
    const productionSpecPattern = configPattern(source, "productionSpecPattern");
    const mockupSpecPattern = configPattern(source, "mockupSpecPattern");
    const testMatch = source.match(/testMatch:\s*(\/.*\/),/);
    expect(testMatch, "playwright.config.ts: could not read the top-level testMatch regex").not.toBeNull();
    const testMatchPattern = new RegExp(testMatch![1].slice(1, -1));
    const spec = "tests/ui-care-plan-mockup.spec.ts";

    expect(existsSync(resolve(process.cwd(), spec)), `${spec} is missing`).toBe(true);
    expect(testMatchPattern.test(spec), `${spec} is not collected by top-level testMatch`).toBe(true);
    expect(mockupSpecPattern.test(spec), `${spec} is not collected by chromium-mockups`).toBe(true);
    expect(
      productionSpecPattern.test(spec),
      `${spec} leaked into the required production projects, where a red prototype would block a release`,
    ).toBe(false);

    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.["test:e2e:care-plan-mockup"]).toBe(
      "node scripts/run-playwright.mjs --project=chromium-mockups tests/ui-care-plan-mockup.spec.ts",
    );
  });

  /**
   * The phone-scroll coverage is split across sibling spec files so no single
   * file can dominate one `--shard`. That split only holds if every sibling is
   * actually collected: `productionSpecPattern` and `testMatch` are two more
   * hand-maintained lists of spec basenames, and a file they miss does not fail
   * — it silently never runs, on a green pull request. Assert against the files
   * on disk rather than against a third copy of the list.
   */
  it("collects every phone-scroll spec sibling into the required browser projects", () => {
    const source = readFileSync(resolve(process.cwd(), "playwright.config.ts"), "utf8");
    const productionSpecPattern = configPattern(source, "productionSpecPattern");
    const testMatch = source.match(/testMatch:\s*(\/.*\/),/);
    expect(testMatch, "playwright.config.ts: could not read the top-level testMatch regex").not.toBeNull();
    const testMatchPattern = new RegExp(testMatch![1].slice(1, -1));

    const siblings = readdirSync(resolve(process.cwd(), "tests")).filter(
      (file) => file.startsWith("ui-phone-scroll") && file.endsWith(".spec.ts"),
    );

    // The split is the point; one file means it was undone without updating this.
    expect(siblings.length, "expected the phone-scroll coverage to stay split across sibling specs").toBeGreaterThan(1);

    for (const file of siblings) {
      expect(testMatchPattern.test(`tests/${file}`), `${file} is not collected by testMatch`).toBe(true);
      expect(
        productionSpecPattern.test(`tests/${file}`),
        `${file} is not collected by productionSpecPattern, so it never runs in a required browser project`,
      ).toBe(true);
    }
  });

  /**
   * The viewer-canvas gate is the only browser proof that a clinical source page
   * actually paints, and it is the single spec most likely to be dropped by a
   * future edit to those two hand-maintained regexes: it skips on any browser
   * without pdf.js 6's engine requirement, so "it did not run" and "it ran and
   * skipped" look identical in a log. Assert its collection directly.
   */
  it("collects the viewer-canvas gate into the required browser projects", () => {
    const source = readFileSync(resolve(process.cwd(), "playwright.config.ts"), "utf8");
    const productionSpecPattern = configPattern(source, "productionSpecPattern");
    const testMatch = source.match(/testMatch:\s*(\/.*\/),/);
    expect(testMatch, "playwright.config.ts: could not read the top-level testMatch regex").not.toBeNull();
    const testMatchPattern = new RegExp(testMatch![1].slice(1, -1));

    const spec = "tests/ui-document-canvas.spec.ts";
    expect(existsSync(resolve(process.cwd(), spec)), `${spec} is missing`).toBe(true);
    expect(testMatchPattern.test(spec), `${spec} is not collected by testMatch`).toBe(true);
    expect(
      productionSpecPattern.test(spec),
      `${spec} is not collected by productionSpecPattern, so the viewer canvas has no browser gate at all`,
    ).toBe(true);
  });

  /**
   * Ward Flow's browser journeys are the prototype's only rendered evidence, and their
   * collection depends on TWO hand-maintained alternations in playwright.config.ts that both
   * spell each spec out by name. A ward spec missing from either one does not fail — it silently
   * never runs, which is indistinguishable from passing on a green pull request. That exact
   * defect has already shipped here in five different forms (a spec regex, a nav icon map, a
   * route-coverage map, a cohort picker, and the CI scope list `assertMockupSpecParity` now
   * guards). Assert against the ward specs actually on disk rather than against a third copy of
   * the list, the same way the phone-scroll siblings above are checked.
   */
  it("collects every ui-ward-*.spec.ts on disk into the advisory mockup project, and none into the required ones", () => {
    const source = readFileSync(resolve(process.cwd(), "playwright.config.ts"), "utf8");
    const productionSpecPattern = configPattern(source, "productionSpecPattern");
    const mockupSpecPattern = configPattern(source, "mockupSpecPattern");
    const testMatch = source.match(/testMatch:\s*(\/.*\/),/);
    expect(testMatch, "playwright.config.ts: could not read the top-level testMatch regex").not.toBeNull();
    const testMatchPattern = new RegExp(testMatch![1].slice(1, -1));

    const wardSpecs = readdirSync(resolve(process.cwd(), "tests")).filter(
      (file) => file.startsWith("ui-ward-") && file.endsWith(".spec.ts"),
    );
    expect(wardSpecs.length, "expected Ward Flow to carry browser journeys").toBeGreaterThan(0);

    for (const file of wardSpecs) {
      const spec = `tests/${file}`;
      expect(testMatchPattern.test(spec), `${file} is not collected by testMatch, so it never runs at all`).toBe(true);
      expect(
        mockupSpecPattern.test(spec),
        `${file} is not collected by chromium-mockups, so the journey silently never runs`,
      ).toBe(true);
      expect(
        productionSpecPattern.test(spec),
        `${file} leaked into the required production projects, where a red prototype would block a release`,
      ).toBe(false);
    }
  });

  /**
   * ⚠️ THE UNIVERSAL NET — ADDED 2026-09-02, AND IT IS AN ADDITION, NOT A REPLACEMENT.
   *
   * Every test above answers "is THIS family routed correctly": collected at all, collected by the
   * right project, and NOT leaked into the wrong one. **None of them can answer "is there a spec on
   * disk that no project collects at all", because each one starts from a family it already knows
   * about.** A file nobody thought to write a test for is invisible to all of them.
   *
   * ⚠️ THAT GAP WAS NOT HYPOTHETICAL. `tests/ui-tools-show-all.spec.ts` landed on 2026-08-16 (PR
   * #2008) carrying a launcher regression this repository had just paid for, was never added to any
   * config, and so never ran once — while being edited twice more (2026-08-22, 2026-08-23) by people
   * who reasonably believed it was protecting something. Seventeen days. `git log -S "tools-show-all"
   * -- playwright.config.ts` returns nothing: the token was never there to be removed.
   *
   * ⚠️ THIS MUST NOT BE USED TO DELETE THE PER-FAMILY TESTS ABOVE, and consolidating them into it
   * would LOSE coverage rather than tidy it. This checks only that a spec is collected SOMEWHERE. It
   * cannot see a mockup leaking into a required browser project — which is the property those tests
   * exist for and the only one that can block a release on a red prototype.
   *
   * Measured argument, from a mutation run on 2026-09-02: a cross-check between two DERIVED counts
   * stayed silent under mutation because both sides collapsed together, and only a separate pin
   * against a hand-written literal caught it. **Two guards that fail differently are worth more than
   * one that fails once.**
   */
  it("every ui-*.spec.ts on disk is collected by some Playwright config, so a spec cannot sit unrun", () => {
    const readTestMatch = (file: string) => {
      const path = resolve(process.cwd(), file);
      if (!existsSync(path)) return null;
      const matched = readFileSync(path, "utf8").match(/testMatch:\s*(\/[^\n]*\/)\s*,/);
      return matched ? new RegExp(matched[1].slice(1, -1)) : null;
    };

    const mainMatch = readTestMatch("playwright.config.ts");
    expect(mainMatch, "playwright.config.ts: could not read the top-level testMatch regex").not.toBeNull();

    // The visual-baseline suite runs from its own config with its own CI job, so a spec collected
    // only there is collected, not orphaned. Absent file = matches nothing, which fails CLOSED:
    // specs it would have covered are then reported as orphans rather than silently excused.
    const visualMatch = readTestMatch("playwright.visual.config.ts");

    const specs = readdirSync(resolve(process.cwd(), "tests")).filter(
      (file) => file.startsWith("ui-") && file.endsWith(".spec.ts"),
    );
    // Anti-vacuity: an empty or collapsed listing would satisfy the loop below for free.
    expect(specs.length, "expected the repository to carry browser specs at all").toBeGreaterThan(20);

    const orphans = specs.filter((file) => {
      const spec = `tests/${file}`;
      return !mainMatch!.test(spec) && !(visualMatch?.test(spec) ?? false);
    });

    expect(
      orphans,
      "These spec files exist on disk and are collected by NO Playwright config, so they never run " +
        "and the suite reports green having run fewer tests than it appears to. Add each one's token " +
        "to the pattern for the project it belongs in — production or mockup — and run it once before " +
        "trusting it. Do NOT silence this by narrowing the disk scan.",
    ).toEqual([]);
  });

  it("blocks service workers for mocked journeys but allows the dedicated PWA suite", () => {
    const config = readFileSync(resolve(process.cwd(), "playwright.config.ts"), "utf8");
    const pwaSpec = readFileSync(resolve(process.cwd(), "tests/ui-pwa.spec.ts"), "utf8");

    expect(config).toContain('serviceWorkers: "block"');
    expect(pwaSpec).toContain('test.use({ serviceWorkers: "allow" })');
  });
});
