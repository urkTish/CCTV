# ContracTech company profile

The company profile (الملف التعريفي) in Arabic and English, 18 slides each, in
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
2. About ContracTech: two divisions, one partner from design to maintenance, 30+ years of team experience, Kingdom-wide coverage
3. Our purpose, and the slogan "Say it once." explained (approved 5 Nov 2026)
4. Values: the four core values, each with a one-line explanation
5. Our team: Eng. Turki AlTurki, Eng. Kamal Asif (30+ years in security, low-current and electrical systems), Eng. Mahmoud Rashad
6. Our divisions: General Contracting and Technology Solutions
7. General Contracting: four services
8. Electrical works (low voltage): power and lighting, LV/ELV cabling, containment, earthing and lightning protection, distribution and control
9. Low-current (ELV) systems at a glance: security, communication, TV and audio-visual, networks
10. Security systems: CCTV, access control and time attendance, intrusion detection, one integrated platform
11. Communication, TV and audio-visual: PA and background music, IPTV and SMATV, VoIP telephony, nurse call and intercom, master clock, AV
12. Networks and computer rooms: structured cabling, data networking, computer and server rooms
13. How we design CCTV systems: the engineered method behind every proposal
14. Renovation: "see it before we build it, and see why it costs what it costs"
15. How we work: seven steps from first call to aftercare
16. Why ContracTech: six reasons, each backed by something we do today
17. Selected projects (to fill in)
18. Contact

Slides 5 and 8–12 bring in Eng. Kamal Asif's services and experience (November 2026), reworded in ContracTech's brand. **Fire systems are not offered** (fire alarm, fire cabling, fire suppression, fire-alarm integration were all left out on the GM's instruction).

## Compared with the GM's 7-slide version (November 2026)

The GM's own English profile (cover, about, contracting services, technology
solutions, coverage, values, contact) is clean and concise. Its wording is now the
source for the About text, the eight service descriptions, the values and the
contacts, including Eng. Mahmoud's email, in both languages. It is also why the
English name of the division is now "Technology Solutions". What this version adds:

- **An Arabic version.** Most client documents are in Arabic.
- **Proof of how ContracTech works.** The CCTV design method, renovation, the
  seven-step process and "why ContracTech" give a client a reason to choose
  ContracTech, not just a list of services.
- **Brand-neutral CCTV.** "In the brand you specify."
- **Places for photos and reference projects.** Neither version has these yet;
  they are the biggest gap.
- **The brand rules.** The 7-slide version uses coloured icons and a green
  circuit-board map. The brand guide asks for plain black text with colour only
  from photos and the logo, so this version leaves them out. If you prefer the
  icons, say so and the brand guide should be updated to match.

## What changed from a plain service list

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
| 1 | ~~Approve the vision and mission~~ Done: purpose and slogan approved 5 Nov 2026 | Slide 3 |
| 2 | **Three to six reference projects**: photo, client (with their permission), city, year, scope. This is the biggest gap. Eng. Kamal's past low-current projects count if he can name them. | Slide 17 |
| 3 | Eight real photos: team on site, a contracting project, a CCTV installation, renovation before and after, three project photos | Slides 2, 6, 14, 17 |
| 4 | CR number, VAT number, Chamber of Commerce membership, national address | Cover or contact slide |
| 5 | Year founded and team size (engineers, technicians) | Slides 2, 5 |
| 6 | Contractor classification, certifications (e.g. ISO 9001), licences or approvals for security-system installation, if held | New slide after 7 |
| 7 | Which government compliance requirements the systems meet (name the authority or approval); any manufacturer partner level, only if confirmed in writing | Slides 2, 9, 10 |
| 8 | Client logos, only with permission. Can the Ministry of Media be listed as a client? | New slide after 12 |
| 9 | Website (is there one at contractech.sa?) | Slide 18 |
| 10 | Eng. Kamal Asif's title (proposed: "Low-Current and Electrical Systems Lead") and the Arabic spelling of his name (proposed: كمال آصف) | Slide 5 |
| 11 | The construction lead with 10+ years: who, and is it Eng. Mahmoud? Then add the years on the team slide | Slide 5 |

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
