# Handoff — where the UI/UX redesign stands

## UI/UX redesign (cloud session 5, 2026-10-05) — IN PROGRESS

Brief: `uiux-agent-prompt.md` (owner's explicit command given). Audit + IA:
`docs/uiux-audit-and-ia.md`. Task list: TASKS.md, section "UI/UX redesign" (U1–U17).

- **Done:** U1–U12 — tokens with the ContracTech blue + contrast test; shared
  components; one app with routes (`#/client`, `#/intake/…`, project hash); the
  Admin shell (left nav with per-section status, drawer on phones, jump palette
  Ctrl K), Overview, Locations list → detail with input/result tabs and Advanced
  disclosures, Recording / Network / Cabling sections, Site map workspace, BOM
  with optional prices, Settings (engineer profile), workspace envelope for
  extras, client-intake mapping module.
- **Resume at:** U13 (client wizard UI, `src/client/`), U14 (handoff test),
  U15–U16 (report), U17 (close-out).
- Engine, data files, existing schemas and `buildBillOfMaterials` untouched.
- Browser checks: scripts in the session scratchpad (`uiux/`), not in the repo.

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
