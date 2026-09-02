// Usage: node save-results.mjs <workflow task .output file>  → writes results/<pkg>.json per package
import fs from "node:fs";
const SP = "/tmp/claude-0/-home-user-Database/f185f405-83e6-51c4-90c5-be0b0f107617/scratchpad";
const out = `${SP}/remediation/results`;
fs.mkdirSync(out, { recursive: true });
const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const result = data.result ?? {};
for (const [pkg, r] of Object.entries(result)) {
  fs.writeFileSync(`${out}/${pkg}.json`, JSON.stringify(r, null, 2));
  const impl = r?.fix ?? r?.impl;
  const review = r?.review2 ?? r?.review;
  console.log(`${pkg}: impl=${impl ? "ok" : "MISSING"} fixed=${impl?.findings_fixed?.length ?? 0} skipped=${impl?.findings_skipped?.length ?? 0} commits=${impl?.commits?.length ?? 0} review=${review ? (review.pass ? "pass" : `blocked(${review.blocking?.length})`) : "MISSING"}${r?.fix ? " (after fix round)" : ""}`);
  for (const s of impl?.findings_skipped ?? []) console.log(`   skipped ${s.id}: ${String(s.reason).slice(0, 160)}`);
  for (const d of impl?.needs_owner_decision ?? []) console.log(`   owner: ${String(d).slice(0, 160)}`);
  if (review && !review.pass) for (const b of review.blocking ?? []) console.log(`   BLOCK ${b.finding}: ${String(b.problem).slice(0, 160)}`);
}
console.log(`tokens=${data.totalTokens} toolCalls=${data.totalToolCalls} agents=${data.agentCount}`);
