#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

const projectRoot = process.cwd();
const textExtensions = new Set([".css", ".html", ".js", ".json", ".map", ".md", ".svg", ".txt", ".xml"]);
const forbiddenMarkers = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "OPENAI_SAFETY_IDENTIFIER_SECRET",
  "OPENAI_ORG_ID",
  "OPENAI_PROJECT_ID",
  "RAG_QUERY_HASH_SECRET",
  // Match an actual secret *value* (prefix + a long token), not the bare "sb_secret_"
  // prefix string. @supabase/supabase-js's own browser client code legitimately ships
  // that literal prefix (isNewApiKey()/checkApiKeyFormat() in its fetch helpers, used to
  // detect new-format Supabase API keys) — that string alone is not a leaked secret.
  /\bsb_secret_[A-Za-z0-9_-]{20,}\b/,
  "sk-proj-",
  "sk-svcacct-",
];

function textFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];

  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && textExtensions.has(extname(entry.name).toLowerCase())) {
        files.push(entryPath);
      }
    }
  }

  visit(root);
  return files;
}

const publicRoot = join(projectRoot, "public");
const clientBuildRoot = join(projectRoot, ".next", "static");

if (!existsSync(clientBuildRoot)) {
  console.error("Client bundle secret surface check requires .next/static. Run it after next build.");
  process.exit(1);
}

const offenders = new Map();
for (const file of [...textFiles(publicRoot), ...textFiles(clientBuildRoot)]) {
  const content = readFileSync(file, "utf8");
  for (const marker of forbiddenMarkers) {
    const matchedText = marker instanceof RegExp ? content.match(marker)?.[0] : content.includes(marker) ? marker : null;
    if (matchedText) {
      const relativePath = relative(projectRoot, file).replaceAll("\\", "/");
      offenders.set(`${relativePath}\0${matchedText}`, { marker: matchedText, relativePath });
    }
  }
}

if (offenders.size > 0) {
  console.error("Client bundle secret surface check failed:");
  for (const { marker, relativePath } of [...offenders.values()].sort((a, b) => {
    return a.relativePath.localeCompare(b.relativePath) || a.marker.localeCompare(b.marker);
  })) {
    console.error(`- ${relativePath}: ${marker}`);
  }
  process.exit(1);
}

console.log("Client bundle secret surface check passed.");
