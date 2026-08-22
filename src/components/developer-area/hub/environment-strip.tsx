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
  const facts = [
    demoMode === null ? "environment unknown" : demoMode ? "Demo corpus" : "Live data",
    documentCount === null ? "document count unavailable" : `${documentCount.toLocaleString("en-AU")} documents`,
    buildSha ? `build ${buildSha.slice(0, 7)}` : "build unknown",
    email ?? "account unknown",
  ];

  return (
    <p
      data-testid="developer-hub-environment-strip"
      className="rounded-lg bg-[color:var(--surface-subtle)] px-3 py-2 text-xs leading-6 text-[color:var(--text-muted)]"
    >
      {facts.join(" · ")}
    </p>
  );
}
