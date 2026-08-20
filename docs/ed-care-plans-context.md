# ED Care Plans — domain glossary

The ubiquitous language for the ED Care Plans context. This glossary defines the clinical-workflow concepts without describing schemas, routes, components, or implementation choices.

## People and services

**Patient**:
A person whose recurrent emergency care may benefit from a shared continuity plan. A patient is never defined by their presentation count.
_Avoid_: Frequent flyer, high utilizer, problem patient

**Community Mental Health Team (CMHT)**:
The community service responsible for ongoing specialist mental-health care and coordination during its stated operating hours.
_Avoid_: Clinic, case-management inbox

**Care Coordinator**:
A named clinician who coordinates the patient's community care within the CMHT. The CMHT remains the durable service contact when the named person is unavailable.
_Avoid_: Plan owner, approver

**Support Person**:
A family member, carer, advocate, peer, cultural support, or other person the patient wants involved in communication or decisions.
_Avoid_: Next of kin, unless that legal relationship is specifically meant

## Presentation activity

**ED Presentation**:
One episode beginning when the patient arrives at an emergency department and ending in a recorded disposition. It is an episode record, not the patient and not the longitudinal plan.
_Avoid_: Visit, attendance, encounter

**Presenting Indication**:
A concise statement of why emergency assessment was sought during one ED Presentation. It is not automatically a diagnosis or a description of clinical severity.
_Avoid_: Chief complaint, diagnosis

**Presentation Outcome**:
The concise assessment and disposition result recorded when an ED Presentation closes.
_Avoid_: Plan outcome, treatment success

**Presentation Activity**:
Objective counts of a patient's ED Presentations over an explicitly stated period. Activity can prompt human review but never determines a diagnosis, risk state, or mandatory pathway.
_Avoid_: Frequent-presenter score, risk score

**Presentation Amendment**:
A visible, attributed correction to a completed ED Presentation. It preserves the original record and states what changed and why.
_Avoid_: Edit, overwrite

## Identification

**Identification Policy**:
The locally governed rule describing when presentation activity or professional referral should prompt review for coordinated care planning. No approved numeric rule exists in this prototype.
_Avoid_: Algorithm, clinical rule

**Identification Review**:
A human multidisciplinary review of whether coordinated care planning may benefit the patient. It does not enrol the patient, create a plan, or make a severity judgment.
_Avoid_: Frequent-presenter flag, automatic enrolment

**Manual Referral**:
An authorised clinician's reasoned request for Identification Review independent of any numeric threshold.
_Avoid_: Override

## Management planning

**Management Plan**:
The patient's longitudinal clinician-facing continuity record for psychiatric ED presentations. It is one evolving plan composed of controlled versions, not a new plan for every presentation.
_Avoid_: ED note, treatment order, risk assessment

**Management Plan Version**:
One preserved edition of the Management Plan with an author, reason, state, and review history.
_Avoid_: Copy, document

**Current Plan**:
The single Management Plan Version approved for use now. Only named senior-clinician approval makes a version Current.
_Avoid_: Latest plan, active draft

**Draft**:
A proposed Management Plan Version that can be edited but is not approved for use. A Draft never displaces the Current Plan.
_Avoid_: Working Current Plan

**Awaiting Approval**:
A submitted Management Plan Version that is read-only while a senior clinician compares and approves it or returns it for changes.
_Avoid_: Current, approved

**Superseded Plan**:
A previously Current Management Plan Version replaced by a newer approved version. It remains available as history and never becomes Current again automatically.
_Avoid_: Expired plan

**Withdrawn Plan**:
A formerly Current Management Plan Version deliberately removed from current use with a recorded reason. Withdrawal leaves no Current Plan unless another version is separately approved.
_Avoid_: Deleted plan

**Review State**:
The currency of a Current Plan relative to its formal review expectation: within review, due soon, or overdue. An overdue Current Plan remains Current until reviewed, replaced, or withdrawn.
_Avoid_: Version state, expiry

**Plan Owner**:
The clinician or team accountable for coordinating review and keeping the Management Plan current. Ownership does not itself grant approval.
_Avoid_: Care Coordinator, approver

**Approver**:
The named senior clinician who confirms that a submitted Management Plan Version can become Current.
_Avoid_: Author, owner

**Review Trigger**:
A reason the Current Plan should be reconsidered, such as ineffective guidance, changed circumstances, repeated deviation, or stale contact information. A trigger never changes the plan automatically.
_Avoid_: Alert, automatic update

**Plan-use Feedback**:
The ED clinician's structured account of whether the Current Plan was available, used, and helpful during one ED Presentation.
_Avoid_: Compliance score, effectiveness verdict

## Personal safety planning

**Personal Safety Plan**:
A distinct patient-owned, patient-voice plan for recognising distress, using coping strategies, making the environment safer, and reaching personal and professional support.
_Avoid_: Management Plan section, risk-management plan

**Personal Safety Plan Version**:
One preserved edition of the Personal Safety Plan with a collaboration and patient-confirmation state. It does not require Management Plan approval.
_Avoid_: Clinical plan version

**Patient Confirmation**:
The recorded state of the patient's involvement with a Personal Safety Plan Version: confirmed, discussed but not confirmed, declined, or unavailable.
_Avoid_: Clinical approval, compliance

## Communication and evidence

**Contact Action**:
An explicit attempt to open an external telephone or email application using displayed service details. It is not evidence that communication occurred.
_Avoid_: Contact completed, message sent

**Contact Verification**:
Confirmation that a CMHT's shared contact details and operating hours were checked on a stated date.
_Avoid_: Service availability guarantee

**Audit Event**:
An attributed record that a meaningful workflow action occurred inside ED Care Plans. It describes only evidence the application actually has.
_Avoid_: Activity feed, communication log
