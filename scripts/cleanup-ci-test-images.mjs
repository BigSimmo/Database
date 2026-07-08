#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const IMAGES = ["clinical-kb-app:ci-test", "clinical-kb-worker:ci-test"];

function runDocker(args) {
  return spawnSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

function hasDockerCli() {
  const result = runDocker(["--version"]);
  if (result.error) return false;
  if (result.status !== 0) {
    console.error(`[cleanup] docker --version failed: ${String(result.stderr || "").trim()}`);
    return false;
  }
  return true;
}

function isMissingImageError(result) {
  if (result.status === 0) return false;
  const output = `${result.stdout ?? ""} ${result.stderr ?? ""}`.toLowerCase();
  return output.includes("no such image") || output.includes("not found") || output.includes("repository does not exist");
}

function imageExists(image) {
  const inspect = runDocker(["image", "inspect", image]);
  if (inspect.error) throw inspect.error;
  return inspect.status === 0;
}

function removeImage(image) {
  const remove = runDocker(["image", "rm", image]);
  if (remove.error) throw remove.error;

  if (remove.status === 0) {
    console.log(`[cleanup] removed ${image}`);
    return true;
  }

  if (isMissingImageError(remove)) {
    console.log(`[cleanup] ${image} already removed`);
    return false;
  }

  console.error(`[cleanup] failed to remove ${image}: ${String(remove.stdout || remove.stderr || "").trim()}`);
  return false;
}

if (!hasDockerCli()) {
  console.error("[cleanup] docker CLI is unavailable. Start Docker Desktop and rerun this command.");
  process.exit(1);
}

const dockerLs = runDocker(["image", "ls", "--format", "{{.Repository}}:{{.Tag}}"]);
if (dockerLs.error || dockerLs.status !== 0) {
  console.error("[cleanup] Docker daemon is not reachable. Start Docker Desktop and rerun this command.");
  process.exit(1);
}

const availableImages = new Set(
  dockerLs.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean),
);

let removedCount = 0;
let missingCount = 0;
let failedCount = 0;

for (const image of IMAGES) {
  if (!availableImages.has(image)) {
    console.log(`[cleanup] ${image} is not present`);
    missingCount += 1;
    continue;
  }

  if (!imageExists(image)) {
    missingCount += 1;
    continue;
  }

  if (removeImage(image)) {
    removedCount += 1;
  } else {
    failedCount += 1;
  }
}

if (removedCount === 0 && failedCount === 0) {
  if (missingCount > 0) {
    console.log("[cleanup] no matching CI-test images were present to remove.");
  } else {
    console.log("[cleanup] no changes were needed.");
  }
  process.exit(0);
}

if (failedCount > 0) {
  console.error(`[cleanup] removal completed with ${removedCount} removed, ${failedCount} failed.`);
  process.exit(1);
}

console.log(`[cleanup] removed ${removedCount} CI-test image(s).`);
process.exit(0);
