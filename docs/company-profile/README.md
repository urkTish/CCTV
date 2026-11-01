# ContracTech company profile

The company profile (الملف التعريفي) in Arabic and English, 13 slides each, in
ContracTech's brand: white pages, Tahoma, black text, logo on every slide.

| File | Use |
|---|---|
| `ContracTech-Company-Profile-AR.pptx` | Arabic, editable. The main version for clients. |
| `ContracTech-Company-Profile-EN.pptx` | English, editable. |
| `ContracTech-Company-Profile-AR.pdf`, `-EN.pdf` | Previews. They were rendered without Tahoma installed, so the font is a substitute. For the PDF you send out, open the `.pptx` in PowerPoint and use File > Export > PDF. |
| `contractech-company-profile.skill` | The generator as a Claude skill. Upload it in the Claude app (Customize > Skills > Upload a skill) to use it in any chat, not only in this repository. |

**Status: draft.** The text is ready to use. Photos, reference projects and a
few company facts still need to be added (list below).

## What is in it

1. Cover
2. About ContracTech: two divisions, one partner from design to maintenance, Kingdom-wide coverage
3. Vision and mission (draft wording, see below)
4. Values: the four core values, each with a one-line explanation
5. Our divisions: General Contracting and Technological Solutions
6. General Contracting: four services
7. Technological Solutions: four services
8. How we design CCTV systems: the engineered method behind every proposal
9. Renovation: "see it before we build it, and see why it costs what it costs"
10. How we work: seven steps from first call to aftercare
11. Why ContracTech: six reasons, each backed by something we do today
12. Selected projects (to fill in)
13. Contact

## What changed

- **Built around differentiators, not a service list.** The design portal does
  things most integrators can't show: camera choice by what the client needs
  to see (IEC 62676-4), sized storage, PoE and cabling, a reason for every
  figure, datasheet links, photo handover reports. Slides 8–11 turn those into
  selling points.
- **Arabic and English say the same thing.** Both decks are built from one
  content file, so a change made once shows up in both.
- **Only confirmed facts.** Nothing about years, project counts, certifications
  or partner status is claimed until you confirm it.
- **Arabic laid out properly:** right-to-left throughout, logo top-left, title
  top-right, phone numbers that don't flip, Arabic numerals.
- **Easy to update.** Speaker notes on each slide say where its content comes
  from and what to check.

## To complete (owner input needed)

| # | Item | Where it goes |
|---|---|---|
| 1 | **Approve or rewrite the vision and mission** (draft wording on slide 3) | Slide 3 |
| 2 | **Three to six reference projects**: photo, client (with their permission), city, year, scope. This is the biggest gap. | Slide 12 |
| 3 | Eight real photos: team on site, a contracting project, a CCTV installation, renovation before and after, three project photos | Slides 2, 5, 9, 12 |
| 4 | CR number, VAT number, Chamber of Commerce membership, national address | Cover or contact slide |
| 5 | Year founded and team size (engineers, technicians) | Slide 2 |
| 6 | Contractor classification, certifications (e.g. ISO 9001), licences or approvals for security-system installation, if held | New slide after 7 |
| 7 | Hikvision partner level, only if confirmed in writing | Slide 7 |
| 8 | Client logos, only with permission. Can the Ministry of Media be listed as a client? | New slide after 12 |
| 9 | Website (is there one at contractech.sa?) | Slide 13 |

## How to update

**Small edits:** edit the `.pptx` in PowerPoint. To swap a gray photo frame,
right-click it and choose Change Picture.

**Rebuilding** (keeps Arabic and English in step): the generator is the
`contractech-company-profile` skill in `.claude/skills/contractech-company-profile/`.

1. Change the wording in `scripts/content.cjs`.
2. Put real photos in `assets/photos/` named by frame id
   (`about.jpg`, `div_gc.jpg`, `div_tech.jpg`, `reno_before.jpg`,
   `reno_after.jpg`, `proj1.jpg`, `proj2.jpg`, `proj3.jpg`).
3. Ask Claude to "rebuild the company profile", or run (macOS / Linux shell):

```bash
npm install --prefix /tmp/pptx pptxgenjs
NODE_PATH=/tmp/pptx/node_modules node .claude/skills/contractech-company-profile/scripts/build_profile.cjs docs/company-profile
```

Rebuilding overwrites the `.pptx` files here, so make any edits in
`content.cjs` rather than only in PowerPoint.
