/**
 * The one owner-by-email lookup for scripts that scope work to a Supabase Auth user.
 * import-documents, enrich-documents, purge-query-logs and the eval tooling all resolve
 * `--owner-email` through this function, so a hardening change reaches every caller.
 */
export type OwnerLookupUser = { id?: string | null; email?: string | null };

export type OwnerLookupClient = {
  auth: {
    admin: {
      listUsers(params: { page: number; perPage: number }): Promise<{
        data: { users: OwnerLookupUser[] };
        error: { message: string } | null;
      }>;
    };
  };
};

export const OWNER_LOOKUP_PAGE_SIZE = 1000;
export const OWNER_LOOKUP_MAX_PAGES = 50;

/**
 * Resolve an owner id from an email by paging `auth.admin.listUsers`. Matching is
 * case-insensitive on a trimmed email. Throws when no user matches; `purpose` names the
 * script's action in that message ("Sign in once before <purpose>.").
 */
export async function findOwnerIdByEmail(
  supabase: OwnerLookupClient,
  email: string,
  options: { purpose?: string } = {},
): Promise<string> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("An owner email is required.");
  const perPage = OWNER_LOOKUP_PAGE_SIZE;

  for (let page = 1; page < OWNER_LOOKUP_MAX_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === normalized);
    if (user?.id) return user.id;
    if (data.users.length < perPage) break;
  }

  throw new Error(
    `No Supabase Auth user found for ${email}. Sign in once before ${options.purpose ?? "running this script"}.`,
  );
}
