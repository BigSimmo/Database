import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

// Two real sessions, on this worktree's disposable replay container only.
const container = process.argv[2];
assert(container, "Usage: node tests/roster-draft-concurrency.mjs <owned scratch container>");
const owner = createHash("sha256")
  .update(fileURLToPath(new URL("../", import.meta.url)).toLowerCase())
  .digest("hex")
  .slice(0, 12);
const inspection = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8" }))[0];
assert.equal(
  inspection.Config.Labels?.["com.psychiatry-tools.drift-manifest.worktree"],
  owner,
  "Refusing an unowned container",
);
const prefix = [
  "exec",
  "-i",
  container,
  "psql",
  "-X",
  "-qAt",
  "-v",
  "ON_ERROR_STOP=1",
  "-U",
  "postgres",
  "-d",
  "postgres",
];
const sql = (text) => execFileSync("docker", prefix, { input: text, encoding: "utf8", timeout: 20000 }).trim();
const lit = (value) => `'${String(value).replaceAll("'", "''")}'`;
const ids = Object.fromEntries(["manager", "second", "doctor", "team"].map((key) => [key, randomUUID()]));
const command = (actor, action, payload) =>
  `select public.roster_command(${lit(ids[actor])},${lit(ids.team)},${lit(action)},${lit(JSON.stringify(payload))}::jsonb);`;
