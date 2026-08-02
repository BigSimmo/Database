export const DOCX_EXTRACTION_BUDGET = {
  maxArtifacts: 1_000,
  maxSingleArtifactBytes: 32 * 1024 * 1024,
  maxArtifactBytes: 256 * 1024 * 1024,
  maxTextBytes: 32 * 1024 * 1024,
} as const;

export type DocxExtractionBudget = {
  maxArtifacts: number;
  maxSingleArtifactBytes: number;
  maxArtifactBytes: number;
  maxTextBytes: number;
};

type DocxMediaBudgetEntry = {
  _data?: { uncompressedSize?: number };
};

function budgetExceeded(message: string): never {
  throw new Error(`DOCX_EXTRACTION_BUDGET_EXCEEDED: ${message}`);
}

function nonNegativeByteLength(byteLength: number) {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
    budgetExceeded(`invalid artifact byte length ${byteLength}`);
  }
  return byteLength;
}

function declaredUncompressedByteLength(entry: unknown) {
  return nonNegativeByteLength(Number((entry as DocxMediaBudgetEntry)._data?.uncompressedSize));
}

export class DocxExtractionBudgetTracker {
  private artifactCount = 0;
  private artifactBytes = 0;

  constructor(readonly limits: DocxExtractionBudget = DOCX_EXTRACTION_BUDGET) {}

  assertText(text: string) {
    const textBytes = Buffer.byteLength(text, "utf8");
    if (textBytes > this.limits.maxTextBytes) {
      budgetExceeded(`extracted UTF-8 text exceeds ${this.limits.maxTextBytes} bytes`);
    }
  }

  assertArtifactCount(artifactCount: number) {
    if (!Number.isSafeInteger(artifactCount) || artifactCount < 0) {
      budgetExceeded(`invalid artifact count ${artifactCount}`);
    }
    if (artifactCount > this.limits.maxArtifacts) {
      budgetExceeded(`artifact count ${artifactCount} exceeds ${this.limits.maxArtifacts}`);
    }
  }

  addArtifact(byteLength: number) {
    const safeByteLength = nonNegativeByteLength(byteLength);
    const nextArtifactCount = this.artifactCount + 1;
    if (nextArtifactCount > this.limits.maxArtifacts) {
      budgetExceeded(`artifact count ${nextArtifactCount} exceeds ${this.limits.maxArtifacts}`);
    }
    if (safeByteLength > this.limits.maxSingleArtifactBytes) {
      budgetExceeded(`single artifact bytes ${safeByteLength} exceed ${this.limits.maxSingleArtifactBytes}`);
    }
    const nextArtifactBytes = this.artifactBytes + safeByteLength;
    if (!Number.isSafeInteger(nextArtifactBytes) || nextArtifactBytes > this.limits.maxArtifactBytes) {
      budgetExceeded(`aggregate artifact bytes exceed ${this.limits.maxArtifactBytes}`);
    }
    this.artifactCount = nextArtifactCount;
    this.artifactBytes = nextArtifactBytes;
  }
}

export function assertDeclaredDocxMediaBudget(
  entries: readonly unknown[],
  limits: DocxExtractionBudget = DOCX_EXTRACTION_BUDGET,
) {
  const budget = new DocxExtractionBudgetTracker(limits);
  budget.assertArtifactCount(entries.length);
  for (const entry of entries) {
    budget.addArtifact(declaredUncompressedByteLength(entry));
  }
}

export function assertDeclaredDocxTextBudget(
  entries: readonly unknown[],
  limits: DocxExtractionBudget = DOCX_EXTRACTION_BUDGET,
) {
  let sourceBytes = 0;
  for (const entry of entries) {
    sourceBytes += declaredUncompressedByteLength(entry);
    if (!Number.isSafeInteger(sourceBytes) || sourceBytes > limits.maxTextBytes) {
      budgetExceeded(`declared Word XML bytes exceed ${limits.maxTextBytes}`);
    }
  }
}
