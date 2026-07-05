export function isDeployedClinicalKb() {
  return process.env.NODE_ENV === "production";
}
