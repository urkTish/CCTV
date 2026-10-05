# Assumptions

Everything on this list is a decision I made without being able to ask. Correct
any of them and the code points at where the change goes.

Written 2026-10-04.

---

## 1. Stack and operating model

| # | Assumption | Where it lives | If wrong |
|---|---|---|---|
| 1.1 | Vite + React 19 + TypeScript strict + Tailwind v4, no backend. | `package.json`, `vite.config.ts` | Rewriting the UI layer only; `src/domain/` and `src/engine/` have no framework dependency. |
| 1.2 | Runs fully offline as static files. `base` is `./` so the build opens from any path, and no code makes a network request at runtime. | `vite.config.ts` | — |
| 1.3 | Camera data lives in one versioned JSON file read at build time, not fetched. | `src/data/hikvision-cameras.json` | — |
| 1.4 | Units: metric/imperial toggle, metric default. State is always metres; imperial is a presentation layer only. | `src/domain/units.ts` | — |
| 1.5 | Printable/PDF client proposal is out of scope for phase 1. | — | It is phase 2, alongside the bill of materials. |

## 2. Figures I could not source, and how they are marked

Each of these is flagged `isEstimate: true` in code and shows an **Unverified**
badge in the UI wherever it affects a number on screen.

| # | Figure | Value used | Why it is an assumption |
|---|---|---|---|
| 2.1 | "Monitor / crowd overview" pixel density | 12.5 px/m | **Not a level in IEC 62676-4.** The standard defines four levels (detect, observe, recognise, identify), not five. 12.5 px/m is a widely repeated industry convention of half the Detect figure. I could find no standards source. |
| 2.2 | "Cash / till overwatch" pixel density | 250 px/m | Also not a standard level. Mapped to identification-grade because the operational need is the same. |
| 2.3 | Pixel-density margin band | 15% | The allowance above the threshold below which a model is called "marginal" rather than "pass", to account for motion blur, compression, rain and a dirty dome. An engineering judgement, not a published figure. |
| 2.4 | IR / supplement-light headroom | 20% | The fraction of a published light range held back as margin. Manufacturer ranges are measured on a high-reflectance target in clear air. Engineering judgement. |
| 2.5 | IR hotspot warning thresholds | subject closer than 2 m, illuminator 30 m or longer | When to warn about close subjects being washed out. Practitioner rule of thumb. |
| 2.6 | Tilt-angle guidance | too steep above 45°, facial ID degrades past 30°, too shallow below 10° | Practitioner rules of thumb, shown as guidance rather than as a pass/fail verdict. |
| 2.7 | Camera-overlap allowance | 15% default, user editable | Common installation default for seam-free coverage. |
| 2.8 | "Moderate" motion bitrate multiplier | x1.15 | Interpolated inside Hikvision's own published "+20%~30% for more complex environments" guidance. The low (x1.00) and high (x1.30) steps *are* sourced. |
| 2.9 | Target (face) height default | 1.6 m | A conventional working figure for an adult's eye/face height. It is an input the user can change, and it only affects the tilt angle. |
| 2.10 | Sensor active areas for 1/4", 1/2.9", 1/2.7", 1/2.5", 1/1.7" | interpolated from the Commonlands curve, split 16:9 | No published sensor found to cross-check these specific formats. 1/3", 1/2", 1/2.8", 1/1.8" and 1/1.2" **are** cross-checked against real sensors and are not flagged. |

### What *is* sourced

For contrast, these are not assumptions and carry their source URL in the code:

- DORI 25 / 63 / 125 / 250 px/m — IEC 62676-4:2014 via the Axis white paper.
- LPR plate-width requirement — 170 px across a 0.52 m single-line EU plate.
- Focal length and angle-of-view formulas — standard machine-vision optics.
- Sensor active area for 1/2.8" (Sony IMX327) and 1/1.2" (Sony IMX585).
- Every bitrate figure — Hikvision's own published recommended bit-rate tables.
- IEEE 802.3af/at/bt port and powered-device wattages.
- Every camera specification — the manufacturer datasheet linked on each card.

