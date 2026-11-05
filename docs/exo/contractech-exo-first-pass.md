# ContracTech: ExO 3.0 first pass

**Area:** Winning work: finding leads, proposals, and follow-up until the client's purchase order (PO)
**Date:** 4 November 2026, updated 5 November with the GM's answers · **Prepared for:** Eng. Turki AlTurki, General Manager
**Method:** ExO 3.0 *building-an-exo* skill (OS Outline v25), First-Pass Intake workflow
**Status:** Draft. Scores use what is known from the portal, the company profile and the GM's answers. Items still open are marked **[confirm]**; the list is at the end.

**The firm in numbers (from the GM):**
- **Team:** the GM handles business development, client relationships and every proposal. Two or three people work with him, bringing in clients alongside him or supervising work on site.
- **Office:** none, by choice. Work runs online: proposals, connections, email and WhatsApp. An office comes only when larger projects justify it.
- **Revenue:** under SAR 100k last year; about SAR 200k expected this year.
- **Jobs:** CCTV, renovation, maintenance and small construction. The largest so far is under SAR 30k.
- **Volume:** about 4–5 leads a month, roughly 2 of which become jobs. **[confirm reading]**
- **Speed:** a proposal goes out within a day of first contact. Then about **a month until the client issues the PO**.
- **Records:** kept in different places; there is no single list of jobs.
- **Out of scope:** supply-only orders (buying equipment and reselling it). A recent side line that may not continue.

---

## The answer in five lines

1. ContracTech is a **Direct Mode** firm (Tier 2): the whole company is redesigned directly. **No office is needed.** ExO 3.0 agrees: in an AI-native firm, a written purpose holds the team together, not a building.
2. Readiness is **40/80, "foundational"**. **Proposals are already fast** (under a day, thanks to the design portal). That is a real strength.
3. **The gap is after the proposal.** It takes about a month to get the PO. Follow-ups, client questions and revisions run from memory, and the records sit in different places, so nothing shows which proposals are waiting on what.
4. **Wave 1 is ContracTech's own jobs system plus a follow-up assistant.**
   - **Jobs system:** a "Jobs" section in the existing portal, holding one record per enquiry from first contact to PO, work, handover, invoice and maintenance.
   - **Follow-up assistant:** drafts the next message for every open proposal and flags anything stalled. The GM approves every message.
5. **The goal: grow agency, not headcount.**
   - Targets: every proposal has a next step and a date; less time to PO; more proposals turning into POs.
   - Measure today's baseline first, from past proposals.
   - The team of 3–4 does the work of a bigger one, and the GM's time goes to relationships and bigger jobs, such as hotel pre-openings.

---

## 1. The frame: three things

| | What it is | For ContracTech |
|---|---|---|
| **Destination (ExO 3.0)** | What the company looks like when redesigned around AI | A small core who own judgment, relationships, site work and sign-off. Agents do the coordination, drafting and record-keeping around them. Subcontractors are pulled in per job. |
| **Operating system (Intelligence Stack)** | The layer of agents, data and controls everything runs on | Built from what you already have: the portal (design, BOQ, proposals), the skills in this repo, and a new Jobs section that holds every record. |
| **Playbook (REWRITE)** | The six steps, in order | Steps 1–2 here, then a 90-day sprint through Steps 3–5 on one workflow |

The book compares a company to a car:
- **The Intelligence Stack is the engine.** Build it first.
- **DRIVE is the drivetrain:** the speed and intelligence.
- **SHAPE is the chassis and safety systems:** what keeps the company right and resilient.

As the book puts it, *"DRIVE without SHAPE is a fuse waiting for a spark"*, so both are scored below.

---

## 2. Diagnostics (Appendix A, run in order)

### 2.1 Readiness Score: 40 / 80

