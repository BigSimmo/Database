function npmScript(script) {
  return { kind: "npm-script", command: "npm", args: ["run", script], label: `npm run ${script}` };
}

function command(commandName, args, prerequisiteMessage) {
  return {
    kind: prerequisiteMessage ? "prerequisite" : "command",
    command: commandName,
    args,
    label: [commandName, ...args].join(" "),
    prerequisiteMessage,
  };
}

export function buildPrLocalPlan(scope, options = {}) {
  const extended = options.extended === true;
  const plan = [npmScript("format:check"), npmScript("verify:cheap")];

  if (extended && scope.source_changed) plan.push(npmScript("test:coverage"));
  if (extended && !scope.docs_only) {
    plan.push(command("npm", ["audit", "--omit=dev", "--audit-level=high"]));
    plan.push(npmScript("check:edge:functions"));
    plan.push(npmScript("check:production-readiness:ci"));
  }
  if (extended && scope.workflow_changed) plan.push(npmScript("check:codex-autofix-workflow"));
  if (scope.build_changed || scope.workflow_changed) plan.push(npmScript("build"));
  if (extended && scope.ui_changed) {
    plan.push(npmScript("ensure"));
    plan.push(npmScript("test:e2e:critical"));
  }
  if (scope.rag_eval_changed) plan.push(npmScript("eval:rag:offline"));
  if (extended && scope.db_changed) {
    plan.push(
      command(
        "docker",
        ["info"],
        "Database replay is required, but Docker is unavailable. Start Docker Desktop and rerun the extended PR-local gate.",
      ),
      command(
        "supabase",
        ["--version"],
        "Database replay is required, but the Supabase CLI is unavailable. Install it and rerun the extended PR-local gate.",
      ),
      command("supabase", ["start"]),
      command("supabase", ["db", "reset"]),
    );
  }
  return plan;
}

export function formatPrLocalPlan(plan) {
  return plan.map((entry, index) => `${index + 1}. ${entry.label}`).join("\n");
}
