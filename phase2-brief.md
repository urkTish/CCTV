# Phase 2 Brief — HDD, NVR, PoE Switch, CAT6 Calculator, Site Map, BOM, Branding

Phase 1 (camera recommendation) is complete and approved by the owner. Same
project, same rules as the original brief (`cctv-selector-agent-prompt.md`):
mandatory process, written task list in `TASKS.md` with statuses **kept current
row by row as you go**, no fabricated specs, every spec sourced from a
manufacturer datasheet with URL + `verifiedOn`, `null` + "Not specified" when
unsourced, pure unit-tested domain/engine modules, TS strict, no `any`,
lint/test/build green with real output in the report. Log every assumption in
`ASSUMPTIONS.md`.

**Do not redesign the existing UI layout.** A separate UI/UX agent will restructure
the whole interface later, only on the owner's command (an "Admin" version and a
simplified "Client" version). Your job is engine, data, and functional UI that
slots into the current structure cleanly. Keep logic out of components so that
agent can rearrange screens freely without touching the maths. **Do not build the
client report** — but do build the pure function it will need (item 6).

## 1. HDD / storage recommendation

**Inputs**
- Retention days (already collected per location)
- Recording mode: continuous / motion-only / scheduled hours per day
- Motion level (already exists)
- RAID level: none / 1 / 5 / 6 / 10, with a hot-spare option
- Growth headroom % (default 20%)

**Calculation:** sum over every camera in the project of
per-camera bitrate (already emitted) × recording seconds × retention, adjusted for
the recording mode. Then add RAID overhead, then filesystem/formatting overhead
(source a figure or flag it as an estimate), then headroom. Show the formula trace
the same way phase 1 does.

**Output:** the number of drives × capacity, total raw vs usable TB, and specific
surveillance-rated drive models, for example Seagate SkyHawk and WD Purple.
Recommend Hikvision-branded HDDs only if you find a real Hikvision HDD datasheet.

The drive configuration must fit the chosen NVR's bay count and its maximum
capacity per bay — that is the compatibility check. If the storage doesn't fit any
configuration of the chosen NVR, say so and suggest one of:
- a larger NVR
- fewer retention days
- lower-bitrate settings

## 2. NVR recommendation

Project-level inputs, each with a default:
- Channels needed = cameras in the project + channel growth headroom % (default 25%)
- Incoming bandwidth total (computed, not typed) vs the NVR's rated incoming
  bandwidth
- Highest camera resolution in the project → the NVR must decode/record it
- Storage required (item 1) → drive bays × max capacity per bay
- RAID required? (only some series support it)
- Built-in PoE ports, or an external switch. Default: built-in when channels ≤ 16
  and every camera is within 90 m of cable from the NVR; otherwise an external
  switch.
- Recorder-side analytics: AcuSense NVR, face recognition, ANPR, people counting.
  Inherit these from the camera analytics choices.
- Video outputs: number of monitors and max output resolution (HDMI 4K vs 1080p)
- Form factor: desktop / 1U / 1.5U / 2U rackmount
- Redundancy: N+1 / dual power supply (premium tier only)
- Budget tier (already exists)

**Data:** `src/data/hikvision-nvrs.json`, populated only from Hikvision NVR
datasheets. Aim for 12–20 models spanning 4 to 64+ channels, PoE and non-PoE, and
1 to 8+ bays. No padding.

**Output:** a primary recommendation plus alternatives, with reasons and weak
points, exactly like the camera engine. Show every hard check pass/fail with its
margin: channels, bandwidth, resolution, bays × capacity, and PoE budget if PoE is
built in.

## 3. PoE switch recommendation

**Inputs**
- The camera list for each switch, computed from the map/cable plan (items 4–5)
- PoE budget headroom % (default 25%)
- Managed vs unmanaged. Default: unmanaged for ≤ 8 cameras on the economy tier,
  managed otherwise.
- Uplink type: copper GbE / SFP fibre
- Spare ports % (default 20%)

**Checks**
- PoE port count
- Total PoE budget vs summed camera draw + headroom
- Per-port standard 802.3af/at/bt (PTZ and heated cameras need at/bt)
- Uplink bandwidth vs aggregate camera bitrate on that switch
- Hikvision long-range/extend PoE mode for runs of 100–250 m. Source the datasheet
  distance and the speed it drops to, and flag it.

**Data:** `src/data/hikvision-switches.json` (DS-3E series and similar), 10–15
models, from datasheets only.

**Output:** how many switches, which model each one is, and which cameras connect
to each.

## 4. Site map editor

