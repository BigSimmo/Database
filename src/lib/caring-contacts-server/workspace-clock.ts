// src/lib/caring-contacts-server/workspace-clock.ts
//
// The one clock the workspace's server-side reads and its store share.
//
// By default it is the real clock, everywhere. A local demo can OPT INTO the virtual AWST clock
// (`CaringContactsTimeProvider`, ../caring-contacts/demo-clock.ts) by setting
// `CARING_CONTACTS_DEMO_CLOCK_START` to an ISO instant: the demo seed then treats that instant as
// "today", and every screen that asks "what is due today" asks the same clock, so the population
// and the screens cannot disagree about the date. The virtual clock does not tick on its own --
// that is the point of it: a demo started at the same instant shows the same day every time.
//
// It is honoured ONLY where the in-memory demo store is in use: the demo must be enabled and no
// durable database configured. Anywhere else -- production included -- the variable is ignored and
// the real clock is returned, so a stray setting can never move a real patient's schedule.
//
// Memoised on `globalThis` for the same reason as the store (./store.ts): Turbopack gives pages and
// route handlers separate module registries under `next dev`, and two virtual clocks would be two
// different "todays".
import "server-only";

import { systemClock, type Clock } from "@/lib/caring-contacts/clock";
import { CaringContactsTimeProvider } from "@/lib/caring-contacts/demo-clock";

import { caringContactsDatabaseUrl } from "./config";
import { isCaringContactsDemoEnabled } from "./session";

export const CARING_CONTACTS_DEMO_CLOCK_START_VAR = "CARING_CONTACTS_DEMO_CLOCK_START";
export const CARING_CONTACTS_WORKSPACE_CLOCK_GLOBAL_KEY = "__caringContactsWorkspaceClock";

type GlobalWithWorkspaceClock = typeof globalThis & {
  [CARING_CONTACTS_WORKSPACE_CLOCK_GLOBAL_KEY]?: CaringContactsTimeProvider;
};

export function caringContactsClock(): Clock {
  const start = process.env[CARING_CONTACTS_DEMO_CLOCK_START_VAR]?.trim();
  if (!start || !isCaringContactsDemoEnabled() || caringContactsDatabaseUrl()) return systemClock();
  const runtime = globalThis as GlobalWithWorkspaceClock;
  // An unparseable instant throws here, loudly, rather than silently falling back to the real date.
  runtime[CARING_CONTACTS_WORKSPACE_CLOCK_GLOBAL_KEY] ??= new CaringContactsTimeProvider(start);
  return runtime[CARING_CONTACTS_WORKSPACE_CLOCK_GLOBAL_KEY];
}
