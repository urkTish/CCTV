# ContracTech Portal — Civil Works, Maintenance and Renovation: Functional Specification

**Audience:** the owner of ContracTech (decisions), and the programmer who will
build it (detail).
**Status:** design proposal dated 2026-10-12. **Phase 1 (section 12, renovation
MVP) was built on 2026-10-12** with the owner's decisions recorded in section
14.1; what was built, and what is still pending, is listed in `TASKS.md`
("Renovation Phase 1") and `HANDOFF.md`. Phases 2 and 3 are not built.
**Builds on:** the CCTV portal as described in `README.md`,
`docs/about-the-portal-services.md` and `docs/uiux-audit-and-ia.md`.

> **How to read this.** The owner should read the executive summary, sections 1,
> 5 (the "after" visuals), 12 (roadmap) and 14 (open questions). The programmer
> needs everything. Throughout, **[Essential]** marks what the MVP must have,
> **[Optional]** marks what can follow, and **[Idea]** marks creative proposals
> that are not required for the product to work. Any figure that is a rule of
> thumb rather than a sourced value is marked **Unverified**, exactly as in the
> CCTV portal.

---

## Contents

0. Executive summary
1. Vision and positioning
2. Service catalogue
3. Client intake per service line
4. Site survey / engineer inspection
5. The "after" visualisation pipeline
6. Engineering and estimation
7. Maintenance module
8. Proposal and contract outputs
9. Integration with the existing portal
10. Data model
11. Roles and permissions
12. Phased roadmap
13. Risks, compliance and limits
14. Open questions for the owner
Appendix A. Glossary for non-engineers
Appendix B. Default rule-of-thumb library (all Unverified)

---

## 0. Executive summary

**What we are adding.** Three new service lines beside CCTV in the same portal:
**Renovation** (repainting, flooring, ceilings, kitchens and bathrooms, full
refurbishments), **Civil works** (a room, an extension, a villa, a small
building) and **Maintenance** (fixing and servicing MEP, HVAC and civil
defects). They share one client, one site, one floor plan and one branded
proposal style with CCTV.

**The "wow".** A client photographs their rooms on a phone, answers a short
style quiz, and within a day receives a branded proposal that shows **their own
rooms, before and after**, with a written story of the transformation, a mood
board, a colour and material schedule with real colour codes, a priced bill of
quantities, and a programme. A shareable before/after slider page lets them show
their family.

**How, without building a 3D engine.** The portal does not render anything
itself. It does three things well:
1. **Collects and structures** the facts: rooms, measurements, photos, what
   exists, what is proposed (finishes with colour codes, materials, fixtures,
   lighting), the style and mood, and **what must not change**.
2. **Assembles prompt briefs** from that data using fixed, versioned templates
   (written out in full in section 5), and hands them to an AI model. Claude
   writes the narrative, the schedules, the mood-board composition and the
   per-view image briefs; a photo-editing image model, driven by those briefs,
   produces the after images (see 5.1 for why two models).
3. **Brings the results back**, pairs each "after" with its "before" photo,
   labels every visual **Illustrative**, and puts them in the proposal.

Everything engineering — quantities, litres of paint, tiles with wastage,
concrete, blocks, AC tonnage checks, labour days — is calculated by the portal
with the formula shown, exactly as the CCTV engine does today. The AI never
produces a number that goes into a price.

**Honesty rules carried over.** Every number traceable; rules of thumb flagged
**Unverified**; client answers treated as a draft until the engineer confirms;
visuals labelled illustrative; no invented prices, certifications or code
compliance; local building codes must be confirmed by a licensed engineer.

**MVP (Phase 1), roughly 8–12 weeks of one developer** (effort L, see section
12):
- Shared project spine: one client, one site, many service lines; a project
  "line" switcher in Admin.
- Renovation client intake on a phone: rooms, photos, dimensions, style quiz,
  budget, timeline.
- Engineer survey of rooms (dimensions, openings, condition, defects) reusing the
  site-map drawing tools for floor plans.
- Quantity engine for paint, flooring/wall tiles, skirting, gypsum ceilings and
  simple demolition, with a unit-rate library typed by ContracTech.
- The visualisation **brief pack**: the portal assembles all prompts; the
  engineer runs them (copy/export to Claude and the image tool, or via API if
  the owner approves a backend); results are imported and paired.
- Branded A4 renovation proposal with before/after gallery, scope, BOQ,
  programme, exclusions, warranty and payment schedule; Draft/Final with stamp.

**Phase 2** adds civil works (structure, blockwork, concrete, MEP rough-in
quantities), MEP sizing checks, variations and handover, and good/better/best
options. **Phase 3** adds the maintenance module with a backend: fault
reporting, work orders, SLA timers, preventive schedules, asset register and a
building health score.

**The biggest owner decisions** (section 14): whether to add a backend and
customer accounts (needed for maintenance and automatic submission); which
image model to use and where client photos are processed; the currency, VAT and
rate library ownership; the jurisdiction and codes; and the warranty terms.

---

## 1. Vision and positioning

### 1.1 What the new modules are

| Module | One-line description | Main output |
|---|---|---|
| **Renovation** | Refresh or transform existing spaces, from a repaint to a full apartment or villa refurbishment | Before/after proposal with BOQ and programme |
| **Civil works** | Build new space: a room, an annex, an extension, a villa or a small multi-storey building, with its MEP rough-in | Concept visuals, structured scope, quantities, BOQ, phased programme |
| **Maintenance** | Diagnose and fix faults (corrective) and keep assets healthy (preventive) under call-outs or contracts | Work orders, service reports, PM schedules, contract proposals |
| **Shared spine** | Client, site, buildings, floors, rooms, floor plan, photos, rate library, proposal engine | One record per client and site that every line uses, CCTV included |

### 1.2 Who uses it

| User | What they do | Device |
|---|---|---|
| **Client** (homeowner, landlord, facility manager, tenant) | Describes the need, uploads photos, takes the style quiz, reviews the proposal, reports faults | Phone first |
| **Engineer** (site / estimation / design) | Surveys, confirms assumptions, specifies finishes, runs the visual brief pack, prices, issues proposals and variations | Laptop in office, phone or tablet on site |
| **Technician** | Receives work orders, records findings, photos, parts, time, client sign-off | Phone |
| **Business development (BD)** | Sends intake links, qualifies leads, tracks pipeline, spots cross-sell, presents proposals | Laptop and phone |
| **Admin** | Users, roles, rate library, templates, branding, warranty and terms text | Laptop |

### 1.3 The "wow" moments

1. **"That's my living room."** The client sees their own photo transformed,
   from the same angle, with a slider between before and after. (Essential.)
2. **"It understood my taste."** A six-card style quiz turns into a mood board
   with named colours (e.g. a real paint code), materials and a paragraph that
   uses the client's own words. (Essential.)
3. **"I can see where the money goes."** Each room shows its quantities, the
   formula behind them and its share of the price; good / better / best options
   side by side. (Essential for the BOQ; options in Phase 2.)
4. **"I know when it will be done."** A simple bar programme by room and trade,
   showing which rooms stay usable during the works. (Essential.)
5. **"They found things I didn't know about."** The survey report lists defects
   with photos (damp, cracks, unsafe wiring) and what they cost to fix now
   versus later. (Essential for renovation and maintenance.)
6. **[Idea] "Share with my family."** A private link to a before/after slider
   page that works on any phone.
7. **[Idea] "My building has a health score."** For maintenance clients, a
   0–100 score per building from asset condition, overdue PM and open defects.

### 1.4 Positioning

ContracTech already sells a CCTV proposal that explains *why* every camera was
chosen. The same promise extends to building works: **"See it before we build
it, and see why it costs what it costs."** Competitors typically send a single
lump-sum quote; ContracTech sends a visual, itemised, honest proposal.

### 1.5 What the portal builds versus what is delegated to AI

| Built into the portal (deterministic, testable) | Delegated to an AI model (creative, labelled illustrative) |
|---|---|
| Questionnaires, survey forms, photo capture and tagging | Transformation narrative in plain language |
| Floor plans (existing drawing tools), room areas and perimeters | Per-view "after" images (image model, from Claude-written briefs) |
| Quantities, wastage, units, rounding to purchasable packs | Mood-board composition and captions |
| BOQ, unit-rate library, totals, VAT, payment schedule | Style suggestions and alternative palettes ("warmer", "more modern") |
| Labour days, programme and phasing | Wording polish of the scope description, in the client's language |
| MEP sizing checks with formulas | Optional: a first-pass reading of a defect photo, always confirmed by an engineer |
| Proposal layout, Draft/Final, stamp, sign-off | — |
| Prompt assembly from templates, versioning, provenance | — |

Rule: **an AI output never feeds a quantity, price, date or compliance
statement.** If the AI suggests a material, the engineer must select it from the
portal's library before it is priced.

---

## 2. Service catalogue

Each service has a **code** (used in the BOQ, rate library and work orders), its
typical scope, and the inputs it needs. "Room" means any space record (room,
corridor, balcony, roof, façade elevation, external area).

### 2.1 Renovation (RN)

| Code | Service | Typical scope | Inputs needed |
|---|---|---|---|
| RN-PNT | Repainting (interior) | Surface prep, crack filling, primer, 2 coats emulsion; ceilings; doors and frames (enamel) | Room L × W × H, openings, surface condition, current and new colour, finish (matt/eggshell/satin), number of coats |
| RN-PNT-EXT | Exterior painting | Pressure wash, repair, primer, elastomeric or texture coats | Elevation areas, height (access/scaffold), substrate, condition |
| RN-TCH | Touch-up / make-good | Patch, sand, spot paint, sealant renewal | Defect list with photos and sizes |
| RN-FLR | Flooring | Remove old, level/screed, porcelain/marble/vinyl/SPC/parquet, skirting | Floor area, perimeter, door thresholds, existing floor, new material and tile size, pattern |
| RN-WAL | Wall finishes | Wall tiles, cladding, wallpaper, feature walls, wood panelling | Wall areas per surface, heights, material |
| RN-CLG | Ceilings | Gypsum board, suspended tiles, cornices, coves, cove lighting pockets | Ceiling area, perimeter, drop height, lighting layout |
| RN-JNR | Joinery | Doors, wardrobes, vanities, TV walls | Item list, sizes, finish |
| RN-KIT | Kitchen refurbishment | Strip-out, cabinets, worktop, splashback, sink, appliances, MEP points | Layout (L/U/galley/island), run lengths, appliances, finish choices |
| RN-BTH | Bathroom refurbishment | Strip-out, waterproofing, tiles, sanitary ware, fittings, ventilation | Room size, fixture list, waterproofing extent, wet-area plan |
| RN-FAC | Façade refresh | Cladding repair, paint, glazing seals, lighting | Elevations, photos, access constraints |
| RN-FULL | Full apartment / villa refurbishment | Combination of the above plus MEP upgrades | Everything above, room by room, plus phasing and occupancy |
| RN-LTG | Lighting upgrade | New fittings, cove/strip, dimming, scenes | Room use, target lux, ceiling type, style |

### 2.2 Civil works (CV)

| Code | Service | Typical scope | Inputs needed |
|---|---|---|---|
| CV-ROOM | Single room / annex | Foundation, blockwork, slab, finishes, MEP points | Footprint, height, location on plot, soil info (if any), use |
| CV-EXT | Extension (horizontal or vertical) | Tie-in to existing structure, new structure, finishes | Existing structure type and drawings, load capacity check by structural engineer |
| CV-VILLA | Villa / house new build | Full structure, envelope, MEP, finishes | Plot size, setbacks, floors, room programme, authority drawings |
| CV-BLDG | Small multi-storey building | Structure, envelope, MEP, lifts, fire systems | Architectural and structural drawings (mandatory), permits |
| CV-FDN | Foundations and substructure | Excavation, blinding, footings, tie beams, waterproofing, backfill | Soil report, structural drawings |
| CV-CONC | Concrete works | Columns, beams, slabs, stairs | Structural drawings, grades, rebar schedules |
| CV-MAS | Masonry / blockwork | Internal and external walls, lintels | Wall lengths, heights, block type and thickness, openings |
| CV-PLS | Plaster and render | Internal plaster, external render | Wall areas, thickness |
| CV-WP | Waterproofing | Roofs, wet areas, basements, tanks | Areas, upturn heights, system type |
| CV-ROOF | Roofing and insulation | Thermal insulation, screed to falls, membrane, tiles | Roof area, falls, drains |
| CV-SITE | Site works | Boundary walls, paving, landscaping, drainage, gates | Site plan, lengths, areas |
| CV-DEM | Demolition and strip-out | Partitions, finishes, structural (with engineer approval) | Elements, sizes, structural status |
| CV-MEP | MEP rough-in for new build | Conduits, drainage, water supply, AC drains and refrigerant routes, earthing | Room programme, fixture and point schedule |

### 2.3 Maintenance (MT)

| Code | Service | Typical scope | Inputs needed |
|---|---|---|---|
| MT-HVAC | AC and ventilation | Split/ducted/VRF/chiller service, gas top-up, coil cleaning, drain unblocking, fan repair | Asset (type, brand, capacity, location), symptom, photos, error code |
| MT-ELE | Electrical | Tripping breakers, dead sockets, lighting faults, DB inspection, earthing test | Location, symptom, DB photo, what was running |
| MT-PLB | Plumbing and drainage | Leaks, blockages, low pressure, water heaters, pumps, tanks | Location, symptom, photos/video, water meter behaviour |
| MT-CIV | Civil defects | Cracks, damp, spalling concrete, failed waterproofing, tile hollowness | Location, size, photos with scale, age, recent rain/leaks |
| MT-FIRE | Fire alarm and fire fighting | Inspection, testing, panel faults, extinguisher service | Panel type, zone, fault message; statutory schedule |
| MT-LV | Low-current | CCTV, data, access control, intercom faults | Links to the CCTV project if it exists |
| MT-PPM | Preventive maintenance contract | Scheduled visits per asset type | Asset register, frequency, SLA level |
| MT-AMC | Annual maintenance contract (comprehensive or non-comprehensive) | PPM plus call-outs, with or without parts | Site, assets, SLA, parts policy |
| MT-HANDY | Small works / handyman | Fixing doors, hanging, sealant, minor carpentry | Description and photos |

