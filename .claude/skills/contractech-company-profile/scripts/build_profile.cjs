/**
 * Build the ContracTech company profile as two editable PowerPoint decks:
 *   ContracTech-Company-Profile-AR.pptx  (Arabic, right-to-left)
 *   ContracTech-Company-Profile-EN.pptx  (English)
 *
 * Usage:  node build_profile.cjs [output-folder]     (default: current folder)
 * Needs:  pptxgenjs  (npm install pptxgenjs). If it is installed somewhere else,
 *         run with NODE_PATH pointing at that node_modules folder.
 *
 * Brand rules (from the contractech-brand skill, non-negotiable): white pages,
 * Tahoma everywhere, black text, the logo in the top corner of every slide, no
 * decorative shapes or colour. The only colour besides the logo comes from photos.
 *
 * Layout is written once in "reading-start" coordinates: `s` is the distance from
 * the edge where reading starts (right in Arabic, left in English). X() mirrors it,
 * so both languages share one layout.
 */
const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');
const { ar, en, notes } = require('./content.cjs');

const HERE = __dirname;
const ASSETS = path.join(HERE, '..', 'assets');
const LOGO = path.join(ASSETS, 'contractech-logo.png');
const LOGO_ASPECT = 693 / 208; // contractech-logo.png is 693 x 208 px
const SLOTS = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(HERE, 'placeholders.json'), 'utf8')).slots.map((s) => [s.id, s]),
);

const W = 10; // LAYOUT_16x9 is 10 x 5.625 in
const FONT = 'Tahoma';
const BLACK = '000000';

const THEME = {
  name: 'ContracTech',
  colors: {
    dk1: '000000', lt1: 'FFFFFF', dk2: '333333', lt2: 'F2F2F2',
    accent1: '4F79FF', accent2: '333333', accent3: '7F7F7F', accent4: 'BFBFBF',
    accent5: 'D9D9D9', accent6: '595959', hlink: '000000', folHlink: '000000',
  },
};

const SECTIONS = {
  ar: ['الغلاف', 'الشركة', 'الخدمات', 'منهجيتنا', 'الأعمال والتواصل'],
  en: ['Cover', 'Company', 'Services', 'How we work', 'Projects and contact'],
};

