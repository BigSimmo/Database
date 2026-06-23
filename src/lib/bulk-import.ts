import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { smartDocumentTitle } from "@/lib/document-naming";

export const DEFAULT_IMPORT_BATCH_SIZE = 20;
export const DEFAULT_IMPORT_INCLUDE = "**/*.{pdf,docx,xlsx,txt}";

export type ImportCliArgs = {
  path: string;
  ownerEmail?: string;
  ownerId?: string;
  batchName?: string;
  include: string;
  limit?: number;
  queueBatchSize: number;
  dryRun: boolean;
  force: boolean;
  forceLargeImport: boolean;
  resume?: string;
};

export type ScannedImportFile = {
  absolutePath: string;
  relativePath: string;
  fileName: string;
  size: number;
  contentHash: string;
};

export type ExistingImportDocument = {
  id: string;
  storage_path: string;
  title: string;
  source_path?: string | null;
  content_hash?: string | null;
};

export function parseImportCliArgs(argv: string[]): ImportCliArgs {
  const args: Record<string, string | boolean> = {
    include: DEFAULT_IMPORT_INCLUDE,
    queueBatchSize: String(DEFAULT_IMPORT_BATCH_SIZE),
    dryRun: false,
    force: false,
    forceLargeImport: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (key === "dry-run" || key === "force" || key === "force-large-import") {
      const normalizedKey = key === "dry-run" ? "dryRun" : key === "force-large-import" ? "forceLargeImport" : "force";
      args[normalizedKey] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    index += 1;
    args[key.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())] = value;
  }

  if (!args.path || typeof args.path !== "string") {
    throw new Error('Missing required --path "D:\\Clinical PDFs" argument.');
  }

  const limit = typeof args.limit === "string" ? Number.parseInt(args.limit, 10) : undefined;
  const queueBatchSize =
    typeof args.queueBatchSize === "string" ? Number.parseInt(args.queueBatchSize, 10) : DEFAULT_IMPORT_BATCH_SIZE;
  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    throw new Error("--limit must be a positive integer when provided.");
  }
  if (!Number.isInteger(queueBatchSize) || queueBatchSize <= 0) {
    throw new Error("--queue-batch-size must be a positive integer.");
  }

  return {
    path: args.path,
    ownerEmail: typeof args.ownerEmail === "string" ? args.ownerEmail : undefined,
    ownerId: typeof args.ownerId === "string" ? args.ownerId : undefined,
    batchName: typeof args.batchName === "string" ? args.batchName : undefined,
    include: typeof args.include === "string" ? args.include : DEFAULT_IMPORT_INCLUDE,
    limit,
    queueBatchSize,
    dryRun: Boolean(args.dryRun),
    force: Boolean(args.force),
    forceLargeImport: Boolean(args.forceLargeImport),
    resume: typeof args.resume === "string" ? args.resume : undefined,
  };
}

export function safeFileName(fileName: string) {
  return fileName.replace(/[^\w.\-() ]+/g, "_");
}

export function titleFromFileName(fileName: string) {
  return smartDocumentTitle(fileName);
}

export function buildImportStoragePath(ownerId: string, documentId: string, fileName: string) {
  return `${ownerId}/documents/${documentId}/${safeFileName(fileName)}`;
}

export function formatExactDuplicateSkip(
  file: Pick<ScannedImportFile, "relativePath">,
  duplicate: ExistingImportDocument,
  options: { dryRun?: boolean } = {},
) {
  const prefix = options.dryRun ? "DRY RUN DUPLICATE exact copy would be skipped" : "DUPLICATE exact copy skipped";
  const matchedSource = duplicate.source_path || duplicate.storage_path;
  return `${prefix} ${file.relativePath} (matches "${duplicate.title}" at ${matchedSource})`;
}

function normalizeInclude(include: string) {
  return include.trim().toLowerCase().replaceAll("\\", "/");
}

function extensionsFromInclude(include: string) {
  const normalized = normalizeInclude(include);
  const braceMatch = normalized.match(/\{([^}]+)\}$/);
  if (braceMatch) {
    return braceMatch[1]
      .split(",")
      .map((extension) => extension.trim().replace(/^\./, ""))
      .filter(Boolean)
      .map((extension) => `.${extension}`);
  }
  if (normalized.startsWith("**/*.")) return [normalized.slice(4)];
  if (normalized.startsWith("*.")) return [normalized.slice(1)];
  return [".pdf"];
}

export function matchesInclude(relativePath: string, include = "**/*.pdf") {
  const normalizedPath = relativePath.toLowerCase().replaceAll("\\", "/");
  return extensionsFromInclude(include).some((extension) => normalizedPath.endsWith(extension));
}

export function importMimeType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (extension === ".txt") return "text/plain";
  return "application/octet-stream";
}

export function chunkImportFiles<T>(files: T[], queueBatchSize = DEFAULT_IMPORT_BATCH_SIZE) {
  if (!Number.isInteger(queueBatchSize) || queueBatchSize <= 0) {
    throw new Error("--queue-batch-size must be a positive integer.");
  }
  const batches: T[][] = [];
  for (let start = 0; start < files.length; start += queueBatchSize) {
    batches.push(files.slice(start, start + queueBatchSize));
  }
  return batches;
}

export async function hashFile(filePath: string) {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

export async function scanImportFiles(
  root: string,
  include = DEFAULT_IMPORT_INCLUDE,
  limit?: number,
): Promise<ScannedImportFile[]> {
  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) {
    throw new Error(`Import path is not a directory: ${root}`);
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    throw new Error("--limit must be a positive integer when provided.");
  }

  const files: ScannedImportFile[] = [];

  async function visit(directory: string) {
    if (limit !== undefined && files.length >= limit) return;
    const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (limit !== undefined && files.length >= limit) return;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;

      const relativePath = path.relative(root, absolutePath);
      if (!matchesInclude(relativePath, include)) continue;
      const fileStat = await stat(absolutePath);
      files.push({
        absolutePath,
        relativePath,
        fileName: path.basename(absolutePath),
        size: fileStat.size,
        contentHash: await hashFile(absolutePath),
      });
    }
  }

  await visit(root);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function createDocumentId() {
  return randomUUID();
}
