/**
 * Cross-tenant content probe for On Call service handbooks (audit F17 follow-up).
 *
 * ./cross-tenant-write-probe.ts proves user B cannot administer user A's service (invite, add
 * sites, change roles) and that revocation works. This probe covers the handbook content inside
 * that service: entries, reports and orientation progress. User A publishes one disposable
 * orientation entry in the service A already created, then:
 *
 *  - as a non-member, B must be refused every content action and the scoped read, and none of
 *    those refused writes may change what A sees;
 *  - as a plain member (invited by A), B can read published content and file a report, but is
 *    refused the editor actions, never sees the report queue, and B's orientation ticks stay
 *    B's own;
 *  - after A revokes B, B is refused again.
 *
 * Statuses and response fields follow `on_call_service_command`
 * (supabase/migrations/20260922174716_on_call_service_handbooks.sql) and the error-code map in
 * src/lib/on-call/service-repository.ts: service_access_denied and service_role_denied and
 * service_review_denied are all 403. The probe creates no new service; the caller registers the
 * service for cleanup, and every entry, report and orientation row cascades with it.
 */
import type { WriteProbeRequest } from "./cross-tenant-write-probe";

type ProbeEntry = {
  id?: unknown;
  revision?: unknown;
  status?: unknown;
  content?: { title?: unknown } | null;
  publishedContent?: { title?: unknown } | null;
};
type ProbeReport = { id?: unknown; entryId?: unknown; status?: unknown };
type ProbeOrientation = { entryId?: unknown; siteId?: unknown; rotation?: unknown };

