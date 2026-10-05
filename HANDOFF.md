# Handoff — where phase 2 stopped

## CURRENT STATE (cloud session 2) — phase 2 complete except M5

- **Tests 358 / 358 (20 files), `tsc -b` clean, `eslint .` clean, `vite build` ok.**
- **Done this session:** K3, M1–M4, M6, N1, N2, O1–O5. **M5 (OSM/Leaflet) deferred**:
  it needs the `leaflet` package and no dependencies were added (ASSUMPTIONS 11.6).
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
- **Resume at:** nothing pending in TASKS.md except M5. The UI/UX redesign still
  waits for the owner's explicit command.
- Tooling in this Linux container: `node node_modules/vitest/vitest.mjs run`,
  `node node_modules/typescript/bin/tsc -b`, `node node_modules/eslint/bin/eslint.js .`,
  `node node_modules/vite/bin/vite.js build` (the `.bin` shims are not executable).
  Never stage `node_modules/` or `dist/`; restore `dist/` after a build.

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
