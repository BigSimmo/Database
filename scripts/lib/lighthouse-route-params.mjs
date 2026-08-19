export function routeWithLighthouseParams(route) {
  // Lighthouse is a synthetic unattended run. Keep local-dev PWA prompts off so
  // browser-timed install eligibility cannot inject the fixed install sheet and
  // register a non-product CLS spike in budget grading.
  const separator = route.includes("?") ? "&" : "?";
  return `${route}${separator}pwa-dev=0`;
}
