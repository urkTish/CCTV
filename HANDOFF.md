# Handoff — site layout drawing

## Site layout drawing (cloud session 6, 2026-10-06) — COMPLETE

Owner request: draw the site in the Site map when there is no plan to upload.
Tasks D1–D7 in TASKS.md. Decisions in ASSUMPTIONS 13. **tsc 0, eslint 0,
578 / 578 tests (35 files), vite build ok.**

- **Pure module** `src/domain/layoutShapes.ts`: rectangle, line / polygon, smooth
  curve (Catmull–Rom → cubic Bézier), door / double door / window / gate, label;
  blank canvas in metres that sets the calibration (20 px/m); grid snapping;
  45° / square constraints; resize-from-corner and rotation maths; door swing
  geometry; length and area; `x,y` point-list parsing; undo history; zod schema.
- **Schema**: optional `sitePlan.layout`; a plan with nothing drawn is saved
  without it (old files byte-identical, still open in an older app); a file
  with drawings is refused by an older app with a clear reason. File version
  stays 1. Autosave, Admin status and the report know about it.
- **UI**: drawing row in the Site map toolbar (`SiteMapPanel.tsx`), shape
  fields / list / blank-canvas form (`LayoutShapeEditor.tsx`), shared renderer
  (`LayoutShapesSvg.tsx`, `planPalette.ts`) used by the editor and the report.
  New colour tokens `--color-plan-*` (light, dark, over an image).
- **Checked in real Chromium** (Playwright, 1440 px and 380 px, light and dark):
  drew a 60 × 40 m depot with the mouse (building, rooms, wall, car park, curved
  fence, doors, double door, window, two gates, six labels), placed an NVR, a
  switch and five cameras, drew one route — device table and Cabling section
  numbers checked by hand (drawn route 52 m → 61 m installed; estimated
  17.03 m × 1.3 = 22.1 m); undo / redo; selected-shape panel; save → file has
  18 shapes and the canvas; open the file on a phone, draw a wall by taps and a
  room by a touch drag; trace over an uploaded, click-calibrated PNG; autosave
  restore of a drawn-only layout; report map. No console errors, no failed
  requests, no horizontal scroll. Fixed from the check: routes were black like
  walls (now blue), the canvas's own calibration line showed along the top edge,
  shapes caught the pointer while drawing / when locked.
- **Not checked**: other browsers; a real phone (only Chromium touch
  emulation); printing the report to PDF with a drawn layout (the on-screen
  report map was checked); very large layouts (performance with hundreds of
  shapes).
- **Resume at:** nothing pending. Browser scripts and screenshots are in the
  session scratchpad (`draw/`), not in the repo.

---

# Handoff — where the UI/UX redesign stands

## UI/UX redesign (cloud session 5, 2026-10-05) — COMPLETE

Brief: `uiux-agent-prompt.md`. Audit + IA: `docs/uiux-audit-and-ia.md`. Tasks
U1–U17 in TASKS.md, all done. **tsc 0, eslint 0, 523 / 523 tests (33 files),
vite build ok.**

- **Admin** (`src/ui/admin/`): sectioned workflow with per-section status,
  Overview with linked warnings, Locations list → detail (input tabs + result
  tabs, Advanced disclosures), Recording / Network / Cabling, Site map workspace
  with a selected-device panel, BOM with optional prices, Report, Settings,
  Ctrl K jump palette.
- **Client** (`src/client/`): `#/client` six-step wizard; mapping module
  `intakeMapping.ts`; intake file / `#/intake/…` link; Admin opens it as a draft
  with every assumed value marked.
- **Report** (`src/report/`): A4 print CSS, QR encoder, draft watermark, stamp
  only after the Final confirmation.
- **New persisted data** without touching schemas: `src/state/workspace.ts`
  (envelope), `src/state/engineerProfile.ts` (localStorage).
- Engine, data files, existing schemas and `buildBillOfMaterials` untouched.
- **Checked in real Chromium** (Playwright, 1440 px and 380 px, light and dark):
  every Admin section, the client wizard end to end, the handoff, the report
  section, and Chromium print-to-PDF of the report (18 A4 pages, QR codes
  decoded from the PDF). Not checked: other browsers' print output (page-number
  margin boxes need Chromium 131+), OSM tiles (blocked here), a real person
  timing the client wizard.
