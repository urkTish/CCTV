# About the Portal / Services

**Audience:** a business-development agent who needs to know what ContracTech
offers through this portal, what the portal can and cannot do, and how to talk
about it accurately.
**Status:** describes the platform as built on 2026-10-09 (`main` branch).

---

## 1. Who ContracTech is

ContracTech is a **security systems integrator**. It designs CCTV (video
surveillance) systems for clients and supplies the equipment and installation
for them. Its designs are built on **Hikvision** equipment.

The portal described here is ContracTech's own in-house platform. It carries the
ContracTech brand: logo, brand blue and the company stamp on approved proposals.

> **Confirm with the owner before using in outreach:** company size, years in
> business, registration, office location(s), geographic service area,
> certifications and partner status (e.g. Hikvision partner level), reference
> clients, and pricing policy. None of this is recorded in the platform, so do
> not state it as fact.

---

## 2. What the portal is, in one paragraph

The portal is a **CCTV system design and proposal tool**. A client describes the
site and what they need to see in plain language. ContracTech's engineer then
turns that into a complete, engineered design:
- the right camera models for every area
- the recorder and hard drives sized to the retention needed
- the PoE network switches
- the network cabling, down to the number of cable boxes
- a site map

It produces a **branded, print-ready proposal**. Every number in it can be traced
back to a formula or a manufacturer datasheet.

---

## 3. The three parts of the portal

### 3.1 Client questionnaire (for prospects and clients)
A six-step, **phone-friendly** questionnaire in plain, non-technical language:
1. **The premises:** name and type of site.
2. **Each area to cover:** how many cameras, and what they need to see. There are
   six illustrated choices:
   - watch general activity
   - see what people are doing
   - recognise people they know
   - clearly identify faces
   - read car number plates
   - watch a cash register
   It also asks indoors or outdoors, how dark it gets at night, and a rough
   distance.
3. **Recording:** how long to keep video, where the recorder goes, and how
   cameras get power. "Let the engineer decide" is the default.
4. **Budget.**
5. **Optional floor plan** upload.
6. **Review:** an **indicative, clearly preliminary** summary and rough estimate.

The client sends the result to ContracTech as a file or a link. There is no
automatic submission; see Limitations.

**Business-development use:**
- a lead-capture and qualification tool
- lets a prospect describe the need before the first meeting
- removes the "I don't know what I need" barrier

### 3.2 Admin workspace (for ContracTech engineers)
The engineer opens the client's answers as a **draft**. Every value the client
was not asked is flagged "assumed — please confirm" until the engineer checks it.
The workspace is organised in sections, each showing its status:

| Section | What it does |
|---|---|
| **Overview** | Project totals and every open warning, each linked to where it is fixed |
| **Site map** | Upload a floor plan or **draw the site** (see 3.4); place cameras, recorder and switches; draw cable routes |
| **Locations & cameras** | Per-area camera recommendation with alternatives and the reasons models were excluded |
| **Recording & storage** | Storage needed, recorder (NVR) choice, hard-drive set, RAID options |
| **Network** | PoE switches: how many, which model, which cameras on each |
| **Cabling** | Every cable run, standards check, and boxes to buy |
| **Bill of materials** | Every item with datasheet link; optional prices typed by the engineer |
| **Report** | The client proposal (see 3.3) |

It works on desktop and phone, in light and dark mode, and has a quick
jump-to search (Ctrl K).

### 3.3 Client proposal (the deliverable)
A **branded A4 proposal** that prints or saves to PDF. Its sections:
- cover with the ContracTech logo, client and engineer details
- executive summary
- site map with legend
- one section per area: the client's own words, the chosen camera, its
  15-field spec sheet, and why it was chosen
- recording, network and cabling
- bill of materials, priced only if the engineer entered prices
- datasheet links with **QR codes**
- assumptions and notes
- approval / sign-off block

How drafts and finals differ:
- A draft carries a "DRAFT — NOT FOR APPROVAL" watermark.
- Only a report marked **Final**, after an explicit confirmation, carries the
  ContracTech company stamp.

### 3.4 Site map and drawing tools
- **No floor plan?** Enter the building's size (e.g. 10 m × 6 m). The portal
  generates a scaled drawing area with margin around it for fences, gates and car
  parks, and draws the building outline.
- **Drawing tools:**
  - rooms and rectangles, walls and lines, curved lines (fences, kerbs)
  - doors, double doors, windows, gates
  - text labels
  - fills for building, room, car park, grass and paving
- **Have a plan?** Upload a PNG/JPG and set the scale by marking a known
  dimension, or trace over it with the drawing tools.
- **Devices on the map:** each camera shows its **field of view**, and cable
  lengths are measured from the map.
