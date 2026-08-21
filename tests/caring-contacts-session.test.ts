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

  it("names the acting role in the actor id so the audit trail can show it", () => {
    expect(demoActorForRole("auditor").id).toBe("demo-auditor");
  });
});
