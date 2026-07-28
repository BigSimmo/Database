import { compareDriftSnapshots } from "./check-drift.ts";

function runSimulation() {
  console.log("[Drift Simulator] Injecting synthetic schema drift...");

  const expected = {
    extensions: [],
    views: [],
    policies: [],
    constraints: [],
    triggers: [],
    storage_buckets: [],
    tables: [
      { name: "users", rls_enabled: true, rls_forced: true, reloptions: null, acl: null, columns: [{ name: "id" }] },
      { name: "dropped_table", rls_enabled: true, rls_forced: true, reloptions: null, acl: null, columns: [] }
    ],
    functions: [
      { signature: "public.get_users()", def_hash: "hash1", acl: null }
    ],
    indexes: [
      { name: "users_id_idx", table: "users", def_hash: "indexhash1" }
    ]
  };

  const live = {
    extensions: [],
    views: [],
    policies: [],
    constraints: [],
    triggers: [],
    storage_buckets: [],
    tables: [
      // "dropped_table" missing
      { name: "users", rls_enabled: false, rls_forced: true, reloptions: null, acl: null, columns: [{ name: "id" }] }, // mismatch: rls_enabled
      { name: "unexpected_table", rls_enabled: false, rls_forced: false, reloptions: null, acl: null, columns: [] } // unexpected
    ],
    functions: [
      { signature: "public.get_users()", def_hash: "hash2", acl: null } // mismatch: def_hash
    ],
    indexes: [
      { name: "users_id_idx", table: "users", def_hash: "indexhash1" }
    ]
  };

  const result = compareDriftSnapshots(expected, live, []);
  
  const expectedFindings = [
    { category: "tables", kind: "missing_live", key: "dropped_table" },
    { category: "tables", kind: "mismatch", key: "users" },
    { category: "tables", kind: "unexpected_live", key: "unexpected_table" },
    { category: "functions", kind: "mismatch", key: "public.get_users()" },
  ];

  let passed = true;
  for (const ef of expectedFindings) {
    const found = result.findings.find(f => f.category === ef.category && f.kind === ef.kind && f.key === ef.key);
    if (!found) {
      console.error(`❌ Missing expected finding: ${JSON.stringify(ef)}`);
      passed = false;
    }
  }

  if (result.findings.length !== expectedFindings.length) {
    console.error(`❌ Expected ${expectedFindings.length} findings, got ${result.findings.length}`);
    console.log(result.findings);
    passed = false;
  }

  if (passed) {
    console.log("✅ Drift simulation passed. All synthetic drift vectors were detected correctly.");
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSimulation();
