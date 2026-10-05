# Handoff — where phase 2 stopped

## CURRENT STATE (cloud session 2, keep this section current)

- **Done this session:** K3 (project file save/open), M1–M4 and M6 (site map editor
  `src/ui/SiteMapPanel.tsx`, edits in `src/domain/sitePlanEdit.ts`, view model in
  `src/engine/siteMapView.ts`, upload in `src/domain/planImage.ts`, Save/Open +
  IndexedDB autosave). **M5 (OSM/Leaflet) deferred** — see ASSUMPTIONS 11.6.
- **N1 done:** `designProject()` in `src/engine/projectDesign.ts` chains storage →
  PoE-mode rule → recorder → switches → cable plan; UI in `src/ui/DesignSettingsPanel.tsx`
  (all phase-2 inputs) and `src/ui/DesignPanel.tsx` (results), totals in the Project card.
- **N2 done:** `buildBillOfMaterials()` in `src/engine/billOfMaterials.ts`, tested on an
  18-camera, 4-location project with a site map (fibre uplink, over-100 m run, placeholders).
- **Resume at:** O1–O5 (close-out).
- Tooling in this Linux container: run `node node_modules/vitest/vitest.mjs run`,
  `node node_modules/typescript/bin/tsc -b`, `node node_modules/eslint/bin/eslint.js .`
  (the `.bin` shims are not executable). Never stage `node_modules/` or `dist/`.


**Stopped:** 2026-10-05, on the owner's instruction ("stop all"). The agent was
stopped mid-task, not at a planned checkpoint.

## State at stop (verified by the main session after the stop)

- **Tests:** 11 files, **259 / 259 passing**
- **Build:** clean (`tsc -b && vite build`)
- **Lint:** clean, exit 0
- **Phase 2 tasks:** 27 done / 1 in progress / 16 pending (of 44), about 61%
- `resolve.preserveSymlinks` has been **removed** from `vite.config.ts`. The build
  passes without it on this short path.

| Group | Status |
|---|---|
| G. Data research (NVR, switch, HDD datasheets) | done |
| H. Storage maths | done |
| I. NVR engine | done |
| J. PoE switch engine | **J1 in progress**, J2–J3 pending |
| K. Site plan data model + scale maths | K1–K2 done, **K3 pending** (project save/open) |
| L. CAT6 cable maths (bin packing, 90 m limit) | done |
| M. Site map UI | all 6 pending |
| N. Integration + `buildBillOfMaterials` | both pending |
| O. Close-out | all 5 pending |
| P. ContracTech branding | done |

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
