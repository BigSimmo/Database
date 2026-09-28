import type { SupervisionEntry, SupervisionPairing, SupervisionPairingView } from "@/lib/teaching/depth-model";

/* Made-up depth fixtures (supervision). No DOM imports, so node tests can use them. */

export const SERVICE = "22222222-2222-4222-8222-222222222222";
export const PAIRING = "55555555-5555-4555-8555-555555555555";
export const ENTRY = "66666666-6666-4666-8666-666666666666";
export const ENTRY_2 = "66666666-6666-4666-8666-666666666667";
export const NOTE = "77777777-7777-4777-8777-777777777777";

export function entry(overrides: Partial<SupervisionEntry> = {}): SupervisionEntry {
  return {
    entryId: ENTRY,
    date: "2026-09-28",
    minutes: 90,
    type: "group",
    topics: ["case_review", "risk"],
    status: "pending",
    confirmedAt: null,
    confirmedByName: null,
    notes: [],
    ...overrides,
  };
}

export function pairing(overrides: Partial<SupervisionPairing> = {}): SupervisionPairing {
  return {
    pairingId: PAIRING,
    access: "registrar",
    registrarName: "Dr Demo Registrar",
    supervisorName: "Dr Demo Supervisor",
    startsOn: "2026-08-03",
    endsOn: "2027-02-01",
    targetHours: null,
    confirmedMinutes: 60,
    pendingMinutes: 90,
    pendingCount: 1,
    oldestPendingAt: "2026-09-28T06:00:00.000Z",
    entries: [
      entry(),
      entry({
        entryId: ENTRY_2,
        date: "2026-09-21",
        minutes: 60,
        type: "individual",
        topics: ["psychotherapy"],
        status: "confirmed",
        confirmedAt: "2026-09-22T01:00:00.000Z",
        confirmedByName: "Dr Demo Supervisor",
      }),
    ],
    ...overrides,
  };
}

export function pairingView(overrides: Partial<SupervisionPairingView> = {}): SupervisionPairingView {
  return { ...pairing(), serviceId: SERVICE, serviceName: "Demo service", readOnlyUntil: null, ...overrides };
}
