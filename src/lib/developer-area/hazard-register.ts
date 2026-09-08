import snapshotJson from "../../../data/hazard-register-snapshot.json";

export const HAZARD_SNAPSHOT_VERSION = "hazard-register-snapshot-v1";

/**
 * The three states a hazard row can carry, plus the escape hatch.
 *
 * `string` is deliberately part of the union. The Caring Contacts log is a
 * markdown document a human edits, so a status this code has never seen is a
 * change to that document, not an impossibility — and the generator passes it
 * through rather than coercing it to the nearest known band. The page renders
 * an unknown status as its own raw text, because filing an unrecognised status
 * under "controlled" is how a hazard surface starts lying.
 */
export type HazardStatus = "unmitigated" | "partial" | "controlled-unreviewed" | (string & {});

export type HazardRow = {
  id: string;
  title: string | null;
  status: HazardStatus;
  owner: string | null;
  residualRisk: string | null;
  /** Caring Contacts rows only: the harm the row describes. */
  harm?: string;
  /** Caring Contacts rows only: whether the row cites any control at all. */
  hasControl?: boolean;
  /** PsychSift rows only: how many files and tests the register cites. */
  controlCount?: number;
  testCount?: number;
  reviewExpiresAt: string | null;
  reviewExpired: boolean;
};

export type LedgerMention = { id: string; priority: string; summary: string };

export type HazardRegister = {
  id: string;
  name: string;
  scope: string;
  sourcePath: string | null;
  /** False means no register has been written for this area at all. */
  exists: boolean;
  authority: string;
  signedOff: boolean;
  gate: string | null;
  reviewedAt: string | null;
  reviewExpiresAt: string | null;
  reviewExpired: boolean;
  documentStatus?: string | null;
  hazards: HazardRow[];
  ledgerMentions?: LedgerMention[];
  openAssuranceDecisions: { id: string; owner: string | null; residualRisk: string | null }[];
};

export type HazardSnapshot = {
  version: string;
  generatedAt: string;
  counts: {
    registers: number;
    registersMissing: number;
    registersUnsigned: number;
    hazards: number;
    unmitigated: number;
    reviewExpired: number;
  };
  registers: HazardRegister[];
};

/**
 * Loads the committed snapshot, refusing an unrecognised shape.
 *
 * Throws rather than degrading, matching `loadLedgerSnapshot`. A hazard page
 * that renders a partial list because the snapshot shape moved is worse than a
 * page that does not render: the first quietly under-reports unmitigated
 * clinical risk, which is the whole failure this panel exists to prevent.
 */
export function loadHazardSnapshot(): HazardSnapshot {
  const snapshot = snapshotJson as HazardSnapshot;
  if (snapshot.version !== HAZARD_SNAPSHOT_VERSION) {
    throw new Error(
      `Unrecognised hazard snapshot version ${snapshot.version}; expected ${HAZARD_SNAPSHOT_VERSION}. Run: npm run snapshot:hazards`,
    );
  }
  return snapshot;
}

/**
 * The hazards with no control at all, across every register, with the register
 * they came from.
 *
 * These are the rows that block a real-patient pilot, and they are the reason
 * the page leads with them rather than with a total. A count of 44 hazards
 * reads as thoroughness; "4 with no control" reads as the truth.
 */
export function unmitigatedHazards(snapshot: HazardSnapshot): { register: HazardRegister; hazard: HazardRow }[] {
  return snapshot.registers.flatMap((register) =>
    register.hazards.filter((hazard) => hazard.status === "unmitigated").map((hazard) => ({ register, hazard })),
  );
}

/** Registers with nothing written for them — an absence the page must state, not omit. */
export function missingRegisters(snapshot: HazardSnapshot): HazardRegister[] {
  return snapshot.registers.filter((register) => !register.exists);
}

/** How many rows carry each status within one register, in a stable, renderable order. */
export function statusBreakdown(register: HazardRegister): { status: HazardStatus; count: number }[] {
  const counts = new Map<HazardStatus, number>();
  for (const hazard of register.hazards) {
    counts.set(hazard.status, (counts.get(hazard.status) ?? 0) + 1);
  }
  const known: HazardStatus[] = ["unmitigated", "partial", "controlled-unreviewed"];
  const ordered = known.filter((status) => counts.has(status));
  // Anything the known list does not cover still renders, after the known ones.
  const rest = [...counts.keys()].filter((status) => !known.includes(status)).sort();
  return [...ordered, ...rest].map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

/** Human wording for a status, so no page has to hand-map it twice. */
export function statusLabel(status: HazardStatus): string {
  if (status === "unmitigated") return "No control";
  if (status === "partial") return "Partial control";
  if (status === "controlled-unreviewed") return "Controlled, unreviewed";
  return status;
}
