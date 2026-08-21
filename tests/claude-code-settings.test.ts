import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `.claude/settings.json` is the only place where AGENTS.md's provider-confirmation
 * boundary is enforced rather than merely stated. Prose did not hold for the PR-following
 * rule — `.claude/hooks/pr-handoff-stop.sh` says so in its own header, "prose rules in
 * AGENTS.md have not held, a denied tool call does" — and there is no reason to expect it to
 * hold better for provider access.
 *
 * These tests pin the two properties that make the block trustworthy. Both were asserted in
 * review before they were ever measured, which is the failure shape this session kept hitting:
 * a check that cannot fail is not a check.
 *
 * 1. **No `allow` rule may reach a provider-backed script.** The block deliberately avoids
 *    broad wildcards such as `Bash(npm run check:*)` precisely so the outcome never depends on
 *    allow-versus-ask precedence. If someone later broadens the allow list for convenience,
 *    this goes red.
 * 2. **Every provider-backed script must carry an `ask` rule.** `ask` is also the default for
 *    an unlisted command, so these rules buy no protection on their own — what they buy is a
 *    machine-readable statement of the boundary that survives a future broadening, and a list
 *    that fails loudly when a new provider script is added without one.
 *
 * Plus one hook property: every hook command invokes its script through an interpreter rather
 * than by bare path. `session-start.sh` was registered by bare path AND checked in as mode
 * 100644, so on the Linux web containers that are the only place it does any work, it could
 * not run. See the "Claude Code hook scripts" section in AGENTS.md.
 */

const repoRoot = process.cwd();
const settings = JSON.parse(readFileSync(join(repoRoot, ".claude/settings.json"), "utf8"));
const packageScripts: Record<string, string> = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).scripts;

/**
 * Claude Code's Bash permission rules: `Bash(cmd)` matches that command exactly, and a
 * trailing `:*` (or ` --*`) makes it a prefix match. Anything else is not a Bash rule.
 */
function bashRuleMatches(rule: string, command: string): boolean {
  const parsed = /^Bash\((.*)\)$/.exec(rule);
  if (!parsed) return false;
  const pattern = parsed[1];
  if (pattern.endsWith(":*")) return command.startsWith(pattern.slice(0, -2));
  if (pattern.endsWith(" --*")) return command.startsWith(pattern.slice(0, -4));
  return command === pattern;
}

/**
 * Provider-backed or destructive npm scripts, per AGENTS.md "API and provider confirmation
 * boundary": anything that reaches OpenAI, live Supabase, GitHub, hosted CI, or mutates the
 * live index. Derived from the script names rather than hand-listed, so a newly added
 * `eval:` or `reindex:` script is covered the day it lands.
 */
const PROVIDER_BACKED =
  /supabase-project|^eval:|^test:live|^verify:release|github-shell-access:live|^sync:pr-br|production-readiness|cross-tenant|^import:docs|^enrich:|^classify:|^reindex|governance:release/;

const providerScripts = Object.keys(packageScripts).filter((name) => PROVIDER_BACKED.test(name));

describe("claude code permissions", () => {
  it("recognises a meaningful set of provider-backed scripts", () => {
    // A regex that silently stops matching would make both tests below vacuously pass.
    expect(providerScripts.length).toBeGreaterThan(20);
  });

  it.each(providerScripts)("npm run %s is not reachable through an allow rule", (script) => {
    const command = `npm run ${script}`;
    const reachedBy = (settings.permissions.allow as string[]).filter((rule) => bashRuleMatches(rule, command));
    expect(
      reachedBy,
      `${command} is provider-backed but matched allow rule(s): ${reachedBy.join(", ")}. ` +
        `Narrow the allow pattern rather than relying on ask-over-allow precedence.`,
    ).toEqual([]);
  });

  it.each(providerScripts)("npm run %s carries an explicit ask rule", (script) => {
    const command = `npm run ${script}`;
    const asked = (settings.permissions.ask as string[]).filter((rule) => bashRuleMatches(rule, command));
    expect(asked.length, `${command} is provider-backed but has no ask rule in .claude/settings.json`).toBeGreaterThan(
      0,
    );
  });

  it("denies reading local env files", () => {
    const deny = settings.permissions.deny as string[];
    for (const target of ["Read(./.env)", "Read(./.env.local)"]) {
      expect(deny, `${target} must stay denied — a staging key leaked on 2026-08-18`).toContain(target);
    }
  });

  it("soft-denies live supabase inspection in auto mode", () => {
    const allow = (settings.autoMode?.allow ?? []) as string[];
    const softDeny = (settings.autoMode?.soft_deny ?? []) as string[];
    expect(allow.some((rule) => rule.includes("supabase"))).toBe(false);
    expect(softDeny.some((rule) => rule.includes("supabase migration list"))).toBe(true);
  });
});

