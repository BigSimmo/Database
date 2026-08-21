// tests/caring-contacts-server-store.test.ts
//
// Review round 1, Important 3 and Minor 2: caringContactsStore() must select the Postgres
// repository when a database URL is configured (the brief's own four config.ts tests only pin the
// unconfigured/in-memory branch, so an implementation that ignored the URL entirely would still
// pass all of them), and it must memoise the result at module scope -- an unmemoised Postgres
// branch would build a brand-new pg.Pool on every call with nothing ever ending one, and an
// unmemoised in-memory branch would hand back a fresh, empty store on every call, silently
// breaking the demo (nothing written by one call would ever be visible to the next).
//
// createCaringContactsPool and createPostgresRepository are both mocked so this proves store.ts's
// own selection/memoisation logic without touching a database or the pg driver.
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCaringContactsPool: vi.fn((url: string) => ({ url, withConnection: vi.fn() })),
  createPostgresRepository: vi.fn(() => ({ instance: Symbol("postgres-repository-instance") })),
}));

vi.mock("@/lib/caring-contacts-server/pool", () => ({
  createCaringContactsPool: mocks.createCaringContactsPool,
}));

vi.mock("@/lib/caring-contacts/db/postgres-repository", () => ({
  createPostgresRepository: mocks.createPostgresRepository,
}));

import { caringContactsStore } from "@/lib/caring-contacts-server/store";

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.createCaringContactsPool.mockClear();
  mocks.createPostgresRepository.mockClear();
});

describe("caringContactsStore", () => {
  it("selects the Postgres repository when a database URL is configured, and memoises it across calls", async () => {
    vi.stubEnv("CARING_CONTACTS_DATABASE_URL", "postgres://demo@example.invalid:5432/postgres");

    const first = await caringContactsStore();
    const second = await caringContactsStore();

    expect(second).toBe(first);
    expect(mocks.createCaringContactsPool).toHaveBeenCalledTimes(1);
    expect(mocks.createCaringContactsPool).toHaveBeenCalledWith("postgres://demo@example.invalid:5432/postgres");
    expect(mocks.createPostgresRepository).toHaveBeenCalledTimes(1);
  });
});
