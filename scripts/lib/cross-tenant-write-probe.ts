/**
 * Cross-tenant write, invitation and revocation probe for CME and On Call (audit F17).
 *
 * The read-only probe in ./cross-tenant-records-probe.ts only uses records user A already owns,
 * so it cannot try writes without risking A's real data, and it skips when A owns nothing. This
 * probe instead has user A create disposable records through the real API, then checks that
 * user B cannot change, delete, invite into or keep access to them. Every record it creates is
 * reported through `register` before the next request, so the harness cleans up even after a
 * failure part-way through.
 */
export type WriteProbeRequest = (
  token: string,
  path: string,
  init: { method?: string; body?: unknown },
  expectedStatuses: number[],
) => Promise<unknown>;

export type WriteProbeCreated =
  { kind: "cme-year"; year: number } | { kind: "cme-entry"; id: string } | { kind: "on-call-service"; id: string };

/** A year no real CPD record uses; the API accepts 2000 to 2100. */
export const CROSS_TENANT_CME_YEAR = 2000;

function field(value: unknown, key: string, context: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${context}: not a JSON object.`);
  return (value as Record<string, unknown>)[key];
}

function stringField(value: unknown, key: string, context: string): string {
  const result = field(value, key, context);
  if (typeof result !== "string" || !result) throw new Error(`${context}: response has no ${key}.`);
  return result;
}

function listedEntries(value: unknown, context: string) {
  const entries = field(value, "entries", context);
  if (!Array.isArray(entries)) throw new Error(`${context}: response has no entries array.`);
  return entries as { id?: unknown; title?: unknown; archivedAt?: unknown; transcribed?: unknown }[];
}

export async function probeCmeWriteIsolation(args: {
  request: WriteProbeRequest;
  tokenA: string;
  tokenB: string;
  marker: string;
  register: (created: WriteProbeCreated) => void;
}) {
  const { request, tokenA, tokenB, marker, register } = args;
  const year = CROSS_TENANT_CME_YEAR;
  const existingYear = field(
    await request(tokenA, `/api/cme/year?year=${year}`, {}, [200]),
    "requirementSet",
    "CME year",
  );
  if (existingYear) {
    return {
      checkpoints: [] as string[],
      skipped: [`CME writes: user A already has a ${year} CPD year, so the probe did not create a disposable one.`],
      entryId: null,
    };
  }

  register({ kind: "cme-year", year });
  await request(
    tokenA,
    "/api/cme/year",
    {
      method: "PUT",
      body: {
        year,
        totalHours: 1,
        confirmedOn: `${year}-01-01`,
        confirmedSource: "Cross-tenant staging harness fixture",
        requirements: [
          {
            id: "tenancy-probe",
            label: "Tenancy probe",
            source: "national",
            spec: { shape: "hours-in-category", category: "educational", minimumHours: 1 },
            completedOn: null,
          },
        ],
      },
    },
    [200],
  );
  const created = await request(
    tokenA,
    "/api/cme/entries",
    {
      method: "POST",
      body: { date: `${year}-06-15`, title: marker, allocations: [{ category: "educational", hours: 1 }] },
    },
    [201],
  );
  const entryId = stringField(field(created, "entry", "CME create"), "id", "CME create entry");
  register({ kind: "cme-entry", id: entryId });

  const listPath = `/api/cme/entries?year=${year}`;
  if (!listedEntries(await request(tokenA, listPath, {}, [200]), "user A CME list").some((e) => e.id === entryId)) {
    throw new Error("User A could not list its own disposable CME entry.");
  }
  if (listedEntries(await request(tokenB, listPath, {}, [200]), "user B CME list").some((e) => e.id === entryId)) {
    throw new Error("User B listed user A's CME entry.");
  }

  const entryPath = `/api/cme/entries/${entryId}`;
  const fullReplace = {
    date: `${year}-06-16`,
    title: "cross tenant mutation must fail",
    allocations: [{ category: "educational", hours: 2 }],
    reflection: "",
    costCents: null,
    routineId: null,
    documentId: null,
    sourceUrl: null,
    buckets: [],
    formalPeerReviewHours: 0,
  };
  for (const body of [{ archived: true }, { transcribed: true }, fullReplace]) {
    await request(tokenB, entryPath, { method: "PATCH", body }, [404]);
  }
  await request(tokenB, entryPath, { method: "DELETE" }, [404]);

  const after = listedEntries(await request(tokenA, listPath, {}, [200]), "user A CME list after").find(
    (e) => e.id === entryId,
  );
  if (!after) throw new Error("User A's CME entry disappeared after user B's rejected delete.");
  if (after.title !== marker || after.archivedAt || after.transcribed === true) {
    throw new Error("User A's CME entry changed after user B's rejected writes.");
  }
  return { checkpoints: ["cme-write-isolation"], skipped: [] as string[], entryId };
}

export async function probeOnCallServiceWriteIsolation(args: {
  request: WriteProbeRequest;
  tokenA: string;
  tokenB: string;
  userIdB: string;
  marker: string;
  register: (created: WriteProbeCreated) => void;
}) {
  const { request, tokenA, tokenB, userIdB, marker, register } = args;
  const created = await request(
    tokenA,
    "/api/on-call/services",
    { method: "POST", body: { name: `Tenancy probe ${marker}`.slice(0, 160), siteName: "Tenancy probe site" } },
    [200],
  );
  const serviceId = stringField(created, "serviceId", "On Call service create");
  const siteId = stringField(created, "siteId", "On Call service create");
  register({ kind: "on-call-service", id: serviceId });
  const servicePath = `/api/on-call/services/${serviceId}`;
  const checkpoints: string[] = [];

  await request(tokenA, servicePath, {}, [200]);
  await request(tokenB, servicePath, {}, [403, 404]);
  for (const body of [
    { action: "invitation.create", role: "admin", expiresInDays: 1 },
    { action: "site.create", name: "cross tenant site must fail" },
    { action: "member.update", memberId: userIdB, role: "admin", clinicalReviewer: false },
  ]) {
    await request(tokenB, servicePath, { method: "POST", body }, [403, 404]);
  }
  checkpoints.push("on-call-service-write-isolation");

  // A code nobody issued must not open any service.
  await request(tokenB, "/api/on-call/services/join", { method: "POST", body: { code: "0".repeat(64) } }, [400]);
  const invitation = await request(
    tokenA,
    servicePath,
    { method: "POST", body: { action: "invitation.create", role: "member", expiresInDays: 1 } },
    [200],
  );
  const code = stringField(invitation, "code", "On Call invitation");
  const joined = await request(tokenB, "/api/on-call/services/join", { method: "POST", body: { code } }, [200]);
  if (stringField(joined, "serviceId", "On Call join") !== serviceId) {
    throw new Error("User B's invitation joined a different service than the one it was issued for.");
  }
  await request(tokenB, servicePath, {}, [200]);
  // A plain member must not be able to widen access: no invitations, no self-promotion.
  await request(
    tokenB,
    servicePath,
    { method: "POST", body: { action: "invitation.create", role: "admin", expiresInDays: 1 } },
    [403],
  );
  await request(
    tokenB,
    servicePath,
    { method: "POST", body: { action: "member.update", memberId: userIdB, role: "admin", clinicalReviewer: true } },
    [403],
  );
  checkpoints.push("on-call-invitation-membership");

  await request(tokenA, servicePath, { method: "POST", body: { action: "member.revoke", memberId: userIdB } }, [200]);
  await request(tokenB, servicePath, {}, [403, 404]);
  // A used invitation must not bring a revoked member back.
  await request(tokenB, "/api/on-call/services/join", { method: "POST", body: { code } }, [400]);
  checkpoints.push("on-call-revocation");

  return { checkpoints, serviceId, siteId };
}
