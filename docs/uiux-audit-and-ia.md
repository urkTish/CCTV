# UI/UX redesign — audit and information architecture

Written 2026-10-05, before any redesign code (mandatory process, steps 1 and 2 of
`uiux-agent-prompt.md`).

## 1. Audit of the phase-2 app

### How it was audited

The phase-2 app (commit a84f997) was run on the Vite dev server and driven in
headless Chromium at 1440 × 900 and 380 × 800, with a realistic 10-location
project ("Northgate Logistics depot": main gate × 2, weighbridge (LPR + ANPR),
reception, cash office, two warehouse aisles × 3, loading bay × 2, car park × 2,
perimeter fence × 4, server room — 20 cameras), loaded through the shareable
link. No console errors, no failed requests, no horizontal scroll at either
width.

| Measure | Desktop 1440 px | Phone 380 px |
|---|---|---|
| Page height | 13,223 px (14.7 screens) | 25,428 px (31.8 screens) |
| Inputs and selects on the page | 68 | 68 |
| Buttons | 54 | 54 |
| `<details>` disclosures | 84 | 84 |
| Tables | 8 | 8 |
| Where "Design settings" starts | y = 8,107 | y = 17,266 |
| Where "System design" starts | y = 9,130 | y = 20,035 |
| Where "Site map" starts | y = 11,589 | y = 23,465 |

### Screen regions, top to bottom (one page)

1. **Header** — logo, "CCTV camera sizing — Hikvision", dataset line, Metric /
   Imperial, theme select, *Copy shareable link* (primary-styled).
2. **Project card** — location chips (one per location, with ×count and a
   remove ×), *Add location*, eight totals (locations, cameras, PoE load and
   switch budget, aggregate bitrate, storage needed, recorder + drives, PoE
   switches, CAT6 boxes), PoE explanation, unresolved-locations line, *Save
   project*, *Open project*, autosave status, the "link excludes the map"
   notice, the autosave restore offer.
3. **Location inputs** (left column, 480 px) — five cards for the active
   location only: Location (name); Geometry (mounting height, furthest distance,
   nearest distance, coverage mode, scene width *or* room length / width /
   overlap, target height); Purpose (select + px/m explanation + Unverified
   badge); Environment (site, mounting surface, vandal, ambient light, colour at
   night, backlight, four special conditions); Client requirements (audio,
   two-way audio, 12 must-have feature checkboxes, budget, lens, PTZ, camera
   count, retention, motion, codec, frame rate). 37 controls.
4. **Location results** (right column) — "What this location requires" (3 traced
   rows); the primary recommendation card (why / weak point, lens / PoE / price /
   datasheet strip, the 15-field table, engineer's note, warnings, the
   calculation summary with ~14 traced rows open by default, score breakdown,
   geometry sketch); up to three alternative cards, each with its own 15-field
   table and calculation; the exclusion list; "hard-filtered on". With the
   default scenario this column is ~7,000 px tall.
5. **Design settings** — 30 project-wide inputs in four fieldsets (recording &
   storage, recorder, PoE switching, cabling), five with Unverified badges.
6. **System design** — storage trace, drive set, recorder + 13-row checks table,
   alternatives, rejected recorders, switches per group with their checks,
   CAT6 summary (6 figures), runs table, warnings.
7. **Site map** — upload, scale, calibration form, OSM reference toggle, tool
   buttons, the SVG canvas, map warnings, place buttons, the device table
   (8 columns, scrolls sideways on a phone).
8. **Footer** — sources.

### Outputs inventory (everything that must stay reachable in Admin)

Per location: required px/m, required horizontal resolution, required FOV (each
traced); primary + alternatives with why / weak point / trade-off label, score
and score breakdown, verdict badge, lens / FOV / aperture, PoE standard and draw,
price band, datasheet link and verified date, the 15 fields with "derived"
markers and "Not specified" cells, engineer's note, calculation warnings, the
calculation rows (verdicts, Unverified badges, formulas, sources), per-location
bitrate / storage line, the side-elevation and plan sketch; the no-result path
(suggested fixes, nearest misses); rejections with reasons; hard-filter line;
invalid-input path.

