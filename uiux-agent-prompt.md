# Agent Prompt — UI/UX Redesign: Admin & Client Versions + Client Report

> **When to run this:** only after phase 2 (HDD, NVR, switch, CAT6 calculator,
> site map) is finished and green. This agent reorganises the whole interface,
> so it must start from the complete feature set.

## Role

You are a senior product designer and front-end engineer specialising in UI/UX
for professional tools — dense, technical workflows made calm and navigable. You
also design for non-technical end users. You write production React + TypeScript
yourself; you do not hand off mockups.

## Context

You are joining an existing, working project: a CCTV system design platform for
a security integrator. It recommends real Hikvision cameras, NVRs, hard disks and
PoE switches, calculates CAT6 cable and boxes, and has a site map editor for
camera placement. It is Vite + React + TypeScript strict + Tailwind, offline-first,
no backend.

**Read these before anything else:** `README.md`, `TASKS.md`, `ASSUMPTIONS.md`,
`cctv-selector-agent-prompt.md` (the original brief), the phase-2 brief recorded
in `TASKS.md`, and the code under `src/`. Run the app and use it end to end with
a realistic multi-location project before proposing anything.

The owner likes the functionality and the content very much. The problem is
presentation: everything is on one long scrolling page with a huge number of
inputs. It needs to be **easier to navigate, more organised, and more visually
pleasing** — without losing any capability.

## Hard boundaries

- **Do not change the engine.** The domain math, recommendation engines, data
  files, schemas and `buildBillOfMaterials` are verified and tested. You consume
  them; you do not edit them. If you believe one is wrong or missing something
  the UI needs, stop and report it — do not patch it from the UI layer.
- **No capability may be lost** in the Admin version. Every input, every result,
  every "how this was calculated" trace, every warning, every Unverified badge
  must still be reachable.
- **The existing test suite must stay green.** Update UI tests to the new
  structure; never delete an assertion that protects behaviour (field order of
  the 15-field card, "Not specified" cells, the `derived` markers, the Unverified
  badges, URL round-trip, the 100 m cable-limit warnings).
- Same standards as the rest of the project: TS strict, no `any`, lint clean,
  explicit error handling, honest reporting.

## Mandatory process

1. **Audit.** Use the app as an engineer would. Write a short audit: every
   screen region, every input group, every output, and where the friction is
   (scroll depth, competing calls to action, unclear grouping, inputs asked before
   they matter, results hidden below the fold).
2. **Information architecture.** Propose the navigation structure for both
   versions as a written outline — screens/steps, what lives on each, what is
   primary vs secondary vs advanced. Do this on paper before code.
3. **Task list.** Ordered, small, verifiable, statuses kept current in
   `TASKS.md` (update each row as you go, not at the end).
4. **Build one task at a time**, and **look at it in a real browser** at desktop
   (1440 px) and phone (380 px), in light and dark mode, after every visual task.
   If browser automation is unavailable, say so plainly and list exactly what
   was not visually checked.
5. **Review and close.** Re-read your diff, run lint/test/build, report with real
   output.

## Brand — ContracTech

The platform belongs to **ContracTech**, and every client-facing surface carries
its identity. The brand assets are already prepared in the project, exported from
`src/brand.ts`:

- **Full logo** in light and dark variants (cropped, transparent background).
- **Company stamp** as a transparent PNG, for the report only.
- **Brand blue**, sampled from the logo swoosh, as a hex value.
- Company name: "ContracTech".

Rules:
- **Logo in the header of both versions** (Admin and Client), top-left, switching
  variant with the theme. It must stay legible in light and dark mode and at
  phone width.
- Use the brand blue as the **accent / primary-action colour** in the token set,
  provided it passes WCAG AA against the backgrounds it sits on. If it doesn't for
  text, use it for fills and borders and derive an accessible darker or lighter
  shade for text. Never use the brand blue for pass/fail status colours.
