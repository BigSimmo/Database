# Message review pack — lived experience and clinical

**Status:** ready to run, 19 August 2026. Owner: Josh. Hazard **H-04**.

**Why.** The message text is the highest-risk content in the programme and the cheapest thing to get
wrong. It has never been read by anyone with lived experience of a suicidal crisis. Doing this costs an
afternoon and should happen **before** the system is shown to a sponsor — a demonstration built around
wording that reads as automated is worse than no demonstration.

**Who.** Three or four people with lived experience of a suicidal crisis or a hospital discharge after
one, plus a clinician who is not part of designing this. Paid or otherwise properly recognised, per
normal lived-experience engagement practice. No patients currently under the reviewer's care.

**What this review is not.** Not consent, not ethics approval, not a substitute for the formal
lived-experience approval gate at pathway-version level. It is early formative feedback that will shape
what goes to that gate.

---

## 1. A provisional correction already applied — confirm or replace it

The reply decision of 19 August (production build specification §2.1) changed what happens when someone
replies: messages now come from a number that can receive, an automated response is sent immediately, and
the reply content is discarded without ever being stored or read.

The wording in use until 19 August was:

> Replies are not received, stored, analysed or monitored

Under the new design the first clause was **no longer true** — replies are received by the number, then
discarded. A **provisional replacement has been applied in code** so that nothing inaccurate about a safety
boundary remains in the prototype:

> No one reads replies to this number

This is provisional and explicitly not clinically approved. Confirming it, softening it, or replacing it is
the first job of this review. The requirement is that it be **true**, **plain**, and **not discouraging** to
someone who is struggling.

The **automated reply** itself is new content that also needs your view. Its current provisional text:

> This number is not read. Your message has not been seen by anyone and has not been kept. To talk to
> someone, call \<programme line\>, 9 am–6 pm every day. In an emergency call 000. \<Crisis line\>: \<number\>.

Ask the group directly whether this reads as honest or as a door closing. It is the message a person
receives at the moment they reached out, which makes it the highest-stakes sentence in the whole service.

## 2. The current message, in full

The approved patient-visible text as it stands, with fictional details:

> Hi Rowan, Alex from Example Aftercare Team is thinking of you. This is a one-way message. No one reads
> replies to this number. For timing changes call \<programme line\>, 9 am–6 pm. In an emergency call 000.
> Fictional Support Line: \<crisis contact\>. — Alex

This is the **first** message, which by policy carries the complete support information. Later messages
keep a short boundary statement and the programme contact, and are correspondingly shorter. Every message
including notices and signature must fit two SMS segments.

## 3. What to ask

Show the message on a phone screen, not on paper, and not in a spreadsheet. Show it as it would arrive.

**First impressions**

1. What is your honest first reaction to receiving this two days after leaving hospital?
2. Does it feel like it came from a person or from a system? What makes the difference?
3. Would you know who it was from?

**The boundary**

4. What do you understand about whether you can reply?
5. If you were having a bad night and texted back, what would you expect to happen?
6. Does the boundary wording feel like care, or like being kept at arm's length? Where is the line?

**The practicalities**

7. Is it clear where to get help, and which number is for what?
8. Is there anything here you would not want visible on a lock screen?
9. Is the length right — too much, too little?

**Over time**

10. How would you feel receiving these ten times over a year?
11. How should the last one, at twelve months, be different? What would make the ending feel considered
    rather than abrupt?
12. What would make you want them to stop?

**The name**

13. The service is called Caring Contacts. Does that name set the right expectation? Does anything about it
    promise something it should not?

## 4. What to record

For each question: what was said, in their words rather than paraphrased into clinical language.
Separately, a short list of **changes required** versus **changes suggested**, because the first group
blocks progress and the second does not.

Anything raised that is not about wording — timing, frequency, who sends it, what happens at the end —
belongs in the hazard log or the decision register, not lost in a wording note.

## 5. What happens to the output

1. Required changes are made to the message set.
2. The reply-boundary wording and the automated reply (§1) are confirmed or replaced, and the constants
   updated in code.
3. Findings that change policy rather than wording become dated decision-lock revisions.
4. The revised set goes to the formal dual approval — clinical programme lead plus lived-experience
   representative — which is a separate, recorded gate.
5. Only then is the message set used in any demonstration.