/**
 * Loosening `Bash(git push:*)`, `Bash(git add:*)`, and `Bash(gh pr create:*)` for routine
 * work (PR #2243) opened three gaps review caught, all on this same permissions file:
 *
 * 1. The generic push allow rule also matches a `HEAD:main` (or `<branch>:main`) destination
 *    refspec, not just a literal `main`/`master` source ref — the existing deny rules only
 *    covered the latter shape.
 * 2. The generic `git add` allow rule also matches `git add -f`/`--force`, which force-stages
 *    an otherwise-.gitignore'd file (e.g. `.env.local`) with no confirmation.
 * 3. `gh pr create` was blanket-allowed, letting an agent open a PR and trigger hosted CI
 *    without the confirmation provider-backed GitHub writes otherwise require.
 *
 * These tests pin the fixes using the same `bashRuleMatches` prefix-match model above, and
 * additionally assert that the broader loosened rule still matches the dangerous command —
 * proving the narrower deny/ask rule is what closes the gap via precedence, not merely the
 * absence of an allow match (see the docstring above on why that distinction matters).
 */
describe("git push HEAD:main destination-refspec tightening", () => {
  const dangerousPushCommands = [
    "git push origin HEAD:main",
    "git push origin HEAD:main --force-with-lease",
    "git push origin HEAD:master",
  ];

  it.each(dangerousPushCommands)("%s is matched by a deny rule", (command) => {
    const deny = settings.permissions.deny as string[];
    const matched = deny.filter((rule) => bashRuleMatches(rule, command));
    expect(
      matched.length,
      `${command} pushes to the protected main/master branch via an explicit refspec ` +
        `destination even though the source ref is not literally "main" — it must stay denied`,
    ).toBeGreaterThan(0);
  });

  it.each(dangerousPushCommands)(
    "%s is still matched by the generic push allow rule (deny must win via precedence)",
    (command) => {
      const allow = settings.permissions.allow as string[];
      const matched = allow.some((rule) => bashRuleMatches(rule, command));
      expect(
        matched,
        `${command} should still be reachable by Bash(git push:*) — this test only holds if ` +
          `the deny match above is what blocks it, not an absence of an allow match`,
      ).toBe(true);
    },
  );
});

describe("git add forced-staging tightening", () => {
  const forcedAddCommands = ["git add -f .env.local", "git add --force .env.local"];

  it.each(forcedAddCommands)("%s carries an explicit ask rule", (command) => {
    const asked = (settings.permissions.ask as string[]).filter((rule) => bashRuleMatches(rule, command));
    expect(
      asked.length,
      `${command} force-stages an ignored file, which combined with the now-allowed git commit/push ` +
        `is a path to publishing credentials — it must require confirmation`,
    ).toBeGreaterThan(0);
  });

  it.each(forcedAddCommands)(
    "%s is still matched by the generic git add allow rule (ask must win via precedence)",
    (command) => {
      const allowed = (settings.permissions.allow as string[]).filter((rule) => bashRuleMatches(rule, command));
      expect(allowed.length).toBeGreaterThan(0);
    },
  );
});

describe("gh pr create requires confirmation", () => {
  const command = "gh pr create --fill";

  it("is not reachable through an allow rule", () => {
    const allowed = (settings.permissions.allow as string[]).filter((rule) => bashRuleMatches(rule, command));
    expect(allowed, `${command} must not be blanket-allowed — it publishes a PR and triggers hosted CI`).toEqual([]);
  });

  it("carries an explicit ask rule", () => {
    const asked = (settings.permissions.ask as string[]).filter((rule) => bashRuleMatches(rule, command));
    expect(asked.length).toBeGreaterThan(0);
  });
});

describe("claude hook registrations", () => {
  const commands: { event: string; command: string }[] = [];
  for (const [event, matchers] of Object.entries(
    settings.hooks as Record<string, { hooks: { command: string }[] }[]>,
  )) {
    for (const matcher of matchers) {
      for (const hook of matcher.hooks) commands.push({ event, command: hook.command });
    }
  }

  it("registers at least the known hook events", () => {
    expect(commands.length).toBeGreaterThanOrEqual(5);
  });

  it.each(commands.map((c) => [c.event, c.command]))(
    "%s hook runs through an interpreter, not a bare path: %s",
    (_event, command) => {
      // A bare `$CLAUDE_PROJECT_DIR/.../foo.sh` depends on the checked-in executable bit, which
      // is invisible on this repo's Windows Dev Drive (core.fileMode=false) and was already
      // wrong once. Requiring `bash "..."` removes the dependency entirely.
      expect(
        /^(bash|sh|node|npx) /.test(command as string),
        `hook command must start with an interpreter: ${command}`,
      ).toBe(true);
    },
  );

  it.each(commands.map((c) => [c.event, c.command]))("%s hook declares an explicit timeout: %s", (event) => {
    const matchers = (settings.hooks as Record<string, { hooks: { timeout?: number }[] }[]>)[event as string];
    for (const matcher of matchers) {
      for (const hook of matcher.hooks) {
        // The default is 60s. session-start.sh downloads a Node tarball and runs npm ci on a
        // cold container, and a killed hook leaves dependencies half installed.
        expect(typeof hook.timeout, `${event} hook is missing a timeout`).toBe("number");
      }
    }
  });
});
