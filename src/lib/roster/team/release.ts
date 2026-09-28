/** Live staff access stays off until the service privacy and isolation checks are accepted. */
export function rosterTeamReleaseEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.NODE_ENV !== "production" || environment.ROSTER_TEAM_RELEASE_ENABLED === "true";
}
