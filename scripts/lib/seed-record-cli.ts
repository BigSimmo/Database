import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Shared plumbing for the record-seeding CLIs (`seed-differential-records`,
 * `seed-medication-records`, `seed-registry-records`). They all take the same
 * `--owner-id/--write/--confirm` flags, lazily load the admin client and
 * registry-corpus module so a dry run never needs server env, and must preserve
 * governance a clinician reviewed after the last seed.
 */
export type SeedArgs = {
  ownerId?: string;
  write: boolean;
  confirmed: boolean;
};

export type SeedSupabaseClient = ReturnType<typeof createAdminClient>;

/** Deferred so `--help`/dry runs do not require server environment variables. */
export async function loadAdminClient(): Promise<SeedSupabaseClient> {
  const { createAdminClient: create } = await import("@/lib/supabase/admin");
  return create();
}

export async function loadRegistryCorpus() {
  return import("@/lib/registry-corpus");
}

/**
 * Parses the flags every seed CLI shares. `valueOptions` adds script-specific
 * flags that take a value (for example `--kind service`).
 */
export function parseSeedArgs<Args extends SeedArgs>(
  argv: string[],
  defaults: Omit<Args, keyof SeedArgs>,
  valueOptions: Record<string, (value: string | undefined, args: Args) => void> = {},
): Args {
  const args = {
    ...defaults,
    ownerId: process.env.LOCAL_NO_AUTH_OWNER_ID,
    write: false,
    confirmed: false,
  } as Args;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--write") {
      args.write = true;
      continue;
    }
    if (token === "--confirm") {
      args.confirmed = true;
      continue;
    }
    if (token === "--owner-id") {
      args.ownerId = argv[index + 1];
      index += 1;
      continue;
    }
    const valueOption = valueOptions[token];
    if (valueOption) {
      valueOption(argv[index + 1], args);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

export function requireOwnerId(args: SeedArgs): string {
  if (!args.ownerId) {
    throw new Error("No owner id. Pass --owner-id <uuid> or set LOCAL_NO_AUTH_OWNER_ID.");
  }
  return args.ownerId;
}

type GovernanceKey = "source_status" | "validation_status" | "last_reviewed_at" | "review_due_at";

export type ReviewedGovernance = {
  source_status: unknown;
  validation_status: unknown;
  last_reviewed_at: unknown;
  review_due_at: unknown;
};

/**
 * Keeps reviewed governance on rows that already exist: a reseed for fixture
 * copy changes must not downgrade `source_status` / `validation_status` /
 * `last_reviewed_at` / `review_due_at` back to the fixture-derived defaults.
 */
export function preserveReviewedGovernance<Row, Prior extends ReviewedGovernance>({
  rows,
  existing,
  rowKey,
  priorKey,
}: {
  rows: Row[];
  existing: Prior[];
  rowKey: (row: Row) => string;
  priorKey: (prior: Prior) => string;
}): { rows: Array<Row | (Row & Pick<Prior, GovernanceKey>)>; preserved: number } {
  const priorByKey = new Map(existing.map((prior) => [priorKey(prior), prior] as const));
  let preserved = 0;
  const merged = rows.map((row) => {
    const prior = priorByKey.get(rowKey(row));
    if (!prior) return row;
    const hasReviewedGovernance =
      Boolean(prior.last_reviewed_at) ||
      prior.validation_status === "locally_reviewed" ||
      prior.validation_status === "approved";
    if (!hasReviewedGovernance) return row;
    preserved += 1;
    return {
      ...row,
      source_status: prior.source_status,
      validation_status: prior.validation_status,
      last_reviewed_at: prior.last_reviewed_at,
      review_due_at: prior.review_due_at,
    };
  });
  return { rows: merged, preserved };
}

/**
 * Reports how many records the owner holds after an upsert. A failed count is a
 * warning, not an error: the upsert itself already succeeded.
 */
export async function reportOwnerRecordCount({
  supabase,
  table,
  ownerId,
  logPrefix,
  noun,
}: {
  supabase: SeedSupabaseClient;
  table: "clinical_registry_records" | "differential_records" | "medication_records";
  ownerId: string;
  logPrefix: string;
  noun: string;
}) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);
  if (error) {
    console.warn(`${logPrefix} Upsert succeeded but count check failed: ${error.message}`);
    return;
  }
  console.log(`${logPrefix} Done. Owner now has ${count ?? "?"} ${noun}.`);
}
