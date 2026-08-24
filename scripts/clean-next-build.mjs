import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");
const nextBuildPath = path.resolve(repositoryRoot, ".next");

function assertRepositoryTarget() {
  if (path.dirname(nextBuildPath) !== repositoryRoot || path.basename(nextBuildPath) !== ".next") {
    throw new Error("Refusing to clean anything except this repository's .next directory.");
  }
}

export function validateCliArguments(args) {
  if (args.length > 0) throw new Error("clean-next-build does not accept target arguments.");
}

export async function cleanNextBuild({ remove = rm } = {}) {
  assertRepositoryTarget();
  await remove(nextBuildPath, { force: true, recursive: true });
  return nextBuildPath;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === scriptPath) {
  validateCliArguments(process.argv.slice(2));
  const removed = await cleanNextBuild();
  console.log(`Removed ${removed}`);
}
