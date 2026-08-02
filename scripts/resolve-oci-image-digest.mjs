#!/usr/bin/env node
/**
 * resolve-oci-image-digest — print the multi-platform image index digest for a
 * Docker Hub reference. Use it to pin base images and scanners in Dockerfiles.
 */
import { spawnSync } from "node:child_process";

const imageRef = process.argv[2];
if (!imageRef) {
  console.error("Usage: node scripts/resolve-oci-image-digest.mjs <image:tag>");
  process.exit(1);
}

const result = spawnSync("docker", ["buildx", "imagetools", "inspect", imageRef], {
  encoding: "utf8",
  stdio: "pipe",
});

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || `docker buildx imagetools inspect ${imageRef} failed`);
  process.exit(1);
}

const digestMatch = result.stdout.match(/Digest:\s+(sha256:[a-f0-9]{64})/);
if (!digestMatch) {
  console.error("Could not extract digest from docker buildx imagetools output");
  process.exit(1);
}

console.log(`${imageRef}@${digestMatch[1]}`);
