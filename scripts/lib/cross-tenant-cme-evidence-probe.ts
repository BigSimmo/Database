/**
 * Cross-tenant probe for CME evidence files and the CME CSV export (audit F17 follow-up).
 *
 * It runs after ./cross-tenant-write-probe.ts has given user A a disposable CME entry in a
 * disposable CPD year, and checks that user B cannot reach that entry's evidence or see it in
 * B's own export, with user A's own requests as the positive control.
 *
 * Evidence can only be attached as a multipart file upload into private storage
 * (src/app/api/cme/entries/[id]/evidence/route.ts reads a form with a `file` field), so this
 * probe never uploads. It checks the ownership gate instead: every evidence route calls
 * `assertEvidenceEntry(client, user.id, entryId)`, which answers 404 "Activity not found." for an
 * entry the caller does not own, before any evidence row or signed download link is looked up.
 */
import { randomUUID } from "node:crypto";

import type { WriteProbeRequest } from "./cross-tenant-write-probe";

export const CME_EVIDENCE_UPLOAD_NOT_EXERCISED =
  "CME evidence: attaching evidence needs a multipart file upload to private storage, so the probe did not attach " +
  "a file. It checked only that user B is refused (404) when listing, downloading or removing evidence on user A's " +
  "entry, so a leak that affects only an uploaded file's own row was not exercised.";

function bodyText(body: unknown) {
  if (typeof body === "string") return body;
  return JSON.stringify(body) ?? "";
}

function assertNoLeak(body: unknown, secrets: string[], context: string) {
  const text = bodyText(body);
  if (secrets.some((secret) => text.includes(secret))) {
    throw new Error(`${context} contained user A's CME entry.`);
  }
}

export async function probeCmeEvidenceAndExportIsolation(args: {
  request: WriteProbeRequest;
  tokenA: string;
  tokenB: string;
  /** User A's disposable CME entry, already created by the write probe. */
  entryId: string;
  /** The disposable entry's title; it appears in the export CSV (the entry id does not). */
  marker: string;
  /** The disposable CPD year the entry belongs to. */
  year: number;
}) {
  const { request, tokenA, tokenB, entryId, marker, year } = args;
  if (!entryId || !marker) throw new Error("CME evidence probe needs user A's entry id and marker.");
  const secrets = [entryId, marker];
  const checkpoints: string[] = [];
  const skipped: string[] = [];

  // Evidence. The owner's list is the positive control that the route answers at all.
  const listPath = `/api/cme/entries/${entryId}/evidence`;
  const ownList = await request(tokenA, listPath, {}, [200]);
  const ownEvidence = (ownList as { evidence?: unknown } | null)?.evidence;
  if (!Array.isArray(ownEvidence)) throw new Error("User A could not list evidence on its own CME entry.");

  assertNoLeak(await request(tokenB, listPath, {}, [404]), secrets, "User B's evidence list");
  // A well-formed evidence id, so a 404 comes from the ownership gate rather than validation (400).
  const evidencePath = `${listPath}/${randomUUID()}`;
  // A leaked download would be a 303 to a signed storage URL; the harness fetch refuses redirects.
  assertNoLeak(await request(tokenB, evidencePath, {}, [404]), secrets, "User B's evidence download");
  // The route checks the removal reason (400) before ownership, so send a valid one.
  assertNoLeak(
    await request(
      tokenB,
      evidencePath,
      { method: "DELETE", body: { reason: "Cross-tenant removal must fail" } },
      [404],
    ),
    secrets,
    "User B's evidence removal",
  );
  await request(tokenA, listPath, {}, [200]);
  checkpoints.push("cme-evidence-isolation");
  skipped.push(CME_EVIDENCE_UPLOAD_NOT_EXERCISED);

  // Export. A CSV on success; user B normally has no CPD year for this year, which answers 404.
  const exportPath = `/api/cme/export?year=${year}`;
  if (!bodyText(await request(tokenA, exportPath, {}, [200])).includes(marker)) {
    throw new Error(
      "User A's CME export did not contain its own disposable entry, so the export check proves nothing.",
    );
  }
  assertNoLeak(await request(tokenB, exportPath, {}, [200, 404]), secrets, "User B's CME export");
  checkpoints.push("cme-export-isolation");

  return { checkpoints, skipped };
}
