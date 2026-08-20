import { existsSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { env } from "../src/lib/env";
import {
  checkPythonPdfPrerequisites,
  checkMedspacyPrerequisites,
  checkDoclingShadowPrerequisites,
} from "./prerequisites";

const NODE_BUILTINS = new Set(builtinModules);

type ValidationResult = {
  ok: boolean;
  nodeVersion: string;
  execPath: string;
  externals: { spec: string; resolved: string; ok: boolean }[];
  python: Awaited<ReturnType<typeof checkPythonPdfPrerequisites>>;
  medspacy?: Awaited<ReturnType<typeof checkMedspacyPrerequisites>>;
  /** Packet B4: present only when WORKER_DOCLING_PYTHON_BIN is set (Dockerfile.worker sets it). */
  doclingShadow?: Awaited<ReturnType<typeof checkDoclingShadowPrerequisites>>;
  doclingPipCheck?: { ok: boolean; detail: string };
  pipCheck: { ok: boolean; detail: string };
  errors: string[];
};

function resolveRelativeToBundle(relPath: string): URL {
  return new URL(relPath, import.meta.url);
}

function nodeMajor(): number {
  return Number(process.versions.node.split(".")[0]);
}

function npmMajor(): number | null {
  const userAgent = process.env.npm_config_user_agent ?? "";
  const match = userAgent.match(/\bnpm\/(\d+\.\d+\.\d+)/);
  return match ? Number(match[1].split(".")[0]) : null;
}

async function runPipCheck(pythonBin: string = env.PYTHON_BIN): Promise<{ ok: boolean; detail: string }> {
  const { execFile } = await import("node:child_process");
  return new Promise((resolve) => {
    execFile(pythonBin, ["-m", "pip", "check"], { timeout: 60_000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, detail: (stdout + stderr).trim() || String(error) });
      } else {
        resolve({ ok: true, detail: (stdout + stderr).trim() || "No broken requirements found." });
      }
    });
  });
}

export type ValidateRuntimeOptions = {
  /** Override the externals list for testing. */
  externals?: string[];
  /** Override the externals.json path for testing. */
  externalsPath?: URL | string;
  /** Skip Python/Tesseract/pip checks (for unit tests). */
  skipPython?: boolean;
};

export async function validateRuntime(options: ValidateRuntimeOptions = {}): Promise<ValidationResult> {
  const errors: string[] = [];
  const result: ValidationResult = {
    ok: true,
    nodeVersion: process.versions.node,
    execPath: process.execPath,
    externals: [],
    python: { ok: false, detail: "not checked" },
    pipCheck: { ok: false, detail: "not checked" },
    errors,
  };

  if (nodeMajor() !== 24) {
    errors.push(`Expected Node 24.x, got ${process.versions.node}`);
  }

  const npmMaj = npmMajor();
  if (npmMaj !== null && npmMaj !== 11) {
    errors.push(`Expected npm 11.x, got npm ${npmMaj}`);
  }

  let externals: string[] = options.externals ?? [];
  if (externals.length === 0) {
    const externalsPath = options.externalsPath
      ? typeof options.externalsPath === "string"
        ? pathToFileURL(options.externalsPath)
        : options.externalsPath
      : resolveRelativeToBundle("./externals.json");
    if (existsSync(externalsPath)) {
      try {
        externals = JSON.parse(readFileSync(externalsPath, "utf8")) as string[];
      } catch (error) {
        errors.push(`Failed to parse externals.json: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      errors.push(`externals.json not found at ${externalsPath}`);
    }
  }

  for (const spec of externals) {
    // esbuild may emit bare builtin names (`fs`) as well as `node:fs`.
    if (spec.startsWith("node:") || NODE_BUILTINS.has(spec)) {
      result.externals.push({ spec, resolved: spec.startsWith("node:") ? spec : `node:${spec}`, ok: true });
      continue;
    }
    try {
      const resolved = import.meta.resolve(spec, import.meta.url);
      const resolvedFile = fileURLToPath(resolved);
      const ok = existsSync(resolvedFile);
      result.externals.push({ spec, resolved: resolvedFile, ok });
      if (!ok) {
        errors.push(`Resolved ${spec} to ${resolvedFile} but the file does not exist`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.externals.push({ spec, resolved: "", ok: false });
      errors.push(`Failed to resolve ${spec}: ${message}`);
    }
  }

  if (!options.skipPython) {
    result.python = await checkPythonPdfPrerequisites();
    if (!result.python.ok) {
      errors.push(`Python PDF/OCR check failed: ${result.python.detail}`);
    }

    if (env.WORKER_MEDSPACY_ASSERTION) {
      result.medspacy = await checkMedspacyPrerequisites();
      if (!result.medspacy.ok) {
        errors.push(`medSpaCy check failed: ${result.medspacy.detail}`);
      }
    }

    result.pipCheck = await runPipCheck();
    if (!result.pipCheck.ok) {
      errors.push(`pip check failed: ${result.pipCheck.detail}`);
    }

    // Packet B4: when the docling interpreter is configured (Dockerfile.worker ENV), the
    // docling venv must import and be pip-consistent — proven at image build, offline.
    // Unset is not an error: legacy-only workers never need docling.
    if (env.WORKER_DOCLING_PYTHON_BIN) {
      result.doclingShadow = await checkDoclingShadowPrerequisites();
      if (!result.doclingShadow.ok) {
        errors.push(`docling shadow-extraction check failed: ${result.doclingShadow.detail}`);
      }
      result.doclingPipCheck = await runPipCheck(env.WORKER_DOCLING_PYTHON_BIN);
      if (!result.doclingPipCheck.ok) {
        errors.push(`docling venv pip check failed: ${result.doclingPipCheck.detail}`);
      }
    }
  }

  result.ok = errors.length === 0;
  return result;
}

async function main() {
  const result = await validateRuntime();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exit(1);
  });
}
