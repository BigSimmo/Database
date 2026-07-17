import { createAdminClient } from "../src/lib/supabase/admin";

function argument(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback;
}

const roleName = argument("--role", "supabase_admin");
const schemaName = argument("--schema", "public");
if (!process.argv.includes("--confirm-provider-read")) {
  throw new Error("Refusing provider-backed ACL verification without --confirm-provider-read.");
}
const supabase = createAdminClient();
const { data, error } = await supabase.rpc("default_privileges_status", {
  p_role_name: roleName,
  p_schema_name: schemaName,
});

if (error) throw new Error(`Default ACL verification failed: ${error.message}`);
console.log(JSON.stringify(data, null, 2));

const status = data && typeof data === "object" && !Array.isArray(data) ? data : null;
if (!status || status.safe !== true) {
  throw new Error(`Unsafe default privileges for ${roleName} in schema ${schemaName}.`);
}
