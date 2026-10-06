# Task list — CCTV Camera Specification & Recommendation Platform

Status key: `pending` / `in progress` / `done` / `blocked` / `deferred` (not built, reason given)

## Phase 1 — complete

Domain research (A1–A5), domain math (B1–B10), data layer (C1–C4), recommendation
engine (D1–D5), UI (E1–E9) and close-out (F1–F6): all **done** on 2026-10-04.
151 tests, lint and build green. Details in git history and `ASSUMPTIONS.md`.

---

## Phase 2 — recorder, storage, switching, cabling, site map, BOM

Order is dependencies-first, as the brief requires.

### G. Data research and schemas

| # | Task | Verification | Status |
|---|---|---|---|
| G1 | Extract shared schema pieces into one module (`src/data/shared.ts`) that camera, NVR, switch and HDD schemas all import | Camera tests still green; new schemas import from it | done |
| G2 | Research NVR datasheets (DS-76xx / 77xx / 96xx); 12–20 models, 4 to 64+ ch, PoE and non-PoE, 1 to 8+ bays | Each entry has a hikvision.com datasheet URL + verifiedOn; read via local PDF text extraction | done |
| G3 | Research DS-3E PoE switch datasheets; 10–15 models incl. long-range PoE figures | As above; extend-mode distance **and** speed sourced | done |
| G4 | Check whether a real Hikvision HDD datasheet exists before assuming; research Seagate SkyHawk and WD Purple datasheets | Finding recorded either way in ASSUMPTIONS | done |
| G5 | Write `hikvision-nvrs.json`, `hikvision-switches.json`, `hdds.json` + zod schemas + validating loaders | Schema tests: corrupt fixture rejected, unknown field rejected, dataset invariants hold | done |
| G6 | Source TIA-568 channel limits (90 m permanent link + 10 m patch = 100 m) and a filesystem-overhead figure for HDD capacity (or flag it) | Cited in code; test asserts constants | done |
| G7 | Fix the UTF-8 corruption that PowerShell introduced into README.md and TASKS.md in phase 1 | No mojibake in any .md file | done |

### H. Storage math (pure)

| # | Task | Verification | Status |
|---|---|---|---|
| H1 | `storage.ts`: per-camera seconds/day by recording mode (continuous / motion-only / scheduled hours) | Worked-example tests | done |
| H2 | Project storage = Σ cameras bitrate × seconds × retention, then filesystem overhead, then headroom; every step traced | Hand-computed worked example | done |
| H3 | RAID usable-capacity math (none / 1 / 5 / 6 / 10, + hot spare) and minimum-drive rules | Tests per level incl. invalid drive counts | done |
| H4 | Drive-configuration search: smallest set of N × capacity that fits a given NVR's bays and per-bay max | Tests: fits / doesn't fit / RAID needs more bays | done |

### I. NVR engine (pure)

| # | Task | Verification | Status |
|---|---|---|---|
| I1 | Project-level recorder inputs with defaults (channel headroom 25%, monitors, output res, form factor, redundancy, PoE mode, RAID) | Types + defaults + URL schema extended | done |
| I2 | Hard checks with pass/fail and margin: channels, incoming bandwidth, max resolution, bays × capacity, RAID support, PoE ports/budget, analytics, outputs, form factor, redundancy | One test per check, incl. failing cases | done |
| I3 | Scoring + primary/alternatives + why/weak point + rejections + no-result path | Engine tests on a realistic project | done |
| I4 | Storage ↔ NVR compatibility: fit drives into the chosen NVR; if impossible, say so and suggest larger NVR / fewer days / lower bitrate | Test on an oversized retention | done |

### J. PoE switch engine (pure)

| # | Task | Verification | Status |
|---|---|---|---|
| J1 | Group cameras per switch from the site plan (or a single default group when no map) | Test | done |
| J2 | Checks: port count + spare %, PoE budget + headroom, per-port standard (at/bt for PTZ/heated), uplink bandwidth, long-range PoE for 100–250 m runs | One test per check | done |
| J3 | Managed/unmanaged default rule, uplink type, select model per switch, list cameras per switch | Engine test | done |

### K. Site plan data model and scale math (pure)

| # | Task | Verification | Status |
|---|---|---|---|
| K1 | Site-plan types: image, calibration, devices (camera/NVR/switch), routes, routing factor | Types compile | done |
| K2 | Scale math: px → m from a calibration line; polyline length; straight-line × routing factor estimate | Worked-example tests | done |
| K3 | Project file save/open (.json with image data URI) with schema validation | Round-trip test; corrupt file rejected with reason | done |

### L. CAT6 cable math (pure)

| # | Task | Verification | Status |
|---|---|---|---|
| L1 | Per-run length = horizontal + camera drop + rack drop + service loop, then waste % | Worked-example test | done |
| L2 | TIA-568 checks: > 90 m flagged with remedies; > 100 m never passes; uplinks > 90 m → fibre line item | Tests | done |
| L3 | First-fit-decreasing bin packing into 305 m boxes; naive vs real box count; offcut per box | Tests incl. a case where FFD needs more boxes than total ÷ 305 | done |
| L4 | Connectors (2/run, configurable) and patch cords (1/run) | Test | done |