## 3. Camera dataset

| # | Assumption | Note |
|---|---|---|
| 3.1 | `priceTier` (economy / standard / premium) is **editorial**, assigned from series positioning. | There is no public Hikvision price list. The card labels it "indicative" and the scorer weights it at only 10%. Replace it with your real buy prices and the budget filter becomes meaningful. |
| 3.2 | "Room Type" on the card is a **suggested application**, derived in code from form factor, ingress rating, light range and ANPR capability. | Marked `derived` on the card. Hikvision does not publish a field for this. |
| 3.3 | "Controller Type" is derived from the published client-software list, ONVIF profiles and PTZ capability. | Marked `derived`. |
| 3.4 | "Alert Type" is derived from the published alarm I/O, audio hardware and strobe/siren features. | Marked `derived`. |
| 3.5 | `mountTypes` is the set of mounting methods the datasheet's accessory list implies for that form factor. Where the datasheet names specific bracket models, they are quoted verbatim in `requiredBracket`. | Most of these cameras need no bracket to mount directly; the brackets are optional accessories and are described as such. |
| 3.6 | `colour` is `null` (renders "Not specified") for every model except DS-2CD2143G2-I (Black), whose finish is in its model name. | Hikvision datasheets do not state a colour field. White is the usual supply but I will not guess it. |
| 3.7 | `stillResolution` is `null` for every model. | None of these datasheets publishes a snapshot resolution separate from the video resolution. The card says so and quotes the max video resolution instead. |
| 3.8 | Where a datasheet quotes a spec per variant suffix (-S, -U, -2U, -F), the dataset records the **fully-populated** variant's figures and the note says which suffix is needed. | e.g. DS-2CD2123G2-I shows 1 alarm in/out, which is the -S variant. Check the suffix when ordering. |
| 3.9 | Operating temperature is `null` where the datasheet revision I read did not state it. | Affects 7 entries. It renders as "operating temperature not specified" on the card. |
| 3.10 | DS-2CD2T47G2-L: the datasheet prints "I: 2 m" for the 2.8 mm identify distance, which contradicts its own D/O/R figures. | Recorded as `null` with a note, rather than reproducing an obvious typo. |
| 3.11 | Five models publish their DORI distances as a layout table my PDF text extraction could not read reliably. | Recorded as `null` rather than guessed. The tool's own geometry still works for them; only the datasheet cross-check row is missing. |
| 3.12 | The two panoramic models' horizontal FOV is clamped below 180°. | A rectilinear-lens model cannot represent 180° or more (the tangent diverges). The DS-2CD2387G3P datasheet states 182.6°; it is stored as 179.9° and its note says the pixel-density figure for it is indicative only. |

## 4. Engineering choices worth challenging

| # | Choice | Reasoning |
|---|---|---|
| 4.1 | Pixel density is the **only** hard gate on a model, after the environment filters. Lens fit affects the score but does not veto. | A lens that is "too wide" for the stated scene still sees the target; it just shows more of the surroundings, and that cost is already priced into the achieved px/m. Vetoing on lens fit threw away models that genuinely met the requirement. |
| 4.2 | A varifocal is evaluated at the focal length the scene needs, clamped into its range — not at its widest setting. | That is what the installer will set at commissioning. **Known consequence:** zooming to the stated scene width maximises pixel density but shrinks the vertical field of view, which pushes the blind spot out and can leave almost no ground coverage on the approach. The tool warns when that happens rather than hiding it, but it does not automatically trade density for coverage — the engineer decides. If you would rather it optimised for coverage, that choice lives in `chooseFocalLength()` in `src/domain/calculate.ts`. |
| 4.3 | Where a datasheet publishes a horizontal FOV angle for a lens at its widest setting, that measured figure is used in preference to our own sensor-table arithmetic. | A manufacturer measurement beats a curve fit. The calculation panel says which basis was used. |
| 4.4 | Scoring weights: pixel density 35%, lens fit 20%, low light 20%, feature match 15%, budget 10%, summing to 1. | Documented with reasoning in `src/engine/weights.ts`; a test asserts they still sum to 1. |
| 4.5 | "Room dimensions" mode assumes the camera looks down the **long** axis from one end, so the long axis is the distance and the short axis is the scene width. | Worst case for a single camera. |
| 4.6 | Outdoor requires at least IPx6; semi-covered at least IPx4; dust or washdown requires IP6x; vandal exposure requires IK10. | Conventional integrator practice. All four are in one function (`rejectForConstraints`). |
| 4.7 | Strong backlight requires at least 120 dB **true** WDR, which excludes every digital-WDR model. | A digital-WDR camera facing a doorway will not deliver. |
| 4.8 | Storage is reported in decimal GB (10^9 bytes) and assumes continuous recording. | Drives are sold in decimal GB. Motion-only recording will be materially lower; the panel says so. |
| 4.9 | Only the frame rates Hikvision publishes a bitrate column for (30/25/20/15/12.5/10) are offered. | Interpolating a bitrate would be inventing a figure. |
| 4.10 | For a resolution with no published bitrate row, the next **larger** published row is used, flagged as an estimate. | Never under-estimate bandwidth. |