**Floor-plan mode (primary, offline-first)**
- Upload a floor or site plan image (PNG/JPG; the first page of a PDF if that's
  easy, otherwise say PDF isn't supported).
- Calibrate the scale by drawing a line over a known dimension and entering its
  real length. All distances derive from that scale. Show the scale and allow
  recalibration.

**Online mode (optional):** OpenStreetMap tiles via Leaflet when internet is
available. Comply with the OSM tile usage policy (attribution, no heavy bulk use).
Satellite imagery is out unless a provider's terms allow it without a key. Never
put an API key in code.

**Placing devices**
- Place and drag cameras. Each is linked to a phase-1 location and shows its FOV
  cone from the computed horizontal FOV and coverage distance. Cones are rotatable.
- Place the NVR/rack room and switches/IDF points.

**Cable routes**
- Draw cable routes as polylines from each camera to its switch or NVR. Cables run
  along walls and ceilings, not in straight lines.
- If a camera has no drawn route, estimate one as the straight-line distance × a
  routing factor (default 1.3, editable, flagged as an estimate), and mark it
  "estimated route".

**Saving:** the uploaded image is too big for the URL, so add project Save/Open as
a `.json` file with the image embedded as a data URI. Add IndexedDB autosave
wrapped in try/catch. URL sharing keeps working for scenarios without a map; say so
in the UI.

**Accessibility:** provide a keyboard/list alternative to the map — a table of
placed devices with editable x/y and route length.

## 5. CAT6 cable calculator

**Length per run**
- horizontal route length (map polyline × scale, or the estimate)
- \+ vertical drops: camera mount height, plus a ceiling-to-rack drop at the
  NVR/switch end (inputs with defaults)
- \+ termination/service-loop slack (default 3 m per run, editable)
- \+ waste allowance (default 10%)

**The 100 m limit:** TIA-568 allows a 100 m channel (90 m permanent link + 10 m
patch). Verify and cite these figures. Flag any run over 90 m and suggest a closer
switch on the map, long-range PoE mode, or a PoE extender. A run over the limit
must never silently pass.

**Uplinks:** count switch-to-NVR uplinks separately. An uplink over 90 m is flagged
as needing fibre and listed as its own line item, not as CAT6.

**Boxes are not total ÷ 305.** A run cannot be spliced across two boxes. Compute
boxes with bin packing (first-fit decreasing, run lengths into 305 m bins). Show
the naive total-metres figure, the real box count and the leftover offcut per box.
Keep 305 m per box as one configurable constant.

**Also count:**
- RJ45 connectors (2 per run, configurable)
- patch cords (1 per run)

No conduit or trunking.

## 6. Bill of materials (function only, no report UI)

A pure `buildBillOfMaterials(project)` that returns a typed BOM listing:
- every camera model × quantity
- NVR(s)
- HDDs × quantity
- switch(es)
- CAT6 boxes, connectors and patch cords
- fibre uplinks, flagged

Every hardware line carries its datasheet URL, and the BOM carries the warnings
that apply. Unit-test it on a realistic multi-location project. It must be complete
enough that the later client report needs no further calculation.

## 7. ContracTech branding

The platform belongs to the owner's company, **ContracTech**.

**Source files (read-only):** `C:\Users\Admin\Desktop\Contractech\Files\FullLogo.jpg`
and `Company Stamp.png`. Never modify, move or delete anything in that folder. It
also holds unrelated private company documents: do not open them. Never reference
the Desktop path from code.

1. Copy both files into `src/assets/brand/` (originals kept as
   `fulllogo-original.jpg` / `company-stamp-original.png`).
2. **Logo:** make a tight crop with a transparent background, and a dark-mode
   variant with a light wordmark and the blue swoosh unchanged. Never redraw it. If
   keying fails, use a white rounded plate in dark mode.
3. Put the logo in the app header: left side, ~28–36 px tall, alt text
   "ContracTech", switching variant with the theme. This is a minimal header change
   only, with no layout restructure.
4. **Stamp:** make a transparent PNG by removing the opaque grey vignette and
   keeping only the blue ink (soft alpha edges, full resolution). Do not use it in
   the UI. It is for the future client report.
5. `src/brand.ts` exports: logo light/dark, stamp, the company name "ContracTech",
   and the brand blue sampled from the swoosh as hex. Do not retheme the app.
6. Add a test that every brand export resolves to a real file. Visually check the
   processed images, and report anything the owner should look at before the stamp
   goes on client documents.

## Order

1. data + schemas
2. storage maths
3. NVR engine
4. switch engine
5. map data model + scale maths
6. cable maths (bin packing)
7. map UI
8. wire everything into the project totals
9. BOM
10. close-out

Branding (item 7) is slotted in as its own group P without disturbing this order.