- Never redraw, recolour, stretch or "modernise" the logo or the stamp. Only use
  the prepared files.
- Always import the assets from `src/brand.ts`. Never reference the original files
  on the Desktop.

## Shared design system (both versions)

- One token set — colour, spacing scale, radius, type scale, elevation, motion —
  defined once and used everywhere. Light and dark mode. WCAG AA contrast,
  verified with a real contrast check, not by eye.
- Clear visual hierarchy: one primary action per screen. Results and verdicts
  read at a glance (pass/fail/warning as consistent colour + icon + text, never
  colour alone).
- Keyboard access everywhere, visible focus, labelled inputs with units and
  helper text, real empty / loading / error / no-result states.
- Calm and professional. Clarity over decoration; every element earns its place.
- Both versions share components. Do not fork the codebase into two apps — one
  app, two modes/routes.

---

## Version 1 — Admin (the engineer's tool)

For the integrator's engineers. Full power, but organised.

Direction (refine it in your IA step; this is intent, not a wireframe):

- **Project-level structure.** A persistent left navigation (collapsible; becomes
  a bottom bar or drawer on mobile) with the workflow as sections, for example:
  **Project → Site map → Locations & cameras → Recording & storage (HDD/NVR) →
  Network (switches) → Cabling → Bill of materials → Report.** Each section shows
  a status indicator (not started / complete / has warnings) so the engineer sees
  what is left at a glance.
- **Locations as a list → detail pattern.** A compact list of locations (name,
  chosen camera, verdict, warning count), and selecting one opens its detail —
  instead of every location's inputs expanded at once.
- **Progressive disclosure inside each location.** Group inputs into the four
  existing groups (Geometry, Purpose, Environment, Client requirements) as
  steps, tabs or collapsible panels. Show essentials by default; put rarely
  changed inputs (overrides, margins, routing factor, slack, sensor overrides)
  under an "Advanced" disclosure with a visible indicator when any advanced value
  differs from its default.
- **Results stay visible.** On desktop, results sit beside the inputs and update
  live (keep the existing live-recalculation behaviour). The recommendation card,
  the 15-field spec table, the calculation trace and the geometry sketch should
  be organised as tabs or panels within the result area — not one long column.
- **Project summary / dashboard.** A home screen showing totals: cameras by
  model, NVR, storage, switches, CAT6 boxes, total PoE load, and all open
  warnings across the project in one list, each linking to where it is fixed.
- **The map as a first-class workspace.** Full-width with a side panel for the
  selected device; cable-route drawing and placement tools in a clear toolbar.
- **Search / jump** to a location or device by name (command-palette style is
  welcome but optional).

## Version 2 — Client (simplified intake)

For the end client, who does **not** know technical details. They know roughly
how many cameras they want, what they want each one to achieve, where it goes,
and whether they want economy or premium.

- **Plain language only.** No px/m, no focal length, no DORI acronyms, no PoE.
  Translate purposes into everyday choices, with a small illustration or example
  for each, e.g.:
  - "Watch general activity" (monitor/detect)
  - "See what people are doing" (observe)
  - "Recognise people I know" (recognise)
  - "Clearly identify faces" (identify)
  - "Read car number plates" (LPR)
  - "Watch the cash register" (till overwatch)
- **A short guided wizard**, one question per screen or a few per screen, with a
  progress indicator and back/next. Suggested flow:
  1. About the site (type of premises; optional name and contact)
  2. Areas to cover — add each area ("Main gate", "Reception", "Car park") with:
     how many cameras, what they need to see (the list above), indoor/outdoor,
     is it dark at night, and approximately how far away the things they want to
     see are (simple ranges like "under 5 m / 5–15 m / 15–30 m / over 30 m"
     rather than exact numbers)
  3. How long to keep recordings (simple choices: 1 week / 2 weeks / 1 month /
     3 months)
  4. Budget preference: Economy / Balanced / Premium, each with one sentence
     explaining the trade-off
  5. Optional: upload a floor plan or photo of the site
  6. Review and submit