## 5. Deliberately not built (in phase 1)

*Phase 2 has since built the recorder, storage, switching, cabling, site map and bill-of-materials function; see sections 7 to 11. The printable client proposal is still not built.*

NVR/recorder selection, storage hardware and RAID sizing, PoE switch selection,
cable runs and distance limits, and the printable client proposal with a bill of
materials. They are designed for:

- the recommendation engine is a pure function over typed inputs;
- the project/location data model is multi-device from the start
  (`projectTotals()` already aggregates across locations);
- per-camera bandwidth, storage and PoE are already computed and emitted;
- each product category gets its own data file against a shared schema
  (`src/data/schema.ts` exports `poeStandardSchema` and `priceTierSchema` for
  the phase-2 files to reuse).

## 6. Environment notes specific to this machine

| # | Note |
|---|---|
| 6.1 | Node.js was not installed. I extracted the official Node 24.21.0 LTS Windows x64 zip to `C:\Users\Admin\n24\node-v24.21.0-win-x64` and put it on `PATH` for each command. Nothing was installed system-wide and no registry or system setting was changed. |
| 6.2 | The project path (`...\AppData\Roaming\Claude\scratch-workspaces\...`) is 156 characters, and Windows long paths are disabled on this machine (`LongPathsEnabled = 0`), so `npm install` could not create `node_modules`. I created a junction at `C:\Users\Admin\cv` pointing at the project and ran npm from there. |
| 6.3 | (Superseded, see 8.1.) That junction, combined with the fact that `AppData\Roaming\Claude` is itself redirected to a packaged-app LocalCache path, made Rollup resolve `index.html` to a foreign absolute path and refuse to build. `resolve.preserveSymlinks: true` in `vite.config.ts` fixes it. On a normal checkout the option is harmless. |
| 6.4 | `vitest` was bumped from 2.x to 3.x because vitest 2 bundles its own Vite 5 and its plugin types clash with Vite 6. |

---

# Phase 2 — recorder, storage, switching, cabling, site map, BOM, branding

Written 2026-10-05. Sections 7 onward are phase 2; sections 1 to 6 above are
unchanged from phase 1.

## 7. Phase-2 product data

