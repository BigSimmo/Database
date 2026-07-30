import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { inspectUploadLimitConfiguration } from "../scripts/check-upload-limit-config.mjs";

describe("upload limit configuration", () => {
  it("runs the parity guard before every production build", () => {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    const buildScript = packageJson.scripts["build:internal"] as string;
    expect(buildScript.indexOf("check:upload-limits")).toBeGreaterThanOrEqual(0);
    expect(buildScript.indexOf("check:upload-limits")).toBeLessThan(buildScript.indexOf("next build"));
  });

  it("passes matching server and browser limits into the Docker build guard", () => {
    const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
    const dockerWorkflow = readFileSync(new URL("../.github/workflows/docker-image.yml", import.meta.url), "utf8");
    const buildStage = dockerfile.slice(dockerfile.indexOf("FROM node:24-bookworm-slim AS build"));
    const buildCommandIndex = buildStage.indexOf("RUN npm run build");
    expect(buildStage.indexOf("ARG MAX_UPLOAD_MB=")).toBeLessThan(buildCommandIndex);
    expect(buildStage.indexOf("ENV MAX_UPLOAD_MB=${MAX_UPLOAD_MB}")).toBeLessThan(buildCommandIndex);
    expect(buildStage.indexOf("ARG NEXT_PUBLIC_MAX_UPLOAD_MB=")).toBeLessThan(buildCommandIndex);
    expect(buildStage.indexOf("ENV NEXT_PUBLIC_MAX_UPLOAD_MB=${NEXT_PUBLIC_MAX_UPLOAD_MB}")).toBeLessThan(
      buildCommandIndex,
    );
    expect(dockerWorkflow).toMatch(/^\s+MAX_UPLOAD_MB=50$/m);
    expect(dockerWorkflow).toMatch(/^\s+NEXT_PUBLIC_MAX_UPLOAD_MB=50$/m);
  });

  it("uses the matching 150 MB defaults when neither value is configured", () => {
    expect(inspectUploadLimitConfiguration()).toEqual({
      ok: true,
      serverMb: 150,
      clientMb: 150,
      errors: [],
    });
  });

  it("accepts matching lowered client and server limits", () => {
    expect(inspectUploadLimitConfiguration({ MAX_UPLOAD_MB: "50", NEXT_PUBLIC_MAX_UPLOAD_MB: "50" })).toMatchObject({
      ok: true,
      serverMb: 50,
      clientMb: 50,
    });
  });

  it("rejects a lowered server limit without the matching build-time client value", () => {
    const result = inspectUploadLimitConfiguration({ MAX_UPLOAD_MB: "50" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "MAX_UPLOAD_MB (50) and NEXT_PUBLIC_MAX_UPLOAD_MB (150) must match before building or releasing.",
    );
  });

  it("rejects a lowered client limit while the server remains at its default", () => {
    const result = inspectUploadLimitConfiguration({ NEXT_PUBLIC_MAX_UPLOAD_MB: "50" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "MAX_UPLOAD_MB (150) and NEXT_PUBLIC_MAX_UPLOAD_MB (50) must match before building or releasing.",
    );
  });

  it("rejects malformed and above-ceiling limits", () => {
    const result = inspectUploadLimitConfiguration({
      MAX_UPLOAD_MB: "zero",
      NEXT_PUBLIC_MAX_UPLOAD_MB: "151",
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "MAX_UPLOAD_MB must be an integer from 1 to 150.",
      "NEXT_PUBLIC_MAX_UPLOAD_MB must be an integer from 1 to 150.",
    ]);
  });

  it("checks the same .env.production.local values that Next loads for a build", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "upload-limit-config-"));
    const environment: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production" };
    delete environment.MAX_UPLOAD_MB;
    delete environment.NEXT_PUBLIC_MAX_UPLOAD_MB;
    writeFileSync(
      join(fixtureRoot, ".env.production.local"),
      "MAX_UPLOAD_MB=50\nNEXT_PUBLIC_MAX_UPLOAD_MB=40\n",
      "utf8",
    );

    try {
      const result = spawnSync(
        process.execPath,
        [fileURLToPath(new URL("../scripts/check-upload-limit-config.mjs", import.meta.url))],
        {
          cwd: fixtureRoot,
          env: environment,
          encoding: "utf8",
          stdio: "pipe",
        },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/MAX_UPLOAD_MB \(50\).*NEXT_PUBLIC_MAX_UPLOAD_MB \(40\)/s);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
