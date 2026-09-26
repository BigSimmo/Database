export function EnvironmentStrip({
  demoMode,
  documentCount,
  buildSha,
  email,
}: {
  /**
   * `null` means the environment has not been read, which is distinct from
   * having read it and found live data. Claiming "Live data" on a page that
   * never looked is the one fact on this strip that can be actively wrong
   * rather than merely absent — in demo mode it states the opposite of the
   * truth. Every fact here either reports a value it read or names its own gap.
   */
  demoMode: boolean | null;
  documentCount: number | null;
  buildSha: string | null;
  email: string | null;
}) {
  const before = [
    demoMode === null ? "environment unknown" : demoMode ? "Demo corpus" : "Live data",
    documentCount === null ? "document count unavailable" : `${documentCount.toLocaleString("en-AU")} documents`,
  ].join(" · ");
  const after = email ?? "account unknown";

  // The build is the one fact with somewhere to go: the commit's page on GitHub
  // shows what it contains and whether its checks passed. A bare hex SHA is
  // validated before it becomes part of a URL.
  const sha = buildSha && /^[0-9a-f]{7,40}$/i.test(buildSha) ? buildSha : null;

  return (
    <p
      data-testid="developer-hub-environment-strip"
      className="rounded-lg bg-[color:var(--surface-subtle)] px-3 py-2 text-xs leading-6 text-[color:var(--text-muted)]"
    >
      {before} ·{" "}
      {sha ? (
        <a
          href={`https://github.com/BigSimmo/Database/commit/${sha}`}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
          data-testid="developer-hub-build-link"
        >
          build {sha.slice(0, 7)}
          <span className="sr-only"> (opens the commit on GitHub in a new tab)</span>
        </a>
      ) : (
        "build unknown"
      )}{" "}
      · {after}
    </p>
  );
}