- **Engine gaps noted (not patched):** no achieved-retention figure in the
  design output (`retentionDaysThatFit` exists but is not wired), so the report
  states the target retention; `projectTotals` and `buildBillOfMaterials` take
  only a project, so the recommendation pass runs three times per change.
- **Resume at:** nothing pending. Browser-check scripts are in the session
  scratchpad (`uiux/`), not in the repo.

---

# Handoff — where phase 2 stopped

## Browser check (cloud session 4, 2026-10-05)

Checked in real Chromium (Playwright, headless) on the Vite dev server, at
1440×900 and 390×844, light and dark. **Tests 383 / 383 (23 files), `tsc -b`
clean, `eslint .` clean, `vite build` ok.** Fixes in commit 8f42b8e;
regression tests in `src/ui/browserCheck.test.tsx`.

| Check | Result |
|---|---|
| Loads with no console errors / failed requests | Pass (both widths) |
| Phase 1 recommendation, add location | Pass |
| Upload PNG plan, two-click calibration | Pass (20 m over 1000 px → "1 px = 0.02 m · 100 px = 2 m") |
| Place cameras / NVR / switch, mouse drag, touch tap | Pass |
| FOV cones, `[` / `]` rotate, arrow-key nudge | Pass |
| Drawn route (length checked by hand) and dashed "estimated route" | Pass |
| Device table: x/y, facing, cabled-to, typed run | Pass after fix 1 |
| Design settings / System design / BOM numbers (3 locations, 7 cameras) | Pass, checked by hand |
| No horizontal page scroll | Pass after fixes 2 and 3 |
| OSM view: attribution, scale bar, measuring, failure and offline messages | Pass after fix 5; **tiles not verified** — this container's proxy refuses tile.openstreetmap.org (`ERR_TUNNEL_CONNECTION_FAILED`) |
| Save .json → open (byte-identical re-save), autosave restore prompt after reload | Pass |
| Dark mode: logo variant, readability | Pass after fix 4 |

Bugs fixed: (1) number fields snapped back when emptied, so clearing "305" and
typing "3" gave "3053" — new `NumberInput` primitive keeps the typed text while
focused, shows the stored value on blur; (2) Design settings / System design
widened the phone page to 754 px; (3) the device table's sr-only header widened
it to 710 px; (4) in dark mode, routes and the NVR marker were near-white on the
white plan; (5) on a phone the OSM attribution covered the scale bar.

Still to see on a machine with internet: OSM tiles loading, pan/zoom over real
tiles. Cosmetic notes (not acted on): device labels overlap when cameras are
close; a drawn route is black like the plan's walls; on a phone the map labels
are tiny and the Verdict column of the check tables needs a sideways scroll;
the "Cabled to" select is clipped to "NVR / r" on desktop.

## CURRENT STATE (cloud session 3) — phase 2 complete, M5 included

- **Tests 379 / 379 (22 files), `tsc -b` clean, `eslint .` clean, `vite build` ok.**
- **M5 done this session (2026-10-05):** optional OpenStreetMap reference view in the
  Site map card, off by default. Measure two points on it → *Use as calibration
  length* fills the plan's calibration form. Code: `src/domain/osmMap.ts` (policy
  citation, constants, pure maths), `src/ui/OsmReferenceMap.tsx`,
  `src/ui/osmLeaflet.ts` (the only Leaflet importer, loaded by dynamic `import()`).
  New dependencies: `leaflet` ^1.9.4, dev `@types/leaflet` ^1.9.22 (pulls in
  `@types/geojson`); their folders are committed in `node_modules/` so the Windows
  copy works after a pull. Leaflet is its own chunk (~150 kB JS + 16 kB CSS); the
  main chunk grew only by the new UI code (622.8 → 629.5 kB).
- **Tile policy** (ASSUMPTIONS 11.6): the live OSMF page was blocked by this
  container's proxy, so it was read from its published source
  (openstreetmap/owg-website `policies/tiles.md`, changed 2026-08-11) and cited.