| # | Dimension | Score | Why |
|---|---|---|---|
| 1 | Organizational Drag | 6 | Few meetings, fast proposals. The drag sits after the proposal: follow-ups and paperwork depend on the GM remembering. |
| 2 | AI Elevation | 7 | AI strategy sits with the GM, who has P&L responsibility. You are acting as Chief AI Officer (CAIO) in practice. Not formalised. |
| 3 | Work Architecture | 4 | The CCTV and renovation engineering is broken into tasks inside the portal. Business development, follow-up and paperwork are still role-based and in people's heads. |
| 4 | Firm Boundary Design | 5 | Small core plus project-based people and subcontractors, but nobody has designed that mix deliberately. There is no register of who or what can do which task. |
| 5 | Decision Autonomy | 3 | Centralised. Nothing goes to a client without the GM. That is right for prices; it is too tight for routine coordination. |
| 6 | Network Structure | 5 | Flat and small, but the work is not yet organised as people managing AI agents. |
| 7 | Reinvention Cadence | 5 | New service lines get built in weeks (renovation, picture sections, company profile). No standing routine yet for retiring old workflows. |
| 8 | Tacit Knowledge Accessibility | 5 | The engineering rules, catalogue and rates are written into the portal, which is rare and valuable. Client history, pricing judgment and sales know-how are in your head and in scattered records. |

**Band: 33–55, foundational.** The book's prescription: start a 90-day sprint on a single workflow now, with the minimum stack (MVIS, section 4.1) in week one.

### 2.2 The four safety basics (Four Pillars of GOVERN/ASSURE)

In plain words, these are four habits that must be in place before letting AI do work on your behalf:
1. **A test:** a handful of your past jobs to check the AI's work against.
2. **One record per job:** every job gets a number, and everything about it is kept under that number.
3. **A way to undo:** you can always go back to the previous version of an AI helper.
4. **A gate:** nothing reaches a client without a named person checking it.

| Pillar | Score | Today |
|---|---|---|
| Trusted Evals (the test) | 2 | The portal's calculations have automated tests, but nothing checks AI-drafted messages, designs or prices. |
| Searchable Logs with Correlation IDs (one record per job) | 1 | No job numbers and no single place where a job's history lives. |
| Granular Rollback (a way to undo) | 3 | Skills and portal code are in git, so any single skill can be reverted to an earlier version. |
| Human Review Queue (the gate) | 2 | You check everything, but nothing tracks what is waiting for you. |
| **Maturity (lowest)** | **1** | **Rule: no AI helper deals with clients until every pillar is at least 3.** The Jobs section (section 7.1) lifts the weakest one. |

### 2.3 Miura-Ko ladder: L2 in CCTV design, L1 elsewhere

The ladder runs L0 to L5:
- **L0:** AI theater, nothing real
- **L1:** individuals use AI for their own tasks
- **L2:** a team workflow is sped up by AI
- **L3:** agents read and write the company's own records, across the business
- **L4:** the company runs on AI and compounds
- **L5:** a self-driving company, which doesn't exist yet

The CCTV design-to-proposal path is a real team workflow (**L2**). Everywhere else AI is personal productivity (**L1**). This matches the 40/80 score, so the two don't conflict.

### 2.4 Dabbling Test: FAIL (one of two checks passes)

This test asks whether AI has changed how the company is run, not just whether people use it.
- **Check 1, the 50% time check: Pass.** The GM confirms that building the design portal and documents with AI has shifted his time. Site work has not changed, beyond better record keeping.
- **Check 2, the operating-cadence check: Fail.** What happens after a proposal is the same as before: follow-ups, client questions and PO paperwork run from memory, by the GM.
- **The metric to track from now on:** the number of workflows that AI agents carry out safely under human command. **Today: 0.** The portal is software operated by a person; it is not an agent. The goal is to raise this number.

### 2.5 Third Anchor (team capacity)

Not measured. In a team of 3–4, one overloaded person is a real risk to the plan. Ask the team one question each month ("Is your workload sustainable?", scored 1–5) and track the trend. **[confirm]**

