# ContracTech: ExO 3.0 first pass

**Area:** Winning work (leads, surveys, designs, BOQs, quotes, tenders, proposals)
**Date:** 4 November 2026 · **Prepared for:** Eng. Turki AlTurki, General Manager
**Method:** ExO 3.0 *building-an-exo* skill (OS Outline v25), First-Pass Intake workflow
**Status:** Draft. Scores use what is known from the portal and the company profile. Every assumption is marked **[confirm]**; the list is at the end.

---

## The answer in five lines

1. ContracTech is a **Direct Mode** firm (1–10 people): the whole company is redesigned directly. There is no separate pilot unit to set up.
2. Readiness is **40/80, "foundational"**. The engineering work is already strongly codified in the portal. The rest of winning work still runs through you, by hand.
3. The rule that blocks agents: the four safety basics (a test set, a log, a way to undo, and a review queue) score **1/5 at their weakest**. **No AI agent goes live with clients until all four reach 3.** That takes about two weeks.
4. **Wave 1 workflow:** *lead to proposal* for CCTV and security jobs. AI drafts everything from the first message to the proposal; an engineer approves every client-facing item.
5. **Run a 90-day sprint.** Weeks 1–2 build the basics, weeks 3–8 run AI drafts alongside your normal way, and weeks 9–12 hand over the first decisions. Success is measured by **how often you have to correct the AI**, which must fall every week.

---

## 1. The frame: three things

| | What it is | For ContracTech |
|---|---|---|
| **Destination (ExO 3.0)** | What the company looks like when redesigned around AI | A small core of engineers who own judgment, site work, relationships and sign-off. Agents do the coordination and drafting around them. Subcontractors are pulled in per job. |
| **Operating system (Intelligence Stack)** | The layer of agents, data and controls everything runs on | Built from what you already have: the portal (design, BOQ, proposals), the skills in this repo, and a single jobs log. |
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
| 1 | Organizational Drag | 6 | Few meetings and fast decisions. But every price, proposal and commitment waits for the GM, so drag sits in one place: you. |
| 2 | AI Elevation | 7 | AI strategy sits with the GM, who has P&L responsibility. You are acting as Chief AI Officer (CAIO) in practice. Not formalised. |
| 3 | Work Architecture | 4 | The CCTV and renovation engineering is broken into tasks inside the portal. Sales, follow-up and tenders are still role-based and in people's heads. |
| 4 | Firm Boundary Design | 5 | Small core plus project-based helpers and subcontractors, but nobody has designed that mix deliberately. There is no register of who or what can do which task. |
| 5 | Decision Autonomy | 3 | Centralised. Nothing goes to a client without the GM. That is right for prices; it is too tight for routine coordination. |
| 6 | Network Structure | 5 | Flat and small, but the work is not yet organised as people managing AI agents. |
| 7 | Reinvention Cadence | 5 | New service lines get built in weeks (renovation, picture sections, company profile). No standing routine yet for retiring old workflows. |
| 8 | Tacit Knowledge Accessibility | 5 | The engineering rules, catalogue and rates are written into the portal, which is rare and valuable. Pricing judgment, sales know-how and client history are still in your head. |

**Band: 33–55, foundational.** The book's prescription: start a 90-day sprint on a single workflow now, with the minimum stack (MVIS, section 4.1) in week one.

### 2.2 The four safety basics (Four Pillars of GOVERN/ASSURE)

| Pillar | Score | Today |
|---|---|---|
| Trusted Evals (a fixed test set the AI is checked against) | 2 | The portal's calculations have automated tests, but nothing checks AI-drafted text, designs or prices. |
| Searchable Logs with Correlation IDs (one ID per job, every step logged against it) | 1 | No job ID and no log of what the AI drafted and what was changed. |
| Granular Rollback (undo one agent without breaking the rest) | 3 | Skills and portal code are in git, so any single skill can be reverted to an earlier version. |
| Human Review Queue (a named person and a response time) | 2 | You review everything, but there's no written queue or response time, so work waits on your availability. |
| **Maturity (lowest)** | **1** | **Rule: no new agent class goes live until every pillar is at least 3.** |

### 2.3 Miura-Ko ladder: L2 in CCTV design, L1 elsewhere