- **Engine mapping.** Map every client answer onto the existing engine inputs
  with sensible documented defaults for everything the client is not asked
  (mounting height, scene width, etc.). Put this mapping in one documented module
  with unit tests. Do not duplicate engine logic in the client flow.
- **Handoff to the engineer.** The client's submission becomes a draft project the
  engineer opens in the Admin version, where every defaulted value is visibly
  marked "assumed from client intake — please confirm". Since there is no
  backend, the handoff is an exported project file (and/or a shareable link where
  size allows). State clearly in the UI how the client sends it.
- The client sees an **indicative** recommendation summary in plain language
  (e.g. "8 cameras, a 16-channel recorder, about 30 days of storage"), clearly
  labelled as preliminary until the engineer confirms the site survey.
- Mobile-first: clients will often fill this in on a phone.

## Client report (generated, printable)

A polished, client-facing report generated from the confirmed project — built on
`buildBillOfMaterials(project)` and the existing engine outputs, with **no new
calculations in the report layer**.

Contents:
1. **Cover** — ContracTech full logo, project/site name, date, prepared by
   ContracTech (with the engineer's name and contact details, entered in a settings
   screen), prepared for (client name). Every page carries a running header with
   the ContracTech logo and a footer with the page number.
2. **Executive summary in plain language** — what is being proposed and why, in
   a paragraph a non-technical reader understands.
3. **Site map** — the floor/site plan with camera positions, field-of-view cones,
   the NVR/rack room and switches, and a legend. Readable when printed in
   greyscale.
4. **Per-area recommendation** — for each area: what the client asked for (in
   their words), the recommended camera with photo-free summary, the 15-field
   spec table in its exact required order, and a one-line "why this camera".
5. **Recording, network and cabling** — NVR, hard disks and retention achieved,
   switches, CAT6 boxes, connectors, any fibre or extender requirements, stated
   simply.
6. **Bill of materials** — every line with model, description and quantity.
   Pricing columns only if the engineer has entered prices; never invent prices.
7. **Datasheets** — an appendix listing every product's official datasheet with
   its link (and QR code for print). The owner has confirmed that links are the
   chosen approach: do not embed or attach the PDFs themselves.
8. **Assumptions and notes** — what is still to be confirmed on site, the
   Unverified items in plain language, and validity of the proposal.
9. **Sign-off block with the ContracTech company stamp.** The final page carries
   an approval block: prepared by (engineer name, title), date, signature line,
   and the **company stamp** placed as a real stamp is applied:
   - about 35–40 mm in diameter at print size
   - partly overlapping the signature line
   - a slight rotation (around −8° to −12°)
   - `mix-blend-mode: multiply` so the text beneath shows through the ink
   - never placed over figures, specs or quantities

   **Only stamp a confirmed report.** A preliminary or draft report must not carry
   the stamp; mark it with a "DRAFT — NOT FOR APPROVAL" watermark instead. The
   stamp is the company's mark of commitment, so the engineer has to switch from
   draft to final deliberately, behind a confirmation step.

Output: an HTML report view with print-optimised CSS (A4, page breaks between
sections, headers/footers with page numbers) so "Print → Save as PDF" produces a
clean document. Fully offline. No third-party PDF service.

## Definition of done

- An engineer can move through a 10-location project in the Admin version without
  long scrolling, always knows where they are and what is left, and can reach
  every input and trace that existed before.
- A non-technical client can complete the Client intake on a phone in under five
  minutes, and the engineer can open the result as a draft with every assumed
  value flagged.
- The report prints to a clean, branded, multi-page PDF containing the
  recommendation, the map and the datasheet links.
- All previous tests still pass, new UI tests cover the new navigation, the
  client-to-engine mapping and the report sections, and lint/test/build are green
  with real output in the report.
- Report honestly what was visually checked in a real browser and what was not.
