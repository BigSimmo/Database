const reviewedActionPins = new Map([
  [
    "actions/checkout",
    new Map([
      ["9f698171ed81b15d1823a05fc7211befd50c8ae0", "v6.0.3"],
      ["9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0", "v7.0.0"],
    ]),
  ],
  ["actions/setup-node", new Map([["a0853c24544627f65ddf259abe73b1d18a591444", "v5.0.0"]])],
  ["actions/github-script", new Map([["3a2844b7e9c422d3c10d287c895573f7108da1b3", "v9.0.0"]])],
  ["actions/cache", new Map([["55cc8345863c7cc4c66a329aec7e433d2d1c52a9", "v6"]])],
  ["actions/upload-artifact", new Map([["043fb46d1a93c77aae656e7c1c64a875d1fc6a0a", "v7"]])],
  ["denoland/setup-deno", new Map([["22d081ff2d3a40755e97629de92e3bcbfa7cf2ed", "v2.0.5"]])],
  ["supabase/setup-cli", new Map([["46f7f98c7f948ad727d22c1e67fab04c223a0520", "v3"]])],
  ["gitleaks/gitleaks-action", new Map([["e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e", "v3"]])],
  ["actions/ai-inference", new Map([["a7805884c80886efc241e94a5351df715968a0ad", "v2"]])],
  ["peter-evans/create-or-update-comment", new Map([["e8674b075228eee787fea43ef493e45ece1004c9", "v5"]])],
  ["docker/setup-buildx-action", new Map([["bb05f3f5519dd87d3ba754cc423b652a5edd6d2c", "v4"]])],
  ["docker/build-push-action", new Map([["53b7df96c91f9c12dcc8a07bcb9ccacbed38856a", "v7"]])],
]);

const usesPattern = /^\s*(?:-\s*)?uses:\s*([^@\s]+)@([^\s#]+)(?:\s+#\s*(\S.*?))?\s*$/;
const immutableCommitSha = /^[0-9a-f]{40}$/;

export function validateActionReference(line) {
  const match = line.match(usesPattern);
  if (!match) return null;

  const [, action, ref, versionComment] = match;
  if (action.startsWith("./")) return null;
  if (!immutableCommitSha.test(ref)) {
    return `${action}@${ref} is mutable. Pin external actions to a reviewed 40-character commit SHA.`;
  }

  const reviewedPins = reviewedActionPins.get(action);
  if (!reviewedPins) {
    return `${action}@${ref} is not in the reviewed action allowlist.`;
  }
  const expectedVersion = reviewedPins.get(ref);
  if (!expectedVersion) {
    return `${action}@${ref} is not a reviewed commit SHA for this action.`;
  }
  if (versionComment !== expectedVersion) {
    return `${action}@${ref} must retain the exact reviewed release comment '# ${expectedVersion}'.`;
  }
  return null;
}
