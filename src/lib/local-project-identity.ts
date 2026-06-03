export type LocalProjectIdentityPayload = {
  appName: string;
  projectId: string;
  identityPath: "/api/local-project-id";
  localServer: {
    currentUrl: string | null;
    currentPort: number | null;
    projectPortStart: number;
    projectPortEnd: number;
    safeLocalOrigin: boolean;
    requestOrigin: string | null;
    requestReferer: string | null;
    unsafeLocalCaller: string | null;
  };
};

export async function readLocalProjectIdentity() {
  const response = await fetch("/api/local-project-id", { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as LocalProjectIdentityPayload;
}

export function unsafeLocalProjectMessage(identity: LocalProjectIdentityPayload | null) {
  const range =
    typeof identity?.localServer?.projectPortStart === "number" &&
    typeof identity.localServer.projectPortEnd === "number"
      ? ` Use the URL printed by npm run ensure; managed ports are ${identity.localServer.projectPortStart}-${identity.localServer.projectPortEnd}.`
      : " Use the URL printed by npm run ensure.";
  return `This tab is not using the guarded Clinical KB local URL.${range}`;
}
