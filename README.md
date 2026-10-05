# ContracTech — CCTV Design (Hikvision, phases 1 and 2)

An internal tool an integrator uses in front of a client. Enter the physical facts
of a location — mounting height, distance, scene width, environment, and what the
client actually needs to *see* — and get specific Hikvision models with their full
spec sheet and the engineering numbers that justify the choice.

Phase 2 sizes the rest of the system for the whole project: storage and drives,
the recorder (NVR), PoE switches, the CAT6 plan with real box counts, a site-map
editor to place it all on a floor plan, and a bill of materials function.

Runs offline. No backend, and no runtime network calls unless the engineer turns
on the optional OpenStreetMap view on the site map (off by default).

## Running it

Node 20 or newer.

```
npm install
npm run dev        # development server
npm run build      # static bundle into dist/
npm run preview    # serve the built bundle
npm test           # vitest: unit, engine and jsdom UI tests
npm run lint
```

`dist/` is plain static files with a relative `base`, so it can be served from
any path, a USB stick or a laptop with no network.

## What it does

**Inputs** are grouped the way an engineer works: geometry, then purpose, then
environment, then client requirements. Every field has a helper line that explains
what it means on site. There is no submit button — the results recompute on every
change.

**Purpose** drives everything. It is the DORI scale from IEC 62676-4:2014, plus
the two special cases that carry their own requirement (ANPR and till overwatch).

