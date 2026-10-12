/**
 * The "picture section": one reusable building block for every report that
 * shows work as Title → Picture(s) → Description — the Concept chapter of a
 * proposal (renovation now; civil and maintenance later) and the completion /
 * photo report (docs/backlog-concept-and-completion-reports.md).
 *
 * Pure and line-agnostic: it knows nothing about rooms or BOQs beyond an
 * optional reference id and a printed text, so another service line can link
 * its own records. Images are stored as compressed, metadata-free data URIs
 * in the project file (offline, as every other photo); the printed label
 * ("Concept / Illustrative" or "Actual photo · date") is burned into the
 * picture when it is shown for print, so a later change of date or language
 * is never stuck in the pixels.
 */

import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a YYYY-MM-DD date');
const id = z.string().min(1).max(64);
const text = (max: number) => z.string().max(max);

export const SECTION_STATUSES = ['proposed', 'in-progress', 'done', 'snag'] as const;
export type SectionStatus = (typeof SECTION_STATUSES)[number];
export const SECTION_STATUS_LABEL: Readonly<Record<SectionStatus, string>> = {
  proposed: 'Proposed',
  'in-progress': 'In progress',
  done: 'Done',
  snag: 'Snag',
};

export const SECTION_LAYOUTS = ['one', 'two', 'pair'] as const;
export type SectionLayout = (typeof SECTION_LAYOUTS)[number];
export const SECTION_LAYOUT_LABEL: Readonly<Record<SectionLayout, string>> = {
  one: '1-up (full width)',
  two: '2-up (side by side)',
  pair: 'Before / after pair',
};

/** What a picture is in the story of the work. `main` = a concept picture. */
export const IMAGE_ROLES = ['main', 'before', 'during', 'after'] as const;
export type ImageRole = (typeof IMAGE_ROLES)[number];
export const IMAGE_ROLE_LABEL: Readonly<Record<ImageRole, string>> = { main: 'Picture', before: 'Before', during: 'During', after: 'After' };

/** `concept` sections are illustrative (proposals); `actual` sections hold evidence photos (completion reports). */
export const SECTION_KINDS = ['concept', 'actual'] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const MAX_SECTION_IMAGES = 6;
export const MAX_SECTIONS = 60;

export const pictureImageSchema = z
  .object({
    id,
    role: z.enum(IMAGE_ROLES),
    fileName: text(200),
    /** Compressed and stripped of location / camera metadata on import; no label in the pixels. */
    dataUri: z
      .string()
      .max(12_000_000)
      .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/, 'expected a PNG or JPEG data URI'),
    widthPx: z.number().int().min(1).max(20000),
    heightPx: z.number().int().min(1).max(20000),
    caption: text(300),
    /** When the photo was taken (from the photo before its metadata was removed, else the file date); editable. */
    takenOn: isoDate.nullable(),
    metadataStripped: z.boolean(),
  })
  .strict();
export type PictureImage = z.infer<typeof pictureImageSchema>;

export const pictureSectionSchema = z
  .object({
    id,
    kind: z.enum(SECTION_KINDS),
    title: text(200),
    layout: z.enum(SECTION_LAYOUTS),
    images: z.array(pictureImageSchema).max(MAX_SECTION_IMAGES),
    /** Simple rich text: paragraphs separated by a blank line; lines starting with "- " are bullets. */
    description: text(6000),
    /** Optional links, kept as an id (for the app) and a printed text (so the report reads the same if the source changes). */
    roomId: id.nullable(),
    scopeRef: text(40),
    scopeText: text(300),
    status: z.enum(SECTION_STATUSES),
    /** Completion only: when the work was done and who did it. */
    doneOn: isoDate.nullable(),
    doneBy: text(160),
    /** Completion only: a client sign-off line printed under this item. */
    signOff: z.boolean(),
  })
  .strict();
export type PictureSection = z.infer<typeof pictureSectionSchema>;

export const pictureSectionsSchema = z.array(pictureSectionSchema).max(MAX_SECTIONS);

