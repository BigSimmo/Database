import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type FunctionDefinition = {
  name: string;
  start: number;
  end: number;
  text: string;
};

const ROOT_DIR = process.cwd();
const SCHEMA_PATH = join(ROOT_DIR, "supabase", "schema.sql");
const MIGRATIONS_DIR = join(ROOT_DIR, "supabase", "migrations");

const DEFAULT_MIGRATION_HINT = "20260701140631_codify_live_retrieval_rpcs.sql";

function normalizeFunctionName(rawName: string): string {
  return rawName
    .replace(/^public\./, "")
    .replace(/"/g, "")
    .trim();
}

function isDryRunArg(): boolean {
  return process.argv.includes("--dry-run");
}

function getMigrationArg(): string | null {
  const directArg = process.argv.find((arg) => arg.startsWith("--migration="));
  if (!directArg) return null;

  const provided = directArg.split("=", 2)[1];
  if (!provided) return null;

  return provided;
}

function isTargetRetrievalRpc(name: string): boolean {
  return /^(match|search|query)_/i.test(name) || /table_facts/i.test(name);
}

function findFunctionStatements(sql: string): Map<string, FunctionDefinition> {
  const declarationRegex =
    /^CREATE\s+OR\s+REPLACE\s+FUNCTION\s+((?:public\.)?(?:"[^"]+"|\w+))/gim;
  const functions = new Map<string, FunctionDefinition>();
  let match: RegExpExecArray | null;

  while ((match = declarationRegex.exec(sql)) !== null) {
    const rawName = match[1];
    const normalizedName = normalizeFunctionName(rawName);
    const start = match.index;
    const headerRest = sql.slice(start);
    const asMatch = headerRest.match(/\bAS\s+([^\s;]+)/i);

    if (!asMatch || typeof asMatch.index !== "number") {
      continue;
    }

    const delimiter = asMatch[1];
    const bodyStart = start + asMatch.index + asMatch[0].length;
    const delimiterIndex = sql.indexOf(delimiter, bodyStart);
    if (delimiterIndex === -1) {
      continue;
    }

    const statementEnd = sql.indexOf(";", delimiterIndex + delimiter.length);
    if (statementEnd === -1) {
      continue;
    }

    const end = statementEnd + 1;
    functions.set(normalizedName, {
      name: normalizedName,
      start,
      end,
      text: sql.slice(start, end).trimEnd(),
    });
  }

  return functions;
}

function countRetrievalFunctions(sql: string): number {
  const declarationRegex =
    /^CREATE\s+OR\s+REPLACE\s+FUNCTION\s+((?:public\.)?(?:"[^"]+"|\w+))/gim;
  let match: RegExpExecArray | null;
  let count = 0;

  while ((match = declarationRegex.exec(sql)) !== null) {
    const name = normalizeFunctionName(match[1]);
    if (isTargetRetrievalRpc(name)) {
      count += 1;
    }
  }

  return count;
}

function chooseMigrationPath(): string {
  const explicitPath = join(MIGRATIONS_DIR, getMigrationArg() ?? DEFAULT_MIGRATION_HINT);
  if (existsSync(explicitPath)) {
    return explicitPath;
  }

  const retrievalCandidates = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .filter((name) => name.includes("codify"))
    .map((name) => {
      const fullPath = join(MIGRATIONS_DIR, name);
      const content = readFileSync(fullPath, "utf8");
      return { name, fullPath, count: countRetrievalFunctions(content) };
    })
    .filter((candidate) => candidate.count > 0)
    .sort((a, b) => b.count - a.count || b.name.localeCompare(a.name));

  if (retrievalCandidates.length === 0) {
    throw new Error(
      "No retrieval-focused migration file found in supabase/migrations. Set one with --migration=<path>.",
    );
  }

  return retrievalCandidates[0].fullPath;
}

function patchSchema(schemaSql: string, sourceFunctions: Map<string, FunctionDefinition>, schemaFunctions: Map<string, FunctionDefinition>, targetNames: string[]) {
  const toReplace: { start: number; end: number; replacement: string; name: string }[] = [];
  const missingInSchema: string[] = [];

  for (const name of targetNames) {
    if (!isTargetRetrievalRpc(name)) continue;
    const source = sourceFunctions.get(name);
    const target = schemaFunctions.get(name);

    if (!source || !target) {
      if (name) {
        missingInSchema.push(name);
      }
      continue;
    }

    if (source.text.trim() === target.text.trim()) continue;
    toReplace.push({ name, start: target.start, end: target.end, replacement: source.text });
  }

  if (missingInSchema.length > 0) {
    console.log(`Skipped functions not found in schema.sql: ${missingInSchema.join(", ")}`);
  }

  if (toReplace.length === 0) {
    console.log("No retrieval function body changes detected in schema.sql.");
    return schemaSql;
  }

  toReplace.sort((a, b) => b.start - a.start);
  let next = schemaSql;
  for (const rep of toReplace) {
    const prefix = next.slice(0, rep.start);
    const suffix = next.slice(rep.end).replace(/^\n+/, "");
    next = `${prefix}${rep.replacement}\n\n${suffix}`;
  }

  return next;
}

function main() {
  const migrationPath = chooseMigrationPath();
  const migrationSql = readFileSync(migrationPath, "utf8");
  const schemaSql = readFileSync(SCHEMA_PATH, "utf8");

  const migrationFunctions = findFunctionStatements(migrationSql);
  const sourceNames = [...migrationFunctions.keys()].filter(isTargetRetrievalRpc);

  if (sourceNames.length === 0) {
    console.log(`No retrieval RPC definitions found in ${migrationPath}.`);
    return;
  }

  const schemaFunctions = findFunctionStatements(schemaSql);
  const nextSchemaSql = patchSchema(schemaSql, migrationFunctions, schemaFunctions, sourceNames);

  if (nextSchemaSql === schemaSql) {
    console.log("schema.sql already matches migration bodies.");
    return;
  }

  if (isDryRunArg()) {
    console.log("Dry run enabled; not writing schema.sql.");
    return;
  }

  writeFileSync(SCHEMA_PATH, `${nextSchemaSql.trimEnd()}\n`);
  console.log(`Updated supabase/schema.sql from ${migrationPath}.`);
}

main();
