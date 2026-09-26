// tests/caring-contacts-workspace-clock.test.ts
//
// #2783. The workspace clock is the real clock unless a local in-memory demo opts into the virtual
// AWST clock, and a stray setting can never move a durable (Postgres-backed) workspace's date.
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CARING_CONTACTS_DEMO_CLOCK_START_VAR,
  CARING_CONTACTS_WORKSPACE_CLOCK_GLOBAL_KEY,
  caringContactsClock,
} from "@/lib/caring-contacts-server/workspace-clock";
import { CaringContactsTimeProvider } from "@/lib/caring-contacts/demo-clock";

const PINNED = "2026-03-02T01:00:00.000Z";

afterEach(() => {
  vi.unstubAllEnvs();
  Reflect.deleteProperty(globalThis, CARING_CONTACTS_WORKSPACE_CLOCK_GLOBAL_KEY);
});

describe("caringContactsClock", () => {
  it("is the real clock when no virtual start is set", () => {
    vi.stubEnv(CARING_CONTACTS_DEMO_CLOCK_START_VAR, "");
    const before = Date.now();
    const now = caringContactsClock().now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it("is one shared virtual AWST clock, pinned to the start, for the in-memory demo", () => {
    vi.stubEnv(CARING_CONTACTS_DEMO_CLOCK_START_VAR, PINNED);
    vi.stubEnv("CARING_CONTACTS_DATABASE_URL", "");

    const clock = caringContactsClock();

    expect(clock).toBeInstanceOf(CaringContactsTimeProvider);
    expect(clock.now().toISOString()).toBe(PINNED);
    expect(caringContactsClock()).toBe(clock);
  });

  it("ignores the virtual start whenever a durable database is configured", () => {
    vi.stubEnv(CARING_CONTACTS_DEMO_CLOCK_START_VAR, PINNED);
    vi.stubEnv("CARING_CONTACTS_DATABASE_URL", "postgres://demo@example.invalid:5432/postgres");

    expect(caringContactsClock()).not.toBeInstanceOf(CaringContactsTimeProvider);
    expect(caringContactsClock().now().toISOString()).not.toBe(PINNED);
  });

  it("ignores the virtual start where the demo is unavailable, as in production", () => {
    vi.stubEnv(CARING_CONTACTS_DEMO_CLOCK_START_VAR, PINNED);
    vi.stubEnv("CARING_CONTACTS_DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLAYWRIGHT_OFFLINE_MODE", "");
    vi.stubEnv("CARING_CONTACTS_DEMO_ENABLED", "");

    expect(caringContactsClock()).not.toBeInstanceOf(CaringContactsTimeProvider);
  });

  it("refuses an unreadable start loudly rather than falling back to the real date", () => {
    vi.stubEnv(CARING_CONTACTS_DEMO_CLOCK_START_VAR, "not-a-date");
    vi.stubEnv("CARING_CONTACTS_DATABASE_URL", "");

    expect(() => caringContactsClock()).toThrow(/invalid initial instant/);
  });
});