| # | Assumption / finding | Note |
|---|---|---|
| 7.1 | **19 NVRs, 11 PoE switches, 23 hard drives**, each read off the manufacturer PDF in its `datasheetUrl` via local text extraction (pdfjs). Every entry carries `verifiedOn`. Unstated fields are `null`. | `src/data/hikvision-nvrs.json`, `hikvision-switches.json`, `hdds.json`; schemas in `src/data/productSchemas.ts`. |
| 7.2 | **A real Hikvision HDD datasheet exists** ("Hikvision IoT 4T/6T/8T/10T/16T HDD", assets.hikvision.com m000064038). It is in the data, but the storage engine does **not** recommend it: the datasheet positions it for "enterprise-class data storage", publishes no workload rating, and none of its part numbers is on Hikvision's own *HDD Compatible List for Hikvision DVR/NVR* (v20240718). It appears in the result as an excluded option with that reason. | Change `isRecommendableDrive()` in `src/engine/storagePlan.ts` if you stock it. |
| 7.3 | Only **CMR** SkyHawk / WD Purple part numbers are listed. SMR variants (ST2000VX015, ST4000VX013) were deliberately left out. | SMR drives rebuild badly under RAID. |
| 7.4 | Drives are preferred when their exact part number is on Hikvision's compatibility list v20240718. Drives not on it are still offered, with a warning to confirm with the distributor. | `onHikvisionCompatList` per drive. |
| 7.5 | NVR `formFactor` is `desktop` for any chassis narrower than 19-inch rack width (about 440 mm), even where Hikvision's title says "1U". | Each affected entry's note says so. A desk chassis on a rack shelf is still possible; the engine just will not call it rack-mount. |
| 7.6 | An NVR's `analytics` list records every analytic its datasheet lists, **including those Hikvision lists as "AI by camera" or "configurable special camera smart functions"** (the camera does the recognition; the recorder accepts, stores and searches the events). Each such entry's note says which side does the work. The NVR check therefore asks "does this recorder support the workflow", not "does the recorder do the recognition itself". | e.g. ANPR on DS-7604NXI-K1/4P and the M series. |
| 7.7 | Hikvision's extend-mode PoE: datasheets give the reach (300 m) but only the DS-3E0318P/0326P quick-start guide gives the speed (10 Mbps). For every other long-range model the 10 Mbps figure is **applied as an estimate** and flagged. The brief assumed 250 m; Hikvision publishes 300 m and that is used. | `HIKVISION_EXTEND_MODE` in `src/domain/standards.ts`. |
| 7.8 | DS-3E0505HP-E: datasheet says 802.3bt without naming the Type; 60 W per port corresponds to Type 3 and is recorded as such. | Its note says so. |
| 7.9 | `priceTier` on NVRs, switches and drives is **editorial**, exactly as for cameras. | No public price list. |

## 8. Environment (phase 2)

| # | Note |
|---|---|
| 8.1 | The project now lives at `C:\Users\Admin\Desktop\Contractech\My Platform`, a short ordinary path. `resolve.preserveSymlinks: true` was removed from `vite.config.ts` after confirming that build and all tests pass without it; it existed only to work around the old junctioned path (6.2, 6.3). |
| 8.2 | `node_modules` was not copied; it was reinstalled with `npm ci` from the existing lockfile. npm reports that esbuild's postinstall script is not on its allow-list; build and tests run regardless. |

## 9. ContracTech branding

Source files were copied byte-for-byte into `src/assets/brand/` (`fulllogo-original.jpg`,
`company-stamp-original.png`). Nothing in code references the Desktop folder (a test
enforces it). The processing script lives outside the project, at
`C:\Users\Admin\pdftool\brand.mjs` (pngjs + jpeg-js); it reads only the copies.