**Output** is a ranked primary recommendation plus up to three alternatives, each
labelled by its trade-off ("budget option", "better in low light", "more flexible
lens"), each with a plain-language case for it and an honest weak point. Each card
carries the client's fifteen-field spec-sheet table verbatim, the model number,
lens, PoE figures, price band, and a link to the Hikvision datasheet the specs
were read from.

**Every number is traceable.** Each figure has a "how this was calculated"
disclosure showing the formula as applied, the inputs, and a link to the source of
its constants. Figures that are estimates rather than sourced values carry a
visible **Unverified** badge.

**Nothing fails silently.** If no model satisfies the constraints, the tool names
the binding constraint, lists the nearest misses with their shortfall, and suggests
what to change. Every excluded model has a reason you can repeat to a client.

**The configuration is in the URL.** Copy the link to send a client's scenario to
a colleague or reopen it later. A malformed link falls back to defaults with a
readable warning rather than rendering a half-populated scenario.

## Phase 2: system design

**Design settings** (one card, every input defaulted): recording mode
(continuous / motion-only / scheduled hours), RAID level and hot spare, growth
headroom, formatting overhead; recorder channel headroom, monitors and output
resolution, form factor, redundant PSU, built-in vs external PoE, recorder
analytics (inherited from the cameras unless set), and an optional pinned model;
switch PoE headroom, spare ports, managed/unmanaged, uplink type; cabling drops,
service loop, waste, box length, connectors and patch cords per run, routing
factor. Allowances that are not sourced figures carry an **Unverified** badge.

**System design** (results card): the storage trace (Σ bitrate × recording
seconds × retention, then headroom, then formatting), the drive set that fits the
chosen recorder's bays and per-bay maximum, the recorder with every hard check
pass/fail and its margin plus alternatives and rejections, the switches (how many,
which model, which cameras on each), and the CAT6 plan: every run with its
TIA-568 verdict (over 90 m flagged, over 100 m never passes), boxes by first-fit
decreasing bin packing next to the naive total ÷ 305 m, the offcut per box,
connectors, patch cords and fibre uplinks.

**Site map**: upload a PNG/JPG floor plan (PDF is refused with a reason),
calibrate the scale by clicking or typing a known dimension, place cameras, the
NVR and switches, draw cable routes. Each camera shows its FOV cone from the
recommended lens. A camera with no drawn route gets straight line × routing
factor, drawn dashed and labelled "estimated route". The device table below the
map does everything without a pointer: x/y, facing, which switch, a typed run
length. An optional OpenStreetMap view (off by default, needs internet) shows the
site with the required attribution; two clicks on it measure a distance that can
be used as the plan's calibration length. Leaflet loads only when it is turned on
(ASSUMPTIONS 11.6).

**Saving**: the shareable link carries every location and setting but **not the
map** (the image is too big for a URL; the UI says so). *Save project* writes a
`.json` file with the plan image embedded; *Open project* validates it field by
field. The project is also autosaved to IndexedDB, and an autosave with a map is
offered for restore on the next visit.

**Bill of materials**: `buildBillOfMaterials(project)` in
`src/engine/billOfMaterials.ts` returns typed lines — cameras by model and lens,
the recorder, drives, switches, CAT6 boxes, connectors, patch cords, flagged
fibre uplinks — each product line with its datasheet URL, plus every warning and
a `complete` flag with reasons. There is deliberately no report UI yet.

## Layout

```
src/
  domain/           pure maths, no UI, no framework
    units.ts        metric/imperial, SI internally
    dori.ts         pixel-density requirements + their sources
    sensors.ts      optical format -> active area in mm
    optics.ts       FOV, focal length, lens fit
    geometry.ts     tilt, blind spot, footprint, camera count
    pixelDensity.ts achieved density and the verdict
    illumination.ts IR/white-light reach and hotspot risk
    bitrate.ts      Hikvision published bitrates -> storage
    power.ts        PoE accounting (IEEE 802.3af/at/bt)
    calculate.ts    orchestrator: one traceable result object
    types.ts        the typed scenario and the multi-location project
    standards.ts    TIA-568 limits, extend-mode PoE, drive capacity units
    storage.ts      recording time, project storage, RAID arithmetic
    designSettings.ts  phase-2 project inputs and their defaults
    cabling.ts      run lengths, TIA-568 checks, bin packing
    sitePlan.ts     site-plan types and scale maths
    sitePlanEdit.ts pure edits to the plan + FOV-cone geometry
    planImage.ts    PNG/JPEG header reading for uploads
    osmMap.ts       OpenStreetMap tile-policy constants, measuring maths
  data/
    schema.ts              zod schema — the camera data contract
    shared.ts, productSchemas.ts   schemas for NVRs, switches, drives
    hikvision-cameras.json, hikvision-nvrs.json, hikvision-switches.json, hdds.json
    cameras.ts, products.ts        validating loaders (fail loudly)
  engine/
    weights.ts      scoring weights, in one documented place
    recommend.ts    camera: hard filters, then score and rank, then explain
    outputCard.ts   the fifteen fields, in the client's order
    topology.ts     cameras → endpoints → measured runs
    storagePlan.ts  drive-configuration search
    nvrEngine.ts    recorder checks, ranking, storage advice
    switchEngine.ts switch grouping, checks and selection
    projectDesign.ts  the whole-project pass that wires them together
    siteMapView.ts  what the map draws
    billOfMaterials.ts  buildBillOfMaterials(project)
  state/            URL state, project file, IndexedDB autosave, schemas
  ui/               components (no maths)
```

## The data

38 Hikvision cameras, 19 NVRs, 11 PoE switches and 23 hard drives (Seagate
SkyHawk, WD Purple, one Hikvision drive shown but not recommended), every
specification read off the manufacturer datasheet
linked in the entry. No spec came from memory. Fields a datasheet does not state
are `null` and render as "Not specified" — never a guess, never a blank cell.
Each entry carries its datasheet URL and the date it was verified.

Adding a model is a one-object edit to its JSON file with no code change. The schema validates at load and refuses unknown fields, so a typo fails
immediately rather than quietly.

Scraping hikvision.com at runtime is deliberately not done: it would be fragile,
would block offline use, and may breach their terms.

## Not built (yet)

- The client report / printable proposal (the BOM function it needs exists).
- PDF floor plans (needs a PDF renderer; export the page as PNG/JPG instead).
- The Admin/Client UI redesign, which waits for the owner's command.

## Read these too

- `ASSUMPTIONS.md` — every decision made without being able to ask, including
  which figures are not sourced and how they are marked.
- `TASKS.md` — the task list and its final status.