// ---------------------------------------------------------------------------
// Creating and editing (pure; the editor calls these)
// ---------------------------------------------------------------------------

export function nextFreeId(prefix: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  let n = 1;
  while (set.has(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

export function newPictureSection(sectionId: string, kind: SectionKind, title = ''): PictureSection {
  return {
    id: sectionId,
    kind,
    title,
    layout: 'one',
    images: [],
    description: '',
    roomId: null,
    scopeRef: '',
    scopeText: '',
    status: kind === 'concept' ? 'proposed' : 'in-progress',
    doneOn: null,
    doneBy: '',
    signOff: false,
  };
}

export function addSection(list: readonly PictureSection[], kind: SectionKind): { list: PictureSection[]; id: string } {
  const sid = nextFreeId(kind === 'concept' ? 'concept' : 'item', list.map((s) => s.id));
  return { list: [...list, newPictureSection(sid, kind)], id: sid };
}

/** Move the section at `from` to index `to` (clamped). Returns the same array when nothing moves. */
export function moveSection<T>(list: readonly T[], from: number, to: number): T[] {
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (from < 0 || from >= list.length || from === target) return [...list];
  const out = [...list];
  const [item] = out.splice(from, 1);
  out.splice(target, 0, item!);
  return out;
}

/** A copy placed right after the original, with new ids for the section and its images. */
export function duplicateSection(list: readonly PictureSection[], sectionId: string): { list: PictureSection[]; id: string | null } {
  const i = list.findIndex((s) => s.id === sectionId);
  const src = list[i];
  if (!src) return { list: [...list], id: null };
  const sid = nextFreeId(src.kind === 'concept' ? 'concept' : 'item', list.map((s) => s.id));
  const copy: PictureSection = {
    ...src,
    id: sid,
    title: src.title ? `${src.title} (copy)`.slice(0, 200) : '',
    images: src.images.map((im, k) => ({ ...im, id: `${sid}-img-${k + 1}` })),
  };
  const out = [...list];
  out.splice(i + 1, 0, copy);
  return { list: out, id: sid };
}

export function removeSection(list: readonly PictureSection[], sectionId: string): PictureSection[] {
  return list.filter((s) => s.id !== sectionId);
}

export function updateSection(list: readonly PictureSection[], sectionId: string, fn: (s: PictureSection) => PictureSection): PictureSection[] {
  return list.map((s) => (s.id === sectionId ? fn(s) : s));
}

/** Role a newly added picture gets: `main` for concepts; for evidence, the first missing of before → after → during. */
export function roleForNewImage(section: PictureSection): ImageRole {
  if (section.kind === 'concept' && section.layout !== 'pair') return 'main';
  const has = new Set(section.images.map((i) => i.role));
  if (section.layout === 'pair') return has.has('before') ? 'after' : 'before';
  if (!has.has('before')) return 'before';
  if (!has.has('after')) return 'after';
  return 'during';
}

export function addImage(section: PictureSection, image: Omit<PictureImage, 'id' | 'role'> & { role?: ImageRole }): PictureSection {
  if (section.images.length >= MAX_SECTION_IMAGES) return section;
  const imgId = nextFreeId(`${section.id}-img`, section.images.map((i) => i.id));
  const role = image.role ?? roleForNewImage(section);
  return { ...section, images: [...section.images, { ...image, id: imgId, role }] };
}

/** Images in print order: before → during → after for evidence; as added otherwise. */
export function orderedImages(section: PictureSection): PictureImage[] {
  if (section.images.every((i) => i.role === 'main')) return [...section.images];
  const rank: Record<ImageRole, number> = { before: 0, during: 1, main: 1, after: 2 };
  return section.images.map((im, i) => ({ im, i })).sort((a, b) => rank[a.im.role] - rank[b.im.role] || a.i - b.i).map((x) => x.im);
}

/** Printed grid columns for a layout (a single picture always prints full width). */
export function layoutColumns(section: PictureSection): 1 | 2 | 3 {
  const n = section.images.length;
  if (n <= 1 || section.layout === 'one') return 1;
  if (section.layout === 'pair') return 2;
  return n === 3 ? 3 : 2;
}

// ---------------------------------------------------------------------------
// The printed label
// ---------------------------------------------------------------------------

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_EN[(m ?? 1) - 1]} ${y}`;
}

export const CONCEPT_LABEL: Readonly<Record<'en' | 'ar', string>> = { en: 'Concept / Illustrative', ar: 'تصوّر / صورة توضيحية' };
const ACTUAL_LABEL: Readonly<Record<'en' | 'ar', string>> = { en: 'Actual photo', ar: 'صورة فعلية' };

/** The label burned into a picture for print. Evidence photos carry the date taken. */
export function imageLabel(kind: SectionKind, image: Pick<PictureImage, 'role' | 'takenOn'>, lang: 'en' | 'ar' = 'en'): string {
  if (kind === 'concept') return CONCEPT_LABEL[lang];
  const role = image.role === 'main' ? '' : lang === 'ar' ? '' : ` — ${IMAGE_ROLE_LABEL[image.role].toLowerCase()}`;
  const date = image.takenOn ? ` · ${lang === 'ar' ? image.takenOn : shortDate(image.takenOn)}` : lang === 'ar' ? '' : ' · date not recorded';
  return `${ACTUAL_LABEL[lang]}${role}${date}`;
}

// ---------------------------------------------------------------------------
// Simple rich text (paragraphs and bullets), no dependency
// ---------------------------------------------------------------------------

export type RichBlock = { readonly kind: 'p'; readonly lines: readonly string[] } | { readonly kind: 'ul'; readonly items: readonly string[] };

const BULLET = /^\s*[-•*]\s+/;

export function parseRichText(src: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ kind: 'p', lines: para });
    para = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ kind: 'ul', items: list });
    list = [];
  };
  for (const raw of src.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
    } else if (BULLET.test(raw)) {
      flushPara();
      const item = raw.replace(BULLET, '').trim();
      if (item) list.push(item);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

/**
 * Toggle "- " on every line touched by the selection [start, end). Returns the
 * new text and the new selection. If every non-empty touched line is already
 * a bullet, the bullets are removed; otherwise they are added.
 */
export function toggleBullets(src: string, start: number, end: number): { text: string; start: number; end: number } {
  const lineStart = src.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nl = src.indexOf('\n', Math.max(end, start) - (end > start && src[end - 1] === '\n' ? 1 : 0));
  const lineEnd = nl === -1 ? src.length : nl;
  const lines = src.slice(lineStart, lineEnd).split('\n');
  const filled = lines.filter((l) => l.trim());
  const allBullets = filled.length > 0 && filled.every((l) => BULLET.test(l));
  const next = lines.map((l) => (!l.trim() ? l : allBullets ? l.replace(BULLET, '') : `- ${l.replace(BULLET, '')}`)).join('\n');
  const text = `${src.slice(0, lineStart)}${next}${src.slice(lineEnd)}`;
  return { text, start: lineStart, end: lineStart + next.length };
}

// ---------------------------------------------------------------------------
// The date a photo was taken, read BEFORE its metadata is removed
// ---------------------------------------------------------------------------

/**
 * EXIF DateTimeOriginal (or IFD0 DateTime) of a JPEG as YYYY-MM-DD, or null.
 * Only the date is kept — never the location — and the photo's metadata is
 * removed right after (photos.ts).
 */
export function exifDateTaken(b: Uint8Array): string | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    if (marker === 0xda || marker === 0xd9) return null;
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    if (len < 2) return null;
    if (marker === 0xe1 && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) {
      return readTiffDate(b.subarray(i + 10, Math.min(b.length, i + 2 + len)));
    }
    i += 2 + len;
  }
  return null;
}

function readTiffDate(t: Uint8Array): string | null {
  if (t.length < 8) return null;
  const le = t[0] === 0x49 && t[1] === 0x49;
  if (!le && !(t[0] === 0x4d && t[1] === 0x4d)) return null;
  const u16 = (o: number) => (o + 2 > t.length ? -1 : le ? t[o]! | (t[o + 1]! << 8) : (t[o]! << 8) | t[o + 1]!);
  const u32 = (o: number) => (o + 4 > t.length ? -1 : le ? (t[o]! | (t[o + 1]! << 8) | (t[o + 2]! << 16) | (t[o + 3]! << 24)) >>> 0 : ((t[o]! << 24) | (t[o + 1]! << 16) | (t[o + 2]! << 8) | t[o + 3]!) >>> 0);
  const ascii = (off: number, count: number) => {
    if (off < 0 || off + count > t.length) return null;
    return String.fromCharCode(...t.subarray(off, off + count)).replace(/\0.*$/, '');
  };
  const entries = (ifd: number) => {
    const n = u16(ifd);
    const out: { tag: number; count: number; value: number }[] = [];
    if (n < 0 || n > 500) return out;
    for (let k = 0; k < n; k++) {
      const e = ifd + 2 + k * 12;
      const tag = u16(e);
      if (tag < 0) break;
      out.push({ tag, count: u32(e + 4), value: u32(e + 8) });
    }
    return out;
  };
  const toIso = (s: string | null) => {
    const m = s ? /^(\d{4}):(\d{2}):(\d{2})/.exec(s) : null;
    if (!m) return null;
    const [, y, mo, d] = m;
    if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31 || Number(y) < 1990) return null;
    return `${y}-${mo}-${d}`;
  };
  const ifd0 = entries(u32(4));
  const exifPtr = ifd0.find((e) => e.tag === 0x8769);
  if (exifPtr) {
    const original = entries(exifPtr.value).find((e) => e.tag === 0x9003);
    const iso = original && original.count >= 10 ? toIso(ascii(original.value, original.count)) : null;
    if (iso) return iso;
  }
  const dt = ifd0.find((e) => e.tag === 0x0132);
  return dt && dt.count >= 10 ? toIso(ascii(dt.value, dt.count)) : null;
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export function statusCounts(list: readonly PictureSection[]): Record<SectionStatus, number> {
  const out: Record<SectionStatus, number> = { proposed: 0, 'in-progress': 0, done: 0, snag: 0 };
  for (const s of list) out[s.status] += 1;
  return out;
}

/** A section has printable content once it has a title, a picture or a description. */
export function hasContent(s: PictureSection): boolean {
  return !!(s.title.trim() || s.images.length || s.description.trim());
}

// ---------------------------------------------------------------------------
// The completion / photo report (a report type of its own; any service line)
// ---------------------------------------------------------------------------

export const completionReportSchema = z
  .object({
    createdOn: isoDate,
    /** The proposal it was generated from, as it was then. */
    source: z.object({ proposalStatus: z.enum(['draft', 'final']), proposalRevision: text(4) }).strict(),
    /** Optional words for the project summary, under the generated facts. */
    summary: text(3000),
    items: pictureSectionsSchema,
    state: z
      .object({
        status: z.enum(['draft', 'final']),
        finalisedOn: isoDate.nullable(),
        revision: text(4),
        preparedBy: z.object({ name: text(120), title: text(120), phone: text(60), email: text(160) }).strict().nullable(),
      })
      .strict(),
  })
  .strict();
export type CompletionReport = z.infer<typeof completionReportSchema>;

/** The date to record when an item is marked done: the latest After photo's date, else today. */
export function doneDateFor(s: PictureSection, today: string): string {
  const dates = s.images.filter((i) => i.role === 'after' && i.takenOn).map((i) => i.takenOn!).sort();
  return dates[dates.length - 1] ?? today;
}

/** What is outstanding on a snag: a line starting "Snag:" in the description, else its first line. */
export function snagNote(s: PictureSection): string {
  const lines = s.description.split('\n').map((l) => l.replace(BULLET, '').trim()).filter(Boolean);
  const tagged = lines.find((l) => /^snag\b[:\s-]*/i.test(l));
  return (tagged ? tagged.replace(/^snag\b[:\s-]*/i, '') : lines[0]) ?? '';
}
