import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("authenticated live test workflow", () => {
  const workflow = readFileSync(join(process.cwd(), ".github", "workflows", "authenticated-live-tests.yml"), "utf8");

  it("is manual-only, confirmation-gated, and least-privilege", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s+(?:pull_request|push|schedule):/m);
    expect(workflow).toContain(
      "github.ref == 'refs/heads/main' && inputs.confirmation == 'run-authenticated-live-tests'",
    );
    expect(workflow).toContain("environment: Database / production");
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("ref: refs/heads/main");
    expect(workflow).not.toMatch(/read-only/i);
    expect(workflow).toContain("production E2E sign-in/out, test requests, and rate-limit updates");
    expect(workflow).toContain("Authenticated production tests with bounded E2E mutations");
    expect(workflow).not.toContain("OPENAI_API_KEY");
    expect(workflow).not.toContain("RAILWAY_API_TOKEN");
  });

  it("discloses the bounded production state changes before dispatch", () => {
    expect(workflow).toContain('default: "do-not-run"');
    expect(workflow).toContain('- "run-authenticated-live-tests"');
    expect(workflow.indexOf("sign-in/out")).toBeLessThan(workflow.indexOf("environment: Database / production"));
  });

  it("uses GitHub secrets and preserves the repository provider-test guard", () => {
    for (const secret of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "E2E_USER_EMAIL",
      "E2E_USER_PASSWORD",
    ]) {
      expect(workflow).toContain(`secrets.${secret}`);
    }
    expect(workflow).toContain('ALLOW_PROVIDER_TESTS: "true"');
    expect(workflow.indexOf("npm run check:supabase-project")).toBeLessThan(workflow.indexOf("npm run test:live"));
  });
});