The ladder runs L0 to L5:
- **L0:** AI theater, nothing real
- **L1:** individuals use AI for their own tasks
- **L2:** a team workflow is sped up by AI
- **L3:** agents read and write the company's own records, across the business
- **L4:** the company runs on AI and compounds
- **L5:** a self-driving company, which doesn't exist yet

The CCTV design-to-proposal path is a real team workflow (**L2**). Everywhere else AI is personal productivity (**L1**). This matches the 40/80 score, so the two don't conflict.

### 2.4 Dabbling Test: likely FAIL

This test asks whether AI has changed how the company is run, not just whether people use it.
- **Check 1, the 50% time check:** has half of your working time shifted because of AI? You build tools and documents with AI, so this may pass. **[confirm]**
- **Check 2, the operating-cadence check:** have approvals, the weekly rhythm or how money is allocated changed? Not yet. Everything still routes to the GM. **Fail.**
- **The metric to track from now on:** the number of workflows that AI agents carry out safely under human command. **Today: 0.** The portal is software operated by an engineer; it is not an agent. The goal is to raise this number.

### 2.5 Third Anchor (team capacity)

Not measured. With fewer than 10 people, one overloaded person is a real risk to the plan. Ask the team one question each month ("Is your workload sustainable?", scored 1–5) and track the trend. **[confirm]**

### 2.6 Tokenmaxxing Test

This test checks whether AI is really changing the work or just speeding up the old way.

| Check | Answer | Note |
|---|---|---|
| Leaderboard: rewarding AI usage itself? | No | |
| Geometry: is AI speeding up the old flow without changing who decides? | **Yes** | AI makes documents faster, but every step still queues for the GM. |
| Latency: has lead-to-proposal become 5× faster anywhere? | Don't know | Nobody measures it. Start measuring in week 1. |

**Result: below L3.** The book's fix is redesigning who decides what (REWRITE Step 4, section 5), not buying a new tool.

---

## 3. Scorecards

### 3.1 DRIVE (speed and intelligence): 9 / 25

| Component | Score | Note |
|---|---|---|
| D, Decision Architecture | 2 | No written map of which decisions are reversible, delegated or gated. The portal does gate the stamp: Final needs explicit confirmation, a good one-way-door control. |
| R, Recursive Learning | 2 | The portal is versioned and improves, but proposal outcomes (won, lost, why) are not recorded, so sales doesn't learn. |
| I, Intelligence Stack | 1 | Separate tools, no shared log or agent list. Capped at the lowest pillar (1). |
| V, Value Moat | 2 | One durable source is emerging: **proprietary engineering data** (catalogue with datasheets, rates library, design rules) plus **curatorial judgment** (honest, traceable proposals). The rest is relationships, which fade. |
| E, Elastic Agency | 2 | Helpers and subcontractors are added job by job, ad hoc. No Capability Registry (a list of who or what can do each task). |

The GOVERN cap (13/25 maximum without basic controls) doesn't bind here, because 9 is already below it.

**Sector:** Hybrid Operations (design plus physical installation). The book's long-run mix for this sector is about **50% AI agents, 30% internal people, 20% external partners** by share of work.

**Cognitive captivity check:**
- The portal runs offline with no AI inside it, so it is not tied to any AI vendor.
- The skills are plain text files in your own repository.
- **Gap:** all agent work today uses one model family (Claude). Keep a second family available for testing before agents go live. **[confirm]**
- **Keep the jobs log in your own repo or drive, not inside a vendor's tool.** As the book says, "whoever owns the log owns the agent."

### 3.2 SHAPE (resilience): 11 / 25

| Component | Score | Note |
|---|---|---|
| S, Safe Autonomy | 2 | Every decision traces to the GM (a natural Fiduciary Wedge: every agent decision chains to a named person). But there are no written agent permissions and no tested stop switch. |
| H, Human Architecture | 2 | Capped at 2 until we write down how roles change (section 6). There is no plan to cut people; the plan is to grow without growing office headcount. |
| A, Adaptive Architecture | 3 | The portal is modular (cameras, storage, network, cabling and renovation are separate engines), offline and AI-independent. Any part can be swapped. |
| P, Purpose Control | 2 | The values and brand rules exist, but there is no purpose written as rules an AI can follow. Draft in section 4.2. |
| E, Ecosystem Trust | 2 | Trust today comes from relationships, plus traceable numbers, datasheet links and stamped finals. Nothing yet governs what partners or their systems can exchange with you. |

