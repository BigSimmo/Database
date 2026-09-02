import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

type RailwayConfig = {
  build?: {
    dockerfilePath?: string;
    watchPatterns?: string[];
  };
  deploy?: {
    healthcheckPath?: string;
    healthcheckTimeout?: number;
    restartPolicyType?: string;
    restartPolicyMaxRetries?: number;
  };
};

function readConfig(fileName: string): RailwayConfig {
  return JSON.parse(readFileSync(new URL(`../${fileName}`, import.meta.url), "utf8")) as RailwayConfig;
}

function watchPatternMatches(pattern: string, filePath: string) {
  const normalizedPattern = pattern.replace(/^\/+/, "");
  const normalizedPath = filePath.replace(/^\/+/, "");
  if (normalizedPattern.endsWith("/**")) {
    const prefix = normalizedPattern.slice(0, -3);
    return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`);
  }
  return normalizedPath === normalizedPattern;
}

function triggersDeploy(config: RailwayConfig, filePath: string) {
  return (config.build?.watchPatterns ?? []).some((pattern) => watchPatternMatches(pattern, filePath));
}

describe("Railway config as code", () => {
  const app = readConfig("railway.app.json");
  const worker = readConfig("railway.worker.json");
  const appDockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");

  it("ships the local modules imported by next.config.ts in the app runner", () => {
    expect(appDockerfile).toContain("COPY --from=build /app/src/lib/security-headers.ts ./src/lib/security-headers.ts");
    expect(appDockerfile).toContain(
      "COPY --from=build /app/src/lib/observability/sentry-release.ts ./src/lib/observability/sentry-release.ts",
    );
    expect(appDockerfile).toContain("COPY --from=build /app/src/lib/supabase/project.ts ./src/lib/supabase/project.ts");
    expect(appDockerfile).toContain(
      "COPY --from=build /app/src/components/therapy-compass/data/generated-assets.ts ./src/components/therapy-compass/data/generated-assets.ts",
    );
  });

  it("admits Railway's non-secret deployment SHA into the build release", () => {
    expect(appDockerfile).toContain("ARG RAILWAY_GIT_COMMIT_SHA=");
    expect(appDockerfile).toContain("ENV RAILWAY_GIT_COMMIT_SHA=${RAILWAY_GIT_COMMIT_SHA}");
  });

  it("uses the deep readiness endpoint for app rolling deploys", () => {
    expect(app.deploy).toMatchObject({
      healthcheckPath: "/api/health/ready",
      healthcheckTimeout: 60,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    });
  });

  it("keeps the queue-draining worker alive after repeated failures", () => {
    expect(worker.deploy).toMatchObject({ restartPolicyType: "ALWAYS" });
    expect(worker.deploy).not.toHaveProperty("restartPolicyMaxRetries");
  });

  it.each([
    "Dockerfile",
    ".dockerignore",
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "tsconfig.json",
    "railway.app.json",
    "data/services-snapshot.json",
    "public/logo.svg",
    "src/app/page.tsx",
    "scripts/run-heavy.mjs",
    "scripts/guard-next-build.mjs",
    "scripts/check-client-bundle-secrets.mjs",
    "scripts/check-upload-limit-parity.mjs",
  ])("deploys the app for runtime input %s", (filePath) => {
    expect(triggersDeploy(app, filePath)).toBe(true);
  });

  it.each([
    "Dockerfile.worker",
    ".dockerignore",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "railway.worker.json",
    "data/services-snapshot.json",
    "src/lib/rag/rag.ts",
    "src/data/dsm-clinical-content.json",
    "worker/main.ts",
    "worker/python/requirements.txt",
    // B4: the worker image builds its docling venv from the Gate B lab lock.
    "eval/docling/requirements.txt",
    "scripts/build-worker.mjs",
    "scripts/enable-server-only-stub.mjs",
    "scripts/register-server-only.mjs",
    "scripts/resolve-tsx-cli.mjs",
    "scripts/run-tsx.mjs",
    "tests/stubs/server-only.ts",
  ])("deploys the worker for runtime input %s", (filePath) => {
    expect(triggersDeploy(worker, filePath)).toBe(true);
  });

  it.each([
    ".github/workflows/codex-autofix-review-comments.yml",
    "AGENTS.md",
    "README.md",
    "docs/deployment-architecture.md",
    "tests/rag-trust.test.ts",
    "scripts/check-codex-autofix-workflow.mjs",
  ])("does not deploy either service for non-runtime input %s", (filePath) => {
    expect(triggersDeploy(app, filePath)).toBe(false);
    expect(triggersDeploy(worker, filePath)).toBe(false);
  });

  it("keeps service-specific inputs isolated", () => {
    expect(triggersDeploy(app, "Dockerfile.worker")).toBe(false);
    expect(triggersDeploy(app, "worker/main.ts")).toBe(false);
    expect(triggersDeploy(worker, "Dockerfile")).toBe(false);
    expect(triggersDeploy(worker, "next.config.ts")).toBe(false);
    expect(triggersDeploy(worker, "public/logo.svg")).toBe(false);
  });

  it.each(["src/components/ui/button.tsx", "src/app/globals.css"])(
    "does not rebuild the worker for UI-only input %s",
    (filePath) => {
      expect(triggersDeploy(worker, filePath)).toBe(false);
    },
  );
});