- **Needs eyes in a real browser:** turn the map on, pan/zoom, check tiles load,
  the attribution sits bottom-right above the tiles, the scale bar, two-click
  measuring, and the offline message (DevTools → Network → Offline). Serve the app
  over http(s) (`npm run dev` / `npm run preview`): from `file:` no Referer is sent.

## Previous state (cloud session 2)

- Tests 358 / 358 (20 files) at the end of that session.
- Done that session: K3, M1–M4, M6, N1, N2, O1–O5. M5 was deferred then (no new
  dependencies that phase).
- Where things are:
  - project file save/open `src/state/projectFile.ts`; IndexedDB autosave
    `src/state/autosave.ts` + `src/ui/useAutosave.ts`
  - site map: edits `src/domain/sitePlanEdit.ts`, upload `src/domain/planImage.ts`,
    view model `src/engine/siteMapView.ts`, UI `src/ui/SiteMapPanel.tsx`
  - whole-project design `src/engine/projectDesign.ts`; UI `src/ui/DesignSettingsPanel.tsx`,
    `src/ui/DesignPanel.tsx`
  - bill of materials `src/engine/billOfMaterials.ts` (no report UI, by the brief)
- New model field: `runMetresOverride` on placed cameras and switches (typed run
  length, basis `entered`, not an estimate). Older files open with it null.
- O5 self-review fixes: a camera can only be cabled to a switch or back to the
  first NVR (the map and the cable maths disagreed before); several placed NVRs now
  warn; the SVG map is `role="group"` so its focusable devices stay accessible;
  opening a file drops cameras numbered past their location's count (with a
  notice); calibration draft is cleared after a new image upload.
- **Needs eyes in a real browser** (no browser in this container): the site map
  (drag, click-to-calibrate, route drawing, cone size on a real plan), the two new
  cards' layout on desktop and mobile, and the IndexedDB restore prompt.
- **Resume at:** nothing pending in TASKS.md. The UI/UX redesign still waits for the
  owner's explicit command.
- Tooling in this Linux container: `node node_modules/vitest/vitest.mjs run`,
  `node node_modules/typescript/bin/tsc -b`, `node node_modules/eslint/bin/eslint.js .`,
  `node node_modules/vite/bin/vite.js build` (the `.bin` shims are not executable).
  Never stage `dist/`; restore it after a build. Stage `node_modules/` only for a
  newly added package folder (as done for leaflet), never caches or `.package-lock.json`.

## Update — 2026-10-05, cloud session

- The pinned-NVR edit in `recommendNvr` was reviewed: complete, and covered by
  three tests (fails, fits, stale id). Nothing to change.
- **J1–J3 done.** The switch engine code already existed; this session added
  `groupingInputsFromTopology` (site plan → switch groups, using the same
  installed run length as the cable plan) and `src/engine/switchEngine.test.ts`
  (24 tests: grouping, one test per check, selection). No engine bugs found.
- Tests **283 / 283**, `tsc -b` clean, lint clean.
- **Next: K3**, then M1–M6 → N1–N2 → O1–O5.

## Resume here (original notes)

1. **Check first.** The agent was stopped while editing `recommendNvr` in
   `src/engine/nvrEngine.ts`, adding engineer "pinning" of a chosen NVR via
   `pinnedNvrId`. The code compiles and all tests pass, but nobody reviewed that
   edit after the stop. Read it, confirm it is complete, and add a test for the
   pinned path if none exists.
2. **J1** (marked in progress): group cameras per switch from the site plan, or a
   single default group when there is no map. Check whether any code for it exists
   before writing new code.
3. Then continue in `TASKS.md` order: J2 → J3 → K3 → M1–M6 → N1–N2 → O1–O5.

The brief is `phase2-brief.md`. The original standards are in
`cctv-selector-agent-prompt.md`.

## Environment notes

- Node is not on PATH. It is at `C:\Users\Admin\n24\node-v24.21.0-win-x64`.
- `node_modules` is installed in this folder.
- A PDF datasheet text extractor is at `C:\Users\Admin\pdftool\`.
- The old junction at `C:\Users\Admin\cv` points to an obsolete copy. **Do not work
  there.** This folder is the only live copy.

## Not to be started without the owner's explicit command

The UI/UX redesign (`uiux-agent-prompt.md`): the Admin version, the Client version
and the client report.