---

## 4. The destination (one page)

**ContracTech in 2031:** a small team of engineers who own design judgment, site work, client relationships and sign-off. Agents do the sensing, drafting and coordinating around them, and subcontractors are coordinated per job through the same system. ContracTech wins on proposals that are fast, exact and honest, backed by a growing record of every design, price and outcome. This record is the moat.

### 4.1 The Intelligence Stack for winning work

| Layer | What it does here | Starts as |
|---|---|---|
| **PURPOSE** | The rules the agents follow (section 4.2) | A file in this repository |
| **SENSE** | Spots opportunities and takes in leads: new hotels, hospitals, schools and compounds; tenders; inbound WhatsApp, email and questionnaires | A weekly opportunity digest. Lead intake from the bilingual questionnaire. |
| **INTERPRET** | Builds the job file: client, site, needs, similar past jobs, risks | Job folder plus summary |
| **DECIDE** | Bid or no-bid facts, design options, price range | **Recommend only.** You decide. |
| **ORCHESTRATE / ACT** | Runs the portal (design, BOQ), assembles the proposal, drafts follow-ups, books surveys | Drafts only, until handover |
| **LEARN** | Logs win, loss and the reason. Logs every correction you make. | Jobs log columns |
| **GOVERN / ASSURE** | Jobs log, review queue, test set, rollback | Built in weeks 1–2 |

**Minimum stack (MVIS) for week one, at ContracTech's size:**
- **Event bus:** one jobs log, one row per lead with an ID (e.g. `CT-26-031`). Every message, draft and decision carries that ID.
- **Agent registry:** a one-page list of each AI helper, its owner and what it may do. The skills live in this repo, so the list is versioned.
- **Central logging:** every AI draft saved under the job ID, together with what the reviewer changed and why.
- **One agent per class:** start with only the Wave 1 agent (section 7).

### 4.2 Purpose as rules (MTP protocol), draft for your approval

**Purpose statement, draft:** *"Every site in the Kingdom, however remote, built right and kept safe."*
"Built right" covers contracting, "kept safe" covers security systems and maintenance, and "however remote" is your coverage promise. **[confirm or rewrite]**

**Constraint Layer: what agents must never do** (on detection: refuse, log, escalate to the GM)
1. Send a price, date or commitment to a client without a named engineer's approval.
2. State a fact that isn't verified: years, project counts, certifications, partner levels, client names, or a product spec not taken from a datasheet.
3. Share site plans, camera positions, security layouts or site photos outside the job they were given for, or use them for anything else, including training outside models. **A CCTV design shows where a site is not watched; treat it as security-sensitive.**
4. Issue a Final or stamped document with sample rates, unconfirmed assumptions or open safety items.
5. Contact anyone who hasn't agreed to hear from ContracTech, or present an agent as a person. (Saudi Personal Data Protection Law, PDPL.)

**Decision Layer: how agents settle trade-offs**

| Trade-off | Rule |
|---|---|
| Safety and security vs. speed or margin | Safety and security first, always |
| Persuasion vs. honesty | State the weak point; every number traceable |
| Speed vs. completeness | Clearly labelled preliminary range within 24 h; firm price only after survey |
| Volume vs. fit | Bid where we can do the job well; recommend no-bid otherwise |
| Our preferred brand vs. client standard | Client or brand standard wins; we are brand-neutral |
| One-off margin vs. relationship | Favour the relationship (maintenance after handover) |

**Identity Layer: who this company is for, and who it isn't**
- **Why a strong engineer stays:** their judgment governs the agents, and they own a design from first visit to handover.
- **What makes their work visible:** their name is on every proposal and handover report.
- **What they get:** reach across the whole Kingdom.
- **Not for people who:**
  - quote without surveying
  - hide weak points to close a sale
  - want a big hierarchy
  - won't travel to remote sites
  - won't write down how they decide

**Litmus tests**
- **Endorsement test: pass (expected).** Scenario: "The cheapest price for 20 cameras, no visit." The agent should send a labelled preliminary range, offer a survey, and quote no firm price. You would endorse that.
- **Refusal test: pass (expected).** The agent should refuse "Auto-answer every tender" (a fit-over-volume rule) and "WhatsApp blast to a bought list" (constraint 5).
- **Identity test:** the layer above answers why people stay, what is visible, and who it is not for. **[confirm wording]**

