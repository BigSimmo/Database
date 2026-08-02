import type { User } from "@supabase/supabase-js";

export const administratorRoleClaim = "site_role";
export const administratorRoleValue = "administrator";

export function isAdministratorAppMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>)[administratorRoleClaim] === administratorRoleValue;
}

export function isAdministratorUser(user: Pick<User, "app_metadata"> | null | undefined): boolean {
  return isAdministratorAppMetadata(user?.app_metadata);
}