### 2.4 Cross-line packages ([Idea], sold as bundles)

| Package | Lines combined | Why it sells |
|---|---|---|
| "Move-in ready" | RN-PNT + RN-FLR + MT-HVAC service + deep clean | Landlords between tenants |
| "Safe and fresh home" | RN-FULL + CCTV + MT-ELE inspection | New owners |
| "Cool summer" | MT-HVAC service + AC tonnage check + duct cleaning | Seasonal campaign |
| "Shop fit-out" | RN-FLR, RN-CLG, RN-LTG + CCTV with cash-register camera | Retail clients (CCTV already strong here) |

---

## 3. Client intake per service line

### 3.1 Shared pattern (same as the CCTV wizard)

- One app, a new hash route per line: `#/client/renovation`,
  `#/client/build`, `#/client/fix`. `#/client` becomes a **start screen** with
  four big tiles: *Security & CCTV*, *Renovate*, *Build*, *Fix something*, and a
  fifth *Not sure — tell us what you need*.
- Progress bar ("Step 3 of 7"), Back / Next, plain language, illustrated choices,
  large tap targets, works one-handed.
- **"Not sure / let the engineer decide"** is always a choice and the default
  where a guess would be risky.
- Every answer maps to engine inputs in one mapping module per line (same idea
  as `src/client/intakeMapping.ts`); everything not asked gets a documented
  default and is recorded as **assumed — please confirm**.
- Review screen: answers, an **indicative, clearly preliminary** summary
  (e.g. "about 145 m² of walls to paint, about 9 working days") and how to send.
- Sending: in the MVP, file or link exactly as today (photos make the file
  large; the link carries no photos and says so). With a backend (owner decision,
  section 14), a *Send to ContracTech* button.
- Language: English and Arabic, right-to-left layout for Arabic. **[Essential if
  the client base is Arabic-speaking; owner to confirm.]**

**Photo guidance shown to the client** (a short illustrated card before any
photo step):
- Stand in a corner, phone at chest height, landscape, include floor and ceiling.
- Take one photo from each corner of the room (two minimum).
- Turn on the lights and open curtains.
- For a defect: one close-up with a coin or tape measure for scale, one wide
  shot showing where it is.
- Videos up to 30 s are accepted for leaks, noises and AC faults.

The portal records for each photo: room, which corner or wall it faces (chosen
from a small compass sketch), time, and the device's orientation. **Location
metadata (GPS) is stripped** on import unless the client chooses to share the
site location (privacy, section 13).

### 3.2 Renovation intake (`#/client/renovation`) — 8 steps

| Step | Question (client wording) | Choices / input | E / O |
|---|---|---|---|
| 1 About you and the place | "What kind of place is it?" | Apartment, villa/house, office, shop, restaurant/café, clinic, other | **E** |
| | "Is it occupied during the works?" | We live/work there; empty; partly | **E** |
| | Name, phone, email, area/city | Text | **E** (phone), O (rest) |
| | "How old is the building, roughly?" | Under 5 years, 5–15, 15–30, over 30, not sure | O |
| 2 What do you want to do? | "Pick everything that applies" | Illustrated tiles: Repaint, New floors, Ceilings and lighting, Kitchen, Bathroom(s), Doors and wardrobes, Full makeover, Outside of the building, Small repairs, Not sure | **E** |
| 3 Rooms | "Add each room you want to change" | Room type (illustrated: living, majlis, bedroom, kitchen, bathroom, corridor, balcony, office, shop floor, other), name, what to do in it (from step 2, pre-ticked) | **E** |
| | "Roughly how big?" | Three ways, client picks one: (a) small / medium / large pictograms with typical sizes (e.g. bedroom S ≈ 3×3 m, M ≈ 4×4 m, L ≈ 5×5 m, **Unverified defaults**); (b) type length × width (and height if known); (c) "the engineer will measure" | **E** (one of the three) |
| | Photos of the room | Camera or gallery, guided by the photo card; 2–6 per room | **E** (at least 1 per room for visuals; the client is told visuals need photos) |
| | "Anything wrong in this room?" | Tick: damp/stains, cracks, peeling paint, broken tiles, leaks, AC problems, electrical problems; optional photo | O |
| 4 Your style (the style quiz) | "Which of these rooms do you like best?" | 6 cards, pick 1–2: Modern minimal, Warm contemporary, Contemporary Arabic, Classic/Neo-classic, Scandinavian/natural, Industrial; each is an illustration with 3 words | **E** |
| | "Which colours feel like home?" | 6 palettes (warm neutrals, cool greys, earthy, white and wood, bold accent, dark and dramatic) | **E** |
| | "How should it feel?" | Pick up to 3: calm, bright, cosy, luxurious, fresh, practical, family-friendly, impressive for guests | **E** |
| | "Floors you like" | Light stone/porcelain, marble look, wood look, concrete look, keep existing | O |
| | "Anything you love or hate?" | Free text, and up to 5 inspiration photos (Pinterest/Instagram screenshots) | O |
| | "What must stay as it is?" | Tick: furniture, kitchen, floors, doors, a specific item (text) | **E** (default "nothing specified") |
| 5 Budget | "Which fits best?" | Essential refresh / Good quality / Premium finish — one sentence each, no numbers by default; optional number range field | **E** |
| 6 Timing | "When would you like to start?" and "Any date it must be finished by?" | ASAP, within 1 month, 1–3 months, later; optional date; "Are there times we can't work?" (e.g. prayer times, school hours, Ramadan hours) | **E** (start), O (rest) |
| 7 Floor plan | "Do you have a plan?" | Upload PNG/JPG (or PDF in Phase 2), photo of a paper plan, or "No" | O |
| 8 Review and send | Summary, indicative quantities and duration (labelled preliminary), privacy notice and consent for photo use (section 13) | Consent checkbox | **E** (consent) |

**Engine mapping notes.** Size pictograms map to L × W with the room type's
default height (2.8 m apartment, 3.2 m villa — **Unverified defaults**) and
default openings (one door 0.9 × 2.1 m; one window 1.5 × 1.5 m per habitable
room). All are marked **assumed**. The style quiz maps to a `StyleProfile`
(section 5.2).

### 3.3 Civil works intake (`#/client/build`) — 8 steps

| Step | Question | Choices / input | E / O |
|---|---|---|---|
| 1 About you | Contact, city/district | Text | **E** |
| 2 What do you want to build? | Illustrated: one room / annex, majlis or guest room, extension of my house, upper floor, villa / house, small building (shops/apartments), boundary wall / gate, garden works, roof works, not sure | **E** |
| 3 The plot | "Do you own the land / building?" yes / no / renting; "Approximate plot size" (L × W or m²); "Where will it be?" drop a pin (optional) and a photo of the spot | **E** (size or "not sure"), O (pin) |
| 4 The space | Floors (1–4+), rooms list (type and count), approximate size of the new space (m²), ceiling height preference | **E** (approximate) |
| 5 What exists | For extensions: photos of the existing building, its age, "Do you have the original drawings?" (upload), "Any cracks or problems?" | **E** for extensions |
| 6 Permits and drawings | "Do you have a building permit / approved drawings?" yes / in progress / no / need help; upload | **E** |
| 7 Style, budget, timing | Same style quiz as renovation (exterior cards added: modern cubic, contemporary Arabic/Najdi-inspired, Mediterranean, classic); budget band; start date | **E** |
| 8 Review and send | Preliminary area and a broad duration range only; **no price for structural work before drawings** (stated) | **E** |

Honesty line on the review screen: *"Building work needs approved drawings and a
structural design by a licensed engineer. This summary is to start the
conversation; it is not a design."*

### 3.4 Maintenance intake (`#/client/fix`) — 5 steps, designed to take under 2 minutes

| Step | Question | Choices / input | E / O |
|---|---|---|---|
| 1 What's wrong? | Illustrated categories: AC not cooling / leaking / noisy; power or lights; water leak; blocked drain; no water / low pressure; water heater; cracks or damp; doors/windows; fire alarm beeping; CCTV/intercom; other | **E** |
| 2 Tell us more | Category-specific follow-ups (table below), plus photo/video | **E** (at least the follow-ups; photo strongly encouraged) |
| 3 How urgent? | **Emergency** (danger, flooding, no power to the whole home, burning smell, sparks); **Urgent** (no AC in summer, no water, a single main circuit off); **Normal**; **Can wait / next visit** | **E** |
| | Safety prompt for emergencies | Shown immediately: "If there is smoke, sparks or a burning smell, switch off the main breaker if it is safe to do so and call the civil defence emergency number. Then call us on …" (number from Settings) | — |
| 4 Where and when | Site (pick saved site, or new address), room, access times, "Someone home?", parking/building access notes | **E** |
| 5 Review and send | Ticket summary; for contract clients the SLA response time is shown | **E** |

Category follow-ups (examples):

| Category | Follow-up questions |
|---|---|
| AC not cooling | Which unit (room, type: wall split / ceiling / ducted / window / not sure); "Is the indoor fan blowing?"; "Is the outdoor unit running?"; "Any error code on the display?" (photo); "Ice on pipes?"; "When was it last serviced?" |
| AC leaking water | Indoor unit dripping / water on wall / outdoor; since when |
| Power / lights | One socket / one room / whole home; "Did a breaker trip?" (photo of the board); "Does it trip again when switched on?"; "What was switched on at the time?" |
| Water leak | Where is the water appearing; ceiling stain below a bathroom?; "Does your water meter turn when all taps are closed?" (simple illustrated test) |
| Cracks / damp | Size (hairline / can fit a coin / wider), inside or outside, getting bigger?, near windows or bathrooms, photo with a coin |

---

## 4. Site survey / engineer inspection

### 4.1 Workflow

1. Engineer opens the client intake as a **draft** (as CCTV does today); every
   assumed value is flagged *assumed from client intake — please confirm*.
2. On site, the engineer uses the **Survey** section on a phone or tablet, room
   by room. It works offline and syncs or saves to file afterwards.
3. Floor plan: draw with the existing site-map drawing tools (rooms, walls,
   doors, windows, labels), or upload and calibrate a plan. Each drawn room
   becomes a `Room` record with its polygon, so area and perimeter come from the
   drawing; typed dimensions override.
4. Survey completion drives the section status (not started / in progress /
   complete / needs attention), as in the CCTV admin shell.

### 4.2 What is recorded per room

| Group | Fields | Notes |
|---|---|---|
| Identity | Name, type, floor, use, occupancy during works | From intake, confirmed |
| Geometry | Length, width (or polygon from plan), clear height, ceiling drop / bulkheads, wall heights if sloped | Laser distance meter values typed or (Phase 3) imported over Bluetooth |
| Openings | Per opening: type (door, window, arch, opening), wall, width, height, sill height | Deducted from wall areas |
| Surfaces | Per wall / floor / ceiling: substrate (plaster, block, gypsum, concrete, tile), current finish, colour (code if known, photo swatch), condition rating 1–5 | Rating scale in 4.3 |
| Fixed items | Kitchen units, wardrobes, sanitary ware, built-ins: keep / replace / remove | Feeds "must not change" |
| MEP inventory | Sockets, switches, light points, AC units (type, brand, capacity, age), grilles/diffusers, water points, drains, water heaters, smoke detectors, DB location | Each item can become an `Asset` |
| Moisture and structure | Moisture meter reading (%) at suspicious spots, crack width (mm) with crack gauge, hollow tiles (tap test count) | Typed values with photo |
| Photos | Survey photos by wall (compass sketch), defect close-ups with scale | Tagged automatically to room and surface |
| Access and logistics | Lift access, stair width, parking, working hours, where to store materials, nearest water and power | Feeds programme and preliminaries |
| Safety observations | See 4.5 | Mandatory section, even if "none" |

### 4.3 Condition rating scale (shared by renovation, civil and maintenance)

| Rating | Meaning | Typical action |
|---|---|---|
| 5 Good | Sound, clean, as new | None |
| 4 Fair | Minor wear, cosmetic only | Touch-up |
| 3 Worn | Visible wear, small defects | Repair and refinish |
| 2 Poor | Defects affecting use or appearance; early failure | Replace or major repair |
| 1 Failed / unsafe | Not working, or a safety risk | Urgent action; may stop works |

### 4.4 Defect record

| Field | Content |
|---|---|
| Location | Room, surface, position on plan (pin on the drawing) |
| Type | Crack (hairline < 0.3 mm, fine 0.3–1 mm, medium 1–5 mm, wide > 5 mm — classification **Unverified**, a common practical banding), damp/stain, efflorescence, spalling, peeling, hollow tile, leak, mould, corrosion, electrical, HVAC, plumbing, other |
| Measurements | Size, width, moisture %, length |
| Photos | Wide and close-up (with scale), required |
| Probable cause | Engineer's selection from a list per type (e.g. damp: rising damp, leak from above, condensation, failed external seal), with free text |
| Severity | Condition rating 1–5 |
| Recommended action | Link to a service code and BOQ item(s) |
| Fix now / can wait | Engineer's call, shown to the client with consequence of waiting |
| Needs specialist | Structural engineer, licensed electrician, civil defence-approved fire contractor, etc. |

### 4.5 Safety observations (mandatory checklist)

