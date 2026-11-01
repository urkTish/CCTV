---
name: contractech-company-profile
description: Build, update or review ContracTech's company profile (الملف التعريفي) in Arabic and English, as editable PowerPoint decks plus PDF. Use when asked for the company profile, to refresh or optimize it, add projects, clients, photos or certificates to it, or check what it is missing. Pair with the contractech-brand skill, which sets the visual rules.
---

# ContracTech company profile

Makes two matching decks from one content file:

- `ContracTech-Company-Profile-AR.pptx` (Arabic, right-to-left, the main client version)
- `ContracTech-Company-Profile-EN.pptx` (English)

13 slides each: cover, about, vision and mission, values, divisions, general
contracting, technological solutions, CCTV design method, renovation, how we
work, why ContracTech, selected projects, contact.

The brand rules come from the **contractech-brand** skill and are not up for
redesign: white pages, Tahoma, black text, logo in the top corner of every slide
(top-left in Arabic, top-right in English), no decorative shapes or colour. The
only colour besides the logo comes from photos.

## Files

| File | What it is |
|---|---|
| `scripts/content.cjs` | Every word on every slide, Arabic and English side by side, plus speaker notes. **Edit wording here only.** |
| `scripts/build_profile.cjs` | Builds both decks. Layout is written once and mirrored for Arabic. |
| `scripts/placeholders.json` | The photo frames: id, size, label. |
| `scripts/make_placeholders.py` | Redraws the gray frames after a label or size change. |
| `assets/contractech-logo.png` | The real logo (from `src/assets/brand/contractech-logo-light.png`). |
| `assets/photos/<id>.jpg` | Optional real photos. When one exists it replaces that gray frame, cropped to fill it. |

Photo ids: `about`, `div_gc`, `div_tech`, `reno_before`, `reno_after`, `proj1`, `proj2`, `proj3`.
Rotate phone photos upright before adding them.

## Build

```bash
npm install pptxgenjs            # once, anywhere; then point NODE_PATH at it
NODE_PATH=<that>/node_modules node scripts/build_profile.cjs docs/company-profile
```

Then check, as the brand skill requires, before handing anything over:

1. Validate each deck (the pptx skill's `scripts/office/validate.py`).
2. Render to PDF and images, and look at every slide: white background, black
   Tahoma text, logo present and not distorted, no clipped or overlapping text,
   phone numbers not flipped, no Awnak branding.
3. Deliver the `.pptx` files plus PDFs. A PDF rendered on Linux uses a substitute
   font; the final PDF should be exported from PowerPoint (File > Export > PDF)
   so it is in Tahoma.

## Facts: what may be stated

Never invent company facts. A profile goes to clients and tenders.

- **Confirmed** (brand skill and `docs/about-the-portal-services.md`): the two
  divisions and their services, Kingdom-wide coverage including remote areas,
  the four core values, the contacts, the CCTV design method (Hikvision equipment,
  IEC 62676-4, storage / NVR / PoE / TIA-568 cabling sizing, traceable numbers,
  stamped proposals) and the renovation process.
- **Draft, needs the General Manager's approval**: vision and mission wording, and
  the one-line explanations under each value.
- **Unknown, never state until confirmed in writing**: year founded, years of
  experience, number of projects, staff numbers, CR and VAT numbers,
  classifications, certifications, licences, Hikvision partner level, client
  names, office address, website.
- Name a client only with their permission. Renovation pictures are
  "illustrative visuals", never "photos of your finished home".

## Arabic layout notes

- pptxgenjs only marks single-string text as right-to-left. `build_profile.cjs`
  copies `rtlMode` and `lang` onto every paragraph of multi-paragraph text; keep
  that when adding new text.
- Phone numbers and emails go in their own left-to-right paragraph (`LTR()`),
  otherwise `+966 555 755 039` flips to `039 755 555 966+`.
- Latin terms inside Arabic sentences (IEC 62676-4, TIA-568, NVR, PoE,
  Hikvision) render correctly; check them in the render anyway.
- Spelling: الانتهاء، استهلاك، الالتزام (no hamza on these). Formal Saudi
  business register.

## Optimizing the profile

When asked to improve the profile, work through this list and report which items
are still open. Ask the owner for the facts; do not fill them in yourself.

1. Real photos for all eight frames.
2. Three to six reference projects: photo, client (with permission), city, year,
   scope. This is the biggest gap in the current version.
3. Company registration block: CR number, VAT number, Chamber of Commerce
   membership, national address.
4. Year founded and team size (engineers, technicians).
5. Contractor classification, certifications (e.g. ISO 9001), and any licences
   or approvals for installing security systems, if held.
6. Hikvision partner level, only if confirmed in writing.
7. Client logos slide, only with permission.
8. Website and office address on the contact slide.
9. Approve or rewrite the vision and mission.
10. Optional: quality and safety (HSE) policy statements, a Vision 2030 line.

After adding a fact, put it in `content.cjs` in both languages, rebuild, check,
and note in `docs/company-profile/README.md` what changed.