### M. Site map UI (functional, slots into current layout)

| # | Task | Verification | Status |
|---|---|---|---|
| M1 | Image upload (PNG/JPG; PDF first page if feasible, otherwise stated as unsupported) | jsdom test of upload path / clear message | done — PNG/JPG only; PDF refused with a stated reason (no PDF renderer shipped, ASSUMPTIONS 11.1) |
| M2 | Calibrate scale by drawing a line + entering its length; show scale; recalibrate | Test via the list alternative + pure math tests | done |
| M3 | Place/drag cameras (FOV cone, rotatable), NVR, switches; draw route polylines; estimated routes marked | Rendered in jsdom; pure math tested | done |
| M4 | Keyboard/list alternative: table of devices with editable x/y, rotation, route length | jsdom test edits a device without a pointer | done |
| M5 | Optional OSM mode via Leaflet, tile-policy compliant (attribution, no bulk); off by default | Policy checked and cited | done — reference view with a measuring tool that feeds the calibration length; Leaflet 1.9.4 lazy-loaded in its own chunk. OSMF tile usage policy checked 2026-10-05 from its published source (live page blocked here) and cited in `src/domain/osmMap.ts` and ASSUMPTIONS 11.6 |
| M6 | Persistence: Save/Open .json, IndexedDB autosave in try/catch; UI says URL sharing excludes the map | Tests | done |

### N. Integration

| # | Task | Verification | Status |
|---|---|---|---|
| N1 | Wire storage, NVR, switch and cable results into project totals and a functional results section | jsdom test renders them | done |
| N2 | `buildBillOfMaterials(project)` — pure, typed, every hardware line with datasheet URL, all warnings | Tested on a realistic multi-location project | done |

### P. ContracTech branding (add-on; slotted after G so the phase-2 order is undisturbed)

