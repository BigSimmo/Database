export function EnvironmentStrip({
  demoMode,
  documentCount,
  buildSha,
  email,
}: {
  demoMode: boolean;
  documentCount: number | null;
  buildSha: string | null;
  email: string | null;
}) {
  const facts = [
    demoMode ? "Demo corpus" : "Live data",
    documentCount === null ? "document count unavailable" : `${documentCount.toLocaleString("en-AU")} documents`,
    buildSha ? `build ${buildSha.slice(0, 7)}` : "build unknown",
    email ?? "signed in",
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
