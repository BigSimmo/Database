/**
 * Read-only cross-tenant probe for CME and On Call (audit F17).
 *
 * The staging harness in scripts/test-cross-tenant-staging.ts proves document, search and answer
 * isolation with two real accounts. CME and On Call had no equivalent. This probe uses records
 * user A already owns: it never creates, edits or deletes anything, so it is safe against staging
 * data, and when user A owns nothing to probe it says so instead of reporting a silent pass.
 */
export type ProbeRequest = (token: string, path: string, expectedStatuses: number[]) => Promise<unknown>;

const MAX_PROBES = 3;

function ids(value: unknown, key: string, context: string): string[] {
  const list = (value as Record<string, unknown> | null)?.[key];
  if (!Array.isArray(list)) throw new Error(`${context}: response has no ${key} array.`);
  return list
    .map((item) => (item as { id?: unknown } | null)?.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function probeCmeAndOnCallIsolation(args: { request: ProbeRequest; tokenA: string; tokenB: string }) {
  const { request, tokenA, tokenB } = args;
  const checkpoints: string[] = [];
  const skipped: string[] = [];

  const cmeA = ids(await request(tokenA, "/api/cme/entries", [200]), "entries", "user A CME list");
  const cmeB = new Set(ids(await request(tokenB, "/api/cme/entries", [200]), "entries", "user B CME list"));
  if (cmeA.length === 0) {
    skipped.push("CME: user A has no CME entries in the current year, so CME isolation was not exercised.");
  } else {
    const leaked = cmeA.find((id) => cmeB.has(id));
    if (leaked) throw new Error(`User B listed user A's CME entry ${leaked}.`);
    checkpoints.push("cme-list");
    for (const id of cmeA.slice(0, MAX_PROBES)) {
      const payload = await request(tokenB, `/api/cme/entries/${id}/evidence`, [200, 404]);
      const evidence = (payload as { evidence?: unknown } | null)?.evidence;
      if (Array.isArray(evidence) && evidence.length > 0) {
        throw new Error(`User B could read evidence on user A's CME entry ${id}.`);
      }
    }
    checkpoints.push("cme-evidence");
  }

  const servicesA = ids(await request(tokenA, "/api/on-call/services", [200]), "services", "user A services");
  const servicesB = new Set(ids(await request(tokenB, "/api/on-call/services", [200]), "services", "user B services"));
  // A service both users belong to is shared on purpose; only A-only services test isolation.
  const aOnly = servicesA.filter((id) => !servicesB.has(id));
  if (aOnly.length === 0) {
    skipped.push(
      "On Call: user A belongs to no On Call service that user B is not a member of, so isolation was not exercised.",
    );
  } else {
    for (const id of aOnly.slice(0, MAX_PROBES)) {
      await request(tokenB, `/api/on-call/services/${id}`, [403, 404]);
    }
    checkpoints.push("on-call-service-detail");
  }

  return { checkpoints, skipped };
}
