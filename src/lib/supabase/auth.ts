import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env, isLocalNoAuthMode } from "@/lib/env";

type AdminClient = ReturnType<typeof createAdminClient>;

export type AuthenticatedUser = {
  id: string;
};

export class AuthenticationError extends Error {
  constructor() {
    super("Authentication required.");
    this.name = "AuthenticationError";
  }
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Authentication required." }, { status: 401 });
}

export async function requireAuthenticatedUser(request: Request, supabase: AdminClient): Promise<AuthenticatedUser> {
  if (isLocalNoAuthMode()) {
    const configuredOwnerId = env.LOCAL_NO_AUTH_OWNER_ID?.trim();
    if (configuredOwnerId) {
      if (!isUuid(configuredOwnerId)) {
        throw new Error("LOCAL_NO_AUTH_OWNER_ID must be a valid UUID.");
      }
      return { id: configuredOwnerId };
    }

    const configuredOwnerEmail = env.LOCAL_NO_AUTH_OWNER_EMAIL?.trim();
    const ownerIdFromEmail = await resolveOwnerByEmail(supabase, configuredOwnerEmail);
    if (ownerIdFromEmail) return { id: ownerIdFromEmail };

    const fallbackOwnerId = await resolveOwnerFromDocuments(supabase);
    if (fallbackOwnerId) return { id: fallbackOwnerId };

    throw new Error(
      "Local no-auth mode is enabled, but no owner could be resolved. Set LOCAL_NO_AUTH_OWNER_ID or " +
        "LOCAL_NO_AUTH_OWNER_EMAIL, or ensure the documents table has at least one row with owner_id.",
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    throw new AuthenticationError();
  }

  const { data, error } = await supabase.auth.getUser(token);
  const userId = data.user?.id;

  if (error || !userId) {
    throw new AuthenticationError();
  }

  return { id: userId };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveOwnerByEmail(supabase: AdminClient, ownerEmail?: string) {
  if (!ownerEmail) return null;

  const normalizedEmail = ownerEmail.trim().toLowerCase();
  if (!normalizedEmail) return null;

  let page = 1;
  const seenPages = new Set<number>();

  while (page > 0) {
    if (seenPages.has(page)) {
      throw new Error("Failed to resolve owner by email because the admin user listing returned a pagination loop.");
    }
    seenPages.add(page);

    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      throw new Error(`Failed to resolve local owner from email: ${error.message}`);
    }
    if (!data?.users?.length) break;

    const found = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (found?.id) return found.id;

    page = typeof data.nextPage === "number" ? data.nextPage : 0;
  }

  return null;
}

async function resolveOwnerFromDocuments(supabase: AdminClient) {
  const { data, error } = await supabase
    .from("documents")
    .select("owner_id")
    .not("owner_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve local owner fallback from documents: ${error.message}`);
  }

  return data?.owner_id ?? null;
}