### 2.6 Tokenmaxxing Test

This test checks whether AI is really changing the work or just speeding up the old way.

| Check | Answer | Note |
|---|---|---|
| Leaderboard: rewarding AI usage itself? | No | |
| Geometry: is AI speeding up the old flow without changing who decides? | **Yes** | Proposals are faster, but everything after the proposal still runs through the GM, from memory. |
| Latency: has any workflow become 5× faster? | **Likely yes for proposals** | Proposals take under a day now. If they took a week or more before the portal, this passes. **[confirm]** Proposal to PO is still about a month. |

**Result: below L3** (one Yes). The book's fix is redesigning who does what after the proposal (REWRITE Step 4, section 5), not buying a new tool.

---

## 3. Scorecards

### 3.1 DRIVE (speed and intelligence): 9 / 25

| Component | Score | Note |
|---|---|---|
| D, Decision Architecture | 2 | No written map of which decisions are reversible, delegated or gated. The portal does gate the stamp: Final needs explicit confirmation, a good one-way-door control. |
| R, Recursive Learning | 2 | The portal is versioned and improves, but proposal outcomes (won, lost, why) are not recorded, so business development doesn't learn. |
| I, Intelligence Stack | 1 | Separate tools, no shared job record or agent list. Capped at the lowest pillar (1). |
| V, Value Moat | 2 | One durable source is emerging: **proprietary engineering data** (catalogue with datasheets, rates library, design rules) plus **curatorial judgment** (honest, traceable proposals). The rest is relationships, which fade. |
| E, Elastic Agency | 2 | People and subcontractors are added job by job, ad hoc. No Capability Registry (a list of who or what can do each task). |

The GOVERN cap (13/25 maximum without basic controls) doesn't bind here, because 9 is already below it.

**Sector:** Hybrid Operations (design plus physical installation). The book's long-run mix for this sector is about **50% AI agents, 30% internal people, 20% external partners** by share of work.

**Cognitive captivity check:**
- The portal runs offline with no AI inside it, so it is not tied to any AI vendor.
- The skills are plain text files in your own repository.
- **Gap:** all agent work today uses one model family (Claude). Keep a second family available for testing before agents go live. **[confirm]**
- **The jobs records must live in your own system, not inside a vendor's tool.** As the book says, "whoever owns the log owns the agent." This is the strongest reason to build your own Jobs section (section 7.1) rather than rent a CRM.

### 3.2 SHAPE (resilience): 11 / 25

| Component | Score | Note |
|---|---|---|
| S, Safe Autonomy | 2 | Every decision traces to the GM (a natural Fiduciary Wedge: every agent decision chains to a named person). But there are no written agent permissions and no tested stop switch. |
| H, Human Architecture | 2 | Capped at 2 until we write down how roles change (section 6). No cuts planned; the plan is to grow without adding overhead. |
| A, Adaptive Architecture | 3 | The portal is modular (cameras, storage, network, cabling and renovation are separate engines), offline and AI-independent. Any part can be swapped. |
| P, Purpose Control | 2 | The values and brand rules exist, but there is no purpose written as rules an AI can follow. Draft in section 4.2. |
| E, Ecosystem Trust | 2 | Trust today comes from relationships, plus traceable numbers, datasheet links and stamped finals. Nothing yet governs what partners or their systems can exchange with you. |

---

## 4. The destination (one page)

**ContracTech in 2031:**
- **Who:** a small core who own relationships, design judgment, site work and sign-off. No fixed office; the team works online and on site.
- **Agents:** do the sensing, drafting, follow-up and record-keeping around that core. Subcontractors are coordinated per job through the same system.
- **How it wins:** fast, exact, honest proposals and a follow-up that never drops a client. Behind them sits a growing record of every enquiry, design, price and outcome. **That record is the moat.**

### 4.1 The Intelligence Stack for winning work

