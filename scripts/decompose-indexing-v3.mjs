import fs from "fs";
import path from "path";

const indexFile = "supabase/functions/indexing-v3-agent/index.ts";
const utilsFile = "supabase/functions/indexing-v3-agent/utils.ts";

let content = fs.readFileSync(indexFile, "utf-8");

const utilsToExtract = [
  "normalizeText",
  "tokenize",
  "safeRecord",
  "compactString",
  "uniqueStrings",
  "structuredProfileFromMetadata",
  "stringArrayFrom",
  "textItemsFrom",
  "sourceRegionsFromMetadata",
  "isLowQualityLabel",
  "phraseLabelCandidates",
  "sha256Hex",
  "sleep",
  "normalizeLabel",
  "normalizeLabelCandidate",
  "canonicalUnitType",
  "canonicalFieldType"
];

let utilsContent = `// Extracted utilities for indexing-v3-agent\nimport { EXPECTED_EMBED_DIM, type GeneratedLabelCandidate } from "./behavior.ts";\n\n`;

const regexesToExtract = [
  "LABEL_STOPWORDS",
  "GENERIC_LABELS",
  "CLINICAL_PHRASE_PATTERN"
];

let modifiedContent = content;

for (const constName of regexesToExtract) {
  const r = new RegExp(`const ${constName} = [\\s\\S]*?;\\n+`, "g");
  const match = modifiedContent.match(r);
  if (match) {
    utilsContent += `export ` + match[0] + "\n";
    modifiedContent = modifiedContent.replace(r, "");
  }
}

for (const fn of utilsToExtract) {
  const r = new RegExp(`(async )?function ${fn}\\([\\s\\S]*?\\n}\\n+`, "g");
  const match = modifiedContent.match(r);
  if (match) {
    let replaced = match[0].replace(`function ${fn}(`, `export function ${fn}(`);
    replaced = replaced.replace(`async function ${fn}(`, `export async function ${fn}(`);
    utilsContent += replaced + "\n";
    modifiedContent = modifiedContent.replace(r, "");
  }
}

const imports = `import {
  ${utilsToExtract.join(",\n  ")}
} from "./utils.ts";\n`;

modifiedContent = modifiedContent.replace('import postgres from "npm:postgres@3.4.7";', `import postgres from "npm:postgres@3.4.7";\n` + imports);

fs.writeFileSync(utilsFile, utilsContent);
fs.writeFileSync(indexFile, modifiedContent);

console.log("Decomposed into utils.ts");
