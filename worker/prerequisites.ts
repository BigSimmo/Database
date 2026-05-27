import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { env } from "../src/lib/env";

export type PrerequisiteCheck = {
  ok: boolean;
  detail: string;
};

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

  return new Promise((resolve) => {
    const child = spawn(env.PYTHON_BIN, ["-c", script], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ ok: false, detail: `Python unavailable: ${error.message}` });
    });
    child.on("close", (code) => {
      if (code !== 0) {
        resolve({ ok: false, detail: stderr.trim() || `Python prerequisite check exited with ${code}` });
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as { ok: boolean; missing?: string[] };
        resolve({
          ok: parsed.ok,
          detail: parsed.ok ? "Python PDF/OCR prerequisites ready." : `Missing ${parsed.missing?.join("; ")}`,
        });
      } catch {
        resolve({ ok: false, detail: "Python prerequisite check returned invalid output." });
      }
    });
  });
}