| Layer | What it does here | Starts as |
|---|---|---|
| **PURPOSE** | The rules the agents follow (section 4.2) | A file in this repository |
| **SENSE** | Spots opportunities and takes in leads: new hotels, hospitals, schools and compounds; tenders; inbound WhatsApp, email and questionnaires | A weekly opportunity digest (Wave 2). Lead intake into the Jobs section. |
| **INTERPRET** | Builds the job record: client, site, needs, similar past jobs, what the client is waiting for | The Jobs section |
| **DECIDE** | Bid or no-bid facts, design options, price range, next step | **Recommend only.** You decide. |
| **ORCHESTRATE / ACT** | Runs the portal (design, BOQ), assembles proposals, drafts follow-ups and PO paperwork | Drafts only, until handover |
| **LEARN** | Logs won, lost and the reason; logs every correction you make | Fields in each job record |
| **GOVERN / ASSURE** | Job records, the gate (your approval), the test set, rollback | Built in weeks 1–2 |

**Minimum stack (MVIS) for week one, at ContracTech's size:**
- **Event bus:** the Jobs section. One record per enquiry with a number (e.g. `CT-26-031`); every message, draft and decision is kept under that number.
- **Agent registry:** a one-page list of each AI helper, its owner and what it may do. The skills live in this repo, so the list is versioned.
- **Central logging:** every AI draft saved in the job record, together with what you changed and why.
- **One agent per class:** start with only the Wave 1 assistant (section 7).

### 4.2 Purpose as rules (MTP protocol), draft for your approval

**Purpose statement (approved by the GM, 5 November 2026):** *"To be the one team a client trusts with the building and everything that runs and protects it."* · «أن نكون الفريق الواحد الذي يأتمنه العميل على المبنى وكل ما يشغّله ويحميه.»

This is the PURPOSE layer the agents read. It is not the slogan: the client-facing line, also approved, is **"Say it once."** (قُلها مرةً واحدة.), and it lives on the profile's cover. The GM's writing rules for both: no Vision 2030, no location filler, no lists of three, nothing worn out.

The five never-rules below apply whichever statement is chosen.

**Constraint Layer: what agents must never do** (on detection: refuse, log, escalate to the GM)
1. Send a price, date or commitment to a client without the GM's approval.
2. State a fact that isn't verified: years, project counts, certifications, partner levels, client names, or a product spec not taken from a datasheet.
3. Share site plans, camera positions, security layouts or site photos outside the job they were given for, or use them for anything else, including training outside models. **A CCTV design shows where a site is not watched; treat it as security-sensitive.**
4. Issue a Final or stamped document with sample rates, unconfirmed assumptions or open safety items.
5. Contact anyone who hasn't agreed to hear from ContracTech, or present an agent as a person. (Saudi Personal Data Protection Law, PDPL.)

**Decision Layer: how agents settle trade-offs**

| Trade-off | Rule |
|---|---|
| Safety and security vs. speed or margin | Safety and security first, always |
| Persuasion vs. honesty | State the weak point; every number traceable |
| Pushing vs. respecting the client's time | Follow up with something useful (an answer, a clarification, a document they need), never just "any update?" |
| Volume vs. fit | Bid where we can do the job well; recommend no-bid otherwise |
| Our preferred brand vs. client standard | Client or brand standard wins; we are brand-neutral |
| One-off margin vs. relationship | Favour the relationship (maintenance after handover) |

**Identity Layer: who this company is for, and who it isn't**
- **Why a strong person stays:** their judgment governs the agents, and they own a job from first visit to handover.
- **What makes their work visible:** their name is on every proposal and handover report.
- **What they get:** reach across the whole Kingdom, with no office routine.
- **Not for people who:**
  - quote without surveying
  - hide weak points to close a sale
  - want a big hierarchy or an office to sit in
  - won't travel to remote sites
  - won't write down how they decide

