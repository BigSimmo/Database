export type RuntimeCheckResult = {
  ok: boolean;
  expectedMajor: number;
  actualVersion: string;
  message: string;
};

function runtimeResult(runtimeName: string, version: string, expectedMajor: number): RuntimeCheckResult {
  const actualMajor = Number(version.split(".")[0]);

  if (!Number.isFinite(actualMajor)) {
    return {
      ok: false,
      expectedMajor,
      actualVersion: version,
      message: `Could not parse ${runtimeName} runtime version "${version}". Expected ${runtimeName} ${expectedMajor}.x.`,
    };
  }

  if (actualMajor === expectedMajor) {
    return {
      ok: true,
      expectedMajor,
      actualVersion: version,
      message: `${runtimeName} runtime ${version} matches required ${runtimeName} ${expectedMajor}.x.`,
    };
  }

  if (actualMajor < expectedMajor) {
    return {
      ok: false,
      expectedMajor,
      actualVersion: version,
      message: `${runtimeName} ${version} is too old. Use ${runtimeName} ${expectedMajor}.x for this project.`,
    };
  }

  return {
    ok: false,
    expectedMajor,
    actualVersion: version,
    message: `${runtimeName} ${version} is newer than the release target. Use ${runtimeName} ${expectedMajor}.x before release verification.`,
  };
}

export function checkNodeRuntime(version: string, expectedMajor = 24): RuntimeCheckResult {
  return runtimeResult("Node", version, expectedMajor);
}

export function checkNpmRuntime(
  userAgent = process.env.npm_config_user_agent ?? "",
  expectedMajor = 11,
): RuntimeCheckResult {
  if (!userAgent) {
    return {
      ok: true,
      expectedMajor,
      actualVersion: "unknown",
      message: `npm runtime was not detected; skipping npm ${expectedMajor}.x check outside npm script execution.`,
    };
  }

  const version = userAgent.match(/\bnpm\/([^\s]+)/)?.[1] ?? "unknown";
  return runtimeResult("npm", version, expectedMajor);
}

function main() {
  const results = [checkNodeRuntime(process.versions.node), checkNpmRuntime()];
  for (const result of results) {
    console.log(`[Runtime Check] ${result.ok ? "PASS" : "FAIL"}: ${result.message}`);
  }
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("check-runtime.ts")) {
  main();
}