| # | What was done | Why / what to check |
|---|---|---|
| 9.1 | **Logo, light variant**: colour-to-alpha against the white page. Each pixel is classified as swoosh or wordmark by hue, then its alpha is the projection of (white − pixel) onto (white − that object's solid colour), so anti-aliased edges keep their true coverage. Tight crop on alpha with 10 px padding: 693 × 208 px. No pixel was redrawn. | Re-composited over white it differs from the original JPEG by 0.6/255 on average (checked 2026-10-05). |
| 9.2 | **Logo, dark variant**: same alpha; neutral (wordmark) pixels recoloured to `#EEF2F6` (the app's dark-mode ink); blue swoosh pixels untouched. Keying succeeded, so no white plate was needed. | At 5× zoom a few isolated, faint pixels of JPEG noise survive next to the letters and at the swoosh tip. Invisible at the 32 px header height. |
| 9.3 | **Brand blue** `#536FFC`: median of the most-covered swoosh pixels in the source JPEG. | JPEG-derived, so the last digit per channel is approximate. If an official brand-guide hex exists, prefer it. Applied to the theme in the UI redesign (12.1). |
| 9.4 | **Stamp**: ink keyed on "blue and dark" (blue excess − 0.5 × luminance) with a soft 12→30 ramp; faint pixels kept only within 2 px of solid ink; nothing outside the outer ring (geometric guard); edge colours un-mixed against the local background; full 1024 × 1024 resolution. | Measured on the output: alpha is exactly 0 everywhere outside the outer ring and in the corners (no grey halo or vignette left). |
| 9.5 | **What the owner should look at before the stamp goes on a client document** — see the close-out report for the full visual description. In short: (a) the ink comes out darker and navier (opaque mean ≈ `#193E70`) than it looks in the source, because the source's bright blue glow has been removed; (b) the light speckles inside the strokes, which are part of the rubber-stamp texture, became small transparent holes, so on white it reads as a slightly more "distressed" impression than the source; (c) the stamp is low contrast on dark backgrounds — it is meant for white paper. | If a cleaner, flat-colour stamp is wanted, ask for a vector redraw from the original artwork rather than keying a photo. |
| 9.6 | The stamp is exported from `src/brand.ts` (`STAMP_URL`) and used only by the report's sign-off block (`src/report/SignOff.tsx`), and only on a report made Final; a test fails if any other file references it. | See 12.9. |

## 10. Phase-2 engineering choices (storage, recorder, switching, cabling, BOM)

| # | Choice | Reasoning / where |
|---|---|---|
| 10.1 | Recorder analytics are **inherited from the cameras' analytics** unless the engineer sets them: ANPR → ANPR; people counting → people counting; face capture → face recognition (the recorder holds the face lists); AcuSense → Motion Detection 2.0 (the recorder's human/vehicle filter). Only locations that have a recommended camera contribute. | Brief item 2. `inheritedRecorderAnalytics()` in `designSettings.ts`. |
| 10.2 | **Monitor outputs count HDMI only.** On most of these recorders VGA mirrors HDMI 1 rather than driving a separate monitor, so counting it would over-promise. | `evaluateNvr()` in `nvrEngine.ts`. |
| 10.3 | Storage is computed on each camera's **target** bitrate (what it writes on average); the recorder's incoming-bandwidth check uses the sum of **peak** bitrates (what it must be able to ingest). | `designProject()`. |
| 10.4 | Storage chain: recorded data → × (1 + growth headroom) → ÷ (1 − formatting overhead) = usable capacity the drives must give **after** RAID. Both steps are multiplicative, so their order does not change the result. The 5% formatting overhead is an estimate (no published figure for a Hikvision NVR) and is flagged. Motion-only duty (default 30%) is always flagged. | `storage.ts`, `standards.ts`. |
| 10.5 | **One budget tier for project hardware**: when every location asks for the same tier it is used; mixed tiers score as "any" (fit first, then the economy-leaning default), because one recorder and its switches serve every location. | `projectBudgetTier()`. |
| 10.6 | **Built-in vs external PoE (auto)**: built-in only when the channels needed (cameras + headroom, rounded up) are 16 or fewer, no camera is cabled to a switch placed on the map, and every camera's **installed** run (route + camera drop + rack drop + service loop, before waste) is 90 m or less. The reason is shown, and it says when run lengths are estimates. | Brief item 2. `decidePoeMode()`. |
| 10.7 | **One recorder per project**, at the first NVR placed on the map. When nothing fits, the engine says so and suggests splitting across two recorders, but does not design the split. A camera is cabled either to a placed switch or back to that NVR rack. | `topology.ts`, `connectCamera()`. |
| 10.8 | **Switch groups**: one per placed switch (IDF), plus one at the rack for cameras cabled straight back — unless PoE is built-in, when the recorder powers those. A switch in the rack uplinks to the NVR by patch cord, so it has no uplink run in the cable plan; an IDF switch's uplink has a rack drop at both ends. | `groupCameras()`, `cabling.ts`. |
| 10.9 | The TIA-568 90 m / 100 m checks use the **installed** length; the waste allowance is purchasing only. Extend-mode PoE runs over 100 m still show as TIA failures in the cable plan **and** as served-by-extend-mode in the switch plan: both are true. | `cabling.ts`, `switchEngine.ts`. |
| 10.10 | Defaults that are planning allowances, not sourced: ceiling-to-rack drop 3 m, routing factor 1.3, unplaced-camera run 40 m (all flagged Unverified wherever they feed a number); service loop 3 m and waste 10% are the brief's defaults. | `designSettings.ts`, `ESTIMATED_DEFAULTS`. |
| 10.11 | **Bill of materials.** Product lines (cameras, recorder, drives, switches) carry the manufacturer datasheet URL and `verifiedOn`. Commodity lines (CAT6 box, RJ45 connectors, patch cords, fibre runs) are marked `generic` with no datasheet and no invented part number. Cameras are one line per model **and lens**. Patch-cord length, fibre type, fibre connectors and SFP modules are **not sized** (the line says so). A BOM that could not be fully designed is `complete: false` with the reasons, never silently short. | `billOfMaterials.ts`. |
| 10.12 | Design-setting inputs are **clamped to the ranges the URL and file schemas accept** as they are typed, so an out-of-range value can never produce a link or file that will not reopen. | `DesignSettingsPanel.tsx`. |

## 11. Site map and project files (M1–M6, K3)

| # | Assumption / choice | Note |
|---|---|---|
| 11.1 | **PDF plans are refused**, with the message "PDF plans are not supported… export or screenshot the page as PNG or JPG". Rendering a PDF page needs pdf.js (about 1 MB), which is not a dependency and was not added. | `src/domain/planImage.ts`. Add pdf.js and render page 1 to a canvas if PDF upload is wanted. |
| 11.2 | An uploaded file is identified by its **bytes** (PNG signature / JPEG SOI), never by its name or MIME type, and its pixel size is read from the PNG IHDR chunk or the JPEG SOF marker. No image decoding is needed. Limit 22 MB per image (the project file caps the data URI at 30 MB, and base64 adds a third). | `readImageHeader()`. |
| 11.3 | Positions are stored in **image pixels**. Distances exist only after calibration (a line over a known dimension + its real length). Uploading a new image **clears the calibration** but keeps devices and routes (a re-exported drawing usually keeps its geometry); the UI says to recalibrate. | `replaceImage()`. |
| 11.4 | The **FOV cone** is a plan-view wedge: the horizontal FOV delivered by the location's recommended lens, centred on the camera's facing (degrees clockwise from "up" on the plan), out to the location's target distance. It shows direction and reach only; the blind spot under the camera and the vertical FOV are not drawn. | `fovCone()`. |
| 11.5 | **Typed run length.** Every placed camera and switch has an optional engineer-entered horizontal run (`runMetresOverride`). It overrides the plan, works without calibration, and is **not** flagged as an estimate (it is the engineer's measurement). This is how the keyboard/list alternative sets a run without drawing one. Run basis is reported as drawn / typed in / estimated / placeholder everywhere it is shown. | `horizontalRunBetween()`, `buildTopology()`. Files saved before this field existed open with it set to null. |
| 11.6 | **OpenStreetMap mode (M5) is a reference view, off by default, not a second plan.** A checkbox in the Site map card ("Show OpenStreetMap (online)") shows OSM tiles via Leaflet. The engineer can look up the site and click two points to measure a great-circle distance (sphere R = 6 371 km, as Leaflet; within about 0.5% of the ellipsoid, far inside the few-metre accuracy of map features), then **Use as calibration length** puts it into the plan's calibration form — the image + calibration flow is otherwise unchanged, and every distance still comes from the calibrated plan. Nothing from the map (view, measurement, tiles) is stored in the project, the link or the autosave; the last view is kept in memory only while the page is open. Not done: the map as a plan background with devices placed in lat/lng (it would need a second coordinate system in the project file). **Tile policy:** OSMF Tile Usage Policy, https://operations.osmfoundation.org/policies/tiles/, **checked 2026-10-05**. The live page was blocked by this environment's network proxy (HTTP 403), so it was read from the page's published source, github.com/openstreetmap/owg-website `policies/tiles.md` (permalink /policies/tiles/, last changed 2026-08-11, commit c496c36). Implemented: the exact URL `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (HTTPS, no subdomains); maxZoom 19; visible "© OpenStreetMap contributors" linking to https://www.openstreetmap.org/copyright, drawn over the map's bottom-right corner whenever the map is shown (not behind a toggle); the browser's own User-Agent and Referer, with no Referrer-Policy, `crossOrigin` or request headers set; the browser's normal HTTP cache only (no no-cache headers, no cache of our own); only tiles in the viewport — no prefetch, bulk or offline download; the recommended "Report a map issue" link to /fixthemap. A page opened from `file:` sends no Referer, so the map warns there. Not done: the recommended switchable tile URL (it is one constant). Off by default because the tool is meant to run offline and turning the map on sends the area viewed (a client's site) and the user's IP to OSMF servers (OSMF privacy policy). No satellite imagery and no API key. When offline, when Leaflet fails to load, or when tiles fail, a message says so and the plan editor carries on. | `src/domain/osmMap.ts` (policy citation, constants, pure maths), `src/ui/OsmReferenceMap.tsx`, `src/ui/osmLeaflet.ts` (the only Leaflet importer, loaded by dynamic `import()` with its CSS: separate chunk of about 150 kB + 16 kB CSS). |
| 11.7 | **Autosave** writes the whole project to IndexedDB (database `contractech-cctv`, store `autosave`), in the same JSON format as Save project, 0.8 s after the last change. If an autosave with a site map exists at start-up, it is **offered** for restore, not applied, and autosave is paused until the engineer chooses — so a map-less project from a shared link cannot overwrite it. Every IndexedDB call is in try/catch; when IndexedDB is missing or blocked the UI says so and the app carries on. | `src/state/autosave.ts`, `src/ui/useAutosave.ts`. |
| 11.8 | Project files carry a `format: "contractech-cctv-project"` marker and a version (1), and are validated field by field on open; any failure is reported with the failing path, and the current project is left untouched. Files are deterministic (no timestamps), so saving an opened file gives identical bytes. | `src/state/projectFile.ts`. |
| 11.9 | When a location's camera count goes down or a location is removed, the cameras that no longer exist are **removed from the site plan** (with their routes). | `pruneSitePlan()`. |

## 12. UI/UX redesign — Admin, Client, client report

Written 2026-10-05. The engine, the data files, the existing project / URL /
file schemas and `buildBillOfMaterials` are unchanged.

| # | Decision | Reasoning / where |
|---|---|---|
| 12.1 | **Brand blue in the tokens.** `#536FFC` is 4.16:1 on white: it passes 3:1 for fills, borders, focus rings and indicators but not 4.5:1 for text or white button labels. Text, links and primary-button fills use a derived darker shade `#3d56d1` (6.1:1 with white) in light mode and a lighter `#8fa1fd` in dark mode. Status colours are never the brand blue. | `src/index.css`; every pair is checked by `src/ui/tokens.test.ts`, which also caught two old failures (secondary text on the canvas 4.44:1, input borders 2.5:1), both fixed. |
| 12.2 | **Routes in the hash.** `#/client` and `#/intake/<base64url>` start with "/", which base64url never contains, so they cannot collide with a project link. | `src/ui/route.ts`. |
| 12.3 | **Extras beside the schemas, not in them.** The project, URL and file schemas are strict and were not changed. Client name and contact, prices, currency, validity, report state and intake provenance live in `ProjectExtras`; *Save project* wraps the unchanged project-file document in a `contractech-cctv-workspace` envelope when there are extras, and writes the plain project file byte for byte when there are none. The shareable link does not carry extras (the UI says so). An older copy of the app refuses an envelope with a clear "not a ContracTech CCTV project file" reason. | `src/state/workspace.ts`. |
| 12.4 | **Client purposes.** Watch general activity → Detect (25 px/m, the lowest IEC 62676-4 level, rather than the unverified 12.5 px/m "monitor"; flagged for the engineer); see what people are doing → Observe; recognise people I know → Recognise; clearly identify faces → Identify; read car number plates → LPR; watch the cash register → till overwatch. | `SEE_OPTIONS` in `src/client/intakeMapping.ts`. |
| 12.5 | **Client distance ranges are sized for their far end**: under 5 m → 5 m, 5–15 m → 15 m, 15–30 m → 30 m, over 30 m → 40 m (open-ended; flagged). | The engine must hold the pixel density to the furthest point; under-sizing would be the worse error. |
| 12.6 | **Defaults for what the client is not asked**, each recorded as assumed with its reason: mounting height 2.7 m indoors / 3 m outside; scene width by purpose (activity 12 m, actions 8 m, recognise 5 m, identify 3 m, plates 3.5 m, till 1.2 m), capped at the distance; target height 1.6 m (0.5 m for plates); ceiling indoors / wall outside; no vandal risk, colour at night, strong backlight, special conditions, audio, analytics (ANPR is not assumed for "read plates"), PTZ; either lens; moderate motion, H.265+, 25 fps. 19 marks per area, 20 for "general activity". | Planning assumptions for a draft, never survey results. |
| 12.7 | **The client's recorder and power answers are the client's options** (owner decision): desk → desktop; network cabinet → rack, or 1U / 1.5U / 2U if the client knows; not sure → any. Power: let the engineer decide → auto; from the recorder → built-in PoE; separate switch → external. They are mapped directly (not flagged as assumed), shown beside Form factor and Camera power in Admin, and stay editable there. | `formFactorFor`, `POWER_TO_POE_MODE`. |
| 12.8 | **The indicative summary** is `buildBillOfMaterials` on the mapped project, put into words. When no recorder fits every answer it says "a recorder the engineer will choose" and why it may be, rather than dropping the recorder silently. | `src/client/indicative.ts`. |
| 12.9 | **Report.** Built from the BOM and the engine outputs it carries; the only arithmetic is presentation (price × quantity where a price was typed, the valid-until date). Retention is stated as the target ("sized to keep about 30 days") because the design output carries no achieved-retention figure (see the close-out report). Draft → Final needs a confirmation dialog with a tick; Final snapshots the date and the engineer's details. The stamp: 38 mm, −10°, `mix-blend-mode: multiply`, overlapping the signature line, never over figures. | `src/report/`. |
| 12.10 | **Page header and numbers in print.** The running header is a repeated table header (Chromium repeats `<thead>` on every printed page); page numbers use CSS `@page` margin boxes (`counter(page)` / `counter(pages)`), supported by Chromium 131+. Other browsers may print without page numbers. | `src/report/report.css`; checked in Chromium 140 (Playwright) by printing to PDF. |
| 12.11 | **QR codes are generated in-house** (byte mode, ECC M, versions 1–40, eight masks with the standard penalty) rather than adding a dependency. Verified by decoding with ZXing-C++: every datasheet URL in the data at all four ECC levels decoded exactly, and the seven codes on a printed report page decoded from a 150 dpi rendering of the PDF. | `src/report/qr.ts`. |
| 12.12 | **Performance.** `projectTotals` and `buildBillOfMaterials` take only the project, so each re-runs the recommendation pass; with 10 locations a keystroke costs about 30–50 ms in the production build (about 100–140 ms in the dev server). The BOM and totals follow a deferred copy of the project. | `AdminApp.tsx`. |
| 12.13 | **Phones**: data tables (BOM, recorder / switch checks, cable runs) become one block per row below 640 px instead of scrolling sideways. The site-map device table still scrolls sideways; the side panel for the selected device is the phone-friendly editor. | `.stack-table` in `src/index.css`. |