Each answered Yes / No / N/A, with photo if Yes:
- Exposed live conductors, missing DB covers, no RCD/RCBO protection on wet-area circuits
- Burnt or discoloured sockets / switches
- Gas appliances, smell of gas, unvented water heaters
- Structural concerns (wide or growing cracks, deflected beams, exposed corroded rebar)
- Asbestos-suspect materials in older buildings (old ceiling boards, pipe lagging) — **do not disturb; specialist survey**
- Working at height needs (façade, high ceilings, roofs without parapets)
- Fire safety: blocked exits, missing smoke detectors, expired extinguishers
- Occupants at risk during works: children, elderly, people with breathing conditions (dust and paint fumes)

A "Yes" on any item raises a **needs attention** warning that appears on the
Overview and in the proposal's notes, and some (live conductors, structural,
gas, asbestos-suspect) block a proposal from going Final until the engineer
records an action.

### 4.6 Efficient for engineers

- Room templates (bedroom, bathroom, kitchen…) pre-fill typical fields.
- "Same as previous room" for heights and finishes.
- Voice note per room, transcribed (Phase 2, [Optional]).
- Every field reachable without a pointer (table form beside the drawing), as
  in today's site map.
- Survey summary counts: rooms done, photos, defects by severity, safety flags.

---

## 5. The "after" visualisation pipeline

### 5.1 How it works, in one picture

```
 Client photos + intake + style quiz        Engineer survey + specification
              \                                     /
               v                                   v
        +-----------------------------------------------+
        |  PORTAL: structured Visual Data (5.2)         |
        |  rooms, views, existing, proposed, must-keep  |
        +-----------------------------------------------+
                          |
                          v  (fixed, versioned templates, 5.3)
        +-----------------------------------------------+
        |  BRIEF PACK  (text prompts + photo files)     |
        +-----------------------------------------------+
               |                               |
               v                               v
   Claude (text model):                Image model (photo editing),
   narrative, mood-board brief,        driven by the per-view briefs
   schedules check, per-view           Claude wrote: one "after"
   image briefs, QA review             image per before photo
               \                               /
                v                             v
        +-----------------------------------------------+
        |  PORTAL: import, pair before/after, QA,       |
        |  label "Illustrative", engineer approves      |
        +-----------------------------------------------+
                          |
                          v
          Proposal gallery, slider page, mood board
```

**Why two kinds of model.** Claude is the right tool for the words and the
structure: the narrative, the per-view image briefs, the mood-board layout and
captions, checking the schedules for consistency, and reviewing a generated
image against the "must not change" list. Producing a photorealistic edited
photograph is a job for an **image-generation / image-editing model** (the
owner chooses which; section 14). Claude can also produce a simple mood board
or colour board itself as an SVG/HTML layout from the schedule, which is useful
as a guaranteed-accurate swatch sheet. The portal treats both as pluggable
"providers" behind the same brief pack.

**Three ways to run it (owner decision, section 14):**

| Mode | How | Needs backend | When |
|---|---|---|---|
| A. Manual export | Portal exports a ZIP: prompts as text files + photos + a README; the engineer pastes into Claude and the image tool, then imports the results ZIP or files | No | **MVP default**; keeps the portal offline like today |
| B. Assisted copy | Each prompt has *Copy prompt* and *Attach these photos* buttons; results are dropped onto the view card | No | MVP, same as A with less friction |
| C. Integrated | Portal calls the AI APIs via a small ContracTech server, which holds the keys and logs usage | Yes | Phase 2/3 |

### 5.2 The Visual Data model (exactly what the portal must capture)

This is the contract between the portal and the AI. Field names are given for
the programmer; the owner can read the descriptions.

**5.2.1 `VisualProject` (one per renovation or civil proposal)**

| Field | Type | Required | Description |
|---|---|---|---|
| projectRef | text | E | Project number |
| propertyType | enum | E | apartment, villa, office, shop, restaurant, clinic, other |
| locale | text | E | Region for cultural and climate context, e.g. "Riyadh, Saudi Arabia" (owner to confirm the market) |
| language | enum | E | en / ar for narrative output |
| styleProfile | StyleProfile | E | Below |
| budgetTier | enum | E | essential / good / premium |
| clientWords | text[] | O | Short quotes from the intake ("we want it brighter", "the majlis should impress guests") |
| globalMustKeep | text[] | E | Things that must not change anywhere (e.g. "window positions", "existing marble floor in the hall") |
| rooms | VisualRoom[] | E | Below |
| brandRules | text | E (from Settings) | Fixed: no logos of third parties, no people's faces, no text on walls, illustrative label |

**5.2.2 `StyleProfile`**

| Field | Type | Required | Description |
|---|---|---|---|
| primaryStyle | enum | E | modern-minimal, warm-contemporary, contemporary-arabic, classic, scandinavian, industrial, (exterior) modern-cubic, najdi-inspired, mediterranean |
| secondaryStyle | enum | O | Blend with this, weight 30% |
| palette | enum + colour list | E | Chosen palette card and its 4–6 colours, each with a code (below) |
| moodWords | text[1..3] | E | calm, bright, cosy, luxurious, fresh, practical, family-friendly, impressive |
| likes / dislikes | text[] | O | Free text from the client |
| inspirationImages | Photo[] | O | Client screenshots; used as style reference only, never copied |
| lightingMood | enum | E (default from style) | warm 2700–3000 K, neutral 3500–4000 K, mixed scenes |
| furnitureStyle | enum | O | keep existing, suggest new in the same style, unfurnished |

**5.2.3 `VisualRoom`**

| Field | Type | Required | Description |
|---|---|---|---|
| roomId, name, type | ref / text / enum | E | Links to the survey `Room` |
| dimensions | L, W, H (m), area (m²) | E | From survey, or assumed (flagged) |
| openings | list | E | Doors and windows with wall and size; "positions fixed" unless scope changes them |
| existing | per surface: material, finish, colour (code or description), condition | E | From survey |
| proposed | per surface: material (from library), finish, colour with code, pattern/layout (e.g. 60×120 porcelain, stack bond, 2 mm joints) | E | From the engineer's specification; only library items |
| fixtures | list: item, keep / replace / new, product (library), finish | E | Sanitary ware, kitchen units, doors, wardrobes, AC indoor units, grilles |
| lighting | list: type (downlight, cove/strip, pendant, wall light, track), colour temperature (K), position notes, dimmable | E | From the lighting spec |
| furniture | keep / restyle / empty; key pieces | O | |
| mustKeep | text[] | E | Room-specific, e.g. "the window and AC unit stay where they are", "keep the dining table" |
| mustNotShow | text[] | E (defaults) | Defaults: people, pets, brand logos, readable text, views out of windows that are not the real view, structural changes not in scope |
| views | VisualView[] | E (≥1 for a visual) | Below |
| defectsFixed | Defect refs | O | So the after shows the crack gone, the stain removed |

**5.2.4 `VisualView` (one per before photo, or a plan-based view)**

| Field | Type | Required | Description |
|---|---|---|---|
| viewId | id | E | |
| source | enum | E | photo (edit an existing photo) or plan (generate from the plan, for new build or no photo) |
| beforePhoto | Photo | E if photo | Original, untouched, with orientation corrected and metadata stripped |
| facing | text | E | Which wall/corner it looks at, from the compass sketch ("from the entrance door, looking at the window wall") |
| visibleSurfaces | list | E | Which surfaces of the room are in shot, so only their proposed finishes are described |
| visibleFixtures | list | E | Same for fixtures |
| cameraNotes | text | O | "wide-angle phone photo, eye level" |
| timeOfDay | enum | E (default daytime) | daytime / evening with lights on |
| after | VisualAsset[] | — | Results, with provenance (5.5) |

**5.2.5 Colour and material codes**

- **Colours** are always stored as: a paint-system reference chosen by the
  engineer from the library (brand, collection and code as published by the
  manufacturer), plus an approximate sRGB hex for screens, plus an optional
  LRV (light reflectance value) from the manufacturer's card. NCS or RAL codes
  are recorded where the manufacturer gives them. The hex is labelled
  *"screen approximation — check the physical sample"*. Codes are **never
  invented**: if the library does not hold a colour, the engineer adds it with
  its source.
- **Materials** are library items: type, product or range name, size, finish,
  colour, supplier, datasheet link, and a photo of the sample (for the AI as a
  texture reference).

### 5.3 Prompt templates

Conventions:
- `{{field}}` is replaced by the portal from the Visual Data. `{{#each x}}…{{/each}}`
  repeats for each item. Empty optional fields remove their line.
- Every template carries a **template id and version** (e.g. `RN-NARR v1.0`);
  the version is stored with every output (provenance).
- Templates are stored as admin-editable text (Admin → Templates), with a
  preview filled from a sample project. Changes create a new version; old
  outputs keep the version they were made with.
- Outputs requested in a fixed structure so the portal can import them without
  manual cleaning (headings for the narrative; a table for schedules).

#### T0. Shared preamble (prepended to every Claude prompt)

```
You are assisting ContracTech, a contracting company, in preparing a client
proposal for {{propertyType}} works in {{locale}}.

Rules you must follow:
1. Everything you produce is an ILLUSTRATIVE concept to help the client
   imagine the result. Do not state or imply guarantees.
2. Never invent measurements, prices, quantities, durations, product
   certifications, warranty terms or building-code compliance. Use only the
   facts given below. If something you need is missing, say what is missing
   instead of guessing.
3. Use only the materials, colours and products listed in the specification.
   Refer to colours by the name and code given. Do not suggest substitutes
   unless asked.
4. Respect every "must keep" and "must not show" item.
5. Write for a homeowner, not an engineer: warm, clear, specific, no jargon.
   Language: {{language}}. If Arabic, write natural Modern Standard Arabic
   suitable for a Gulf client.
6. Do not mention AI, models or prompts in the client-facing text.
```

#### T1. Transformation narrative (`RN-NARR`, Claude)

```
{{T0}}

TASK
Write the "Your new home" narrative for the proposal: an introduction, one
short section per room, and a closing paragraph.

THE CLIENT
- Property: {{propertyType}}, {{occupancy}} during works.
- In their own words: {{#each clientWords}}"{{this}}"; {{/each}}
- Style: {{styleProfile.primaryStyle}}{{#if secondaryStyle}} with a touch of
  {{secondaryStyle}}{{/if}}.
- They want it to feel: {{moodWords}}.
- They like: {{likes}}. They dislike: {{dislikes}}.
- Budget tier: {{budgetTier}} (do not mention money).

ROOMS
{{#each rooms}}
## {{name}} ({{type}}, about {{area}} m², ceiling {{H}} m)
Today: {{existing summary, one line per surface: "walls: {{finish}} in
{{colour}}, condition {{rating}}/5"}}
Problems we will fix: {{defectsFixed as plain words}}
Proposed:
- Walls: {{proposed.walls.material}}, {{proposed.walls.colourName}}
  ({{colourCode}}), {{finish}}
- Floor: {{proposed.floor.material}} {{size}}, {{pattern}}
- Ceiling: {{proposed.ceiling}}
- Lighting: {{lighting list with colour temperature}}
- Fixtures: {{fixtures list: keep / new}}
Must stay as it is: {{mustKeep}}
{{/each}}

OUTPUT FORMAT
# Introduction (80–120 words): the overall idea in one sentence, then how it
  answers what the client asked for, quoting at most one of their phrases.
# One section per room, headed with the room name (60–100 words each):
  start with how the room will feel, then the two or three changes that make
  the biggest difference, naming the colour and material. Mention a fixed
  problem only if listed.
# Closing (40–60 words): invite the client to review the visuals and samples.
Then, separately, under the heading "MISSING OR UNCLEAR", list any fact you
needed but did not have. Write "None" if nothing.
```

#### T2. Per-view image brief, photo-based (`RN-IMG-EDIT`; Claude writes it, the image model executes it)

Step 1 is a Claude prompt that produces the brief; step 2 sends the brief and
the photo to the image model. Two steps keep the image prompt short, concrete
and in the form image models follow best, while the portal still controls the
facts.

Step 1 — Claude:

```
{{T0}}

TASK
Write an image-editing instruction for a photo-editing image model. The model
will receive the attached BEFORE photo and must return the SAME room, from the
SAME camera position, after renovation. Your instruction must be specific,
visual and short (max 180 words), followed by a separate list of things to
preserve and a list of things to avoid.

THE PHOTO
Room: {{room.name}} ({{room.type}}), about {{L}} × {{W}} m, ceiling {{H}} m.
Camera: {{view.facing}}; {{view.cameraNotes}}.
Visible in this photo: surfaces {{view.visibleSurfaces}}; fixtures
{{view.visibleFixtures}}.
Lighting state wanted: {{view.timeOfDay}}.

CHANGES TO SHOW (only those visible in this photo)
{{#each visibleSurfaces}}
- {{surface}}: from {{existing.finish}} {{existing.colour}} to
  {{proposed.material}}, colour {{proposed.colourName}} (approx. {{hex}}),
  {{proposed.finish}} finish{{#if pattern}}, {{pattern}}{{/if}}.
{{/each}}
{{#each visibleFixtures}}
- {{item}}: {{keep|replace with {{product description}}, {{finish}}}}.
{{/each}}
- Lighting: {{lighting in plain visual terms, e.g. "warm 3000 K LED cove light
  along the ceiling edge, recessed downlights"}}.
- Furniture: {{furniture rule}}.
- Defects to remove: {{defectsFixed visible here}}.
- Overall style and mood: {{primaryStyle}}, feeling {{moodWords}}.

PRESERVE EXACTLY
- Camera position, lens, perspective and framing.
- Room geometry: walls, ceiling height, door and window positions and sizes.
{{#each mustKeep}}- {{this}}{{/each}}

AVOID
{{#each mustNotShow}}- {{this}}{{/each}}
- Adding windows, doors, columns, skylights or changing the view outside.
- Text, logos, watermarks, people.

OUTPUT FORMAT
EDIT INSTRUCTION: <one paragraph>
PRESERVE: <bullets>
AVOID: <bullets>
```