async function build(L, key, outDir) {
  const rtl = L.rtl;
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  pres.rtlMode = rtl;
  pres.author = 'ContracTech';
  pres.company = 'ContracTech';
  pres.title = L.deckTitle;
  pres.theme = { headFontFace: FONT, bodyFontFace: FONT };
  const C = pres.SchemeColor;

  const X = (s, w) => (rtl ? W - s - w : s);
  const start = rtl ? 'right' : 'left';
  const base = () => ({
    fontFace: FONT, color: C.text1, lang: L.lang, rtlMode: rtl, align: start,
    margin: 0, valign: 'top', isTextBox: true,
  });
  // Text box at reading-start offset s. Every call builds fresh options: pptxgenjs mutates them.
  // For multi-paragraph text pptxgenjs reads the direction from each run, not from the box,
  // so copy rtlMode and lang onto every run (without this Arabic paragraphs come out LTR).
  const T = (slide, text, s, y, w, h, o = {}) => {
    const opts = Object.assign(base(), { x: X(s, w), y, w, h }, o);
    const body = Array.isArray(text)
      ? text.map((r) => ({ text: r.text, options: Object.assign({ rtlMode: opts.rtlMode, lang: opts.lang }, r.options) }))
      : text;
    return slide.addText(body, opts);
  };
  // Left-to-right text (phone numbers, emails) that must not flip inside an Arabic layout.
  const LTR = (slide, text, s, y, w, h, o = {}) =>
    T(slide, text, s, y, w, h, Object.assign({ rtlMode: false, lang: 'en-US' }, o));
  // A real photo at assets/photos/<id>.jpg|.jpeg|.png replaces the gray frame, cropped to fill it.
  const photo = (slide, id, s, y) => {
    const p = SLOTS[id];
    const real = ['jpg', 'jpeg', 'png']
      .map((ext) => path.join(ASSETS, 'photos', `${id}.${ext}`))
      .find((f) => fs.existsSync(f));
    const frame = { x: X(s, p.w), y, w: p.w, h: p.h };
    if (!real) {
      slide.addImage(Object.assign({ path: path.join(ASSETS, 'placeholders', `${id}-${key}.png`), altText: p[key], objectName: `Photo placeholder ${id}` }, frame));
      return;
    }
    // pptxgenjs crops for 'cover' from the w/h it is given, so pass the photo's true proportions.
    const px = imageSize(real);
    slide.addImage(Object.assign(frame, {
      path: real, w: p.w, h: (p.w * px.h) / px.w, sizing: { type: 'cover', w: p.w, h: p.h },
      altText: p[key].replace(/^[^:]*:\s*/, ''), objectName: `Photo ${id}`,
    }));
  };
  const title = (slide, text) =>
    slide.addText(text, { placeholder: 'title', fontFace: FONT, rtlMode: rtl, lang: L.lang, align: start });
  const num = (i) => L.numerals[i];

  // Layouts: a cover, and a page with the logo (end corner), title (start corner) and page number.
  pres.defineSlideMaster({
    title: 'CT_COVER',
    background: { color: 'FFFFFF' },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 2.75, w: 9, h: 0.7, fontFace: FONT, fontSize: 32, bold: true, color: C.text1, align: 'center', valign: 'middle', margin: 0 }, text: '' } },
    ],
  });
  pres.defineSlideMaster({
    title: 'CT_PAGE',
    background: { color: 'FFFFFF' },
    objects: [
      { image: { path: LOGO, x: X(8.0, 1.6), y: 0.25, w: 1.6, h: 1.6 / LOGO_ASPECT, altText: 'ContracTech logo' } },
      { placeholder: { options: { name: 'title', type: 'title', x: X(0.4, 7.2), y: 0.2, w: 7.2, h: 0.6, fontFace: FONT, fontSize: 24, bold: true, color: C.text1, align: start, valign: 'middle', margin: 0 }, text: '' } },
    ],
    slideNumber: { x: X(9.1, 0.5), y: 5.22, w: 0.5, h: 0.25, fontFace: FONT, fontSize: 10, color: BLACK, align: rtl ? 'left' : 'right' },
  });

  const sec = SECTIONS[key];
  const page = (sectionTitle) => pres.addSlide({ masterName: 'CT_PAGE', sectionTitle });

  // 1. Cover
  pres.addSection({ title: sec[0] });
  {
    const s = pres.addSlide({ masterName: 'CT_COVER', sectionTitle: sec[0] });
    const lw = 4.2, lh = lw / LOGO_ASPECT;
    s.addImage({ path: LOGO, x: (W - lw) / 2, y: 1.15, w: lw, h: lh, altText: 'ContracTech logo' });
    s.addText(L.cover.title, { placeholder: 'title', fontFace: FONT, rtlMode: rtl, lang: L.lang, align: 'center' });
    T(s, L.cover.slogan, 0.5, 3.5, 9, 0.55, { fontSize: 22, bold: true, align: 'center' });
    T(s, L.cover.subtitle, 0.5, 4.15, 9, 0.4, { fontSize: 15, align: 'center' });
    T(s, L.cover.line, 0.5, 4.6, 9, 0.35, { fontSize: 13, align: 'center' });
    s.addNotes(notes.cover);
  }

  // 2. About
  pres.addSection({ title: sec[1] });
  {
    const s = page(sec[1]);
    title(s, L.about.title);
    T(s, L.about.paras.map((p, i, a) => ({ text: p, options: { breakLine: i < a.length - 1 } })),
      0.5, 1.15, 5.4, 3.9, { fontSize: 13, paraSpaceAfter: 7 });
    photo(s, 'about', 6.1, 1.2);
    s.addNotes(notes.about);
  }

  // 3. Vision and mission
  {
    const s = page(sec[1]);
    title(s, L.vision.title);
    const ys = [1.35, 3.0], hs = [1.4, 1.9];
    L.vision.items.forEach(([label, text], i) => {
      T(s, label, 0.5, ys[i], 1.9, 0.5, { fontSize: 20, bold: true });
      T(s, text, 2.6, ys[i], 6.9, hs[i], { fontSize: 20, lineSpacingMultiple: 1.1 });
    });
    s.addNotes(notes.vision);
  }

  // 4. Values (2 x 2)
  {
    const s = page(sec[1]);
    title(s, L.values.title);
    L.values.items.forEach(([head, desc], i) => {
      const sx = i % 2 === 0 ? 0.5 : 5.1, y = i < 2 ? 1.3 : 3.2;
      T(s, num(i), sx, y - 0.08, 0.6, 0.7, { fontSize: 32, bold: true });
      T(s, head, sx + 0.75, y, 3.65, 0.6, { fontSize: 16, bold: true });
      T(s, desc, sx + 0.75, y + 0.5, 3.65, 1.1, { fontSize: 15 });
    });
    s.addNotes(notes.values);
  }

  // 5. Our team: one column per person
  {
    const s = page(sec[1]);
    title(s, L.team.title);
    L.team.people.forEach((p, i) => {
      const sx = [0.5, 3.55, 6.6][i];
      T(s, p.name, sx, 1.45, 2.9, 0.45, { fontSize: 17, bold: true });
      T(s, p.role, sx, 1.95, 2.9, 0.65, { fontSize: 13 });
      T(s, p.desc, sx, 2.7, 2.9, 2.2, { fontSize: 14 });
    });
    s.addNotes(notes.team);
  }

  // 6. Divisions overview
  pres.addSection({ title: sec[2] });
  {
    const s = page(sec[2]);
    title(s, L.divisions.title);
    L.divisions.cols.forEach((col, i) => {
      const sx = i === 0 ? 0.5 : 5.2;
      photo(s, col.photo, sx, 1.15);
      T(s, col.head, sx, 2.98, 4.3, 0.45, { fontSize: 18, bold: true });
      T(s, col.items.map((t, j, a) => ({ text: t, options: { bullet: true, breakLine: j < a.length - 1 } })),
        sx, 3.5, 4.3, 1.55, { fontSize: 15, paraSpaceAfter: 4 });
    });
    s.addNotes(notes.divisions);
  }

  // Numbered rows of service + description, spaced to fit 3 to 5 rows.
  const serviceRows = (s, items) => {
    const top = 1.3, n = items.length;
    const rowH = Math.min(1.25, (5.05 - top) / n);
    const big = n <= 4;
    items.forEach(([name, desc], i) => {
      const y = top + i * rowH;
      T(s, num(i), 0.5, y - 0.06, 0.5, 0.6, { fontSize: big ? 26 : 22, bold: true });
      T(s, name, 1.15, y, 3.1, rowH - 0.08, { fontSize: big ? 16 : 15, bold: true });
      T(s, desc, 4.45, y, 5.05, rowH - 0.08, { fontSize: big ? 15 : 14 });
    });
  };
  // Six items, three per row, each a heading and a line or two.
  const grid6 = (s, items, o) =>
    items.forEach(([head, desc], i) => {
      const sx = [0.5, 3.55, 6.6][i % 3], y = i < 3 ? 1.3 : 3.2;
      T(s, head, sx, y, 2.9, o.headH, { fontSize: o.headSize, bold: true });
      T(s, desc, sx, y + o.descOffset, 2.9, 1.85 - o.descOffset, { fontSize: o.descSize });
    });

  // 7-8. General contracting, then its low-voltage electrical works
  for (const part of ['contracting', 'electrical']) {
    const s = page(sec[2]);
    title(s, L[part].title);
    serviceRows(s, L[part].items);
    s.addNotes(notes[part]);
  }

  // 9. Low-current (ELV) systems at a glance: four groups
  {
    const s = page(sec[2]);
    title(s, L.elv.title);
    T(s, L.elv.lead, 0.5, 1.05, 9, 0.75, { fontSize: 15, bold: true });
    const gap = 0.25, cw = (9 - 3 * gap) / 4;
    L.elv.groups.forEach((g, i) => {
      const sx = 0.5 + i * (cw + gap);
      // Room for a two-line heading ("TV and audio-visual") so the lists all start level.
      T(s, g.head, sx, 2.0, cw, 0.6, { fontSize: 16, bold: true });
      T(s, g.items.map((t, j, a) => ({ text: t, options: { bullet: true, breakLine: j < a.length - 1 } })),
        sx, 2.7, cw, 2.35, { fontSize: 13, paraSpaceAfter: 6 });
    });
    s.addNotes(notes.elv);
  }

  // 10. Security systems
  {
    const s = page(sec[2]);
    title(s, L.security.title);
    serviceRows(s, L.security.items);
    s.addNotes(notes.security);
  }

  // 11. Communication, TV and audio-visual (3 x 2)
  {
    const s = page(sec[2]);
    title(s, L.comms.title);
    grid6(s, L.comms.items, { headSize: 15, headH: 0.62, descOffset: 0.66, descSize: 13 });
    s.addNotes(notes.comms);
  }

  // 12. Networks and computer rooms
  {
    const s = page(sec[2]);
    title(s, L.networks.title);
    serviceRows(s, L.networks.items);
    s.addNotes(notes.networks);
  }

  // Numbered list used by the CCTV and renovation slides.
  const rows = (s, items, width) =>
    items.forEach((t, i) => {
      const y = 1.72 + i * 0.67;
      T(s, num(i), 0.5, y - 0.03, 0.45, 0.5, { fontSize: 20, bold: true });
      T(s, t, 1.05, y, width - 0.55, 0.62, { fontSize: 14 });
    });

  // 13. CCTV method
  pres.addSection({ title: sec[3] });
  {
    const s = page(sec[3]);
    title(s, L.cctv.title);
    T(s, L.cctv.lead, 0.5, 1.1, 9, 0.45, { fontSize: 16, bold: true });
    rows(s, L.cctv.items, 9.0);
    s.addNotes(notes.cctv);
  }

  // 14. Renovation, with before / after frames (before first, in reading order)
  {
    const s = page(sec[3]);
    title(s, L.renovation.title);
    T(s, L.renovation.lead, 0.5, 1.1, 9, 0.45, { fontSize: 16, bold: true });
    rows(s, L.renovation.items, 5.5);
    T(s, L.renovation.before, 6.3, 1.68, 3.2, 0.3, { fontSize: 13, bold: true });
    photo(s, 'reno_before', 6.3, 2.0);
    T(s, L.renovation.after, 6.3, 3.43, 3.2, 0.3, { fontSize: 13, bold: true });
    photo(s, 'reno_after', 6.3, 3.75);
    s.addNotes(notes.renovation);
  }

  // 15. How we work: seven steps across the slide
  {
    const s = page(sec[3]);
    title(s, L.process.title);
    T(s, L.process.lead, 0.5, 1.1, 9, 0.45, { fontSize: 16, bold: true });
    const gap = 0.15, cw = (9 - 6 * gap) / 7;
    L.process.steps.forEach(([name, desc], i) => {
      const sx = 0.5 + i * (cw + gap);
      T(s, num(i), sx, 2.0, cw, 0.65, { fontSize: 30, bold: true });
      T(s, name, sx, 2.75, cw, 0.6, { fontSize: 14, bold: true });
      T(s, desc, sx, 3.45, cw, 1.6, { fontSize: 13 });
    });
    s.addNotes(notes.process);
  }

  // 16. Why ContracTech (3 x 2)
  {
    const s = page(sec[3]);
    title(s, L.why.title);
    grid6(s, L.why.items, { headSize: 16, headH: 0.6, descOffset: 0.5, descSize: 14 });
    s.addNotes(notes.why);
  }

  // 17. Selected projects (to fill in)
  pres.addSection({ title: sec[4] });
  {
    const s = page(sec[4]);
    title(s, L.projects.title);
    L.projects.items.forEach((p, i) => {
      const sx = [0.5, 3.6, 6.7][i];
      photo(s, p.photo, sx, 1.2);
      T(s, p.name, sx, 3.55, 2.8, 0.4, { fontSize: 15, bold: true });
      T(s, p.meta, sx, 3.95, 2.8, 0.4, { fontSize: 13 });
      T(s, p.scope, sx, 4.35, 2.8, 0.6, { fontSize: 13 });
    });
    s.addNotes(notes.projects);
  }

  // 18. Contact
  {
    const s = page(sec[4]);
    title(s, L.contact.title);
    T(s, L.contact.lead, 0.5, 1.2, 9, 0.6, { fontSize: 22, bold: true });
    L.contact.people.forEach((p, i) => {
      const sx = i === 0 ? 0.5 : 5.2, y = 2.1;
      T(s, p.name, sx, y, 4.3, 0.45, { fontSize: 18, bold: true });
      T(s, p.role, sx, y + 0.5, 4.3, 0.4, { fontSize: 15 });
      LTR(s, p.phone, sx, y + 1.0, 4.3, 0.4, { fontSize: 16, align: start });
      if (p.email) {
        LTR(s, [{ text: p.email, options: { hyperlink: { url: `mailto:${p.email}` } } }],
          sx, y + 1.45, 4.3, 0.4, { fontSize: 15, align: start });
      }
    });
    T(s, L.contact.coverage, 0.5, 4.4, 9, 0.6, { fontSize: 14 });
    s.addNotes(notes.contact);
  }

  const file = path.join(outDir, `ContracTech-Company-Profile-${key.toUpperCase()}.pptx`);
  await pres.writeFile({ fileName: file });
  await patchTheme(file);
  return file;
}

