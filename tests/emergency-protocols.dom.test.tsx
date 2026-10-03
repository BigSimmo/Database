import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EmergencyProtocolBanner } from "@/components/clinical-dashboard/emergency-protocol-banner";
import { EMERGENCY_CLINICAL_PROTOCOLS, matchEmergencyClinicalProtocol } from "@/lib/emergency-protocols";

describe("matchEmergencyClinicalProtocol", () => {
  describe("Neuroleptic Malignant Syndrome", () => {
    it.each([
      "nms",
      "NMS",
      "treatment of nms in ED",
      "neuroleptic malignant syndrome",
      "suspected Neuroleptic Malignant Syndrome",
      "patient has lead-pipe rigidity",
      "hyperthermia and rigidity",
    ])("matches %j", (query) => {
      const match = matchEmergencyClinicalProtocol(query);
      expect(match).not.toBeNull();
      expect(match?.id).toBe("EMERG-NMS");
      expect(match?.name).toContain("Neuroleptic Malignant Syndrome");
    });
  });

  describe("Serotonin Syndrome", () => {
    it.each([
      "serotonin syndrome",
      "serotonin toxicity",
      "Hunter criteria for serotonin syndrome",
      "ssri toxicity",
      "snri overdose",
      "maoi toxicity",
    ])("matches %j", (query) => {
      const match = matchEmergencyClinicalProtocol(query);
      expect(match).not.toBeNull();
      expect(match?.id).toBe("EMERG-SEROTONIN-SYNDROME");
    });
  });

  describe("Acute Dystonic Reaction", () => {
    it.each([
      "acute dystonia",
      "acute dystonic reaction",
      "oculogyric crisis",
      "laryngeal dystonia",
      "torticollis antipsychotic",
    ])("matches %j", (query) => {
      const match = matchEmergencyClinicalProtocol(query);
      expect(match).not.toBeNull();
      expect(match?.id).toBe("EMERG-ACUTE-DYSTONIA");
    });
  });

  describe("Lithium Toxicity", () => {
    it.each([
      "lithium toxicity",
      "acute lithium poisoning",
      "lithium overdose management",
      "high lithium level",
      "coarse tremor with lithium",
      "ataxia and lithium",
    ])("matches %j", (query) => {
      const match = matchEmergencyClinicalProtocol(query);
      expect(match).not.toBeNull();
      expect(match?.id).toBe("EMERG-LITHIUM-TOXICITY");
    });
  });

  describe("Clozapine Myocarditis", () => {
    it.each([
      "clozapine myocarditis",
      "clozapine troponin rise",
      "tachycardia and fever on clozapine",
      "chest pain with clozapine",
      "clozapine cardiac monitoring",
    ])("matches %j", (query) => {
      const match = matchEmergencyClinicalProtocol(query);
      expect(match).not.toBeNull();
      expect(match?.id).toBe("EMERG-CLOZAPINE-MYOCARDITIS");
    });
  });

  describe("Malignant Catatonia", () => {
    it.each([
      "malignant catatonia",
      "lethal catatonia",
      "catatonic excitement",
      "catatonia with hyperthermia",
      "catatonia with fever",
    ])("matches %j", (query) => {
      const match = matchEmergencyClinicalProtocol(query);
      expect(match).not.toBeNull();
      expect(match?.id).toBe("EMERG-MALIGNANT-CATATONIA");
    });
  });

  describe("Negative matches (avoiding false positives)", () => {
    it.each([
      "synonyms for depression", // "nms" substring inside "synonyms"
      "dreams in sleep disorder", // "nms" substring inside "dreams"
      "ssri starting dose for depression",
      "lithium regular monitoring schedule",
      "clozapine routine blood test ANC",
      "catatonia rating scale Bush-Francis",
      "acute psychosis without fever or rigidity",
      "hypertension in elderly",
      "",
    ])("does not falsely match %j", (query) => {
      expect(matchEmergencyClinicalProtocol(query)).toBeNull();
    });

    it("safely handles null and undefined", () => {
      expect(matchEmergencyClinicalProtocol(null)).toBeNull();
      expect(matchEmergencyClinicalProtocol(undefined)).toBeNull();
    });
  });
});

describe("EMERGENCY_CLINICAL_PROTOCOLS structural integrity", () => {
  it("defines at least 6 core acute emergency protocols", () => {
    expect(EMERGENCY_CLINICAL_PROTOCOLS.length).toBeGreaterThanOrEqual(6);
  });

  it.each(EMERGENCY_CLINICAL_PROTOCOLS)("validates structure for $id ($name)", (protocol) => {
    expect(protocol.id).toBeTruthy();
    expect(protocol.name).toBeTruthy();
    expect(protocol.firstLineAction.length).toBeGreaterThan(10);
    expect(protocol.warningNotice.length).toBeGreaterThan(20);
    expect(protocol.diagnosticFeatures.length).toBeGreaterThanOrEqual(2);
    expect(protocol.urgentInvestigations.length).toBeGreaterThanOrEqual(2);
    expect(protocol.immediateManagement.length).toBeGreaterThanOrEqual(2);
    expect(protocol.specialistContacts.length).toBeGreaterThanOrEqual(1);
    expect(protocol.evidenceSource.length).toBeGreaterThan(5);

    // Every protocol must reference Poisons Information Centre (13 11 26)
    const hasPoisons = protocol.specialistContacts.some((c) => c.includes("13 11 26"));
    expect(hasPoisons).toBe(true);

    // Immediate management must have at least one high-priority step
    const hasPriority = protocol.immediateManagement.some((m) => m.isHighPriority);
    expect(hasPriority).toBe(true);
  });
});

describe("EmergencyProtocolBanner DOM rendering", () => {
  const nmsProtocol = EMERGENCY_CLINICAL_PROTOCOLS.find((p) => p.id === "EMERG-NMS")!;

  it("renders with role='alert' and aria-live='assertive'", () => {
    const html = renderToStaticMarkup(<EmergencyProtocolBanner protocol={nmsProtocol} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain('data-testid="emergency-protocol-banner"');
  });

  it("renders first-line action and poisons phone link in collapsed view", () => {
    const html = renderToStaticMarkup(<EmergencyProtocolBanner protocol={nmsProtocol} />);
    expect(html).toContain("Cease all dopamine antagonists and antipsychotics immediately.");
    expect(html).toContain('href="tel:131126"');
    expect(html).toContain("Poisons: 13 11 26");
  });

  it("renders detailed management and investigations when defaultExpanded is true", () => {
    const html = renderToStaticMarkup(<EmergencyProtocolBanner protocol={nmsProtocol} defaultExpanded={true} />);
    expect(html).toContain("Urgent Investigations");
    expect(html).toContain("Serum Creatine Kinase (CK)");
    expect(html).toContain("Immediate Antipsychotic Cessation");
    expect(html).toContain("Aggressive IV Hydration");
    expect(html).toContain("Maudsley Prescribing Guidelines");
  });
});
