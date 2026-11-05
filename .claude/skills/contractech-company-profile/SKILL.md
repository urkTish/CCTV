---
name: contractech-company-profile
description: Build, update or review ContracTech's company profile (الملف التعريفي) in Arabic and English, as editable PowerPoint decks plus PDF. Use when asked for the company profile, to refresh or optimize it, add projects, clients, photos or certificates to it, or check what it is missing. Pair with the contractech-brand skill, which sets the visual rules.
---

# ContracTech company profile

Makes two matching decks from one content file:

- `ContracTech-Company-Profile-AR.pptx` (Arabic, right-to-left, the main client version)
- `ContracTech-Company-Profile-EN.pptx` (English)

18 slides each: cover, about, vision and mission, values, our team, divisions,
general contracting, electrical works (low voltage), low-current (ELV) systems,
security systems, communication / TV / audio-visual, networks and computer
rooms, CCTV design method, renovation, how we work, why ContracTech, selected
projects, contact.

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

- **Confirmed** (brand skill, the GM's own 7-slide English profile of November
  2026, and `docs/about-the-portal-services.md`): the two divisions and their
  services (the GM's wording), Kingdom-wide coverage including remote areas, the
  four core values and their one-line explanations, both contacts with emails,
  "systems that meet government compliance requirements", Eng. Kamal Asif's
  low-current and low-voltage electrical services and his 30+ years of
  experience (from his former company's profile, reworded), the CCTV design method
  (IEC 62676-4, storage / NVR / PoE / TIA-568 cabling sizing, traceable numbers,
  stamped proposals) and the renovation process. **ContracTech is brand-neutral:**
  it installs whichever camera brand the project specifies. The design portal's
  catalogue happens to be Hikvision; never present the company as tied to it.
- **Draft, needs the General Manager's approval**: vision and mission wording;
  Eng. Kamal Asif's title and the Arabic spelling of his name.
- **Never offered: fire systems.** No fire alarm, fire cabling, fire suppression
  or fire-alarm integration anywhere in the profile (GM's instruction, Nov 2026).
- **Never copy another company's identity** into the profile: when a team member
  brings services from a previous company, reword them as ContracTech's and leave
  out that company's name, CR, VAT, website, vision and logo.
- **Unknown, never state until confirmed in writing**: year founded, years of
  experience, number of projects, staff numbers, CR and VAT numbers,
  classifications, certifications, licences, which compliance authority or
  approval applies, manufacturer partner levels, client names, office address,
  website.
- Name a client only with their permission. Renovation pictures are
  "illustrative visuals", never "photos of your finished home".

## Arabic layout notes

- pptxgenjs only marks single-string text as right-to-left. `build_profile.cjs`
  copies `rtlMode` and `lang` onto every paragraph of multi-paragraph text; keep
  that when adding new text.
- Phone numbers and emails go in their own left-to-right paragraph (`LTR()`),
  otherwise `+966 555 755 039` flips to `039 755 555 966+`.
- Latin terms inside Arabic sentences (IEC 62676-4, TIA-568, NVR, PoE) render
  correctly; check them in the render anyway.
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
6. Which government compliance requirements the systems meet (name the authority
   or approval), and any manufacturer partner level, only if confirmed in writing.
7. Client logos slide, only with permission.
8. Website and office address on the contact slide.
9. Approve or rewrite the vision and mission.
10. Optional: quality and safety (HSE) policy statements, a Vision 2030 line.

After adding a fact, put it in `content.cjs` in both languages, rebuild, check,
and note in `docs/company-profile/README.md` what changed.
