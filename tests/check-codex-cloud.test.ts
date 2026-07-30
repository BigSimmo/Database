import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  configuredProviderCredentialNames,
  executableFile,
  obsoleteNpmProxyVariables,
} from "../scripts/check-codex-cloud.mjs";

describe("Codex Cloud environment contract", () => {
  it("keeps the checked-in setup reproducible and provider-safe", () => {
    const result = spawnSync(process.execPath, ["scripts/check-codex-cloud.mjs"], {
      cwd: path.resolve(import.meta.dirname, ".."),
      encoding: "utf8",
      shell: false,
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("[Codex Cloud Check] PASS: static Cloud contracts match.");
  });

  it("reports sensitive and proxy variable names without exposing values", () => {
    const env = {
      OPENAI_API_KEY: "never-print-this",
      npm_config_https_proxy: "https://user:secret@example.test",
      HTTP_PROXY: "http://supported.example.test",
    };

    expect(configuredProviderCredentialNames(env)).toEqual(["OPENAI_API_KEY"]);
    expect(obsoleteNpmProxyVariables(env)).toEqual(["npm_config_https_proxy"]);
  });

  it("distinguishes executable files from missing paths", () => {
    expect(executableFile(process.execPath)).toBe(true);
    expect(executableFile("/definitely/not/a/cloud/executable")).toBe(false);
  });
});