### 4.3 Five Design Conditions (binding gate before Step 1 ends)

| Condition | Status |
|---|---|
| AI-centric workflow architecture | Holds if Wave 1 redesigns the flow, not just the documents |
| Recursive improvement infrastructure | Holds once the jobs log captures corrections and win/loss reasons |
| Model sovereignty and governed autonomy | **Amber:** a single model family today. The data and skills are owned; add a second model family before go-live. |
| Intelligence density at every layer | Track proposals per engineer per week and revenue per person |
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
| GM | Follow up after the proposal | C | 4 | agent now (drafts) |
| Engineer | Lead intake: site facts, needs, photos | C | 4 | agent now |
| Engineer | Book the site survey | C | 4 | agent now |
| Engineer | Site survey on site | J | 2 | stay human (agent preps checklist) |
| Engineer | CCTV design: cameras, storage, network, cabling | P | 4 | agent now (portal; engineer confirms) |
| Engineer | Renovation quantities and BOQ | P | 4 | agent now (portal) |
| Engineer | Price the BOQ from current supplier prices | P | 3 | pilot |
| Engineer | Request supplier quotes, check stock | C | 3 | pilot |
| Engineer | Answer client technical questions | P | 3 | pilot |
| Engineer / helper | Proposal text, cover letter, tailored one-page sheet | Cr | 4 | agent now |
| Helper | Tender paperwork compliance check | C | 3 | pilot |
| Helper | Track pipeline status | C | 5 | agent now |
| Helper | Record win / loss and the reason | C | 4 | agent now |

**Totals (18 tasks):**
- **By disposition:** agent now 9 (50%), pilot 4 (22%), stay human 5 (28%).
- **By category:** coordination 7 (39%), pattern 5, judgment 5, creation 1.
- High coordination is the book's strongest signal for a Wave 1 workflow.

**Decision map** (this fixes the Tokenmaxxing "Geometry" yes):
- **Reversible, low-risk** (agents may do after Wave 1, logged):
  - internal drafts
  - pipeline updates
  - booking a survey slot you've pre-approved
  - reminder drafts
- **One-way doors** (always the GM):
  - price
  - commitments
  - Final or stamp
  - anything sent to a client
  - bid / no-bid

---

## 6. People (SHAPE: Human Architecture)

- **Absorption math:** no reduction is planned. The aim is more proposals and faster responses with the same team. The time freed goes to site surveys, client meetings and maintenance contracts. **[confirm]**
- **Transition leader:** Eng. Turki AlTurki. **People budget:** 10–15% of measured savings, spent on training Tawfik and the engineers to supervise agents.
- **Junior loop:** if AI drafts the designs, juniors must still learn to design. Rule: a junior reviews each AI design and writes one line on what they changed and why. That builds their judgment and gives the AI training data.
- **Retention:**
  - **Consequence:** engineers govern the agents.
  - **Legibility:** their name is on proposals and handover reports.
  - **Identity:** see section 4.2.
  - **Pay:** match the market, then stop competing on pay.

---

## 7. Wave 1: lead to proposal (CCTV and security)

**Why this workflow:** high volume, clear rules, measurable, fully reversible (nothing reaches a client without approval), and the portal already does the engineering.

### 7.1 Agent spec: CT-A1 Lead-to-Proposal Assistant

- **Purpose:** turn a new security-systems lead into a complete draft proposal (job file, design, BOQ, proposal text, follow-up plan) ready for engineer review.
- **Human Owner:** Eng. Turki AlTurki
- **Autonomy Tier** (split by action class):
  - may create drafts inside the job folder without asking
  - **recommend only** for anything client-facing
  - **never:** send to a client, issue Final, change rates or the catalogue, or delete anything
- **Permission Envelope:**
  - **Reads:** the lead's messages and questionnaire file, the job folder, the portal catalogue and rates, and past proposals.
  - **Writes:** only into `jobs/<job-id>/drafts`.
  - **No access to:** email or WhatsApp sending, the stamp, the rates library, or other clients' folders.
