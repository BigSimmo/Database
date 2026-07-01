import { describe, expect, it } from "vitest";
import {
  canonicalDocumentDisplayTitle,
  classifyDocumentOrganization,
  extractDocumentBracketTags,
} from "@/lib/document-organization";

describe("document organization classifier", () => {
  it("extracts bracket tags from titles, filenames, and source paths", () => {
    expect(
      extractDocumentBracketTags(
        "Tracheostomy Management (Adult) (FSH)",
        "Remote Network Access (RNA) to WA Health System (Including FSH Clinical Applications) (FSH).pdf",
        "Policies/[SMHS Policy]/example.pdf",
      ),
    ).toEqual(["Adult", "FSH", "RNA", "Including FSH Clinical Applications", "SMHS Policy"]);
  });

  it("assigns Fiona Stanley Hospital only when bracket and source evidence agree", () => {
    const classification = classifyDocumentOrganization({
      title: "Tracheostomy Management (Adult) (FSH)",
      file_name: "Tracheostomy Management (Adult) (FSH).pdf",
      contentText: "This Fiona Stanley Hospital procedure applies to adult inpatient wards.",
    });

    expect(classification.profile).toMatchObject({
      canonical_display_title: "Tracheostomy Management",
      review_status: "confident",
      site: {
        label: "Fiona Stanley Hospital",
        short_label: "FSH",
        raw_tag: "FSH",
        kind: "hospital",
      },
      document_type: { label: "procedure" },
      secondary_facets: { population: ["adult"] },
    });
    expect(classification.labels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Fiona Stanley Hospital", label_type: "site" }),
        expect.objectContaining({ label: "adult", label_type: "population" }),
      ]),
    );
  });

  it("marks site candidates for review when only the bracket supports the site", () => {
    const classification = classifyDocumentOrganization({
      title: "Waitlist Management (Kara Maar) (FSH)",
      file_name: "Waitlist Management (Kara Maar) (FSH).pdf",
      contentText: "This source describes waitlist management for a local service.",
    });

    expect(classification.profile.site.label).toBeNull();
    expect(classification.profile.site.candidates[0]).toMatchObject({
      label: "Fiona Stanley Hospital",
      raw_tag: "FSH",
      confidence: 0.58,
    });
    expect(classification.profile.review_status).toBe("needs_review");
    expect(classification.profile.secondary_facets.service).toEqual(["kara maar"]);
  });

  it("maps health-service and program tags conservatively", () => {
    expect(
      classifyDocumentOrganization({
        title: "Transport of Mental Health Consumers (EMHS Policy)",
        file_name: "Transport of Mental Health Consumers (EMHS Policy).pdf",
        contentText: "East Metropolitan Health Service policy for transport.",
      }).profile.site,
    ).toMatchObject({ label: "East Metropolitan Health Service", kind: "health_service" });

    expect(
      classifyDocumentOrganization({
        title: "Paediatric Consultation Liaison Program Entry Protocol Placecard (CAMHS)",
        file_name: "Paediatric Consultation Liaison Program Entry Protocol Placecard (CAMHS).pdf",
        contentText: "Child and Adolescent Mental Health Service entry protocol.",
      }).profile.site,
    ).toMatchObject({ label: "Child and Adolescent Mental Health Service", kind: "program" });
  });

  it("selects the strongest site when source text mentions multiple organizations", () => {
    const classification = classifyDocumentOrganization({
      title: "Mental Health Handover Procedure (AKG)",
      file_name: "Mental Health Handover Procedure (AKG).pdf",
      contentText:
        "Armadale Kalamunda Group procedure with WA Health and East Metropolitan Health Service governance references.",
    });

    expect(classification.profile.site).toMatchObject({
      label: "Armadale Kalamunda Group",
      short_label: "AKG",
      kind: "hospital",
    });
    expect(classification.labels).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Armadale Kalamunda Group", label_type: "site" })]),
    );
  });

  it("keeps non-site acronym tags out of confident site assignment", () => {
    const classification = classifyDocumentOrganization({
      title: "Patient Assisted Travel Scheme (PATS)",
      file_name: "Patient Assisted Travel Scheme (PATS).pdf",
      contentText: "Patient assisted travel workflow.",
    });

    expect(classification.profile.site).toMatchObject({
      label: null,
      short_label: null,
      kind: "unknown",
    });
    expect(classification.profile.site.candidates).toEqual([]);
    expect(classification.profile.review_status).toBe("needs_review");
    expect(classification.profile.secondary_facets.workflow).toEqual(["patient assisted travel scheme"]);
  });

  it("preserves unknown clinical brackets in display titles", () => {
    expect(
      canonicalDocumentDisplayTitle({
        title: "Management of (CAR-T Cell) Therapy Recipients (FSH)",
        file_name: "Management of (CAR-T Cell) Therapy Recipients (FSH).pdf",
      }),
    ).toBe("Management Of(CAR-T Cell) Therapy Recipients");
  });

  it("classifies new document types accurately based on title keywords", () => {
    expect(
      classifyDocumentOrganization({
        title: "6C Orientation Manual",
        file_name: "6C Orientation Manual (RPBG).pdf",
        contentText: "Welcome to 6C.",
      }).profile.document_type.label,
    ).toBe("manual");

    expect(
      classifyDocumentOrganization({
        title: "Abnormal Involuntary Movement Scale (AIMS)",
        file_name: "AIMS (FSH).pdf",
        contentText: "Movement scale assessment.",
      }).profile.document_type.label,
    ).toBe("assessment_tool");

    expect(
      classifyDocumentOrganization({
        title: "Lithium Prescribing Aid and Calculator",
        file_name: "lithium_prescribing_aid.pdf",
        contentText: "Dosing and monitoring aid.",
      }).profile.document_type.label,
    ).toBe("prescribing_aid");

    expect(
      classifyDocumentOrganization({
        title: "Clozapine Factsheet for Patients",
        file_name: "clozapine_patient_factsheet.pdf",
        contentText: "Patient information sheet.",
      }).profile.document_type.label,
    ).toBe("factsheet");

    expect(
      classifyDocumentOrganization({
        title: "Acute Severe Behavioral Disturbance (ASBD) Management Algorithm",
        file_name: "ASBD Algorithm (PHC).pdf",
        contentText: "Clinical decision flowchart.",
      }).profile.document_type.label,
    ).toBe("algorithm");

    expect(
      classifyDocumentOrganization({
        title: "Acute Surgical Unit SOP",
        file_name: "ASU SOP (RPBG).pdf",
        contentText: "Standard operating procedure.",
      }).profile.document_type.label,
    ).toBe("procedure");

    expect(
      classifyDocumentOrganization({
        title: "Heart UK Junior Booklet 2021",
        file_name: "Heart UK Junior Booklet 2021 (RPBG).pdf",
        contentText: "Patient education booklet.",
      }).profile.document_type.label,
    ).toBe("factsheet");

    expect(
      classifyDocumentOrganization({
        title: "Tracheostomy Suctioning Poster",
        file_name: "Tracheostomy Suctioning Poster (RPBG).pdf",
        contentText: "Poster for ward display.",
      }).profile.document_type.label,
    ).toBe("factsheet");

    expect(
      classifyDocumentOrganization({
        title: "Use of Shower Trolley Ward Routine",
        file_name: "Use of Shower Trolley Ward Routine (RPBG).pdf",
        contentText: "Ward routine for staff.",
      }).profile.document_type.label,
    ).toBe("procedure");

    expect(
      classifyDocumentOrganization({
        title: "Contingency Plan to Manage Workloads When Staffing Is Not Available",
        file_name: "Contingency Plan to Manage Workloads When Staffing Is Not Available (RPBG).pdf",
        contentText: "Escalation plan for staffing demand.",
      }).profile.document_type.label,
    ).toBe("protocol");
  });

  it("uses source-scope site labels for non-site-specific reference material", () => {
    const bmj = classifyDocumentOrganization({
      title: "Alcohol Use Disorder",
      file_name: "Alcohol use disorder.pdf",
      source_path: "C:/Users/joshs/OneDrive/Medicine/Guidelines/BMJ/Alcohol use disorder.pdf",
      contentText: "Clinical reference material.",
    });

    expect(bmj.profile.site).toMatchObject({
      label: "BMJ Best Practice",
      short_label: "BMJ",
      kind: "reference_collection",
    });
    expect(bmj.labels).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "BMJ Best Practice", label_type: "site" })]),
    );

    const general = classifyDocumentOrganization({
      title: "Alcohol Withdrawal",
      file_name: "Alcohol withdrawal.pdf",
      contentText: "Clinical reference material with no site-specific source.",
    });

    expect(general.profile.site).toMatchObject({
      label: "General clinical reference",
      short_label: "GEN",
      kind: "reference_collection",
    });
  });

  it("does not use the general reference fallback without reference or guideline evidence", () => {
    const classification = classifyDocumentOrganization({
      title: "Local Administrative Procedure",
      file_name: "local_admin_procedure.pdf",
      contentText: "This administrative procedure describes office access and document-control responsibilities.",
    });

    expect(classification.profile.site).toMatchObject({
      label: null,
      short_label: null,
      kind: "unknown",
      evidence_sources: [],
    });
    expect(classification.profile.review_status).toBe("needs_review");
    expect(classification.labels).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "General clinical reference", label_type: "site" })]),
    );
  });

  it("flags low-confidence document type classifications as needs_review", () => {
    const classification = classifyDocumentOrganization({
      title: "Random Document",
      file_name: "random_doc.pdf",
      contentText: "Does not contain any pattern keywords.",
    });
    expect(classification.profile.document_type.label).toBe("unknown");
    expect(classification.profile.review_status).toBe("needs_review");
  });

  it("classifies finance and hr workflows correctly and avoids bare hr false positives", () => {
    // 1. Bracket tag [HR] should map to hr
    const classificationBracket = classifyDocumentOrganization({
      title: "Staff Code of Conduct (HR)",
      file_name: "conduct.pdf",
      contentText: "Staff policy document.",
    });
    expect(classificationBracket.profile.secondary_facets.workflow).toContain("hr");

    // 2. Explicit 'human resources' in text should map to hr
    const classificationExplicit = classifyDocumentOrganization({
      title: "Staff Recruitment Policy",
      file_name: "recruitment.pdf",
      contentText: "Managed by the human resources department.",
    });
    expect(classificationExplicit.profile.secondary_facets.workflow).toContain("hr");

    // 3. Bare 'hr' as time unit in text should NOT map to hr workflow
    const classificationTime = classifyDocumentOrganization({
      title: "Infusion Guide",
      file_name: "infusion.pdf",
      contentText: "Administer the drug over 1 hr.",
    });
    expect(classificationTime.profile.secondary_facets.workflow).not.toContain("hr");

    // 4. Finance workflow should match financial terms
    const classificationFinance = classifyDocumentOrganization({
      title: "Annual Budget",
      file_name: "budget.pdf",
      contentText: "Department billing and cost allocation.",
    });
    expect(classificationFinance.profile.secondary_facets.workflow).toContain("finance");
  });

  it("attaches high-yield smart labels for medication monitoring and shared care documents", () => {
    const classification = classifyDocumentOrganization({
      title: "Lithium GP Shared Care Monitoring Guideline (FSH)",
      file_name: "Lithium GP Shared Care Monitoring Guideline (FSH).pdf",
      contentText:
        "Fiona Stanley Hospital lithium shared care guideline. Baseline tests, blood test monitoring, renal function, metabolic monitoring, ECG, toxicity, GP liaison, and ongoing monitoring are required for mood stabiliser treatment.",
    });

    expect(classification.profile.secondary_facets.medication).toEqual(
      expect.arrayContaining(["lithium", "mood-stabilisers"]),
    );
    expect(classification.profile.secondary_facets.topic).toEqual(
      expect.arrayContaining(["shared-care-gp-liaison", "physical-health-care"]),
    );
    expect(classification.profile.secondary_facets.workflow).toEqual(expect.arrayContaining(["monitoring"]));
    expect(classification.profile.secondary_facets.risk).toEqual(expect.arrayContaining(["high-risk-medication"]));
    expect(classification.profile.secondary_facets.clinical_action).toEqual(expect.arrayContaining(["monitor"]));
    expect(classification.profile.secondary_facets.document_intent).toEqual(
      expect.arrayContaining(["clinical-instruction"]),
    );
    expect(classification.profile.secondary_facets.content_feature).toEqual(
      expect.arrayContaining(["contains-monitoring-schedule"]),
    );
    expect(classification.labels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "monitor", label_type: "clinical_action", confidence: 0.74 }),
        expect.objectContaining({ label: "clinical-instruction", label_type: "document_intent", confidence: 0.7 }),
      ]),
    );
  });

  it("adds psychiatry-specific smart labels for risk and legal pathways", () => {
    const classification = classifyDocumentOrganization({
      title: "Mental Health Act Community Treatment Order Safety Plan",
      file_name: "cto_safety_plan.pdf",
      contentText:
        "The pathway includes mental state examination, risk formulation, safety planning, community treatment order review, capacity assessment, and involuntary treatment requirements.",
    });

    expect(classification.profile.secondary_facets.topic).toEqual(
      expect.arrayContaining(["mental-state-examination", "risk-formulation", "safety-plan"]),
    );
    expect(classification.profile.secondary_facets.document_intent).toContain("legal-governance");
    expect(classification.profile.secondary_facets.clinical_action).toEqual(expect.arrayContaining(["assess"]));
  });

  it("does not turn incidental body mentions into broad service labels", () => {
    const classification = classifyDocumentOrganization({
      title: "General Staff Orientation Manual",
      file_name: "General Staff Orientation Manual.pdf",
      contentText:
        "This orientation mentions emergency medicine, cardiology, orthopaedics, infectious disease, respiratory, and renal teams once as examples of hospital services.",
    });

    expect(classification.profile.secondary_facets.service).toEqual([]);
    expect(classification.profile.secondary_facets.workflow).toContain("staff-guidance");
  });

  it("adds smart-v2 intent labels for SOP, SDG, flyer, diagnosis, and staff-access documents", () => {
    const sop = classifyDocumentOrganization({
      title: "Citrate Toxicity During Apheresis Management SOP(RPBG)",
      file_name: "Citrate Toxicity During Apheresis Management SOP (RPBG).pdf",
      contentText: "Royal Perth Bentley Group standard operating procedure.",
    });
    expect(sop.profile.secondary_facets.document_intent).toEqual(
      expect.arrayContaining(["clinical-instruction", "operational-process"]),
    );

    const sdg = classifyDocumentOrganization({
      title: "Aminophylline SDG(FSH)",
      file_name: "Aminophylline SDG (FSH).pdf",
      contentText: "Fiona Stanley Hospital standing drug guideline.",
    });
    expect(sdg.profile.secondary_facets.clinical_action).toContain("prescribe");
    expect(sdg.profile.secondary_facets.document_intent).toEqual(
      expect.arrayContaining(["clinical-instruction", "medication-instruction"]),
    );
    expect(sdg.profile.secondary_facets.content_feature).toContain("contains-dosage-guidance");

    const flyer = classifyDocumentOrganization({
      title: "PI Homatropine Flyer A4 Info Sheet 2016(RPBG)",
      file_name: "PI Homatropine Flyer A4 Info Sheet 2016 (RPBG).pdf",
      contentText: "Royal Perth Bentley Group patient information flyer.",
    });
    expect(flyer.profile.secondary_facets.document_intent).toContain("patient-information");

    const diagnosis = classifyDocumentOrganization({
      title: "Diagnosis Of Potential Delayed Haemothorax In Blunt Thoracic Trauma(RPBG)",
      file_name: "Diagnosis of Potential Delayed Haemothorax in Blunt Thoracic Trauma (RPBG).pdf",
      contentText: "Royal Perth Bentley Group clinical document.",
    });
    expect(diagnosis.profile.secondary_facets.clinical_action).toContain("assess");
    expect(diagnosis.profile.secondary_facets.document_intent).toContain("decision-support");

    const staffAccess = classifyDocumentOrganization({
      title: "Staff Access To CAMHS Nickoll Ward(CAMHS)",
      file_name: "Staff Access to CAMHS Nickoll Ward (CAMHS).pdf",
      contentText: "Child and Adolescent Mental Health Service staff access process.",
    });
    expect(staffAccess.profile.secondary_facets.document_intent).toEqual(
      expect.arrayContaining(["staff-guidance", "operational-process"]),
    );

    const brochure = classifyDocumentOrganization({
      title: "Pregnancy Brochure(RPBG)",
      file_name: "Pregnancy Brochure (RPBG).pdf",
      contentText: "Royal Perth Bentley Group patient brochure.",
    });
    expect(brochure.profile.document_type.label).toBe("factsheet");
    expect(brochure.profile.secondary_facets.document_intent).toContain("patient-information");

    const drugInfusion = classifyDocumentOrganization({
      title: "ED Adult Drug Infusions(RPBG)",
      file_name: "ED Adult Drug Infusions (RPBG).pdf",
      contentText: "Royal Perth Bentley Group drug infusion instructions.",
    });
    expect(drugInfusion.profile.secondary_facets.clinical_action).toContain("administer");
    expect(drugInfusion.profile.secondary_facets.document_intent).toContain("medication-instruction");
    expect(drugInfusion.profile.secondary_facets.content_feature).toContain("contains-dosage-guidance");

    const confidentiality = classifyDocumentOrganization({
      title: "Patient Confidentiality(FSH)",
      file_name: "Patient Confidentiality (FSH).pdf",
      contentText: "Fiona Stanley Hospital confidentiality guidance.",
    });
    expect(confidentiality.profile.secondary_facets.document_intent).toContain("legal-governance");

    const roles = classifyDocumentOrganization({
      title: "NOF Role Roles And Responsibilities(RPBG)",
      file_name: "NOF Role Roles and Responsibilities (RPBG).pdf",
      contentText: "Royal Perth Bentley Group staff responsibilities.",
    });
    expect(roles.profile.secondary_facets.document_intent).toEqual(
      expect.arrayContaining(["staff-guidance", "operational-process"]),
    );
  });
});
