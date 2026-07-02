import { createClient } from "@supabase/supabase-js";
import { requireServerEnv } from "@/lib/env";
import type { Database } from "./database.types";

export function createAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = requireServerEnv();

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
