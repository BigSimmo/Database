import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { env } from "../src/lib/env";
import { embedTexts } from "../src/lib/openai";

export type PrerequisiteCheck = {
  ok: boolean;
  detail: string;
};

// IDX-C2: fail fast at worker startup if the configured embedding model does not produce
// EMBEDDING_DIMENSIONS vectors. The schema's vector(N) columns are fixed, so a model/env
// mismatch would otherwise corrupt or hard-fail ingestion mid-job. One tiny probe call.
export async function checkEmbeddingDimension(): Promise<PrerequisiteCheck> {
  try {
    const [embedding] = await embedTexts(["dimension probe"]);
    if (!embedding) {
      return { ok: false, detail: "Embedding probe returned no vector." };
    }
    if (embedding.length !== env.EMBEDDING_DIMENSIONS) {
      return {
        ok: false,
        detail:
          `Embedding model "${env.OPENAI_EMBEDDING_MODEL}" produced ${embedding.length} dimensions, ` +
          `but EMBEDDING_DIMENSIONS=${env.EMBEDDING_DIMENSIONS} (must match vector(N) in supabase/schema.sql).`,
      };
    }
    return {
      ok: true,
      detail: `Embedding dimension ${env.EMBEDDING_DIMENSIONS} matches model "${env.OPENAI_EMBEDDING_MODEL}".`,
    };
  } catch (error) {
    return {
      ok: false,
      detail: `Embedding dimension check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function resolveTesseractCommand() {
  if (process.env.TESSERACT_CMD) return process.env.TESSERACT_CMD;
  const candidates = [
    "C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
    "C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe",
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? "tesseract";
}

export function checkPythonPdfPrerequisites(): Promise<PrerequisiteCheck> {
  const script = [
    "import json",
    "result = {'ok': True, 'missing': []}",
    "for name in ['fitz', 'PIL', 'pytesseract']:",
    "    try:",
    "        __import__(name)",
    "    except Exception as exc:",
    "        result['ok'] = False",
    "        result['missing'].append(f'{name}: {exc}')",
    "try:",
    "    import pytesseract",
    `    pytesseract.pytesseract.tesseract_cmd = ${JSON.stringify(resolveTesseractCommand())}`,
    "    str(pytesseract.get_tesseract_version())",
    "except Exception as exc:",
    "    result['ok'] = False",
    "    result['missing'].append(f'tesseract binary: {exc}')",
    "print(json.dumps(result))",
  ].join("\n");

  return probePythonJson(script, "Python PDF/OCR prerequisites ready.");
}

// Only enforced when WORKER_MEDSPACY_ASSERTION=true — medspacy is an optional
// dependency and workers without it must keep starting cleanly while the flag is off.
export function checkMedspacyPrerequisites(): Promise<PrerequisiteCheck> {
  const script = [
    "import json",
    "result = {'ok': True, 'missing': []}",
    "try:",
    "    import medspacy",
    "except Exception as exc:",
    "    result['ok'] = False",
    "    result['missing'].append(f'medspacy: {exc}')",
    "print(json.dumps(result))",
  ].join("\n");

  return probePythonJson(script, "medspaCy assertion-tagging prerequisites ready.");
}

// Packet B4: only meaningful when WORKER_DOCUMENT_EXTRACTOR_MODE=shadow (main.ts warns) or
// when the docling interpreter is configured at all (validate-runtime.ts errors, so the image
// build proves the docling venv). Workers without docling must keep starting cleanly while
// the mode is "legacy" — shadow extraction fails open at run time either way.
export function checkDoclingShadowPrerequisites(): Promise<PrerequisiteCheck> {
  const pythonBin = env.WORKER_DOCLING_PYTHON_BIN;
  if (!pythonBin) {
    return Promise.resolve({
      ok: false,
      detail: "WORKER_DOCLING_PYTHON_BIN is not set; shadow extraction will record runtime_unavailable.",
    });
  }
  const script = [
    "import json",
    "result = {'ok': True, 'missing': []}",
    "try:",
    "    import docling",
    "    from docling.document_converter import DocumentConverter",
    "except Exception as exc:",
    "    result['ok'] = False",
    "    result['missing'].append(f'docling: {exc}')",
    "print(json.dumps(result))",
  ].join("\n");

  return probePythonJson(script, "Docling shadow-extraction prerequisites ready.", {
    pythonBin,
    env: { TORCHDYNAMO_DISABLE: "1", HF_HUB_OFFLINE: process.env.HF_HUB_OFFLINE ?? "1" },
    timeoutMs: 120_000,
  });
}

function probePythonJson(
  script: string,
  readyDetail: string,
  options: { pythonBin?: string; env?: Record<string, string>; timeoutMs?: number } = {},
): Promise<PrerequisiteCheck> {
  return new Promise((resolve) => {
    const child = spawn(options.pythonBin ?? env.PYTHON_BIN, ["-c", script], {
      stdio: ["ignore", "pipe", "pipe"],
      env: options.env ? { ...process.env, ...options.env } : process.env,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = options.timeoutMs
      ? setTimeout(() => {
          if (settled) return;
          settled = true;
          child.kill();
          resolve({ ok: false, detail: `Python prerequisite check timed out after ${options.timeoutMs}ms.` });
        }, options.timeoutMs)
      : null;
    const finish = (check: PrerequisiteCheck) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(check);
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      finish({ ok: false, detail: `Python unavailable: ${error.message}` });
    });
    child.on("close", (code) => {
      if (code !== 0) {
        finish({ ok: false, detail: stderr.trim() || `Python prerequisite check exited with ${code}` });
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as { ok: boolean; missing?: string[] };
        finish({
          ok: parsed.ok,
          detail: parsed.ok ? readyDetail : `Missing ${parsed.missing?.join("; ")}`,
        });
      } catch {
        finish({ ok: false, detail: "Python prerequisite check returned invalid output." });
      }
    });
  });
}