- **OpenStreetMap reference view** (optional, needs internet): measure real
  distances on a street map to set the scale.

---

## 4. What the engineering covers

These are the technical selling points. They are all calculated, not guessed.

- **Camera selection by purpose.** Detail levels follow the international CCTV
  standard IEC 62676-4 (detect / observe / recognise / identify), plus number
  plate reading and cash-register monitoring. The portal works out mounting
  geometry, lens, pixel density at the target, blind spots, night-time IR reach
  and environmental rating.
- **Honest recommendations.** Each area gets:
  - a primary model with up to three alternatives, each labelled by its
    trade-off (budget, better in low light, more flexible lens)
  - a stated **weak point**
  - a reason for every model excluded
  If nothing fits, it says which requirement is the blocker and what to change.
- **Storage and recorder sizing.**
  - recording mode (continuous, motion, scheduled), retention days, growth
    headroom and formatting overhead
  - RAID and hot-spare options
  - the drive set that physically fits the chosen recorder
- **PoE network design.**
  - port counts and spare ports, power budget with headroom
  - high-power (PTZ/heated) camera ports, uplink bandwidth
  - long-distance PoE where runs exceed 100 m
- **Cabling to the standard.**
  - runs checked against the TIA-568 limits: over 90 m flagged, over 100 m
    never passes
  - long uplinks flagged for fibre
  - cable boxes counted the way an installer cuts them, not total ÷ 305 m
  - connectors and patch cords included
- **Traceability.** Every figure has a "how this was calculated" view. Estimates
  are marked **Unverified**.
- **Real product data.** The catalogue has 38 Hikvision cameras (bullet, dome,
  turret, mini-bullet, PTZ, panoramic), 19 Hikvision recorders, 11 Hikvision PoE
  switches and 23 surveillance hard drives (Seagate SkyHawk, WD Purple). Every
  spec was read from the manufacturer's datasheet, with the link and the date it
  was checked.

---

## 5. Value proposition (how to position it)

| For the client | For ContracTech |
|---|---|
| Describe needs in plain words, on a phone, in minutes | Qualified leads arrive with structured requirements |
| A proposal that explains *why* each camera was chosen | Faster, consistent designs across engineers |
| Every spec linked to the manufacturer datasheet (QR codes) | Fewer site re-visits and change orders: cable, storage and power are sized up front |
| Clear site map showing camera coverage | Professional, branded deliverable that differentiates from "quote-only" competitors |
| Honest weak points and trade-offs, so no surprises | Accurate bill of materials, including cable boxes, connectors and patch cords |

Good-fit prospects include warehouses and logistics depots, retail with cash
registers, offices and reception areas, gated sites and car parks (number-plate
reading), schools, clinics and residential compounds. In short, any site that
needs a properly engineered multi-camera system.

---

## 6. Limitations: do not over-promise

- **Hikvision only.** The catalogue covers Hikvision cameras, recorders and
  switches, plus Seagate/WD drives. Other brands are not in the system.
- **One recorder per project.** If a project needs more, the portal says so but
  does not design the split.
- **No automatic submission.** The client sends a file or link; there is no
  online backend or customer account.
- **Prices are not built in.** The engineer types them per project. The
  questionnaire's estimate is preliminary only.
- **Floor plans must be images (PNG/JPG).** PDF plans need converting first.
- **The final design is the engineer's responsibility.** Client answers are
  treated as a draft until confirmed.
- **Runs locally in a browser.** It is not a public website. It works offline
  except for the optional street-map view.

---

## 7. Typical client journey

1. **First contact:** send the prospect the questionnaire link. Five minutes on a
   phone.
2. The prospect sends back their answers (a file or a link).
3. A ContracTech engineer opens it as a draft and confirms assumptions. A site
   visit or floor plan sharpens the map.
4. The portal designs cameras, recorder, drives, switches and cabling, and builds
   the bill of materials.
5. The engineer adds prices and generates the **draft proposal** for internal
   review.
6. The proposal is marked **Final** and stamped, then sent to the client.

---

## 8. Glossary for non-engineers

| Term | Meaning |
|---|---|
| **NVR** | Network video recorder: the box that records all cameras |
| **PoE** | Power over Ethernet: one cable carries both data and power to the camera |
| **PoE switch** | Network box that connects and powers several cameras |
| **CAT6** | The standard network cable used for cameras |
| **DORI** | Detect / Observe / Recognise / Identify: standard levels of image detail |
| **ANPR / LPR** | Automatic number-plate reading |
| **PTZ** | Pan-tilt-zoom camera that can be steered |
| **RAID** | Drive arrangement that keeps recordings if one drive fails |
| **Retention** | How many days of video are kept |
| **BOM** | Bill of materials: the full equipment list |