Source folder `C:\Users\Admin\Desktop\Contractech\Files\` is read-only: only the two named files are touched, and only copied.

| # | Task | Verification | Status |
|---|---|---|---|
| P1 | Copy `FullLogo.jpg` and `Company Stamp.png` into `src/assets/brand/` as `fulllogo-original.jpg` / `company-stamp-original.png`; no Desktop path in code | Byte-identical hashes vs source; grep finds no Desktop path in `src/` | done |
| P2 | Logo: tight crop, transparent background (no redraw); dark-mode variant with light wordmark and unchanged blue swoosh — or white rounded plate if keying fails | Open the outputs and look at them | done |
| P3 | Header: logo left, ~32 px, alt "ContracTech", switches with theme; title "ContracTech — CCTV Design". No layout restructure | jsdom test for alt text and title | done |
| P4 | Stamp: transparent PNG keyed on blue dominance with soft alpha, full resolution, not used in UI | Open it; check edges, ink texture, no grey halo | done |
| P5 | Sample brand blue from the swoosh; `src/brand.ts` exports logo light/dark, stamp, company name, brand blue | Test that every exported asset resolves to a real file | done |
| P6 | Record processing method and what to eyeball before the stamp goes on client documents | In ASSUMPTIONS.md and the report | done |

### O. Close-out

| # | Task | Verification | Status |
|---|---|---|---|
| O1 | Lint clean | Real output in report | done — `eslint .` exit 0 |
| O2 | All tests green | Real output in report | done — 20 files, 358 / 358 (22 files, 379 / 379 after M5) |
| O3 | Build clean (TS strict, no `any`) | Real output in report | done — `tsc -b` exit 0, `vite build` ok (chunk-size advisory only) |
| O4 | Update ASSUMPTIONS.md and README.md | Files current, no mojibake | done — ASSUMPTIONS 10 and 11 added |
| O5 | Review own diff as a reviewer; report honestly | Final report | done — fixes listed in HANDOFF |

---

## UI/UX redesign — Admin, Client, client report

Brief: `uiux-agent-prompt.md`. Audit and information architecture:
`docs/uiux-audit-and-ia.md` (written before any code). Owner decisions: the PoE
choice and the recorder form factor are the client's options — asked in plain
language in the intake with a sensible default, and always reachable in Admin.
The engine, data files, schemas and `buildBillOfMaterials` are not changed.
Every visual task is checked in real Chromium at 1440 px and 380 px, light and
dark.

| # | Task | Verification | Status |
|---|---|---|---|
| U1 | Audit the phase-2 app in a real browser; write the audit and the IA for both versions | `docs/uiux-audit-and-ia.md` committed before code | done |
| U2 | Design tokens: brand blue + derived accessible shades, type scale, spacing, radius, elevation, motion, light/dark | Contrast unit test computes WCAG ratios for every token pair used; browser check | done — 71 contrast checks; fixed two old failures (ink-3 on canvas 4.44:1, input border 2.5:1) |
| U3 | Shared components: icons, status badge, tabs, Advanced disclosure with changed count, dialog, empty state, field flag slot | jsdom tests (keyboard on tabs, dialog focus) | done |
| U4 | Routing (`#/client`, `#/intake/…`, project hash) and the Admin shell: header, collapsible left nav / phone drawer, per-section status | Pure tests for route parsing and section status; jsdom nav test; browser check | done — `#/client`, `#/intake/…` and the project hash; nav collapses to icons ≥ 1024 px, drawer below; status = icon + text + colour |
| U5 | Overview dashboard: project name, totals, cameras by model, every open warning linked to where it is fixed | jsdom test; browser check | done — totals, cameras by model, 17 warnings on the 10-location project each with a link |
| U6 | Locations list → detail; input tabs with Advanced disclosure; results tabs (recommendation, spec sheet, calculation, sketch, alternatives, excluded) | Existing UI assertions kept (15-field order, Not specified, derived, Unverified, no-result path); browser check | done — every previous assertion kept; tabs wrap instead of scrolling |
| U7 | Recording & storage, Network and Cabling sections (settings beside their results, advanced allowances behind a disclosure; PoE and form factor kept as primary inputs) | Existing design tests kept; browser check | done — PoE mode and form factor stay primary inputs, never under Advanced |
| U8 | Site map as a workspace: toolbar, canvas, side panel for the selected device, device list | Existing site-map tests kept; browser check | done |
| U9 | Search / jump palette (Ctrl/⌘ K) | jsdom test | done |
| U10 | Workspace extras (client name, prices, report status, intake provenance) in a new envelope file + autosave; engineer Settings | Round-trip tests; old project files still open | done — new `contractech-cctv-workspace` envelope; plain project file written byte-identically when there are no extras |
| U11 | Bill of materials section with optional prices | jsdom test; browser check | done — phone layout stacks each line (no sideways scroll) |
| U12 | Client-to-engine mapping module with documented defaults | Unit tests for every answer and default | done — `src/client/intakeMapping.ts`, 19 assumed fields per area, each with a reason |
| U13 | Client intake wizard (mobile-first), indicative summary, send as file / link | jsdom test of the whole flow; browser check on a phone | done — 6 steps, phone-first; automated run of a 3-area intake takes ~9 s; a client can do it in well under five minutes (not timed with a real person) |
| U14 | Handoff: open an intake file / link as a draft; "assumed from client intake — please confirm" on every defaulted value; confirm or edit to clear | jsdom test | done — file and link; 19 marks per area (20 for "general activity"); Confirm, Confirm all, or edit clears them |
| U15 | Report model (pure, from `buildBillOfMaterials`) and an offline QR encoder | Unit tests; QR output decoded by an independent decoder | done — QR encoder written in-house (no dependency): 75/75 codes decoded by ZXing-C++, and all 7 codes decoded again from the printed PDF at 150 dpi |
| U16 | Report view + A4 print CSS: cover, summary, map, areas, system, BOM, datasheets, assumptions, sign-off; draft watermark; Final behind confirmation with the stamp | jsdom tests per section; Chromium print-to-PDF checked page by page | done — 18-page A4 PDF via Chromium print for the 10-location project; header + “Page n of N” on every page; draft watermark; stamp only after the confirmation |
| U17 | Close-out: README, ASSUMPTIONS, HANDOFF; lint, test, build; review own diff | Real output in the report | done — tsc 0, eslint 0, 523 / 523 tests (33 files), vite build ok (chunk-size advisory only) |

---

## Site layout drawing

Owner request (2026-10-06): draw the site layout in the Site map when there is
no floor plan to upload — rooms, walls, lines, curves, doors, labels, and what
else helps a CCTV layout. Geometry in a pure, unit-tested module; schema
extended backwards-compatibly; no new dependencies; checked in real Chromium.

| # | Task | Verification | Status |
|---|---|---|---|
| D1 | Pure module `src/domain/layoutShapes.ts`: shape types (rectangle, polyline, smooth curve, door / double door / window / gate, text), blank canvas with automatic scale, grid + snap, 45° / square constraints, resize / rotate maths, door swing geometry, length / area, point-list text form, undo/redo history, zod schema | Unit tests | done — 30 tests |
| D2 | Site-plan / project-file schema: optional `sitePlan.layout`; empty layout left out of the file; autosave, Admin status and report model aware of it | Round-trip, old-file, byte-identical and corrupt-shape tests | done — 5 tests; ASSUMPTIONS 13 |
| D3 | Drawing tools in the Site map workspace: select / move / resize / rotate / delete, rectangle (Shift = square), line, curve, opening (click or drag along a wall), label; undo/redo; grid + snap; fills; lock drawing; "Draw a new layout" with W × H in metres | jsdom tests | pending |
| D4 | Keyboard / list alternative for shapes: add, edit position / size / rotation / points / text / style, delete; focusable shapes with arrow keys, [ ], Delete | jsdom tests | pending |
| D5 | Report site map draws the layout under the devices (greyscale-readable) | jsdom test | pending |
| D6 | Real-browser check: draw a small site (building, rooms, doors, labels, curved fence), place cameras, check cable runs and the report map; desktop + phone, light + dark | Screenshots in the session scratchpad | pending |
| D7 | Close-out: README, ASSUMPTIONS, HANDOFF; lint, test, build | Real output | pending |
