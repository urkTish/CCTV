# Backlog: concept sections in proposals, and photo completion reports

**Status:** PARTIALLY DONE (2026-10-12) — built for the **renovation** line:
the reusable picture-section block (`src/pictures/`), the proposal's Concept
chapter (Admin → Renovation → Concepts) and the completion / photo report
(Admin → Renovation → Completion report). All three acceptance criteria below
are met for renovation and were checked in Chromium (see TASKS "Concept
sections and photo report", decisions in ASSUMPTIONS 16). **Not done yet:**
civil and maintenance (those lines do not exist yet; the block and the
`ConceptChapter` are ready for them), the CCTV report, the maintenance service
report and the renovation before / after gallery rebuilt on the block, and
Arabic for the editor and printed text (TASKS PR-P1 … PR-P4).
Queued by the owner on 2026-10-12.
**Applies to:** civil works, maintenance and renovation proposals and reports.
CCTV may adopt it later.

## What the owner asked for (intent)

1. **Proposal: concept sections.** Use the same branded template as the CCTV
   proposal, or one close to it, for civil, maintenance and renovation work.
   - When presenting a concept, the engineer adds a **picture** (a photo, a
     drawing or a render brought from outside) and a **description** beneath it.
   - In the editor this means an **upload button** with a title and a
     description field under it.
   - In the report each concept prints as **Title, then Picture, then
     Description**, repeated for every concept.
2. **Completion report: photo report.** When the work is finished, produce a
   report that shows each completed item the same way: **Title, then Picture,
   then Description**, repeated, as evidence that the work is done.

## Proposed design

One reusable building block, the **picture section**, serves both reports.

**Fields of a picture section:**
- **Title.**
- **Image(s):** one or more images uploaded from outside (photo, drawing, render,
  PDF page exported as an image). Layout is 1 full width, 2 side by side, or a
  before/after pair.
- **Caption** under each image, optional.
- **Description:** rich text with paragraphs and bullets.
- **Optional links:** room or area, a BOQ item or scope line, and a status
  (proposed / in progress / done / snag).
- **Label:** "Illustrative" or "Concept" for proposals, and "Actual photo" with
  the date taken for completion reports. Labels are printed on the images.

**In the editor:**
- **Add section** creates an upload area (drag and drop, or a button), then the
  title and description fields beneath it.
- Sections can be reordered (drag, or up/down buttons for keyboard users),
  duplicated and deleted.
- Images are compressed on import and kept in the project or workspace file
  (offline, as today). Location data is stripped.

**In the proposal (A4, ContracTech branded, same template family as CCTV):**
- A **Concept** chapter of picture sections, printed as title, then picture(s),
  then description.
- Page breaks never split a section from its picture.

**Completion / photo report (new report type, same branding):**
- Cover, then a project summary, then one picture section per completed item.
- **Better idea:** let each item show **before / during / after** photos, with
  dates and who did the work, a status, and a client sign-off line per item or
  one at the end.
- Generate it from the proposal's sections. Each proposed item becomes a
  completion item, and the engineer adds the "after" photo, so nothing has to be
  typed twice.
- **Snags:** items marked "snag" are listed at the end as outstanding.

**Reuse:** the same picture-section block serves maintenance service reports
(fault, then repair, then result) and the renovation before/after gallery.

## Acceptance criteria (draft)
- An engineer adds 5 concept sections, each with an uploaded image, title and
  description, reorders them, and the proposal prints them as title, then
  picture, then description, with no section split across pages.
- From an approved proposal, one click creates a completion report pre-filled
  with the same items. Adding "after" photos and marking items done prints a
  branded photo report with dates, statuses and a sign-off block.
- Old project files still open, because the new data is optional.