- **Memory Boundary:** it works per job. It may look up past jobs for similar designs. It keeps nothing outside the jobs log.
- **Escalation rules** (route to the GM's review queue):
  - information missing to design an area
  - any item still marked assumed or Unverified
  - brand standard not in the catalogue
  - site outside known regions
  - preliminary value above SAR **[set threshold]**
- **Test set (Eval Suite):**
  - replay 10–20 past jobs and compare camera models, counts and BOQ quantities with what the engineer actually chose
  - floor: 90% of design items match
  - correction ceiling: 15% of line items changed by week 8; above that, the skill gets fixed
  - re-run after any skill or model change
- **Audit trail:** one log entry per run, with:
  - job ID
  - inputs
  - output files
  - skill version (git commit)
  - model version
  - reviewer
  - what changed and why
- **Reusability:** the same pattern later serves renovation proposals and maintenance quotes. Registry tags: `intake`, `design-draft`, `proposal-draft`.

### 7.2 Data the agent touches: the six questions

| Data | What is it / who says so | Allowed use | Legal terms | If wrong | Disputes |
|---|---|---|---|---|---|
| Client brief and messages | Client's own words, captured by the engineer | This job only | PDPL; client consent from the questionnaire | Engineer corrects at survey | Client's written words win |
| Site plans and photos | Client or engineer, dated | This job only; marketing only with separate opt-in | Security-sensitive; never shared outside the job | Re-survey | Survey record wins |
| Product catalogue and datasheets | Manufacturer datasheet, with the date checked | Any job | Manufacturer terms | Flag Unverified; engineer checks | Datasheet wins |
| Rates and supplier prices | ContracTech rates library, supplier quotes with dates | Pricing drafts only | Supplier terms; confidential | GM corrects before sending | Latest dated quote wins |

### 7.3 Running it in parallel (success criteria set before starting)

For 6 weeks, every new security lead goes through both paths: the normal way, and AI drafts in parallel ("shadow mode").

**Four learning feeds:**
1. Replay of past jobs
2. Side-by-side comparison on live leads
3. Every correction you make, logged with a reason. This is the most valuable data the company produces.
4. Made-up hard cases, for example:
   - number-plate reading at 30 m
   - a remote site without power
   - a hotel that requires a specific camera brand

**Success criteria:**
- **Corrections fall every week.** This is the real test. If they don't, it's automation with a chat box, not a working agent.
- Lead to proposal sent: **5× faster** than the week-1 baseline. **[baseline to measure]**
- Your editing time per proposal: **down 50%**.
- **Zero** client commitments sent without approval.
- **Zero** BOQ errors found after sending.

---

## 8. The 90-day sprint

| Weeks | Work | Done when |
|---|---|---|
| 1–2 | **Basics:** jobs log with IDs; review queue (you, 24 h response); test set from 10–20 past jobs; skills in git; purpose rules approved; baselines measured (lead-to-proposal time, editing time) | All four pillars at 3 or above |
| 3–8 | **Shadow run** of CT-A1 on every new security lead; weekly 30-minute review of corrections; fix the skill | Corrections falling for 3 weeks in a row |
| 9–12 | **Handover Wave 1:** AI drafts become the default first draft; engineers edit and approve. Start a follow-up drafter and the opportunity digest in shadow. | Success criteria in 7.3 met |
| Month 6 | Retake this scorecard; pick Wave 2 (supplier pricing and tenders) | Score and ladder re-measured |

**Lowest three dimensions to raise first:**
- Decision Autonomy
- Work Architecture
- Tacit Knowledge (getting sales and pricing judgment out of your head)

---

## What I need from you to make this final

1. Revenue band last year (sets the method's tier; assumed under about SAR 7.5M).
2. Leads per month, and roughly how many become proposals and wins.
3. Today's typical time from first contact to proposal sent.
4. Where client records live today (WhatsApp, Excel, email).
5. 10–20 past proposals or BOQs, to build the test set.
6. Has half your working time shifted because of AI? (Dabbling Test check 1)
7. Approve or rewrite the purpose statement and the five never-rules.
8. The value threshold above which every proposal escalates to you.

---

*Source: ExO 3.0 and its frameworks (DRIVE, SHAPE, the Intelligence Stack, REWRITE, MTP-as-protocol, the Four Pillars, the Appendix A diagnostics) are from* The Organizational Singularity *(OS Outline v25, June 2026) by Salim Ismail with contributors, openexo.com/organizational-singularity. The Miura-Ko ladder is by Ann Miura-Ko (Floodgate, 2026). Applied with the* building-an-exo *skill by Kent Langley for OpenExO.*
