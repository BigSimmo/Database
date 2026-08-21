import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CaringContactsProjectSeparationError,
  assertNotClinicalKbProject,
  caringContactsDataMode,
} from "@/lib/caring-contacts-server/config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("caring-contacts database configuration", () => {
  it("falls back to the in-memory store when unconfigured", () => {
    vi.stubEnv("CARING_CONTACTS_DATABASE_URL", "");
    expect(caringContactsDataMode()).toBe("in-memory");
  });

  it("refuses the pinned Clinical KB project reference", () => {
    expect(() =>
      assertNotClinicalKbProject("postgres://user@db.sjrfecxgysukkwxsowpy.supabase.co:5432/postgres"),
    ).toThrow(CaringContactsProjectSeparationError);
  });

  it("refuses a URL that is byte-identical to the Clinical KB connection", () => {
    vi.stubEnv("SUPABASE_DB_URL", "postgres://shared@example.invalid:5432/postgres");
    expect(() => assertNotClinicalKbProject("postgres://shared@example.invalid:5432/postgres")).toThrow(
      CaringContactsProjectSeparationError,
    );
  });

  it("never puts a connection string into its error message", () => {
    try {
      assertNotClinicalKbProject("postgres://secret@db.sjrfecxgysukkwxsowpy.supabase.co:5432/postgres");
      throw new Error("expected a refusal");
    } catch (error) {
      expect((error as Error).message).not.toContain("secret");
      expect((error as Error).message).toContain("CARING_CONTACTS_DATABASE_URL");
    }
  });
});
