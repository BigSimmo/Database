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

  it("uses the deep readiness endpoint for app rolling deploys", () => {
    expect(app.deploy).toMatchObject({
      healthcheckPath: "/api/health/ready",
      healthcheckTimeout: 60,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    });
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
    "scripts/guard-next-build.mjs",
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
    "src/lib/rag.ts",
    "worker/main.ts",
    "worker/python/requirements.txt",
    "scripts/run-tsx.mjs",
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
});