const run = (actor, action, payload) => JSON.parse(sql("set role service_role;\n" + command(actor, action, payload)));
const sessions = [];
const start = (name) => {
  const child = spawn("docker", ["exec", "-i", "-e", `PGAPPNAME=${name}`, container, ...prefix.slice(3)], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  const done = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, output }));
  });
  const session = { child, done, output: () => output };
  sessions.push(session);
  return session;
};
const waitFor = async (check, message) => {
  for (let count = 0; count < 100; count++) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(message);
};
try {
  sql(`begin;
    insert into auth.users(id,email) values (${lit(ids.manager)},'draft-manager@example.org'),(${lit(ids.second)},'draft-second@example.org'),(${lit(ids.doctor)},'draft-doctor@example.org');
    insert into public.on_call_services(id,name,created_by,is_demo) values (${lit(ids.team)},'Synthetic draft race',${lit(ids.manager)},true);
    insert into public.on_call_service_members(service_id,user_id,role) values (${lit(ids.team)},${lit(ids.manager)},'member'),(${lit(ids.team)},${lit(ids.second)},'member'),(${lit(ids.team)},${lit(ids.doctor)},'member');
    set local role service_role;
    select public.roster_set_manager(${lit(ids.team)},${lit(ids.manager)},${lit(ids.manager)},true);
    select public.roster_set_manager(${lit(ids.team)},${lit(ids.second)},${lit(ids.manager)},true); commit;`);
  const draft = run("manager", "draft.open", { periodStart: "2026-11-02", periodEnd: "2026-11-08" });
  assert.equal(draft.version, 1);
  const payload = {
    draftId: draft.draftId,
    expectedVersion: 1,
    source: "grid",
    ops: [
      {
        op: "add",
        row: {
          userId: ids.doctor,
          startsAt: "2026-11-03T00:00:00Z",
          endsAt: "2026-11-03T08:00:00Z",
          shiftCode: "D",
          kind: "day",
        },
      },
    ],
  };
  const first = start("roster-draft-first");
  first.child.stdin.write(
    "begin; set local statement_timeout='15s'; set local role service_role;\n" +
      command("manager", "draft.change", payload) +
      "\n\\echo FIRST_LOCK_HELD\n",
  );
  await waitFor(() => first.output().includes("FIRST_LOCK_HELD"), "first edit did not hold lock");
  const second = start("roster-draft-second");
  second.child.stdin.end(
    "set statement_timeout='15s'; set role service_role;\n" + command("second", "draft.change", payload),
  );
  await waitFor(
    () =>
      sql(
        "select count(*) from pg_stat_activity where application_name='roster-draft-second' and wait_event_type='Lock';",
      ) === "1",
    "second edit did not wait on team lock",
  );
  first.child.stdin.end("commit;\n");
  assert.equal((await first.done).code, 0);
  const loser = await second.done;
  assert.notEqual(loser.code, 0);
  assert.match(loser.output, /roster_conflict/);
  const state = JSON.parse(
    sql(
      `select jsonb_build_object('version',d.version,'rows',(select count(*) from public.roster_draft_assignments a where a.draft_id=d.id)) from public.roster_drafts d where id=${lit(draft.draftId)};`,
    ),
  );
  assert.deepEqual(state, { version: 2, rows: 1 });

  // Undo waits for a later edit, then refuses even with the resulting current version.
  const rowId = sql(`select id from public.roster_draft_assignments where draft_id=${lit(draft.draftId)};`);
  const changeId = sql(`select id from public.roster_changes where draft_id=${lit(draft.draftId)};`);
  const edit = start("roster-draft-edit-before-undo");
  edit.child.stdin.write(
    "begin; set local statement_timeout='15s'; set local role service_role;\n" +
      command("second", "draft.change", {
        ...payload,
        expectedVersion: 2,
        ops: [{ op: "update", id: rowId, row: { shiftCode: "E" } }],
      }) +
      "\n\\echo EDIT_LOCK_HELD\n",
  );
  await waitFor(() => edit.output().includes("EDIT_LOCK_HELD"), "later edit did not hold lock");
  const undo = start("roster-draft-unsafe-undo");
  undo.child.stdin.end(
    "set statement_timeout='15s'; set role service_role;\n" +
      command("manager", "draft.undo", {
        draftId: draft.draftId,
        expectedVersion: 3,
        changeId,
      }),
  );
  await waitFor(
    () =>
      sql(
        "select count(*) from pg_stat_activity where application_name='roster-draft-unsafe-undo' and wait_event_type='Lock';",
      ) === "1",
    "undo did not wait on the later edit",
  );
  edit.child.stdin.end("commit;\n");
  assert.equal((await edit.done).code, 0);
  const unsafe = await undo.done;
  assert.notEqual(unsafe.code, 0);
  assert.match(unsafe.output, /roster_conflict/);
  assert.equal(sql(`select shift_code from public.roster_draft_assignments where id=${lit(rowId)};`), "E");

  // A manager removed while their edit is waiting cannot use stale role evidence.
  const revoke = start("roster-draft-revoke");
  revoke.child.stdin.write(
    `begin; set local statement_timeout='15s'; set local role service_role; select public.roster_set_manager(${lit(ids.team)},${lit(ids.second)},${lit(ids.manager)},false);\n\\echo REVOKE_LOCK_HELD\n`,
  );
  await waitFor(() => revoke.output().includes("REVOKE_LOCK_HELD"), "revoke did not hold lock");
  const removed = start("roster-draft-removed");
  removed.child.stdin.end(
    "set statement_timeout='15s'; set role service_role;\n" +
      command("second", "draft.change", { ...payload, expectedVersion: 3 }),
  );
  await waitFor(
    () =>
      sql(
        "select count(*) from pg_stat_activity where application_name='roster-draft-removed' and wait_event_type='Lock';",
      ) === "1",
    "removed manager edit did not wait",
  );
  revoke.child.stdin.end("commit;\n");
  assert.equal((await revoke.done).code, 0);
  const denied = await removed.done;
  assert.notEqual(denied.code, 0);
  assert.match(denied.output, /roster_role_denied/);
  assert.equal(sql(`select version from public.roster_drafts where id=${lit(draft.draftId)};`), "3");
  console.log(
    "Roster draft concurrency: stale edit, unsafe undo after a concurrent edit, and removed waiting manager refused.",
  );
} finally {
  for (const session of sessions) if (!session.child.stdin.writableEnded) session.child.stdin.end("rollback;\n");
  await Promise.allSettled(sessions.map((session) => session.done));
  sql(
    `delete from public.on_call_services where id=${lit(ids.team)}; delete from auth.users where id in (${lit(ids.manager)},${lit(ids.second)},${lit(ids.doctor)});`,
  );
}