/** Pixel size of a PNG or JPEG, read from its header (no image library needed). */
function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  throw new Error(`Cannot read the size of ${file}; use a .jpg or .png photo.`);
}

/**
 * pptxgenjs writes Office's stock colours and only the Latin theme font. Write the
 * ContracTech colours, and make Tahoma the theme font for Latin and Arabic too, so
 * text typed later in PowerPoint is Tahoma as well.
 */
async function patchTheme(file) {
  const JSZip = require(require.resolve('jszip', { paths: [require.resolve('pptxgenjs')] }));
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const part = 'ppt/theme/theme1.xml';
  let xml = await zip.file(part).async('string');
  const c = THEME.colors;
  const slot = (k) => `<a:${k}><a:srgbClr val="${c[k]}"/></a:${k}>`;
  const scheme = `<a:clrScheme name="${THEME.name}">${Object.keys(c).map(slot).join('')}</a:clrScheme>`;
  const before = xml;
  xml = xml
    .replace(/<a:clrScheme name="[^"]*">[\s\S]*?<\/a:clrScheme>/, scheme)
    .replace(/(<a:theme\b[^>]*\bname=")[^"]*(")/, `$1${THEME.name}$2`)
    .replace(/<a:latin typeface="[^"]*"( panose="[^"]*")?\/>/g, `<a:latin typeface="${FONT}"/>`)
    .replace(/<a:cs typeface="[^"]*"\/>/g, `<a:cs typeface="${FONT}"/>`)
    .replace(/<a:font script="Arab" typeface="[^"]*"\/>/g, `<a:font script="Arab" typeface="${FONT}"/>`);
  if (xml === before || !xml.includes(`<a:clrScheme name="${THEME.name}">`)) {
    throw new Error(`Could not update ${part}; the theme layout has changed. The deck was written without the theme update.`);
  }
  zip.file(part, xml);
  fs.writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}

(async () => {
  const outDir = path.resolve(process.argv[2] || process.cwd());
  fs.mkdirSync(outDir, { recursive: true });
  for (const [key, L] of [['ar', ar], ['en', en]]) {
    console.log('Wrote', await build(L, key, outDir));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
