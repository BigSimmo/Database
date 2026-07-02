import { createClient } from "@supabase/supabase-js";
import { requireServerEnv } from "@/lib/env";
import type { Database } from "./database.types";

// Cache the admin client as a module-level singleton so that every API request
// reuses the same instance (and its underlying HTTP agent) rather than allocating
// a fresh one on every call. Mirrors the openAIClient singleton in openai.ts.
// The service-role client carries no user-specific session state, so sharing it
// across requests is safe.
let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminClient() {
  if (!adminClient) {
    const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = requireServerEnv();
    adminClient = createClient<Database>(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClient;
}
