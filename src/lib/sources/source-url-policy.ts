export const GOVERNED_SOURCE_HOSTS = [
  "aci.health.nsw.gov.au",
  "admhss.mhc.wa.gov.au",
  "australianprescriber.tg.org.au",
  "emhs.health.wa.gov.au",
  "headspace.org.au",
  "helpingminds.org.au",
  "icd.who.int",
  "kidshelpline.com.au",
  "mensline.org.au",
  "pmc.ncbi.nlm.nih.gov",
  "pubmed.ncbi.nlm.nih.gov",
  "qlife.org.au",
  "royalperthhospital.health.wa.gov.au",
  "rph.health.wa.gov.au",
  "ruah.org.au",
  "smhs.health.wa.gov.au",
  "www.aihw.gov.au",
  "www.beyondblue.org.au",
  "www.cci.health.wa.gov.au",
  "www.entrypointperth.com.au",
  "www.gamblinghelponline.org.au",
  "www.health.gov.au",
  "www.health.wa.gov.au",
  "www.healthdirect.gov.au",
  "www.healthywa.wa.gov.au",
  "www.ihacpa.gov.au",
  "www.kemh.health.wa.gov.au",
  "www.legalaid.wa.gov.au",
  "www.legislation.wa.gov.au",
  "www.livingproud.org.au",
  "www.mayoclinic.org",
  "www.medicarementalhealth.gov.au",
  "www.mhas.wa.gov.au",
  "www.mhc.wa.gov.au",
  "www.mht.wa.gov.au",
  "www.ncbi.nlm.nih.gov",
  "www.ndis.gov.au",
  "www.nice.org.uk",
  "www.nimh.nih.gov",
  "www.nmhs.health.wa.gov.au",
  "www.openarms.gov.au",
  "www.psychiatry.org",
  "www.ranzcp.org",
  "www.wa.gov.au",
  "www.wacountry.health.wa.gov.au",
  "www.who.int",
  "www.wslhd.health.nsw.gov.au",
  "www.wungening.com.au",
  "www1.health.gov.au",
] as const;

const governedSourceHosts = new Set<string>(GOVERNED_SOURCE_HOSTS);

function hasGovernedQuery(url: URL) {
  if (!url.search) return true;

  const entries = [...url.searchParams.entries()];
  if (entries.length !== 1) return false;

  const [[key, value]] = entries;
  if (url.hostname === "www.health.gov.au") {
    return key === "language" && /^[a-z]{2}(?:-[A-Z]{2})?$/.test(value);
  }
  if (url.hostname === "www.legislation.wa.gov.au") {
    return key === "OpenElement" && value === "";
  }
  return false;
}

export function safeCanonicalSourceUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (!governedSourceHosts.has(url.hostname)) return null;
    if (!hasGovernedQuery(url)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
