import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

// Run only against the disposable container made by this worktree's drift:manifest --keep.
// This test uses two real transactions: publication must wait for an in-flight approval,
// then reject the old preview once that approval commits. Never pass a shared/live stack.
const container = process.argv[2];
assert(container, "Usage: node tests/roster-publication-concurrency.mjs <owned scratch container>");
const owner = createHash("sha256").update(fileURLToPath(new URL("../", import.meta.url)).toLowerCase()).digest("hex").slice(0, 12);
const inspection = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8" }))[0];
const label = inspection.Config.Labels?.["com.psychiatry-tools.drift-manifest.worktree"];
assert.equal(label, owner, "Refusing a container not owned by this scratch worktree");
const prefix = ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"];
const sql = (text) => execFileSync("docker", prefix, { input: text, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }).trim();
const lit = (value) => `'${String(value).replaceAll("'", "''")}'`;
const j = (value) => `${lit(JSON.stringify(value))}::jsonb`;
const ids = Object.fromEntries(["manager", "one", "two", "team"].map((key) => [key, randomUUID()]));
const actorSql = "set role service_role;\n";
const previewSql = () => `select public.roster_publish_preview(${lit(ids.manager)},${lit(ids.team)},current_date+90,current_date+97);`;
const command = (actor, action, payload) => `select public.roster_command(${lit(ids[actor])},${lit(ids.team)},${lit(action)},${j(payload)});`;
let approval;
let publishing;
try {
  sql(`begin;
    insert into auth.users(id,email) values (${lit(ids.manager)},'synthetic-manager@example.org'),(${lit(ids.one)},'synthetic-one@example.org'),(${lit(ids.two)},'synthetic-two@example.org');
    insert into public.on_call_services(id,name,created_by,is_demo) values (${lit(ids.team)},'Synthetic concurrency test',${lit(ids.manager)},true);
    insert into public.on_call_service_members(service_id,user_id,role) values (${lit(ids.team)},${lit(ids.manager)},'member'),(${lit(ids.team)},${lit(ids.one)},'member'),(${lit(ids.team)},${lit(ids.two)},'member');
    set local role service_role;
    select public.roster_set_manager(${lit(ids.team)},${lit(ids.manager)},${lit(ids.manager)},true);
    ${command("manager", "role.set", { userId: ids.one, grade: "resident" })}
    ${command("manager", "role.set", { userId: ids.two, grade: "resident" })}
    select public.roster_command(${lit(ids.manager)},${lit(ids.team)},'publish',jsonb_build_object('kind','full','periodStart',current_date+90,'periodEnd',current_date+97,'assignments',jsonb_build_array(
      jsonb_build_object('userId',${lit(ids.one)},'startsAt',(current_date+90)::timestamptz,'endsAt',(current_date+90)::timestamptz+interval '8 hours','shiftCode','C','kind','on_call'),
      jsonb_build_object('userId',${lit(ids.two)},'startsAt',(current_date+97)::timestamptz,'endsAt',(current_date+97)::timestamptz+interval '8 hours','shiftCode','C','kind','on_call')))); commit;`);
  const first = JSON.parse(sql(actorSql + previewSql()));
  const give = first.assignments.find((row) => row.userId === ids.one);
  const take = first.assignments.find((row) => row.userId === ids.two);
  const swap = JSON.parse(sql(actorSql + command("one", "swap.create", { giveAssignmentId: give.id, takeAssignmentId: take.id, counterpartyId: ids.two })));
  const preview = JSON.parse(sql(actorSql + previewSql()));
  const publication = JSON.parse(sql("select jsonb_build_object('kind','full','periodStart',current_date+90,'periodEnd',current_date+97,'assignments','[]'::jsonb);"));
  const payload = { roles: [], codes: [], publication };
  const startSession = (name) => {
    const process = spawn("docker", ["exec", "-i", "-e", `PGAPPNAME=${name}`, container, ...prefix.slice(3)], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let output = "";
    process.stdout.on("data", (data) => { output += data; });
    process.stderr.on("data", (data) => { output += data; });
    const done = new Promise((resolve, reject) => { process.once("error", reject); process.once("close", (code) => resolve({ code, output })); });
    return { process, done, output: () => output };
  };
  approval = startSession("roster-followup-approval");
  approval.process.stdin.write("begin;\n" + actorSql + command("two", "swap.accept", { swapId: swap.swapId }) + "\n\\echo APPROVAL_LOCK_HELD\n");
  const waitFor = async (predicate, message) => {
    for (let tries = 0; tries < 100; tries++) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(message);
  };
  await waitFor(() => approval.output().includes("APPROVAL_LOCK_HELD"), "approval did not reach held-lock checkpoint");
  assert(approval.output().includes('"approved"'), "fixture must really approve the swap");
  publishing = startSession("roster-followup-publish");
  publishing.process.stdin.end(actorSql + `select public.roster_publish(${lit(ids.manager)},${lit(ids.team)},${lit(preview.freshnessToken)},${j(payload)});`);
  await waitFor(() => sql("select count(*) from pg_stat_activity where application_name='roster-followup-publish' and wait_event_type='Lock';") === "1", "publication did not wait on the approval's team lock");
  approval.process.stdin.end("commit;\n");
  assert.equal((await approval.done).code, 0);
  const result = await publishing.done;
  assert.notEqual(result.code, 0, "stale publication must fail after the approval commits");
  assert.match(result.output, /roster_conflict/);
  assert.equal(sql(`select user_id from public.roster_assignments where id=${lit(give.id)};`), ids.two, "agreed swap must survive");
  console.log("Roster concurrency: publication waited for approval, rejected stale preview, preserved swap.");
} finally {
  if (approval && !approval.process.stdin.writableEnded) approval.process.stdin.end("rollback;\n");
  if (approval) await approval.done;
  if (publishing) await publishing.done;
  sql(`delete from public.on_call_services where id=${lit(ids.team)}; delete from auth.users where id in (${lit(ids.manager)},${lit(ids.one)},${lit(ids.two)});`);
}