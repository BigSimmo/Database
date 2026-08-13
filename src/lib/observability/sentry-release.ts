type ReleaseEnvironment = {
  SENTRY_RELEASE?: string;
  NEXT_PUBLIC_SENTRY_RELEASE?: string;
  RAILWAY_GIT_COMMIT_SHA?: string;
  VERCEL_GIT_COMMIT_SHA?: string;
  GITHUB_SHA?: string;
};

/** One release resolver for build, app runtimes, and the ingestion worker. */
export function resolveSentryRelease(environment: ReleaseEnvironment = process.env as ReleaseEnvironment): string {
  const release = [
    environment.SENTRY_RELEASE,
    environment.NEXT_PUBLIC_SENTRY_RELEASE,
    environment.RAILWAY_GIT_COMMIT_SHA,
    environment.VERCEL_GIT_COMMIT_SHA,
    environment.GITHUB_SHA,
  ].find((candidate) => candidate?.trim());
  return release?.trim() || "dev";
}

/** Public deployment identity is limited to a full Git commit SHA. */
export function resolveDeploymentCommitSha(
  environment: ReleaseEnvironment = process.env as ReleaseEnvironment,
): string | null {
  const candidate = [
    environment.RAILWAY_GIT_COMMIT_SHA,
    environment.VERCEL_GIT_COMMIT_SHA,
    environment.GITHUB_SHA,
  ].find((value) => /^[a-f0-9]{40}$/i.test(value?.trim() ?? ""));
  return candidate?.trim().toLowerCase() ?? null;
}