**Litmus tests**
- **Endorsement test: pass (expected).** Scenario: a client hasn't replied for 10 days. The agent should draft a follow-up that adds something useful (an answer to an open question, or the vendor-registration documents they'll need) and suggest a date. It should not offer a discount. You would endorse that.
- **Refusal test: pass (expected).** The agent should refuse "Auto-answer every tender" (a fit-over-volume rule) and "WhatsApp blast to a bought list" (constraint 5).
- **Identity test:** the layer above answers why people stay, what is visible, and who it is not for.

### 4.3 Five Design Conditions (binding gate before Step 1 ends)

| Condition | Status |
|---|---|
| AI-centric workflow architecture | Holds if Wave 1 redesigns the follow-up flow, not just the messages |
| Recursive improvement infrastructure | Holds once job records capture corrections and win/loss reasons |
| Model sovereignty and governed autonomy | **Amber:** a single model family today. The data and skills are owned; add a second model family before go-live. |
| Intelligence density at every layer | Track proposals per person per month, proposals that become POs, and revenue per person |
| Human flourishing as a binding constraint | No role cuts. Team capacity checked monthly (section 2.5). |

**Precedent for Direct Mode:** Peter Steinberger built the first version of OpenClaw alone in an evening (November 2025) and ran it with a handful of agents. Solo-founded companies are 36.3% of new ventures. A small firm running on agents is now the normal starting point. (As with any success story, survivorship bias applies.)

---

## 5. Task breakdown for winning work (REWRITE Step 4)

Categories: J = judgment, P = pattern, C = coordination, Cr = creation.
Readiness: 5 = AI can do it now, 3 = pilot it, 1 = stays human.

| Role | Task | Cat. | Readiness | Disposition |
|---|---|---|---|---|
| GM | Spot opportunities (hotel openings, projects, tenders) | P | 4 | agent now (recommend only) |
| GM | Warm introductions, relationship meetings | J | 1 | stay human |
| GM | Bid / no-bid decision | J | 2 | stay human (agent prepares facts) |
| GM | Set final price and margin | J | 2 | stay human |
| GM | Approve, sign and stamp the proposal | J | 1 | stay human |
| GM | Follow up until the PO: next step, reminders, status | C | 4 | agent now (drafts) |
| GM | Answer client questions, revise the proposal | P | 3 | pilot |
| Team | Lead intake: site facts, needs, photos | C | 4 | agent now |
| Team | Book the site survey | C | 4 | agent now |
| Team | Site survey on site | J | 2 | stay human (agent preps checklist) |
| GM / Team | CCTV design: cameras, storage, network, cabling | P | 4 | agent now (portal; GM confirms) |
| GM / Team | Renovation quantities and BOQ | P | 4 | agent now (portal) |
| GM | Price the BOQ from current supplier prices | P | 3 | pilot |
| GM | Request supplier quotes, check stock | C | 3 | pilot |
| GM | Proposal text, cover letter, tailored one-page sheet | Cr | 4 | agent now |
| GM | Vendor registration and PO paperwork for the client | C | 4 | agent now (prepares the pack) |
| GM | Tender paperwork compliance check | C | 3 | pilot |
| GM | Track pipeline status | C | 5 | agent now |
| GM | Record won / lost and the reason | C | 4 | agent now |

**Totals (19 tasks):**
- **By disposition:** agent now 10 (53%), pilot 4 (21%), stay human 5 (26%).
- **By category:** coordination 8 (42%), pattern 5, judgment 5, creation 1.
- Almost all of the coordination sits after the proposal. That is the book's strongest signal for a Wave 1 workflow.

**Decision map** (this fixes the Tokenmaxxing "Geometry" yes):
- **Reversible, low-risk** (agents may do after Wave 1, logged):
  - internal drafts
  - job record updates
  - preparing document packs
  - suggesting the next step and date
- **One-way doors** (always the GM):
  - price
  - commitments
  - Final or stamp
  - any message sent to a client
  - bid / no-bid

---

## 6. People (SHAPE: Human Architecture)

