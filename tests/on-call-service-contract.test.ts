import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { serviceActionSchema, serviceContentSchema, serviceJoinSchema } from "@/lib/on-call/service-model";
import { hashServiceInvitation, serviceCommand, serviceMutation } from "@/lib/on-call/service-repository";
import { createAdminClient } from "@/lib/supabase/admin";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
const id = "11111111-1111-4111-8111-111111111111";
const content = {
  siteId: null,
  section: "orientation",
  kind: "operational",
  title: "Synthetic arrival checklist",
  body: "Find the staff entrance.",
  phone: "",
  sources: [],
  orientationPhase: "leaving",
};
beforeEach(() => rpc.mockReset());

describe("invited service request boundary", () => {
  it("accepts leaving orientation while rejecting private/compliance payloads and caller identities", () => {
    expect(serviceContentSchema.safeParse(content).success).toBe(true);
    for (const extra of [{ ownerId: id }, { personal: true }, { cmeEntryId: id }, { evidence: "private" }]) {
      expect(
        serviceActionSchema.safeParse({ action: "entry.save", ...content, publish: false, ...extra }).success,
      ).toBe(false);
    }
    expect(serviceContentSchema.safeParse({ ...content, section: "compliance" }).success).toBe(false);
  });
  it("requires the loaded revision for edits and independent-review source links", () => {
    expect(
      serviceActionSchema.safeParse({ action: "entry.save", ...content, publish: true, entryId: id }).success,
    ).toBe(false);
    expect(
      serviceActionSchema.safeParse({
        action: "entry.save",
        ...content,
        publish: true,
        entryId: id,
        expectedRevision: 2,
      }).success,
    ).toBe(true);
    expect(
      serviceActionSchema.safeParse({ action: "entry.save", ...content, kind: "clinical", publish: true }).success,
    ).toBe(false);
  });
  it.each([
    "not a URL",
    "javascript:alert(1)",
    "http://example.org/a",
    "https://user:pass@example.org/a",
    "https://127.0.0.1/a",
    "https://localhost/a",
  ])("rejects unsafe source %s", (url) => {
    expect(serviceContentSchema.safeParse({ ...content, sources: [{ label: "Official source", url }] }).success).toBe(
      false,
    );
  });
  it("restricts invitation lifespan and accepts only full random token codes", () => {
    expect(
      serviceActionSchema.safeParse({ action: "invitation.create", role: "admin", expiresInDays: 8 }).success,
    ).toBe(false);
    expect(
      serviceActionSchema.safeParse({
        action: "invitation.create",
        role: "member",
        expiresInDays: 7,
        clinicalReviewer: true,
      }).success,
    ).toBe(false);
    expect(serviceJoinSchema.safeParse({ code: "1234" }).success).toBe(false);
  });
  it("passes only the session actor to the central RPC and maps revocation denial", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "service_access_denied" } });
    await expect(serviceCommand(createAdminClient(), id, id, "read")).rejects.toMatchObject({
      status: 403,
      details: { code: "service_access_denied" },
    });
    expect(rpc).toHaveBeenCalledWith("on_call_service_command", {
      p_actor_id: id,
      p_service_id: id,
      p_action: "read",
      p_payload: {},
    });
  });
  it("returns invite secret once and sends only its hash to the database", async () => {
    rpc.mockResolvedValue({ data: { invitationId: id, expiresAt: "2026-09-25T00:00:00Z" }, error: null });
    const result = await serviceMutation(createAdminClient(), id, id, {
      action: "invitation.create",
      role: "member",
      expiresInDays: 2,
    });
    const parsed = serviceJoinSchema.parse(
      result && typeof result === "object" && "code" in result ? { code: result.code } : null,
    );
    const sent = rpc.mock.calls[0][1].p_payload;
    expect(sent.tokenHash).toBe(hashServiceInvitation(parsed.code));
    expect(sent).not.toHaveProperty("code");
    expect(JSON.stringify(sent)).not.toContain(parsed.code);
  });
  it.each(["service_revision_conflict", "service_last_admin", "service_already_member"])(
    "maps %s to recoverable conflict",
    async (message) => {
      rpc.mockResolvedValue({ data: null, error: { message } });
      await expect(serviceCommand(createAdminClient(), id, id, "member.revoke")).rejects.toMatchObject({
        status: 409,
      });
    },
  );
  it("rejects an already-active member's join BEFORE the invitation is consumed (Codex P2)", () => {
    // Regression for a bug where an already-active member's join marked the invitation
    // `used_at` even though membership was left untouched, silently burning a redeemable
    // invite. The fix must raise before the `update ... set used_at=now()` statement runs,
    // never after it, so the exception actually prevents the write rather than racing it.
    const sql = readFileSync("supabase/migrations/20260922174716_on_call_service_handbooks.sql", "utf8");
    const joinBlock = sql.slice(sql.indexOf("if p_action='join' then", sql.indexOf("for update;")));
    const alreadyMemberCheck = joinBlock.indexOf("service_already_member");
    const consumeInvite = joinBlock.indexOf("set used_at=now()");
    expect(alreadyMemberCheck).toBeGreaterThan(-1);
    expect(consumeInvite).toBeGreaterThan(-1);
    expect(alreadyMemberCheck).toBeLessThan(consumeInvite);
    // The rejection must come from an `exists(...)` on an ACTIVE membership (revoked_at is
    // null), not the inverted `not exists(...)` this bug shipped with — that guarded the
    // insert/reactivate branch instead of the invite consumption.
    expect(joinBlock).toMatch(
      /if exists\(select 1 from public\.on_call_service_members where service_id=p_service_id and user_id=p_actor_id and revoked_at is null\) then\s*\n\s*raise exception 'service_already_member';/,
    );
  });
  it("does not read or republish the legacy or private stores", () => {
    const sql = readFileSync("supabase/migrations/20260922174716_on_call_service_handbooks.sql", "utf8");
    expect(sql).not.toMatch(/(?:from|join|insert into) public\.(?:on_call_entries|cme_\w+)/i);
    expect(sql).toContain(
      "revoke all on function public.on_call_service_command(uuid,uuid,text,jsonb) from public,anon,authenticated",
    );
  });
});