Step 2 — the portal sends to the image model: the before photo, the
EDIT INSTRUCTION, PRESERVE and AVOID text, and optional texture references (the
material sample photos from the library, max 3). Requested output: same aspect
ratio and resolution class as the before photo, 2–4 variants.

#### T3. Per-room concept image, plan-based (`CV-IMG-GEN`, for new build or rooms without a photo)

```
{{T0}}

TASK
Write a text-to-image prompt (max 160 words) for an interior/exterior
architectural visualisation of a space that does not exist yet.

SPACE
{{space.name}}: {{L}} × {{W}} m, ceiling {{H}} m, {{floor level}}.
Openings: {{openings with wall and size}}.
Viewpoint: standing at {{viewpoint from plan, e.g. "the entrance door on the
south wall"}}, eye level 1.6 m, looking {{direction}}, natural lens (approx.
24–28 mm full-frame equivalent), no fisheye.
Finishes: {{proposed surfaces with colour names and approx. hex}}.
Fixtures and furniture: {{list}}.
Lighting: {{lighting}}; time: {{timeOfDay}}.
Style and mood: {{primaryStyle}}, {{moodWords}}; regional context {{locale}}
(climate-appropriate glazing and shading for exteriors).

OUTPUT FORMAT
PROMPT: <one paragraph, photographic architectural style, realistic
proportions matching the dimensions>
NEGATIVE: <bullets: people, text, logos, distorted proportions, extra floors or
openings not listed>
NOTE FOR ENGINEER: <any dimension or detail that was ambiguous>
```

The portal prints the plan-based visuals with the label *"Concept
visualisation — not based on a photograph of your site"*.

#### T4. Mood board (`RN-MOOD`, Claude)

```
{{T0}}

TASK
Compose a one-page mood board for the {{scope: whole home | room name}}.

INPUTS
Style: {{primaryStyle}} / {{secondaryStyle}}; mood {{moodWords}}.
Palette (use only these, in this order of dominance):
{{#each palette}}- {{name}} {{code}} (approx. {{hex}}, LRV {{lrv}}) — used on
  {{where}}{{/each}}
Materials (use only these): {{#each materials}}- {{name}}, {{finish}},
  sample photo {{fileRef}}{{/each}}
Lighting: {{lighting summary}}.
Client inspiration notes: {{likes}}; avoid {{dislikes}}.

OUTPUT FORMAT
1. TITLE: 3–6 words naming the concept (e.g. "Calm Desert Light").
2. CONCEPT LINE: one sentence.
3. LAYOUT: a 3 × 3 grid. For each cell: cell number, content type
   (colour swatch / material sample photo by fileRef / lighting mood image
   brief / furniture or fixture image brief), and a caption of max 8 words.
   Colour swatches must quote name and code exactly.
4. PROPORTION BAR: the palette as percentages of visible surface
   (approximate, e.g. 60 / 30 / 10).
5. Optional: an SVG of the board using only the given hex values and
   placeholders for photos (the portal replaces placeholders with the sample
   photos).
```

The portal renders the board itself from the LAYOUT (cells with real swatches
from the library and real sample photos) so colour swatches are never
AI-painted. Only the "mood image" cells use generated images.

#### T5. Material and colour schedule check (`RN-SCHED`, Claude)

The schedule itself is produced **by the portal** from the specification (it
is data, not creativity). Claude is asked to check it and write the client
captions.

```
{{T0}}

TASK
Review this finishes schedule for consistency and write a one-line client
caption for each row. Do not change any code, product or quantity.

SCHEDULE
| Ref | Room | Surface | Material / product | Colour name | Code | Finish | Size / pattern |
{{#each scheduleRows}}| {{ref}} | {{room}} | {{surface}} | {{product}} | {{colourName}} | {{code}} | {{finish}} | {{size}} |{{/each}}

Style intent: {{primaryStyle}}, mood {{moodWords}}.

OUTPUT FORMAT
CAPTIONS: a table with columns Ref | Caption (max 12 words).
CONSISTENCY NOTES: bullets for anything that looks inconsistent with the
style intent or with other rows (e.g. a cool grey grout with warm beige
tiles; gloss paint on a ceiling; three different whites in one room). For
each note, say which rows and why. Write "None" if none.
```

Consistency notes are shown to the engineer only, never to the client.

#### T6. Iteration with the client (`RN-ITER`, Claude then image model)

```
{{T0}}

TASK
The client reviewed the visual for {{room.name}} (view {{viewId}}) and asked:
"{{clientFeedback}}". Interpreted as: {{feedbackChips, e.g. "warmer",
"more modern", "lighter floor", "less busy"}}.

Current specification for this room: {{proposed summary}}.
Library alternatives the engineer allows for this change:
{{#each allowedAlternatives}}- {{surface}}: {{option}} ({{code}}){{/each}}

1. Choose the smallest set of changes, ONLY from the allowed alternatives,
   that answers the feedback. Explain each in one plain sentence for the client.
2. Write the revised EDIT INSTRUCTION / PRESERVE / AVOID (same format as
   RN-IMG-EDIT), starting from the ORIGINAL before photo, not the previous
   after image.
3. List any feedback you could not answer with the allowed alternatives, so
   the engineer can add options.
```

Feedback chips offered in the portal (client or engineer taps them): *Warmer*,
*Cooler*, *Lighter*, *Darker*, *More modern*, *More classic*, *More cosy*,
*More luxurious*, *Simpler / less busy*, *More contrast*, *Different floor*,
*Different accent colour*, plus free text. Each chip maps to an
engineer-curated set of `allowedAlternatives` (e.g. *Warmer* → paint from the
warm-neutral family, 2700 K lighting, wood-look floor options).

#### T7. Good / better / best variants (`RN-GBB`, Claude; Phase 2)

```
{{T0}}

TASK
Present three options for {{scope}}. The engineer has already specified and
priced them; describe them, do not price them.

GOOD: {{specification summary}}  (portal total: shown separately)
BETTER: {{specification summary}}
BEST: {{specification summary}}

For each option write: a name (2–3 words), what the client gets (3 bullets),
what changes visibly compared with the previous option (1 sentence), and who
it suits (1 sentence). Then write one neutral sentence that helps the client
choose, without pushing the most expensive option.
```

The portal renders the after images for each tier from the same before photo
(three runs of T2), so the client compares like with like.

#### T8. Visual QA review (`RN-QA`, Claude with vision; internal only)

```
{{T0}}

TASK
Compare the BEFORE photo and the generated AFTER image (both attached).
Answer each check with PASS, FAIL or UNSURE and a short reason:
1. Same camera position and perspective.
2. Walls, ceiling height, doors and windows unchanged in position and size.
3. Each "must keep" item is present and unchanged: {{mustKeep}}.
4. No "must not show" item appears: {{mustNotShow}}.
5. Proposed finishes visible and plausibly matching: {{visible proposed
   finishes with names and approx. hex}}.
6. Nothing added that is not in scope (new openings, extra fixtures,
   structural changes, unrealistic views outside).
7. No people, text, logos or watermarks.
8. Overall realism: proportions believable for a room of {{L}} × {{W}} × {{H}} m.
Finally: RECOMMEND = USE / REGENERATE / NEEDS ENGINEER LOOK, and if REGENERATE,
one sentence to add to the edit instruction.
```

A visual cannot be marked *approved for proposal* while any check is FAIL
unless the engineer overrides with a reason (recorded).

### 5.4 Pairing before and after, and what goes in the proposal

- **Pairing key:** each after image belongs to exactly one `VisualView`, which
  belongs to one before photo (or to a plan viewpoint). Iterations are stored
  as versions; one version per view is marked *selected*.
- **Display:** side by side on A4 (before left, after right, same size and
  crop), or as a slider on screen and on the share page. Never crop the after
  differently from the before.
- **Proposal content per room:** the selected pair(s) (max 2 per room in the
  printed proposal, all on the share page), the room narrative section, the
  finishes for that room from the schedule with swatches, and the room's BOQ
  subtotal.
- **Mood board:** one page after the executive summary.
- **What is not shown:** QA notes, consistency notes, rejected variants,
  prompts.

### 5.5 Honesty rules for visuals (enforced by the portal)

1. Every after image carries a **visible label** burned into the corner on
   export and printed under it: *"Illustrative visual — for guidance only.
   Actual colours, materials and finishes may differ. Refer to the samples and
   the schedule."* (Arabic equivalent when the proposal is Arabic.)
2. Plan-based visuals: *"Concept visualisation — not based on a photograph of
   your site."*
3. The proposal's terms include a clause that visuals are not contractual; the
   **schedule and the BOQ are** (owner to confirm wording with legal advice).
4. The before photo is never edited, enhanced or retouched.
5. **Provenance** stored for every visual: template id and version, provider
   and model name, date, the exact prompt text, inputs (photo ids), variant
   number, QA result, who approved it. Shown in Admin on a "how this was made"
   disclosure, mirroring the "how this was calculated" view.
6. Furniture and décor shown but not in scope are captioned *"furniture for
   illustration, not included"* when the scope has no furniture.
7. A visual cannot show anything that is not in the specification. QA check 6
   enforces this, and the engineer approves each one.

### 5.6 Iteration flow with the client

1. Proposal sent (Draft or Final). Share page shows sliders.
2. Client taps a feedback chip or types a comment on a view (share page, or
   via the engineer in a meeting on a tablet).
3. Engineer reviews, picks allowed alternatives, runs T6, QA (T8), approves.
4. If a change alters the specification, the BOQ updates automatically and the
   proposal becomes a new **revision** (Rev A, Rev B…), with a change summary.
5. Limit: the number of free iterations per proposal is a setting (default 2
   rounds, owner to confirm), shown to the client so expectations are clear.

### 5.7 [Idea] Creative extras

- **Before/after slider share page** — private link, expires after N days,
  no prices unless the engineer ticks "include price".
- **Style quiz as a lead magnet** — a 60-second public quiz that ends with "your
  style is Warm Contemporary" and a sample mood board, then invites the
  renovation intake.
- **Day and night views** — the same after view with evening lighting scenes,
  which sells lighting upgrades.
- **Sample box** — the schedule produces a pick list for physical samples to
  bring to the client meeting.
- **Arabic and English side-by-side narrative** for family decision-makers.

---

## 6. Engineering and estimation

### 6.1 Principles (same as the CCTV engine)

- Pure calculation functions, no UI; every result object carries the formula
  as applied, its inputs, the source of each constant, and an **Unverified**
  flag for rules of thumb. The UI shows a *"how this was calculated"*
  disclosure on every figure.