- **Absorption math:** with 3–4 people there is nothing to cut, and that is not the aim. The aim is more proposals turning into POs with the same team. Freed time goes to relationships, site work, bigger jobs and maintenance contracts.
- **Transition leader:** Eng. Turki AlTurki. **People budget:** 10–15% of measured savings, spent on teaching the team to work with the Jobs section and the assistants.
- **Junior loop:** if AI drafts the designs, the team must still learn to design. Rule: whoever reviews an AI design writes one line on what they changed and why. That builds their judgment and gives the AI training data.
- **Retention:**
  - **Consequence:** each person owns their jobs end to end.
  - **Legibility:** their name is on proposals and handover reports.
  - **Identity:** see section 4.2.
  - **Pay:** match the market, then stop competing on pay.

---

## 7. Wave 1: from proposal to purchase order

**Why this workflow:**
- Proposals are already fast. The month after them is where jobs are won or lost, and today it runs from memory.
- It is high-coordination and low-judgment, so it is safe to hand to AI.
- It is measurable: days to PO, and the share of proposals that become POs.
- It is fully reversible: nothing reaches a client without your approval.

### 7.1 The Jobs section: ContracTech's own system

**Recommendation:** add a Jobs section to the existing portal, rather than buy a full ERP or rent a CRM. It is the record the ExO method insists you own.

**What it holds:**
- one record per enquiry, with a number
- client and contacts
- value
- documents: proposal, BOQ, photos
- notes
- the next step and its date
- the outcome and the reason

**Stages:** enquiry → survey → proposal sent → waiting for PO → waiting for payment → work → handover → invoiced → paid → maintenance.

"Waiting for payment" applies to jobs that are not on credit: work starts once the client's transfer arrives.

**What it is not:** accounting, HR or stock. Those can come later, and invoices can be exported to an accountant.

**Where it lives:** in your own system, built and changed with Claude like the rest of the portal.

### 7.2 Agent spec: CT-A1 Follow-up Assistant

- **Purpose:** make sure every open proposal has a timely, useful next step, until a PO or a clear no.
- **Human Owner:** Eng. Turki AlTurki
- **Autonomy Tier:**
  - drafts messages, next steps and document checklists inside the job record without asking
  - **recommend only** for anything client-facing
  - **never:** send to a client, change price or scope, commit a date, or delete anything
- **Permission Envelope:**
  - **Reads:** job records, proposals and BOQs, client messages saved to the job.
  - **Writes:** drafts and next-step suggestions in the job record only.
  - **No access to:** sending email or WhatsApp, prices or rates, the stamp.
- **Memory Boundary:** it works per job. It may look at past jobs to see which follow-ups worked. It keeps nothing outside the Jobs section.
- **Escalation rules** (flag to the GM):
  - the client asks for a discount or a scope change
  - a complaint
  - a competitor is mentioned
  - no reply after three follow-ups
  - PO conditions such as payment terms, penalties or retention
- **Test set (Eval Suite):**
  - replay 10–20 past proposals; the GM rates each drafted follow-up as use / edit / reject
  - target by week 8: at least 70% used as-is or with light edits **[proposed]**
  - the edit rate must fall every week
  - re-run after any skill or model change
- **Audit trail:** every draft is logged in the job record, with:
  - date
  - skill version (git commit)
  - model
  - what the GM changed
  - whether it was sent
- **Reusability:** the same pattern later serves maintenance renewals, invoice reminders and survey scheduling. Registry tags: `follow-up`, `next-step`, `paperwork-pack`.

### 7.3 Data the assistant touches: the six questions

| Data | What is it / who says so | Allowed use | Legal terms | If wrong | Disputes |
|---|---|---|---|---|---|
| Client messages and brief | Client's own words, saved to the job | This job only | PDPL; client consent | GM corrects | Client's written words win |
| Proposals and BOQs | ContracTech, issued and dated | This job; past jobs for patterns | Confidential | Revised proposal replaces it | Latest issued version wins |
| Site plans and photos | Client or ContracTech, dated | This job only; marketing only with separate opt-in | Security-sensitive; never shared outside the job | Re-survey | Survey record wins |
| ContracTech company documents (CR, VAT, bank letter) | Issuing authorities | Only to send to a client registering ContracTech as a vendor | Confidential | Replace with the current copy | Issuing authority wins |