function field(value: unknown, key: string, context: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${context}: not a JSON object.`);
  return (value as Record<string, unknown>)[key];
}

function stringField(value: unknown, key: string, context: string): string {
  const result = field(value, key, context);
  if (typeof result !== "string" || !result) throw new Error(`${context}: response has no ${key}.`);
  return result;
}

function listField<T>(value: unknown, key: string, context: string): T[] {
  const result = field(value, key, context);
  if (!Array.isArray(result)) throw new Error(`${context}: response has no ${key} array.`);
  return result as T[];
}

export async function probeOnCallContentIsolation(args: {
  request: WriteProbeRequest;
  tokenA: string;
  tokenB: string;
  userIdB: string;
  /**
   * User A's service, with no entries of its own yet (such as the disposable one the write
   * probe creates). A must be its admin, and B must not be a member when this is called.
   */
  serviceId: string;
  /** A site belonging to that service (the service-create response returns one as `siteId`). */
  siteId: string;
  marker: string;
}): Promise<{ checkpoints: string[] }> {
  const { request, tokenA, tokenB, userIdB, serviceId, siteId, marker } = args;
  const checkpoints: string[] = [];
  const servicePath = `/api/on-call/services/${serviceId}`;
  const rotation = `tenancy-probe-${marker}`.slice(0, 100);
  // The read only returns orientation rows for the site and rotation it is asked about.
  const readPath = `${servicePath}?${new URLSearchParams({ siteId, rotation }).toString()}`;
  const title = `Tenancy probe entry ${marker}`.slice(0, 160);
  const post = (token: string, body: Record<string, unknown>, expected: number[]) =>
    request(token, servicePath, { method: "POST", body }, expected);
  const read = (token: string, expected: number[] = [200]) => request(token, readPath, {}, expected);

  // An operational entry publishes on save without review, and only a published entry in the
  // orientation section can be ticked off, so this one entry serves every step below.
  const content = {
    siteId,
    section: "orientation",
    kind: "operational",
    title,
    body: "Cross-tenant staging harness fixture.",
    phone: "",
    sources: [],
    orientationPhase: "first_shift",
  };
  const saved = await post(tokenA, { action: "entry.save", ...content, publish: true }, [200]);
  const entryId = stringField(saved, "entryId", "On Call entry save");
  const revision = field(saved, "revision", "On Call entry save");
  if (typeof revision !== "number" || field(saved, "status", "On Call entry save") !== "published") {
    throw new Error("User A's operational entry was not published on save.");
  }

  const assertEntryIntact = (value: unknown, context: string) => {
    const entries = listField<ProbeEntry>(value, "entries", context);
    if (entries.length !== 1 || entries[0]?.id !== entryId) {
      throw new Error(`${context}: user A's service does not hold exactly its one probe entry.`);
    }
    const entry = entries[0];
    if (
      entry.revision !== revision ||
      entry.status !== "published" ||
      entry.content?.title !== title ||
      entry.publishedContent?.title !== title
    ) {
      throw new Error(`${context}: user A's probe entry changed.`);
    }
  };
  const reportsById = (value: unknown, context: string) =>
    new Map(listField<ProbeReport>(value, "reports", context).map((report) => [report.id, report]));

  assertEntryIntact(await read(tokenA), "User A read");
  // A real report, so the refused resolve attempts below aim at something that exists.
  const reportA = stringField(
    await post(tokenA, { action: "report.create", entryId, reason: `Tenancy probe report ${marker}` }, [200]),
    "reportId",
    "User A report",
  );

  // 1. Non-member: every content action and the scoped read are refused (service_access_denied).
  const editBody = {
    action: "entry.save",
    ...content,
    entryId,
    expectedRevision: revision,
    title: "cross tenant edit must fail",
    publish: true,
  };
  const newEntryBody = { action: "entry.save", ...content, title: "cross tenant entry must fail", publish: true };
  const withdrawBody = { action: "entry.withdraw", entryId, expectedRevision: revision };
  const reviewBody = {
    action: "entry.review",
    entryId,
    expectedRevision: revision,
    decision: "approve",
    comment: "cross tenant review must fail",
  };
  for (const body of [
    newEntryBody,
    editBody,
    reviewBody,
    withdrawBody,
    { action: "report.create", entryId, reason: "cross tenant report must fail" },
    { action: "report.resolve", reportId: reportA, resolution: "cross tenant resolution must fail" },
    { action: "orientation.set", entryId, siteId, rotation, completed: true },
  ]) {
    await post(tokenB, body, [403, 404]);
  }
  await read(tokenB, [403, 404]);
  const afterOutsider = await read(tokenA);
  assertEntryIntact(afterOutsider, "User A read after user B's refused writes");
  const outsiderReports = reportsById(afterOutsider, "User A read after user B's refused writes");
  if (outsiderReports.size !== 1 || outsiderReports.get(reportA)?.status !== "open") {
    throw new Error("User B's refused report writes changed user A's report queue.");
  }
  checkpoints.push("on-call-content-write-isolation");

  // 2. Plain member: reads published content, is refused editor actions (service_role_denied;
  //    entry.review is service_review_denied because B is not a clinical reviewer).
  const invitation = await post(tokenA, { action: "invitation.create", role: "member", expiresInDays: 1 }, [200]);
  const code = stringField(invitation, "code", "On Call invitation");
  const joined = await request(tokenB, "/api/on-call/services/join", { method: "POST", body: { code } }, [200]);
  if (stringField(joined, "serviceId", "On Call join") !== serviceId) {
    throw new Error("User B's invitation joined a different service than the one it was issued for.");
  }
  const memberRead = await read(tokenB);
  if (field(field(memberRead, "membership", "User B read"), "role", "User B membership") !== "member") {
    throw new Error("User B joined with a role other than the member role it was invited with.");
  }
  if (
    !listField<ProbeEntry>(memberRead, "entries", "User B read").some(
      (entry) => entry.id === entryId && entry.content?.title === title,
    )
  ) {
    throw new Error("User B, a member, could not read user A's published entry.");
  }
  if (listField<ProbeOrientation>(memberRead, "orientation", "User B read").length !== 0) {
    throw new Error("User B's refused orientation write as a non-member was recorded.");
  }

  // Members may report published content; the RPC only restricts resolving reports.
  const reportB = stringField(
    await post(tokenB, { action: "report.create", entryId, reason: `Tenancy probe member report ${marker}` }, [200]),
    "reportId",
    "User B report",
  );
  for (const body of [
    newEntryBody,
    editBody,
    reviewBody,
    withdrawBody,
    { action: "report.resolve", reportId: reportA, resolution: "member resolution must fail" },
    { action: "report.resolve", reportId: reportB, resolution: "member resolution must fail" },
  ]) {
    await post(tokenB, body, [403]);
  }
  checkpoints.push("on-call-member-content-roles");

  // 3. Reports go only to editors and admins.
  if (listField<ProbeReport>(await read(tokenB), "reports", "User B reports read").length !== 0) {
    throw new Error("User B, a plain member, was shown the service's report queue.");
  }
  const adminRead = await read(tokenA);
  assertEntryIntact(adminRead, "User A read after user B's refused member writes");
  const adminReports = reportsById(adminRead, "User A reports read");
  if (adminReports.get(reportB)?.entryId !== entryId) {
    throw new Error("User A could not see user B's report in the queue.");
  }
  if (adminReports.get(reportA)?.status !== "open" || adminReports.get(reportB)?.status !== "open") {
    throw new Error("User B's refused resolve changed a report in the queue.");
  }
  // Positive control: the resolve B was refused works for an admin.
  await post(tokenA, { action: "report.resolve", reportId: reportB, resolution: "Tenancy probe resolved." }, [200]);
  checkpoints.push("on-call-reports-visibility");

  // 4. Orientation ticks are per user: B's tick is invisible to A, and B clearing its own tick
  //    must not clear A's.
  const orientationSet = (token: string, completed: boolean) =>
    post(token, { action: "orientation.set", entryId, siteId, rotation, completed }, [200]);
  const orientationRows = async (token: string, context: string) =>
    listField<ProbeOrientation>(await read(token), "orientation", context).filter(
      (row) => row.entryId === entryId && row.siteId === siteId && row.rotation === rotation,
    ).length;
  await orientationSet(tokenB, true);
  if ((await orientationRows(tokenB, "User B orientation read")) !== 1) {
    throw new Error("User B's own orientation tick was not recorded.");
  }
  if ((await orientationRows(tokenA, "User A orientation read")) !== 0) {
    throw new Error("User A was shown user B's orientation progress.");
  }
  await orientationSet(tokenA, true);
  await orientationSet(tokenB, false);
  if ((await orientationRows(tokenA, "User A orientation read after B cleared")) !== 1) {
    throw new Error("User B clearing its own orientation tick cleared user A's.");
  }
  checkpoints.push("on-call-orientation-isolation");

  // 5. Revocation leaves the harness clean and closes content access again.
  await post(tokenA, { action: "member.revoke", memberId: userIdB }, [200]);
  await read(tokenB, [403]);
  await post(tokenB, { action: "report.create", entryId, reason: "revoked report must fail" }, [403]);
  checkpoints.push("on-call-content-revocation");

  return { checkpoints };
}