Project: totals; PoE explanation; unresolved locations; storage trace rows;
drive configuration, explanation and alternatives; storage advice when nothing
fits; recorder primary, checks with margins, alternatives, rejections, near
misses, fixes, notices, analytics; PoE-mode reason; switch groups, management
reason, models, cameras per switch, run lengths, checks, failures and fixes;
CAT6 boxes (FFD), naive count, cable to buy, offcuts, connectors, patch cords,
fibre uplinks, runs with TIA-568 verdict / message / remedies / basis /
Unverified; design warnings and errors; map warnings, scale, cone notes,
run basis per device; `buildBillOfMaterials` (no UI today).

### Where the friction is

| # | Friction | Evidence |
|---|---|---|
| F1 | **Scroll depth.** Everything is one page: 14.7 screens on a laptop, 31.8 on a phone. The site map, which drives cable lengths and switch grouping, starts at screen 13 (desktop) / 30 (phone). | Table above. |
| F2 | **Results hidden below the fold.** On a phone the first recommendation starts at y = 5,768, after all 37 inputs. On desktop the project-wide results (recorder, drives, switches, cable) start at y = 9,130, below ~7,000 px of one location's cards. | Section offsets. |
| F3 | **Everything for one location is expanded at once**, and only one location is visible at a time: the engineer cannot see the other nine locations' verdicts without clicking each chip. | Location chips carry name and count only — no camera, no verdict, no warning count. |
| F4 | **Inputs asked before they matter.** Codec, frame rate, motion level, overlap allowance, nearest distance, target height and the special conditions sit between the essentials. In design settings, rarely touched allowances (formatting overhead, routing factor, rack drop, unplaced run, connectors/patch cords per run) carry equal weight to the choices an engineer actually makes (recording mode, RAID, PoE mode, form factor). | 37 + 30 controls at the same visual level. |
| F5 | **Competing calls to action.** *Copy shareable link* is the only primary button on the page; *Add location*, *Save project*, *Open project*, map tools and *Show / Hide* all compete as secondary buttons in the same style. | Header. |
| F6 | **Unclear grouping between "settings" and "results".** Design settings and System design are separate cards a screen apart, so changing RAID and seeing its effect on the recorder check needs scrolling. The project totals at the top repeat some system-design results with no link to the detail. | Sections 5 and 6. |
| F7 | **No overview of what is left to do.** Warnings are scattered: per-card calculation warnings, the unresolved-locations line, design warnings at the bottom of System design, map warnings under the canvas, TIA flags inside the runs table. Nothing says "3 things need attention, here they are". | — |
| F8 | **Alternatives repeat the full card.** Three alternatives each carry a full 15-field table and calculation — ~1,350 px each — so comparing them means scrolling. | Card offsets 857 / 3,854 / 5,212 / 6,570. |
| F9 | **The map is a card at the bottom**, not a workspace: the canvas is the card's width, tools and the device table are stacked above and below it, and on a phone the device table scrolls sideways (min-width 880 px). | Browser-check notes. |
| F10 | **No navigation or search.** No way to jump to "Perimeter fence" or "the NVR". | — |
| F11 | **Brand colour unused.** The accent is a generic blue (#0b5cad); the ContracTech blue (#536FFC) is recorded in `brand.ts` but "not applied to the app theme". | `index.css`, `brand.ts`. |
| F12 | **No client-facing path at all**: no plain-language intake, no report. The project name cannot be edited in the UI. | — |

Things that work and must be kept: live recalculation with no submit; every
number's "How this was calculated"; the Unverified and "derived" markers; "Not
specified" cells; the honest no-result path; the keyboard alternative on the
map; the number fields that keep what is typed; link + file + autosave.

## 2. Information architecture

One app, three surfaces, chosen by the URL hash (the hash already carries the
project; base64url never contains `/`, so a `#/…` route cannot collide with it):

| Hash | Surface |
|---|---|
| `#<base64url project>` or empty | **Admin** (default) |
| `#/client` | **Client intake** wizard |
| `#/intake/<base64url answers>` | Admin, opening a client's intake as a draft project |

The report is a section of Admin (it needs the confirmed project), printed with
print CSS; it is not a separate app.

### 2.1 Admin — the engineer's tool

**Shell.** Header: logo (theme variant), product title, project name, *Jump to…*
(Ctrl/⌘ K), units, theme, and an overflow for *Copy link*. Left navigation
(232 px, collapsible to a 64 px icon rail; a drawer behind a menu button below
1024 px). Each nav item shows a status: not started / in progress / complete /
needs attention (icon + text + colour, never colour alone), with a count where
it helps. Every section ends with *Previous / Next section* so the workflow can
be walked in order on any device.

| # | Section | Primary (always shown) | Secondary | Advanced (disclosure, with a "n changed" indicator) |
|---|---|---|---|---|
| 1 | **Overview** (home) | Project name, client name; totals tiles — cameras by model, recorder, storage (needed vs usable), switches, CAT6 boxes, PoE load, bitrate; **open warnings in one list, each linking to where it is fixed**; intake values still to confirm | Save / Open project, autosave status, link notice, restore offer | — |
| 2 | **Site map** | Full-width canvas + toolbar (select, place camera / NVR / switch, draw route, calibrate) + side panel for the selected device | Plan upload and scale strip; device list (keyboard alternative) | OpenStreetMap reference view |
| 3 | **Locations & cameras** | List: name, camera model, verdict, warnings, count, to-confirm count; *Add location*. Detail: essentials strip (name, cameras, purpose) + input tabs **Geometry / Purpose / Environment / Client requirements**; results beside the inputs on desktop, below on a phone, as tabs **Recommendation / Spec sheet / Calculation / Sketch / Alternatives / Excluded** | Requirement rows, score breakdown | Geometry: nearest distance, target height, overlap. Environment: special conditions. Requirements: motion level, compression, frame rate |
| 4 | **Recording & storage** | Recording mode, RAID, hot spare, monitors, **form factor**, **camera power (PoE mode)**, recorder model; results: storage needed vs usable, drive set, recorder and its checks | Alternatives, rejections, drive alternatives | Growth headroom, formatting overhead, channel headroom, monitor resolution, redundant PSU, recorder analytics |
| 5 | **Network (switches)** | Management, uplink; switches per group with cameras and checks | Management reason | PoE budget headroom, spare ports |
| 6 | **Cabling** | Boxes to buy, cable, connectors, patch cords, fibre; runs table with TIA-568 verdicts | Offcuts, naive count | Rack drop, service loop, waste, box length, connectors / patch cords per run, routing factor, unplaced run |
| 7 | **Bill of materials** | Every `buildBillOfMaterials` line: model, description, quantity, datasheet; complete / incomplete with reasons | Optional unit prices (never invented) | — |
| 8 | **Report** | Preview of the client report; *Print / Save as PDF*; Draft ↔ Final (behind a confirmation) | Client name, validity, prepared-by (from Settings) | — |
| — | **Settings** (nav footer) | Engineer name, title, phone, email (stored in this browser) | — | — |

**Status rules** (pure function, unit-tested): Site map — not started (no image, no drawn layout,
no devices), in progress (some cameras unplaced or no scale), complete, or needs
attention (map warnings). Locations — needs attention when any location has no
model, an input error, a fail/marginal verdict or calculation warnings.
Recording — needs attention when no recorder passes or drives do not fit.
Network / Cabling — needs attention on switch failures, TIA fails/marginals.
BOM — complete flag. Report — Draft / Final.

**Desktop layout of a location detail (1440 px):** nav 232 + location rail
240 + inputs 400 + results (flex, ~520). With the nav collapsed the results get
~170 px more. Below 1280 px the rail is replaced by a location switcher above the
detail; below 1024 px inputs and results stack.

**Search / jump:** a command palette lists sections, locations and placed
devices; typing filters; Enter goes there.

### 2.2 Client — simplified intake (mobile-first)

A six-step wizard with a progress bar ("Step 2 of 6"), Back / Next, plain
language only (no m/px, focal length, DORI or PoE wording):

1. **About your site** — type of premises (home, shop, office, warehouse /
   industrial, school / public building, other); optional site name, contact
   name, phone, email.
2. **Areas to cover** — a list of areas; *Add an area* opens one area per screen:
   name, how many cameras (stepper), what they need to see (six illustrated
   choices: watch general activity, see what people are doing, recognise people
   I know, clearly identify faces, read car number plates, watch the cash
   register), indoors / outdoors / under cover, is it dark at night (lit all
   night / some light / completely dark), roughly how far away (under 5 m, 5–15
   m, 15–30 m, over 30 m).
3. **Recording** — how long to keep recordings (1 week / 2 weeks / 1 month /
   3 months); **where the recorder will go** (not sure — default / on a desk or
   shelf / in a network cabinet, then optionally the cabinet space 1U / 1.5U /
   2U); **how the cameras get power** (let the engineer decide — default /
   straight from the recorder / from a separate network switch). These two map
   to the recorder's form factor and PoE mode and stay editable in Admin.
4. **Budget** — Economy / Balanced / Premium, one sentence each.
5. **Floor plan** (optional) — upload a photo or plan (PNG / JPG).
6. **Review and send** — the answers, an **indicative** summary in plain
   language ("20 cameras, a 32-channel recorder, sized for about 30 days of
   recordings") labelled *preliminary until the engineer confirms the site
   survey*, then **how to send it**: download the intake file and email /
   message it to the ContracTech engineer; or copy a link (no floor plan in a
   link — the UI says so).

**Engine mapping** lives in one module (`src/client/intakeMapping.ts`) with unit
tests: every answer maps onto existing engine inputs; everything not asked
(mounting height, scene width, target height, mounting surface, codec, …) gets a
documented default and is recorded as **assumed**. No engine logic is
duplicated: the indicative summary is `buildBillOfMaterials` on the mapped
project.

**Handoff:** Admin opens the intake file (via *Open project*) or link as a draft
project. Every assumed value carries "Assumed from client intake — please
confirm" next to its input, with *Confirm*; editing the value confirms it; each
location shows a to-confirm count, and the Overview lists them.

### 2.3 Client report (Admin → Report)

Built only from `buildBillOfMaterials(project)` and existing engine outputs
(`buildOutputCard`, `siteMapView`, the recommendation `why`). A4, print CSS, one
section per page group, running header with the logo, page numbers in the page
footer: cover → executive summary → site map with legend → one page per area
(client's words, camera, 15-field table, why) → recording, network and cabling →
bill of materials (prices only if entered) → datasheet links with QR codes →
assumptions and notes → sign-off. A draft carries a "DRAFT — NOT FOR APPROVAL"
watermark and no stamp; only a report switched to Final, behind a confirmation
dialog, carries the company stamp in the sign-off block.

### 2.4 New persisted data, and where it lives

The engine, data files and the existing project / URL schemas are not changed.
What the redesign adds is stored beside them:

| Data | Where |
|---|---|
| Client name, prices, report status, intake answers and the assumed-value list | A new "workspace" envelope file (`format: contractech-cctv-workspace`) that wraps an unchanged project-file document; *Save project* writes the plain project file when there is nothing extra. Autosave stores the same text. Not in the link (the UI says so). |
| Engineer name, title, phone, email | This browser's `localStorage` (Settings), snapshotted into the report when it is made Final. |
| Active section, collapsed nav | `localStorage`, per-viewer convenience only. |
