#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

const projectRoot = process.cwd();
const textExtensions = new Set([".css", ".html", ".js", ".json", ".map", ".md", ".svg", ".txt", ".xml"]);
const forbiddenMarkers = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "OPENAI_ORG_ID",
  "OPENAI_PROJECT_ID",
  "RAG_QUERY_HASH_SECRET",
  "sb_secret_",
  "sk-proj-",
  "sk-svcacct-",
  // Sentry source-map upload token — build-time/server-only. The public DSN is
  // fine in the client bundle; this token must never be, so fail the build if it
  // ever leaks into client output.
  "SENTRY_AUTH_TOKEN",
  "sntrys_",
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
    if (content.includes(marker)) {
      const relativePath = relative(projectRoot, file).replaceAll("\\", "/");
      offenders.set(`${relativePath}\0${marker}`, { marker, relativePath });
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
