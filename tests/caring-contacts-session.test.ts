import { cookies } from "next/headers";
import { describe, expect, it, vi } from "vitest";

import {
  CARING_CONTACTS_ROLE_COOKIE,
  DEMO_ROLES,
  demoActorForRole,
  resolveDemoActor,
} from "@/lib/caring-contacts-server/session";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: (name: string) => mockCookies[name] })),
}));

let mockCookies: Record<string, { value: string } | undefined> = {};

describe("demo role switcher", () => {
  it("offers all five roles and no credential field", () => {
    expect(DEMO_ROLES).toEqual([
      "coordinator",
      "teamLead",
      "auditor",
      "clinicalProgrammeLead",
      "livedExperienceRepresentative",
    ]);
  });

  it("defaults to the coordinator when no cookie is set", async () => {
    mockCookies = {};
    await expect(resolveDemoActor()).resolves.toMatchObject({ roles: ["coordinator"] });
  });

  it("falls back to the coordinator on an unreadable cookie rather than failing", async () => {
    mockCookies = { [CARING_CONTACTS_ROLE_COOKIE]: { value: "administrator" } };
    await expect(resolveDemoActor()).resolves.toMatchObject({ roles: ["coordinator"] });
  });

  // Review round 1, Minor 4: only an unrecognised cookie VALUE fell back before this test. A
  // throw from cookies() itself (or from .get()) used to propagate straight out of
  // resolveDemoActor -- exactly the locked-out-of-a-demonstration outcome the fallback rule
  // exists to prevent.
  it("falls back to the coordinator when the cookie read itself fails, not only on an unrecognised value", async () => {
    vi.mocked(cookies).mockRejectedValueOnce(new Error("cookies() unavailable in this context"));
    await expect(resolveDemoActor()).resolves.toMatchObject({ roles: ["coordinator"] });
  });

  it("names the acting role in the actor id so the audit trail can show it", () => {
    expect(demoActorForRole("auditor").id).toBe("demo-auditor");
  });
});