- All constants live in one **rule library** (Appendix B), editable by Admin,
  each with: value, unit, source (manufacturer TDS / standard / company
  practice / rule of thumb), date, and Unverified yes/no. A product's own
  datasheet value (e.g. a paint's spreading rate) always overrides the generic
  rule.
- Quantities are computed net, then wastage is added, then rounded **up** to
  purchasable units (cans, boxes, bags, boards, trucks). Both the net and the
  purchased figure are shown, as the CCTV cabling shows boxes next to the naive
  total.
- Nothing fails silently: missing inputs produce a named warning that links to
  the field to fix ("Bedroom 2 has no ceiling height; default 2.8 m assumed —
  please confirm").
- Measurement convention (whether small openings are deducted, how skirting is
  measured) is a project setting with a documented default, because practice
  differs between markets and contracts.

### 6.2 Geometry shared by all lines

For a rectangular room of length L, width W, clear height H (metres):

| Quantity | Formula | Notes |
|---|---|---|
| Floor area A_f | L × W (or polygon area from the drawn plan) | The drawing tools already compute room areas |
| Perimeter P | 2 × (L + W) (or polygon perimeter) | |
| Gross wall area A_wg | P × H | |
| Opening area A_o | Σ (w_i × h_i) | Default: deduct openings ≥ 0.5 m² (setting; **Unverified** convention) |
| Net wall area A_w | A_wg − A_o | |
| Ceiling area A_c | A_f (flat), plus bulkhead faces | Bulkheads: length × drop added as vertical faces |
| Skirting length S | P − Σ door widths | |

**Worked example used below** — Bedroom 5.0 × 4.0 m, H = 2.8 m, one door
0.9 × 2.1 m, one window 1.5 × 1.5 m:
A_f = 20.0 m²; P = 18.0 m; A_wg = 50.4 m²; A_o = 1.89 + 2.25 = 4.14 m²;
A_w = 46.26 m²; A_c = 20.0 m²; S = 18.0 − 0.9 = 17.1 m.

### 6.3 Renovation quantities

**Paint (walls, ceilings).**

> Litres = Area × Coats ÷ Spreading rate (m²/L per coat) × (1 + waste)

- Spreading rate from the selected product's TDS. Generic default if none:
  emulsion 10–12 m²/L per coat on smooth primed plaster, use 10 for
  calculation; primer/sealer 8–10 m²/L, use 8 (**Unverified**). Rough or porous
  surfaces: × 0.8 on the spreading rate (**Unverified**).
- Coats: default 1 primer + 2 finish on new or repaired surfaces; 2 finish only
  on sound, same-colour repaint; +1 finish coat when going from dark to light
  (engineer setting).
- Waste: 5% (**Unverified**).
- Packs: from the product's pack sizes (e.g. 18 L, 3.6 L, 1 L); choose the
  combination with the least leftover, preferring fewer packs; if prices are
  entered, the cheapest combination.
- Example walls: 46.26 × 2 ÷ 10 × 1.05 = **9.7 L** finish → 3 × 3.6 L
  (10.8 L) with packs of 18 / 3.6 / 1 L, or part of an 18 L pack if other
  rooms share the colour (the portal aggregates by product
  and colour across rooms before choosing packs). Primer: 46.26 × 1 ÷ 8 × 1.05
  = 6.1 L.
- Filler / crack repair: from defect lengths (m) × product consumption, or an
  allowance in m² of "repair" (engineer typed).

**Floor and wall tiles.**

> Tiles = ceil( Area × (1 + waste) ÷ (tile length × tile width) )
> Boxes = ceil( Tiles ÷ tiles per box )

- Waste by layout (**Unverified**, common practice): straight lay 7%,
  brick/offset 10%, diagonal 15%, herringbone 15–20%; +3% for rooms with many
  cut-outs; large format (≥ 120 cm) +2%. Spare for future repairs: optional
  extra box (setting).
- Example floor, 60 × 60 cm straight: 20.0 × 1.07 ÷ 0.36 = 59.4 → **60 tiles**;
  4 per box → **15 boxes** (21.6 m²).
- **Adhesive (kg)** = Area × consumption (kg/m²) from the adhesive TDS for the
  trowel notch; generic default 5 kg/m² for 10 mm notch, +1.5 kg/m² when
  back-buttering large format (**Unverified**). Bags = ceil(kg ÷ bag size).
- **Grout (kg/m²)** = (A + B) ÷ (A × B) × C × D × ρ, with A, B tile sides
  (mm), C joint width (mm), D joint depth ≈ tile thickness (mm), ρ ≈ 1.6
  kg/dm³ (a standard formula published by grout manufacturers; ρ from the
  product TDS). Example 600 × 600, C = 3, D = 10: (1200 ÷ 360 000) × 3 × 10 ×
  1.6 = **0.16 kg/m²** → 3.2 kg for the room (+10% waste).
- Skirting: S × (1 + 5%) ÷ piece length, rounded up.
- Tile trims / profiles: by edge length (external corners, tile-to-floor
  transitions) typed or picked on the plan.

**Gypsum board ceilings.**

> Boards = ceil( A_c × (1 + 10%) ÷ board area )

- Board 1.2 × 2.4 m = 2.88 m²; 10% waste **Unverified**. Example:
  20 × 1.1 ÷ 2.88 = 7.6 → **8 boards**.
- Perimeter angle = P; framing (main channels, furring, hangers), screws,
  tape and joint compound per m² from the chosen system manufacturer's
  installation guide (library item per system). Cove pockets and bulkheads:
  length × girth as extra board area.

**Other renovation items** (all quantity = measured unit, from the plan or
typed): demolition and removal (m², m³ of debris with a bulking factor 1.3
**Unverified**, skip/truck count), doors (no.), wardrobes (linear metre or
m² of front), kitchen units (linear metre base and wall), worktop (linear
metre and cut-outs), sanitary ware (no.), sealant (m), wallpaper (rolls =
ceil(wall perimeter to cover ÷ roll width) × drops per roll, accounting for
pattern repeat).

### 6.4 Civil quantities

**Blockwork.**

> Blocks per m² = 1 ÷ ((block length + joint) × (block height + joint))
> Blocks = ceil( Net wall area × blocks per m² × (1 + waste) )

- 400 × 200 mm face, 10 mm joints: 1 ÷ (0.41 × 0.21) = **11.6 blocks/m²**.
  Waste 5% (**Unverified**).
- Example wall 10 m × 3 m with one door: (30 − 1.89) × 11.6 × 1.05 = 342.4
  → **343 blocks**.
- Mortar: per m² by block thickness from the library (generic 0.02–0.03 m³/m²
  for 200 mm hollow block, **Unverified**), converted to cement and sand by the
  mix ratio (below).
- Lintels: one per opening, length = opening width + 2 × bearing (default
  200 mm each side, **Unverified**; the structural engineer confirms).

**Plaster / render (site-mixed).**

> Wet volume = Area × thickness
> Dry volume = Wet volume × 1.27 (dry-volume factor, **Unverified**; 1.27–1.33 in common use)
> For mix 1 : n (cement : sand by volume): cement volume = Dry ÷ (1 + n);
> sand volume = Dry × n ÷ (1 + n)
> Cement bags = ceil( cement volume × 1440 kg/m³ ÷ 50 kg )

- Defaults: internal 15 mm, external 20 mm, mix 1:4 (**Unverified**;
  specification governs). Example 46.26 m² × 0.015 = 0.694 m³ wet → 0.881 m³
  dry → cement 0.176 m³ = 254 kg → **6 bags**; sand 0.705 m³.
- Pre-mixed plaster: kg = Area × thickness (mm) × consumption (kg/m²/mm from
  TDS).

**Concrete.**

> Volume = Σ element L × W × D (per element type)
> Order volume = Volume × (1 + 3–5% waste, **Unverified**), rounded up to the
> supplier's increment (setting, e.g. 0.5 m³)

- Example slab 5 × 4 × 0.15 m = 3.0 m³ → 3.15 → **3.5 m³ ordered**.
- Formwork (m²) = contact area: slab soffit + edges (20 + 18 × 0.15 = 22.7 m²);
  beams: (2 × depth below slab + width) × length; columns: perimeter × height.
- **Reinforcement**: before structural drawings, a **budget only** estimate
  from kg/m³ ratios per element (e.g. slabs 80–120, beams 120–180, columns
  150–250, footings 60–100 kg/m³, all **Unverified** rules of thumb), shown
  with a red "budget only — replaced by bar bending schedule" label. Once a
  BBS exists, its total replaces the ratio.
- Concrete grade, cover and curing are taken from the structural drawings; the
  portal stores them and never chooses them.

**Excavation and backfill.** Excavation volume = (footing L + 2 × working
space) × (W + 2 × working space) × depth (working space default 0.3 m,
**Unverified**); disposal = excavated − backfill, × bulking factor 1.25
(**Unverified**); truck loads = ceil(disposal ÷ truck capacity).

**Screed.** Volume = A_f × thickness (default 50 mm, **Unverified**), with
falls in wet areas: average thickness used.

**Waterproofing.** Area = floor + upturn (P × upturn height; default 300 mm
on wet-area walls, shower walls to 1.8 m — **Unverified**, local code and the
system's manufacturer govern) + overlaps 10%. Litres = area × coats × L/m² per
coat (TDS). **Flood test 24–48 h** (**Unverified**) is added to the programme
as a hold point.

### 6.5 MEP sizing checks (checks, not designs)

The portal performs **sanity checks** that flag likely problems and support a
conversation. Final MEP design for new builds, ducted systems, distribution
boards and fire systems is done by a qualified engineer to local codes; the
portal says so next to every check.

**AC capacity (split units, quick check).**

> Required ≈ A_f × q (W/m²) × modifiers + extra occupants × 150 W
> TR = W ÷ 3517 (1 TR = 3.517 kW = 12 000 BTU/h, exact by definition)

| Room use (hot-arid climate, typical insulation) | q, W/m² (**Unverified**) | ≈ m² per TR |
|---|---|---|
| Bedroom | 230–290 | 12–15 |
| Living / family | 260–320 | 11–13.5 |
| Majlis / high occupancy | 300–380 | 9–12 |
| Kitchen | 320–400 | 9–11 |
| Office | 230–290 | 12–15 |

Modifiers (**Unverified**): top floor under an uninsulated roof +15%; large
west- or south-facing glazing +10%; ceiling over 3.2 m +10%; extra occupants
above two (bedroom) or the room's design count: +150 W each.

Example bedroom 20 m², middle floor: 20 × 230–290 = 4.6–5.8 kW =
1.31–1.65 TR → **suggested 18 000 BTU/h (1.5 TR) or 24 000 (2 TR) if on the top
floor**. Verdict against the installed unit: *undersized* if installed <
0.9 × low end; *oversized* if > 1.3 × high end (oversizing causes short-cycling
and poor dehumidification); otherwise *within range*. Ducted, VRF and chilled
water: "requires heat-load calculation" (e.g. ASHRAE method or software),
and the portal records the engineer's figure instead.

**Ventilation (quick check).** Whole-dwelling outdoor air per ASHRAE 62.2
(metric form): Q (L/s) = 0.15 × floor area (m²) + 3.5 × (bedrooms + 1).
Local exhaust: bathroom 25 L/s intermittent, kitchen 50 L/s intermittent
(ASHRAE 62.2). Sourced, but **local code to be confirmed**; shown as a
comparison with the fans specified.

**Lighting (lumen method).**

> N = (E × A) ÷ (Φ × UF × MF)

E target illuminance (lux), A area (m²), Φ lumens per luminaire (from the
product datasheet), UF utilisation factor (default 0.6, **Unverified**), MF
maintenance factor (default 0.8, **Unverified**). Default targets
(**Unverified** for homes; EN 12464-1 governs workplaces): living 200, bedroom
150, kitchen worktop 300–500, bathroom 200, office desk 500, corridor 100.
Example living 20 m², 200 lux, 800 lm downlights: 4000 ÷ 384 = 10.4 →
**11 downlights** (or fewer with cove lighting counted, its lumens per metre
from the datasheet).

**Electrical (inventory and load checks).**
- Circuit current I = P ÷ (V × PF) for single phase (V from Settings; PF
  default 0.9 for mixed loads, **Unverified**). Compares against the existing
  breaker rating recorded in the survey and flags "load near or above breaker
  rating" at > 80%.
- AC circuits: each split unit's rated current from the unit datasheet,
  checked against its dedicated circuit.
- Wet-area circuits without RCD/RCBO protection: always flagged.
- Socket and lighting point counts per room versus a company guideline
  (setting, **Unverified**).
- Breaker and cable sizing are **not** designed by the portal; they are
  recorded from the licensed electrician's design (e.g. to IEC 60364-based
  local regulations).

**Plumbing (quick checks).** Drain falls recorded and compared with a
guideline (e.g. 1:40 to 1:80 for 100 mm drains, **Unverified**, local code
governs); water heater storage ≈ 40–50 L per person (**Unverified**);
fixture count per bathroom used for the BOQ.

### 6.6 BOQ structure

| Level | Example | Notes |
|---|---|---|
| Bill (line) | Renovation / Civil / Maintenance contract / CCTV | One proposal can hold several bills |
| Section | 01 Preliminaries, 02 Demolition, 03 Civil repairs, 04 Waterproofing, 05 Floor finishes, 06 Wall finishes, 07 Ceilings, 08 Joinery, 09 MEP – electrical, 10 MEP – plumbing, 11 MEP – HVAC, 12 Painting, 13 Fixtures, 14 Cleaning and handover | Toggle view: **by trade** (for the engineer and contract) or **by room** (for the client) |
| Item | RN-FLR-0042 "Supply and lay porcelain 60×60, straight lay, 3 mm joints, incl. adhesive and grout" | Code from the rate library |
| Fields | Ref, description, room(s), unit, quantity (with trace), rate, amount, source of rate, notes | Quantity links to its calculation |
| Special items | Provisional sums, prime-cost (PC) sums for client-chosen items (e.g. sanitary ware allowance), daywork rates, contingency % | Clearly named so the client understands them |
| Totals | Subtotal per section → preliminaries → overhead & profit (if not in rates) → discount → VAT (rate from Settings) → total | Currency from Settings |

### 6.7 Unit-rate library

- A rate is **built up**: materials (quantity per unit × material price,
  including waste) + labour (hours per unit × hourly cost) + plant/tools +
  sub-contract, then overhead and profit %. The build-up is visible to the
  engineer, hidden from the client.
- Each rate has: code, description, unit, build-up, **source** (supplier quote
  ref, past project, estimator judgement), **date**, validity (days), owner.
  A rate older than its validity shows "**Rate may be out of date**". A rate
  with no source shows **Unverified**.
- Prices are **never invented by the portal or the AI**. An empty library rate
  makes the BOQ "incomplete" with the reason, as the CCTV BOM does today.
- Market variants: rates can have regional overrides (city) — Phase 2.
- Import/export the library as a spreadsheet so the estimator can maintain it
  in Excel (Phase 2).

### 6.8 Labour, duration, phasing and programme

> Duration (days) = Quantity ÷ (Productivity per worker-day × Crew size),
> rounded up to half days, plus hold times

Default productivities (**Unverified**, editable, per trade):

| Activity | Unit | Per worker-day |
|---|---|---|
| Paint, rolled walls, per coat | m² | 30–40 |
| Surface preparation and filling | m² | 25–40 |
| Floor tiling 60×60 | m² | 10–15 |
| Floor tiling ≥ 120 cm large format | m² | 6–10 |
| Wall tiling | m² | 6–10 |
| Gypsum ceiling (board, with framing), per 2-person team | m² | 12–18 |
| Blockwork 200 mm | m² | 10–12 |
| Internal plaster | m² | 12–18 |
| Screed | m² | 30–50 |
| Waterproofing (liquid, per coat) | m² | 40–60 |

Hold times (**Unverified**, and product TDS governs): paint recoat 2–4 h;
tile adhesive to grout 24 h; waterproofing flood test 24–48 h; screed before
tiling ≥ 3–7 days depending on product; concrete slab formwork striking 7–14
days, curing ≥ 7 days.

**Standard sequence (renovation)**, used to build a simple dependency chain:
protection and set-up → strip-out → MEP first fix → civil repairs / plaster →
waterproofing → flood test → screed → ceiling framing → MEP in ceilings →
boarding → tiling → joinery → first paint coats → fixtures and second fix →
final paint coat → snagging → cleaning → handover.

**Phasing** for occupied homes: the engineer groups rooms into phases (e.g.
"Phase A: bedrooms 1–2; family moves to the majlis"); the programme shows,
per day, which rooms are unusable. Working-time restrictions from the intake
(prayer times, quiet hours, Ramadan hours) reduce the effective hours per day
(setting).

**Programme output**: a bar chart (Gantt) per room and per trade, with
milestones (start, flood test, handover) and the payment milestones linked to
it. The portal does not do resource levelling in the MVP; the engineer can
drag bars and set crew sizes.

**Civil**: same mechanism with civil activities (excavation, footings,
columns, slabs per floor, blockwork, MEP rough-in, plaster, finishes), and
permit / inspection hold points as milestones the engineer dates manually.

### 6.9 What the portal sources and what it does not

| Figure | Status |
|---|---|
| Geometry (areas, perimeters, volumes) | Calculated from measured inputs (traceable) |
| Product consumption, spreading rates, pack sizes | Sourced from the product's TDS in the library (link and date) |
| Grout formula, lumen method, TR conversion, ASHRAE 62.2 rates | Sourced (published formula / standard) |
| Waste %, productivities, W/m² for AC, kg/m³ rebar ratios, dry-volume factor, default heights and openings | **Unverified** rules of thumb |
| Unit rates | Sourced only when they carry a supplier or project reference; otherwise **Unverified** |
| Structural sizes, rebar, cable and breaker sizes, fire systems | **Not calculated**; recorded from licensed engineers' designs |

---

## 7. Maintenance module

> **Dependency:** fault reporting by tenants, SLA timers, technician dispatch
> and history need data that is shared between people in real time. That
> requires a **backend with accounts** (owner decision, section 14). Without
> it, only the survey-style "inspection report" and PM schedule documents can
> be produced, as files. The roadmap places the full module in Phase 3.

### 7.1 Fault reporting (client or tenant)

- Entry points: the `#/client/fix` wizard (3.4); a **QR sticker** on each asset
  (AC unit, DB, pump, fire panel) that opens the wizard pre-filled with the
  asset and site **[Idea, high value]**; phone call logged by admin; WhatsApp
  or email forwarded and logged by admin (manual in Phase 3; integration later).
- Captured: category, sub-category, description, photos/video, urgency, site,
  unit/room, asset (if known), access times, contact, consent.
- Immediate acknowledgement with ticket number and, for contract clients, the
  SLA response target.

### 7.2 Triage and diagnosis

1. **Auto-priority** from category × urgency answer × safety keywords (e.g.
   "sparks", "smoke", "flooding" → P1). The dispatcher confirms or changes it.

| Priority | Examples | Response target (default, contract-dependent) | Fix / make-safe target |
|---|---|---|---|
| P1 Emergency | Sparks, burning smell, major leak, total power loss, fire alarm fault in occupied building | 2 h | Make safe 4 h |
| P2 Urgent | AC failure in summer, no water, one main circuit off | 8 h | 24 h |
| P3 Normal | Dripping tap, single light out, minor leak | 2 working days | 5 working days |
| P4 Planned | Cosmetic, next PPM visit | Next visit | Next visit |

Targets are **defaults to be set by the owner** per contract; they are not
promises until written into a contract.

2. **Diagnosis checklists** per category, used by the technician on the phone,
   each step with Yes/No/value and photo. Example — *AC not cooling (split)*:
   - Thermostat set below room temperature, mode = cool, filter condition
   - Indoor fan running? Outdoor unit compressor and fan running?
   - Supply air temperature and return air temperature (°C); ΔT recorded
     (typical 8–14 °C for a healthy split, **Unverified**)
   - Coil condition (dirty / iced), drain line clear
   - Operating pressures (by refrigerant type) and amps vs nameplate
   - Error code (photo) → looked up in the brand's code table (library, Phase 3)
   - Outcome: cause (filter, gas leak, capacitor, fan motor, PCB, undersized
     unit → link to the AC capacity check), action, parts.

   Other checklists: tripping breaker (isolate circuits one by one, insulation
   resistance test by a qualified electrician, RCD trip test), water leak
   (meter test, pressure test, moisture mapping), damp (moisture readings,
   source: rising / penetrating / condensation / plumbing), cracks (width,
   pattern, monitoring with tell-tales over weeks).
3. **AI assist [Optional, Phase 3]**: Claude reads the client's description and
   photos and suggests the likely category, questions to ask and parts to bring.
   It is labelled "suggestion", is shown only to staff, and never closes or
   prices a job.

### 7.3 Work orders

| Field | Content |
|---|---|
| WO number, type | Corrective / preventive / inspection / quotation visit / warranty call-back |
| Links | Site, unit, room, asset(s), originating request, contract |
| Priority and SLA | Targets and live timers: response, arrival, make-safe, fix |
| Assignment | Technician(s), skill required (HVAC, electrical, plumbing, civil, fire, low-current), scheduled slot |
| Execution | Arrival/departure time (tap, optional location check-in with consent), checklist results, findings, photos before/after, parts used (from stock list), labour hours |
| Outcome | Fixed / temporary fix / needs quote / needs parts / no fault found; follow-up WO |
| Client sign-off | Name, signature on phone, rating 1–5, comment |
| Billing | Under contract / chargeable (rates from library) / warranty |

States: New → Triaged → Scheduled → En route → On site → On hold (parts /
access / quote approval) → Completed → Signed off → Invoiced / Closed.
Every state change is time-stamped (for SLA reports).

**Technician assignment**: a dispatcher board (by day and technician) with
skill matching and distance hints. Automatic assignment is **not** in scope;
suggestions only.

### 7.4 Preventive-maintenance schedules

Templates per asset type, each task with frequency, checklist and estimated
time. Frequencies below are typical industry practice and **Unverified**; the
manufacturer's manual and local regulations govern (fire systems especially
are statutory).

| Asset type | Task | Default frequency |
|---|---|---|
| Split / ducted AC | Filter clean, drain check, visual | Monthly (dusty climate) to quarterly |
| Split / ducted AC | Coil clean, electrical check, amps, ΔT, refrigerant check | 6-monthly (before summer essential) |
| VRF / chiller / AHU | Manufacturer service routine | Per manual, typically quarterly |
| Fresh-air / exhaust fans | Clean, belt/bearing check | 6-monthly |
| Distribution boards | Visual, thermal scan, tighten terminations, RCD test button | Annually (RCD test quarterly) |
| Water tanks | Clean and disinfect, inspect | 6-monthly to annually |
| Water pumps / booster sets | Pressure, noise, seals, controls | Quarterly |
| Water heaters | Safety valve, anode check, descale | Annually |
| Drainage | Manholes and gully clearing | 6-monthly |
| Fire alarm system | Test per zone, batteries, detectors | Per local fire code (statutory) |
| Extinguishers | Inspection, service | Monthly visual, annual service (per code) |
| Roof waterproofing | Inspection, drains clear | Annually, before rainy season |
| CCTV system | Clean lenses, check recording and retention, HDD health | 6-monthly (links to the CCTV project) |

The portal generates the visit calendar from the asset register × templates,
batches tasks per site per visit, creates WOs ahead of time, and flags overdue
tasks.

### 7.5 Asset register

Per asset: tag/QR id, type, brand, model, serial, capacity (e.g. 18 000
BTU/h), refrigerant, location (site, floor, room, pin on plan), install date,
warranty end, supplier, condition rating (1–5), photos, datasheet/manual link,
PM template, history (WOs), criticality (A/B/C), expected life (from a
library, **Unverified**) and replacement year. Assets come from the engineer
survey (MEP inventory in 4.2), from renovation/civil handover, or from the
CCTV project (cameras, NVR, switches).

### 7.6 SLA timers, history and reports

- Timers per WO from request time: response, arrival, make-safe, fix; paused
  in "On hold — client" with a reason. Breach warnings at 75% and 100%.
- History per site, unit and asset: every WO, cost, parts, photos.
- Reports (A4 branded, same engine as proposals): monthly contract report
  (WOs by priority, SLA compliance %, PPM completion %, top recurring faults,
  open items, recommendations); single job service report (signed); asset
  condition report; annual summary with replacement forecast.

### 7.7 [Idea] Building health score

A 0–100 score per site, shown on the client's dashboard and in monthly
reports, with its formula visible (traceable):

> Score = 100 − (weighted open defects) − (overdue PPM penalty) − (asset age
> and condition penalty) − (repeat-fault penalty)

Weights are an admin setting labelled **Unverified (company method)**. It turns
maintenance into a visible, improving number and creates natural upsells
("replace these two 14-year-old AC units: +8 points, fewer breakdowns").

---

## 8. Proposal and contract outputs

All documents reuse the CCTV report engine: A4, print CSS, logo header, page
numbers, Draft watermark ("DRAFT — NOT FOR APPROVAL"), Final behind a
confirmation with the company stamp, revision letters, QR codes linking to
datasheets and to the share page. Language: English and/or Arabic (RTL).

### 8.1 Renovation proposal (sections, in order)

1. Cover — logo, project title, client, site, engineer, date, revision, a hero
   after image (labelled illustrative).
2. Executive summary — scope in 5 lines, total (if priced), duration, start
   window.
3. Your new home — narrative (T1).
4. Mood board (T4, rendered by the portal).
5. Before / after gallery — per room: pairs, room narrative, finishes with
   swatches, room subtotal. Illustrative label on every image.
6. Survey findings — defects found, safety observations, what is included to
   fix them, what is recommended but excluded.
7. Scope of work — by room and by trade, plain language, with inclusions.
8. Finishes and colour schedule — table with codes, products and sample photos
   (T5 captions).
9. Bill of quantities — by room (client view), with trade view in an appendix;
   prices only where entered; provisional and PC sums explained.
10. Options — good / better / best (Phase 2).
11. Programme — Gantt, phasing, rooms unusable per phase, working hours.
12. Exclusions — e.g. furniture, appliances unless listed, authority fees,
    structural alterations, hidden defects found during works (handled by
    variation), asbestos removal, permit drawings.
13. Assumptions and notes — every value still marked assumed, the
    measurement convention, the Unverified rules used (summarised).
14. Warranty — per trade (text from Admin; owner sets terms), manufacturer
    warranties passed through.
15. Payment schedule — milestones linked to programme (e.g. advance %, on
    completion of strip-out and first fix %, on tiling %, on handover %,
    retention %) — percentages are owner settings.
16. Terms, validity, and the visuals disclaimer.
17. Approval / sign-off block.

### 8.2 Civil works proposal

As 8.1, with: concept visuals (plan-based, labelled concept), drawings
schedule (which drawings exist / are needed and who produces them),
structural responsibility statement, permit and inspection hold points,
budget-only items clearly labelled (e.g. reinforcement before BBS), and a
phased programme by floor.

### 8.3 Maintenance contract proposal

Site and asset summary (from the register), PPM schedule table, SLA table,
call-out policy, parts policy (comprehensive / non-comprehensive), exclusions,
price per visit / per year, reporting commitments, optional building health
score baseline.

### 8.4 Variation orders (VO)

- Raised from the project when scope changes or hidden defects are found.
- Contents: VO number, reason (client request / hidden condition / design
  change), photos, description, BOQ lines added/omitted with quantities
  (traceable) and rates from the library, time impact (days), updated contract
  sum, before/after visual if the change is visible (optional, illustrative).
- Client approval on screen or paper before work proceeds; approved VOs
  update the contract sum and programme. An unapproved VO is clearly marked.

### 8.5 Completion and handover pack

- Practical completion certificate (engineer and client sign).
- Snag list: items with photo, room, responsible trade, due date, closed with
  photo.
- As-built notes: finishes actually used with codes and batch numbers (for
  future touch-ups), MEP changes, hidden services marked on the plan (pipes in
  walls — very valuable for the client later).
- Warranties and manuals (QR links), maintenance guidance per finish.
- Asset register handed over (feeds a maintenance contract offer — cross-sell).
- **Before / actual after** photo pairs taken at handover from the same
  positions as the survey photos (the share page can show before / illustrative
  / actual — a strong honesty and marketing moment) **[Idea]**.

### 8.6 Maintenance reports

Single-job service report (signed), monthly contract report, asset condition
report, annual report (7.6).

---

## 9. Integration with the existing portal

### 9.1 Navigation

- **Client side:** `#/client` becomes a start page with service tiles; each
  tile opens its wizard (`#/client/cctv` keeps today's wizard; the old
  `#/client` link still works by showing the start page with CCTV first).
- **Admin side:** a **Project** now has one or more **service lines**. The left
  navigation gets a top-level switcher (e.g. a segmented control or the first
  nav group): *Overview* (whole project) · *Site & plan* (shared) · *CCTV* ·
  *Renovation* · *Civil* · *Maintenance* · *Proposal*. Each line shows only
  its own sections underneath:

| Line | Sections (in workflow order) |
|---|---|
| Shared | Overview, Client & site, Site & plan (map + drawing), Photos, Rate library (admin), Settings |
| CCTV | Locations & cameras, Recording & storage, Network, Cabling, BOM (unchanged) |
| Renovation | Intake review, Survey, Specification (finishes per room), Visuals, Quantities, BOQ, Programme |
| Civil | Intake review, Brief & drawings, Elements (structure, walls, slabs), Quantities, MEP rough-in, BOQ, Programme |
| Maintenance | Requests, Work orders, Assets, PM schedule, Contracts, Reports |
| Output | Proposal (combined or per line), Variations, Handover |

- Section statuses (not started / in progress / complete / needs attention)
  and the Overview's "every open warning with a link to fix it" work exactly
  as today. Ctrl K search covers rooms, defects, assets and work orders.

### 9.2 Shared project and site map

- One **Site** has one or more **Plans** (one per floor or area). The existing
  site-map editor and drawing tools are reused unchanged for the drawing;
  what is new is that a closed room shape can be **promoted to a Room record**
  (name, type, height), so the room's area and perimeter feed the quantities.
- Layers on the same plan: CCTV devices and cable routes; rooms and openings;
  defects (pins); assets (pins); MEP points (sockets, lights, AC units). Each
  layer can be shown/hidden and printed.
- Photo pins: each survey photo has a position and direction arrow on the plan
  (the same idea as a camera's FOV cone).
- New drawing tools needed (small, reuse the shape model): opening on a wall
  with sill height; a "room" shape with a height property; symbols for MEP
  points; dimension lines.

### 9.3 One client, many lines

- Entities: **Client** (person or company) → **Sites** → **Projects** (each
  with one or more lines) → **Quotes/Proposals** (per line or combined).
  A maintenance contract is attached to a site, not to a project.
- One intake can tick several needs (start page: "pick everything you need"),
  creating one project with several lines.
- The CCTV project file remains readable as-is: a CCTV-only project is a
  project with one line. The existing project/workspace file formats are
  wrapped, not changed (the same approach as the workspace envelope in
  `docs/uiux-audit-and-ia.md` 2.4).

### 9.4 Cross-selling (rules shown to the engineer and BD, never automatic to the client)

| Trigger | Suggestion |
|---|---|
| Renovation of a villa or shop with no CCTV line | "Add a CCTV design? Cabling is cheapest before ceilings close." |
| Survey finds AC units > 10 years old or undersized verdict | AC replacement option in the proposal |
| Renovation handover | Maintenance contract offer with the asset register pre-filled |
| Maintenance requests repeat for the same defect (≥ 3 in 6 months) | Renovation / replacement proposal |
| Ceiling works planned | Lighting upgrade, data points, access control |
| Bathroom renovation | Waterproofing warranty upgrade, water heater replacement |

All thresholds are settings and **Unverified** (company judgement).

### 9.5 What changes in the current CCTV code

Nothing in the CCTV engine, data or file formats needs to change. Changes are
additive: the router (new hash routes), the Admin shell (line switcher), the
report engine (new section types), the drawing model (room promotion, new
symbols), and a new shared "client & site" store.

---

## 10. Data model

Schema-like form for the programmer. Types: `id`, `text`, `number` (with unit),
`enum`, `date`, `ref → Entity`, `list<…>`. Every entity also has `createdAt`,
`createdBy`, `updatedAt`, `updatedBy`, and (with a backend) `orgId`. Every
calculated number is **not stored** as a plain value but recomputed from
inputs, as in the CCTV engine; stored outputs (e.g. a Final proposal) are
snapshots.

### 10.1 Entity overview

```
Client 1──* Site 1──* Building 1──* Floor 1──* Room 1──* Surface
  |          |                         |         |  1──* Opening
  |          |                         |         |  1──* Fixture
  |          |                         |         *──* Photo
  |          |                      Plan (drawing, reused site-map model)
  |          1──* Asset ──* WorkOrder *──1 ServiceRequest
  |          1──* MaintenanceContract 1──* PMPlan 1──* PMTask
  |
  1──* Project 1──* ServiceLine (cctv | renovation | civil | maintenance)
          |  1──1 Survey 1──* Defect, SafetyObservation
          |  1──* Spec (proposed finishes per Room/Surface)
          |  1──* VisualView 1──* VisualAsset ; VisualBrief
          |  1──* Quote(=Proposal) 1──* BOQLine *──1 RateItem
          |  1──* Variation 1──* BOQLine
          |  1──1 Programme 1──* Activity
          |  1──1 Handover 1──* SnagItem
Library: Material, ColourRef, Product, RateItem, RuleConstant, PMTemplate, PromptTemplate
User *──* Role
```

### 10.2 Core and site entities

| Entity | Key fields | Relationships |
|---|---|---|
| **Client** | id, type (person/company), name, phone, email, language, preferred contact channel, consent records (photo use, marketing) | has many Sites, Projects |
| **Site** | id, name, address, city, location (optional, consented), property type, building age band, access notes, working-time restrictions | belongs to Client; has Buildings, Plans, Assets, Contracts |
| **Building** | id, name, floors count, structure type (RC frame, load-bearing, steel), year | belongs to Site |
| **Floor** | id, level, name, default height | belongs to Building; has Rooms, Plan |
| **Plan** | id, kind (uploaded image / drawn), scale, layers (shapes, devices, pins) | reuses `sitePlan` + `layoutShapes` model |
| **Room** | id, name, type, use, L, W, H (m), polygon (from Plan, optional), occupancy, isAssumed flags per field | belongs to Floor; has Surfaces, Openings, Fixtures, Photos, Defects |
| **Surface** | id, kind (wall n / floor / ceiling / bulkhead / façade), area override, substrate, existingFinish, existingColour (ColourRef or text), condition 1–5 | belongs to Room |
| **Opening** | id, type (door, double door, window, arch, opening), wall ref, width, height, sill, keep/replace | belongs to Room |
| **Fixture** | id, category (sanitary, kitchen unit, door, wardrobe, light, socket, AC indoor unit…), status (keep/replace/remove/new), product ref, qty | belongs to Room; may link Asset |
| **Photo / Media** | id, file, kind (photo/video), takenAt, room ref, surface ref, facing, plan position + direction, purpose (survey / defect / before / handover / reference / inspiration), uploadedBy, consentScope, EXIF-stripped flag | linked to Room, Defect, WorkOrder, VisualView |

### 10.3 Survey, specification and visuals

| Entity | Key fields | Relationships |
|---|---|---|
| **Survey** | id, date, engineer, status, weather (for civil/exterior), summary | belongs to Project; has Defects, SafetyObservations |
| **Defect** | id, type, location (room, surface, plan pin), measurements, severity 1–5, probable cause, recommended action (service code), fixNow flag, specialist needed, photos | belongs to Survey; may link BOQLine, WorkOrder |
| **SafetyObservation** | id, item (from checklist), answer, photo, action, blocksFinal flag | belongs to Survey |
| **Spec** | id, room, surface/fixture, material ref, colour ref, finish, size, pattern, joints, notes, tier (good/better/best) | belongs to Project line; drives quantities and visuals |
| **Material** (library) | id, category, product/range, manufacturer, size, finish, colour, TDS link, consumption figures, pack sizes, sample photo, verifiedAt | used by Spec, RateItem |
| **ColourRef** (library) | id, manufacturer, collection, name, code, NCS/RAL (if published), approx hex, LRV, source link, verifiedAt | used by Spec, StyleProfile |
| **StyleProfile** | as 5.2.2 | belongs to Project |
| **VisualView** | as 5.2.4 | belongs to Room; has VisualAssets |
| **VisualBrief** | id, template id + version, assembled text, inputs (photo ids, spec snapshot hash), createdAt | belongs to VisualView or Project (narrative, mood board) |
| **VisualAsset** | id, file, kind (after image / mood board / narrative text), provider, model name, variant, brief ref, QA result (T8), approvedBy, selected flag, label applied | belongs to VisualView / Project |

### 10.4 Commercial

| Entity | Key fields | Relationships |
|---|---|---|
| **Project** | id, number, title, client, site, lines[], status (lead / surveying / quoting / won / in progress / handed over / lost), BD owner, engineer | central |
| **ServiceLine** | id, kind, status, line-specific settings | belongs to Project |
| **Quote / Proposal** | id, number, revision, lines included, language, status (Draft / Final / Sent / Accepted / Rejected / Expired), validity, totals snapshot, currency, VAT rate, payment schedule, terms version, stamp applied | belongs to Project; has BOQLines |
| **BOQLine** | id, section, code, description, room(s), unit, quantity (calc ref or typed), rate ref, rate override (with reason), amount, kind (measured / provisional / PC / daywork), tier | belongs to Quote or Variation |
| **RateItem** (library) | code, description, unit, build-up (materials, labour hours, plant, subcontract), O&P %, source, date, validity, region | used by BOQLine |
| **RuleConstant** (library) | key, value, unit, source, Unverified flag, verifiedAt | used by calculations (Appendix B) |
| **Variation** | id, number, reason, description, photos, BOQ lines, time impact, status, approvedBy/at | belongs to Project |
| **Programme / Activity** | activity id, room/trade, quantity, productivity ref, crew, duration, predecessors, start/end, milestone flag, payment link | belongs to Project |
| **Handover / SnagItem** | certificate data, as-built notes; snag: room, description, photo, trade, due, closed photo | belongs to Project |

### 10.5 Maintenance

| Entity | Key fields | Relationships |
|---|---|---|
| **Asset** | as 7.5 | belongs to Site; has WorkOrders, PMPlan |
| **ServiceRequest** | id, channel, category, description, urgency answer, media, site/room/asset, reporter, status | creates WorkOrder(s) |
| **WorkOrder** | as 7.3, plus SLA timestamps | links Request, Asset(s), Contract, Users |
| **MaintenanceContract** | id, site, type (PPM / AMC comprehensive / non-comprehensive), start, end, SLA table, price, assets covered | has PMPlans |
| **PMTemplate** (library) | asset type, tasks (checklist, frequency, time) | used by PMPlan |
| **PMPlan / PMTask** | asset, template, next due, last done, overdue flag | generates WorkOrders |

### 10.6 Platform

| Entity | Key fields |
|---|---|
| **User** | id, name, role(s), phone, email, skills (technicians), active |
| **PromptTemplate** | id, version, text, provider target, status (draft/active/retired), changelog |
| **AuditLog** | who, what, when, before/after (for Final proposals, VO approvals, rate changes, visual approvals) |
| **Settings** | company details, currency, VAT, units, languages, legal texts (warranty, terms, visual disclaimer), SLA defaults, iteration limits |

---

## 11. Roles and permissions

| Capability | Client | Engineer | Technician | BD | Admin |
|---|---|---|---|---|---|
| Fill intake, upload photos, take style quiz | ✔ own | ✔ on behalf | — | ✔ on behalf | ✔ |
| See own proposals, share page, give visual feedback | ✔ own | ✔ | — | ✔ | ✔ |
| Report faults, see own tickets and reports | ✔ own sites | ✔ | ✔ assigned | view | ✔ |
| Survey, defects, safety observations | — | ✔ | ✔ (maintenance inspections) | view | ✔ |
| Specification, quantities, programme | — | ✔ | — | view | ✔ |
| Run visual briefs, approve visuals | — | ✔ | — | request | ✔ |
| Edit rates in a quote (override with reason) | — | ✔ | — | — | ✔ |
| Edit the rate library and rule constants | — | propose | — | — | ✔ |
| Mark proposal Final (stamp) | — | ✔ (if authorised) | — | — | ✔ |
| Approve variation (company side) | — | ✔ | — | — | ✔ |
| Work orders: execute, checklists, parts, sign-off | — | ✔ | ✔ assigned | — | ✔ |
| Dispatch and assign | — | ✔ | — | — | ✔ |
| Pipeline, leads, cross-sell list | — | view | — | ✔ | ✔ |
| See cost build-ups and margins | — | ✔ | — | summary only (owner decision) | ✔ |
| Users, roles, templates, legal texts, branding | — | — | — | — | ✔ |

Rules: clients see only their own sites and documents; technicians see only
assigned work and the asset history of those sites; client photos are visible
to staff on that project only; every Final, VO approval, rate change and visual
approval is logged. Until a backend exists (MVP), "roles" are simply which
surface is used: the client wizard versus the Admin workspace, as today.

---

## 12. Phased roadmap

Effort: **S** ≈ under 2 weeks, **M** ≈ 2–6 weeks, **L** ≈ 6–12 weeks, for one
experienced developer (estimates, **Unverified**).

### Phase 1 — MVP: "See your renovated home" (renovation only, offline like today)

| Feature | Effort | Acceptance criteria |
|---|---|---|
| Shared spine: client, site, rooms; project with lines; CCTV project still opens unchanged | M | An existing CCTV project/workspace file opens and saves byte-compatible (CCTV part); a project can hold CCTV + Renovation |
| Client start page and renovation wizard (8 steps), EN + AR | M | A client completes it on a 360 px phone in under 10 minutes with 3 rooms and photos; the file opens in Admin as a draft with assumed values flagged |
| Survey: rooms, openings, surfaces, condition, defects, safety checklist, photo tagging | M | An engineer surveys a 3-bedroom apartment on a phone with all fields reachable without drawing; safety "Yes" items block Final |
| Room promotion from drawn plan; openings and dimension tools | S | A drawn room shows area and perimeter matching typed L × W to 0.01 m² |
| Library: materials, colours (with codes), rates, rule constants with Unverified flags | M | No quantity can be priced without a library rate; every constant shows source and Unverified status |
| Quantity engine: paint, tiles (+adhesive, grout), skirting, gypsum ceilings, demolition, simple items; pack rounding; trace view | M | Unit tests reproduce the worked examples in section 6; every figure has a "how this was calculated" view |
| BOQ by room / by trade, totals, VAT, payment schedule, simple programme | M | Totals reconcile to the sum of lines; programme durations follow the formula; incomplete BOQ lists reasons |
| Visual brief pack (T0–T5, T8) with export/import (modes A/B), pairing, QA checklist, labels, provenance | M | A brief pack exports in one click; imported after images pair with the right before photo; every exported/printed visual carries the label; provenance is visible |
| Renovation proposal (8.1 sections 1–9, 11–17), Draft/Final, stamp | M | Prints to A4 PDF with the same branding as CCTV; no unlabelled visual can appear |

**Dependencies:** owner decisions on image provider (Q2), market/currency/
language (Q4), legal texts for warranty and visuals (Q6), an initial rate and
colour library from the estimator (Q5).
**Risks:** image quality varies by provider and photo quality (mitigate with
photo guidance, QA prompt, variants); rate library not ready (mitigate:
quantities-only proposal mode); large photo files without a backend (mitigate:
compress on import, file-based handoff).
**Total effort:** **L** (≈ 8–12 weeks).

### Phase 2 — Civil works, options, variations and a light backend

| Feature | Effort | Acceptance criteria |
|---|---|---|
| Civil intake and brief; elements (footings, columns, beams, slabs, walls) with quantities: concrete, formwork, budget rebar, blockwork, plaster, screed, waterproofing, excavation | L | Worked examples reproduce; budget-only items carry the red label; structural items cannot be marked "designed" by the portal |
| Plan-based concept visuals (T3), exterior styles | S | Labelled "concept"; T8 QA run |
| MEP checks: AC capacity, ventilation, lighting lumen method, electrical load flags | M | Each check shows formula, inputs, verdict and the "confirm with a qualified engineer" note |
| Good / better / best options (T7) and client iteration (T6, feedback chips, revision letters) | M | Three priced tiers with paired visuals from the same before photo; revision history kept |
| Variations, handover pack, snag list | M | An approved VO updates contract sum and programme; handover lists finishes with codes |
| Light backend: accounts, *Send to ContracTech*, file storage for photos, integrated AI mode C, share page | L | Intake arrives without email; photos stored encrypted; share links expire; API keys never reach the browser |

**Dependencies:** Phase 1; backend hosting and data-protection decision (Q1,
Q3). **Risks:** scope creep into structural design (mitigate: hard rule that
the portal records, not designs, structure); cost of AI usage (mitigate:
per-project budget and logging).

### Phase 3 — Maintenance

| Feature | Effort | Acceptance criteria |
|---|---|---|
| Fault reporting (wizard, QR on assets), triage, priority, SLA timers | M | A tenant reports a fault in under 2 minutes; P1 safety advice shows instantly; timers pause/resume with reasons |
| Work orders, technician mobile view, checklists, parts, sign-off | L | A technician completes a WO offline and it syncs; signed service report generated |
| Asset register (from survey, handover and CCTV), PM templates and calendar | M | Assets imported from a renovation handover and a CCTV project; overdue PPM flagged |
| Contracts, monthly reports, SLA compliance | M | Monthly report numbers reconcile with WO timestamps |
| [Idea] Building health score, AI triage suggestions | S–M | Score formula visible; AI suggestions labelled and staff-only |

**Dependencies:** Phase 2 backend. **Risks:** operational adoption by
technicians (mitigate: minimal fields, offline-first, photo-first); SLA
liability (mitigate: owner-approved contract SLAs only).

---

## 13. Risks, compliance and limits

| Area | Risk | Mitigation in the portal |
|---|---|---|
| **Safety** | Hazards on site (live wiring, structure, asbestos-suspect materials, working at height, dust/fumes for occupants) | Mandatory safety checklist; blocking items prevent Final; method-statement and PPE notes in the proposal; specialist referral fields |
| **Structural** | Portal or AI implying a structural design | Portal records structural data from licensed engineers only; extensions and openings in walls require a structural sign-off field before Final |
| **Building codes** | Codes differ by country and city (e.g. a national building code, civil-defence fire requirements, municipal permits) | Kept general throughout; every MEP/structural check carries "confirm against local codes with a licensed engineer"; jurisdiction is an owner setting (Q4) |
| **Licensing** | Electrical, gas and fire work may require licensed contractors | Trade/licence requirement per service code; proposal names who performs it |
| **Privacy of client photos** | Homes show valuables, people, layouts, addresses | Consent screen with purpose; GPS stripped by default; faces of people blurred on request or avoided in guidance; storage encrypted (with backend); retention period (default: delete raw photos N months after project closes unless the client agrees, owner to set); photos sent to an AI provider only under a provider agreement that excludes training on them (owner to confirm per provider); marketing use only with separate, explicit consent |
| **AI over-promising** | Client expects the visual exactly; image model adds features not in scope; colours differ on screen | Labels burned in; schedule and BOQ are the contract; T8 QA and engineer approval; swatches rendered by the portal, not the AI; physical samples recommended; handover "actual after" photos |
| **AI factual errors** | Narrative invents details or prices | T0 rules; narrative reviewed by the engineer before Final; MISSING OR UNCLEAR section; AI output never feeds numbers |
| **Pricing accuracy** | Stale or unsourced rates; quantities off due to assumed dimensions | Rate source/date/validity; Unverified flags; assumed dimensions flagged and listed in the proposal; "subject to survey" stamp on any proposal with assumed values; contingency line |
| **Hidden conditions** | Damp behind tiles, corroded pipes, weak slabs | Exclusions and VO mechanism explained up front; provisional sums |
| **Data loss / offline** | Large photo sets in local files | Autosave (IndexedDB) as today; compressed copies for working, originals kept; backend in Phase 2 |
| **Intellectual property** | Client inspiration images from the web | Used as style reference only; not reproduced in proposals |

**Limits to state honestly (as the CCTV document does):** visuals are
illustrative; the portal does not design structure, electrical distribution or
fire systems; AC and lighting are checks, not designs; rates come from
ContracTech's library, not the market; without a backend, nothing is sent
automatically.

---

## 14. Open questions for the owner

| # | Decision | Options | Recommendation |
|---|---|---|---|
| Q1 | **Backend and accounts** — stay offline like the CCTV tool, or add a server? | (a) offline only; (b) offline MVP, backend in Phase 2; (c) backend from day one | **(b)**: ship the "wow" fast with file handoff; the backend is required for maintenance and integrated AI anyway |
| Q2 | **Which image model, and who runs the visuals?** | A commercial image-editing API; a design-specific service; manual use of a tool by the engineer | Start with **manual mode with one chosen provider**, test on 10 real past projects, pick by "preserves the room" quality; integrate in Phase 2. Claude writes all briefs, narratives and QA |
| Q3 | **Where may client photos be processed and stored?** | Local only; a cloud region you choose; provider's cloud | A region you are comfortable with legally, a provider agreement that excludes training on your data, explicit client consent, and a retention period (suggest 12 months after close) |
| Q4 | **Market, codes, language, currency, VAT** | Which country/cities; Arabic + English; currency; VAT rate | Confirm the primary market so codes and defaults (heights, AC factors, voltage, working hours) match; Arabic + English from the MVP |
| Q5 | **Who owns the rate and colour library?** | Estimator, procurement, engineer per project | One named owner, reviewed quarterly; seed it from the last 10 priced jobs; preferred paint and tile brands chosen by you |
| Q6 | **Legal texts** — visuals disclaimer, warranty per trade, payment milestones, retention, VO terms | Draft by ContracTech; review by a lawyer | Have a lawyer approve one set of templates before the first Final proposal |
| Q7 | **Which line first?** | Renovation; civil; maintenance | **Renovation**: fastest to the "wow", lowest structural liability, natural cross-sell to CCTV and maintenance |
| Q8 | **Show prices before a site survey?** | No price; a range; a firm price | **A range only**, clearly "subject to survey"; firm price after the survey |
| Q9 | **Free design iterations** | Unlimited; 2 rounds; paid after N | **2 rounds free**, then a design fee credited against the contract if won |
| Q10 | **Furniture in visuals** | Show existing; show new as "for illustration"; offer furniture supply | Show for illustration, labelled "not included", unless you decide to sell furnishing |
| Q11 | **Can BD see margins?** | Full; summary; none | Summary (margin band) only |
| Q12 | **Maintenance SLA commitments** | Fixed tiers (e.g. Gold/Silver/Bronze) or per contract | Two or three fixed tiers you can staff 24/7 realistically; do not publish P1 targets you cannot meet |
| Q13 | **Use of before/after in marketing** | Never; with consent; anonymised | With separate explicit consent, address removed |
| Q14 | **Civil scope ceiling** | Up to villas; small buildings too | Up to villas and extensions at first; multi-storey only with a partner structural consultancy named in the proposal |

### 14.1 Decisions recorded for Phase 1

The owner's instruction of 2026-10-12 was to *go with the recommendations*.
How each was applied in the Phase 1 build:

| # | Decision | Status |
|---|---|---|
| Q1 | Offline MVP: no backend, no accounts. The client's answers and photos travel as a file (or a link without photos); the engineer saves and sends files. | Decided (owner: go with recommendations, 2026-10-12) |
| Q2 | Manual image mode (A/B): the portal exports the brief pack (prompts T0–T5, T8, before photos, swatch sheet) as a ZIP or as copy-able prompts; the engineer runs Claude and an image tool outside the portal; the "after" images are imported back, paired with their before photo by file name, labelled and recorded with provenance. No provider is chosen or integrated yet. | Decided (owner: go with recommendations, 2026-10-12) |
| Q3 | Consent screen in the client wizard (photo use required to send photos; marketing separate); location (GPS/EXIF) metadata stripped on the phone before anything is saved; nothing uploaded anywhere. Retention period and provider agreements wait for a backend. | Decided (owner: go with recommendations, 2026-10-12) |
| Q4 | Gulf market defaults, all editable in Settings: currency SAR, VAT 15%, metric; client wizard in English and Arabic with right-to-left layout. These are assumptions to confirm (ASSUMPTIONS 15). | Decided (owner: go with recommendations, 2026-10-12) |
| Q5 | Rate and colour library editable in Admin (Library) and kept per project, with a per-browser default. Seeded with a small sample library: every seeded rate and material is marked "SAMPLE — replace with your rates" and Unverified; colours are seeded with RAL Classic codes only (a public standard), never invented manufacturer codes. A proposal priced with any sample rate cannot be issued as Final. | Decided (owner: go with recommendations, 2026-10-12) |
| Q6 | Placeholder legal texts (warranty, terms, visuals disclaimer, exclusions) marked "PLACEHOLDER — to be approved by a lawyer"; Final is blocked until the engineer ticks "approved by a lawyer" and the placeholder line is removed. | Decided (owner: go with recommendations, 2026-10-12) |
| Q7 | Renovation first. Civil works and maintenance are not built (the client start page shows them as "coming soon"). | Decided (owner: go with recommendations, 2026-10-12) |
| Q8 | Before the survey confirms every assumed value the client sees a price range only (estimate −10% … +20%, rounded, settings), "subject to survey", with no unit rates; a firm price after the survey. | Decided (owner: go with recommendations, 2026-10-12) |
| Q9 | 2 free design rounds (setting), printed in the proposal; a counter of rounds used in Visuals. | Decided (owner: go with recommendations, 2026-10-12) |
| Q10 | Furniture in visuals is captioned "Furniture for illustration, not included" unless the client keeps their own. | Decided (owner: go with recommendations, 2026-10-12) |
| Q11 | No margin shown to business development. There are no roles yet (one Admin surface), so this is only noted: rates are all-in and no build-up or margin is displayed anywhere. | Decided (owner: go with recommendations, 2026-10-12) |
| Q12 | Not applicable to Phase 1 (maintenance). | Open |
| Q13 | Marketing use of before/after images only with a separate, explicit consent, recorded as a flag on the client (default off). | Decided (owner: go with recommendations, 2026-10-12) |
| Q14 | Not applicable to Phase 1 (civil). | Open |

---

## Appendix A. Glossary for non-engineers

| Term | Meaning |
|---|---|
| **BOQ** | Bill of quantities: every item of work with its quantity, rate and amount |
| **Unit rate** | Price per unit of work (per m², per metre, per item) |
| **Provisional sum / PC sum** | An allowance for work or items not yet defined / chosen by the client |
| **Variation order (VO)** | A signed change to the agreed scope and price |
| **Snag list** | List of small defects to fix before handover |
| **TDS** | Technical data sheet from the manufacturer (coverage, drying times) |
| **LRV** | Light reflectance value: how much light a colour reflects (0 black – 100 white) |
| **NCS / RAL** | International colour reference systems |
| **TR (ton of refrigeration)** | AC capacity unit: 1 TR = 12 000 BTU/h = 3.517 kW |
| **MEP** | Mechanical (AC, ventilation), electrical, plumbing |
| **PPM / AMC** | Planned preventive maintenance / annual maintenance contract |
| **SLA** | Service level agreement: promised response and fix times |
| **BBS** | Bar bending schedule: the steel reinforcement list from structural drawings |
| **RCD / RCBO** | Safety breakers that trip on earth leakage, protecting people |
| **Illustrative visual** | An AI-assisted picture showing the intended look; not a contract drawing |

## Appendix B. Default rule-of-thumb library (all **Unverified** unless stated)

| Key | Default | Unit | Status |
|---|---|---|---|
| Default ceiling height, apartment / villa | 2.8 / 3.2 | m | Unverified |
| Default door / window | 0.9 × 2.1 / 1.5 × 1.5 | m | Unverified |
| Deduct openings at or above | 0.5 | m² | Unverified (convention setting) |
| Emulsion spreading rate (no TDS) | 10 | m²/L per coat | Unverified |
| Primer spreading rate (no TDS) | 8 | m²/L | Unverified |
| Paint waste | 5 | % | Unverified |
| Tile waste: straight / offset / diagonal / herringbone | 7 / 10 / 15 / 15–20 | % | Unverified |
| Tile adhesive, 10 mm notch (no TDS) | 5 | kg/m² | Unverified |
| Grout density ρ | 1.6 | kg/dm³ | Sourced from product TDS when available |
| Gypsum board waste | 10 | % | Unverified |
| Block 400×200 with 10 mm joints | 11.6 | blocks/m² | Calculated (geometry) |
| Block waste | 5 | % | Unverified |
| Plaster dry-volume factor | 1.27 | — | Unverified |
| Cement bulk density | 1440 | kg/m³ | Common reference value, Unverified |
| Concrete order waste | 3–5 | % | Unverified |
| Rebar ratios (budget only) | slab 80–120, beam 120–180, column 150–250, footing 60–100 | kg/m³ | Unverified |
| Debris / soil bulking | 1.3 / 1.25 | — | Unverified |
| AC cooling density by room use | 230–400 | W/m² | Unverified (hot-arid) |
| 1 TR | 3.517 | kW | Sourced (definition) |
| Ventilation (ASHRAE 62.2) | 0.15 × A + 3.5 × (Nbr + 1) | L/s | Sourced; local code to confirm |
| Lighting UF / MF | 0.6 / 0.8 | — | Unverified |
| Power factor (mixed load) | 0.9 | — | Unverified |
| Productivities | see 6.8 | per worker-day | Unverified |

*End of specification.*
