import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