### 7.4 Running it in parallel (success criteria set before starting)

**First, the baseline from your past proposals.** For each one: the days from proposal to PO, whether it became a PO, and how many follow-ups it took. **[to measure]**

**Then, for 6–8 weeks:** every open proposal gets an AI-drafted next step. You send it, edit it or bin it, and each choice is recorded.

**Volume note:** at 4–5 leads a month, live data builds slowly. The past proposals supply most of the learning.

**Success criteria:**
- **Every open proposal has a next step and a date:** 100%.
- **Your edits fall every week.** This is the real test. If they don't, it's automation with a chat box, not a working assistant.
- Days from proposal to PO: **shorter than the baseline**.
- Share of proposals that become POs: **higher than the baseline**.
- **Zero** messages sent without your approval.

---

## 8. The 90-day sprint

| Weeks | Work | Done when |
|---|---|---|
| 1–2 | **Basics:** build the Jobs section; load the last 10–20 proposals with their outcomes; approve the purpose rules; measure the baseline | All four pillars at 3 or above |
| 3–8 | **Shadow run** of the Follow-up Assistant on every open proposal; weekly 30-minute review of your edits; fix the skill | Edits falling for 3 weeks in a row |
| 9–12 | **Handover Wave 1:** drafted follow-ups become the default. Start the weekly opportunity digest in shadow (Wave 2), aimed at bigger jobs such as hotel pre-openings and new compounds. | Success criteria in 7.4 met |
| Month 6 | Retake this scorecard; pick the next wave (opportunity finding and vendor-registration packs) | Score and ladder re-measured |

**Lowest three dimensions to raise first:**
- Decision Autonomy
- Work Architecture
- Tacit Knowledge (getting client history and follow-up know-how out of your head and into the Jobs section)

---

## Answers so far, and what is still open

**Answered (4–5 November 2026):**
- **Revenue:** under SAR 100k last year, about SAR 200k this year (Tier 2).
- **Team:** the GM (business development, proposals) plus 2–3 people who bring in clients or supervise sites. No office until larger projects justify one.
- **Volume:** about 4–5 leads a month, roughly 2 won. **[confirm reading]**
- **Speed:** proposals go out within a day; about a month from proposal to PO.
- **Records:** in different places today. The GM wants his own system: the Jobs section, section 7.1.
- **Time shift:** about half the GM's working time has moved because of AI (Dabbling check 1 passes).
- **No value threshold:** the GM does every proposal.
- **Past proposals:** the GM will share 10–20 (CCTV, renovation, maintenance, small construction).

- **The month before the PO:** each company has its own approval process. For jobs not on credit, ContracTech then waits for the client's bank transfer. So the assistant follows up on two things: the PO, then the payment.
- **Jobs section:** built on 5 November 2026 (Admin → Jobs in the portal), with the Follow-up Assistant as the `contractech-follow-up` skill. Weeks 1–2 of the sprint can start: load the past proposals and set a next step on every open job.

**Still open:** nothing on the purpose; it and the slogan were approved on 5 November 2026. The never-rules stay as drafted.

---

*Source: ExO 3.0 and its frameworks (DRIVE, SHAPE, the Intelligence Stack, REWRITE, MTP-as-protocol, the Four Pillars, the Appendix A diagnostics) are from* The Organizational Singularity *(OS Outline v25, June 2026) by Salim Ismail with contributors, openexo.com/organizational-singularity. The Miura-Ko ladder is by Ann Miura-Ko (Floodgate, 2026). Applied with the* building-an-exo *skill by Kent Langley for OpenExO.*
