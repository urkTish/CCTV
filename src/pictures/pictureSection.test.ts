import { describe, it, expect } from 'vitest';

import { photoFromBytes, hasExif } from '../renovation/photos.ts';
import {
  addImage,
  addSection,
  completionReportSchema,
  duplicateSection,
  exifDateTaken,
  hasContent,
  imageLabel,
  layoutColumns,
  moveSection,
  newPictureSection,
  orderedImages,
  parseRichText,
  pictureSectionSchema,
  pictureSectionsSchema,
  removeSection,
  roleForNewImage,
  statusCounts,
  toggleBullets,
  type PictureSection,
} from './pictureSection.ts';

const DATA = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP8=';
const img = { fileName: 'a.jpg', dataUri: DATA, widthPx: 640, heightPx: 480, caption: '', takenOn: null, metadataStripped: true };

/** A JPEG whose EXIF holds DateTimeOriginal 2025:03:14 and a GPS IFD pointer. */
function jpegWithDate(date = '2025:03:14 10:20:30', bigEndian = false): Uint8Array {
  const u16 = (n: number) => (bigEndian ? [n >> 8, n & 0xff] : [n & 0xff, n >> 8]);
  const u32 = (n: number) => (bigEndian ? [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff] : [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24]);
  const ascii = [...date].map((c) => c.charCodeAt(0)).concat(0);
  // IFD0 at 8: 2 entries (ExifIFD pointer, GPS pointer); Exif IFD at 38; string at 56.
  const tiff = [
    ...(bigEndian ? [0x4d, 0x4d] : [0x49, 0x49]),
    ...u16(42),
    ...u32(8),
    ...u16(2),
    ...u16(0x8769), ...u16(4), ...u32(1), ...u32(38),
    ...u16(0x8825), ...u16(4), ...u32(1), ...u32(0),
    ...u32(0),
    ...u16(1),
    ...u16(0x9003), ...u16(2), ...u32(ascii.length), ...u32(56),
    ...u32(0),
    ...ascii,
  ];
  const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const app1 = [0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
  const sof = [0xff, 0xc0, 0, 17, 8, 0, 48, 0, 64, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  const sos = [0xff, 0xda, 0, 12, 3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0, 0x12, 0x34, 0x56];
  return Uint8Array.from([0xff, 0xd8, ...app1, ...sof, ...sos, 0xff, 0xd9]);
}

describe('picture section: creating and editing', () => {
  it('adds sections with free ids and the defaults for each kind', () => {
    let r = addSection([], 'concept');
    expect(r.id).toBe('concept-1');
    r = addSection(r.list, 'concept');
    expect(r.list.map((s) => s.id)).toEqual(['concept-1', 'concept-2']);
    expect(r.list[0]).toMatchObject({ kind: 'concept', status: 'proposed', layout: 'one', images: [], roomId: null, doneOn: null, signOff: false });
    expect(addSection([], 'actual').list[0]).toMatchObject({ id: 'item-1', kind: 'actual', status: 'in-progress' });
  });

  it('moves a section up and down, clamping at the ends', () => {
    const l = ['a', 'b', 'c', 'd'];
    expect(moveSection(l, 2, 1)).toEqual(['a', 'c', 'b', 'd']);
    expect(moveSection(l, 0, 3)).toEqual(['b', 'c', 'd', 'a']);
    expect(moveSection(l, 0, -1)).toEqual(l);
    expect(moveSection(l, 3, 10)).toEqual(l);
    expect(moveSection(l, 9, 0)).toEqual(l);
  });

  it('duplicates right after the original with new ids, and removes', () => {
    let list: PictureSection[] = [newPictureSection('concept-1', 'concept', 'Hall'), newPictureSection('concept-2', 'concept', 'Kitchen')];
    list = [addImage(list[0]!, img), list[1]!];
    const d = duplicateSection(list, 'concept-1');
    expect(d.list.map((s) => s.title)).toEqual(['Hall', 'Hall (copy)', 'Kitchen']);
    expect(d.id).toBe('concept-3');
    expect(d.list[1]!.images[0]!.id).toBe('concept-3-img-1');
    expect(d.list[1]!.images[0]!.dataUri).toBe(DATA);
    expect(removeSection(d.list, 'concept-1').map((s) => s.id)).toEqual(['concept-3', 'concept-2']);
    expect(duplicateSection(list, 'nope').id).toBeNull();
  });

  it('gives new pictures a role: main for concepts, before → after → during for evidence and pairs', () => {
    const c = newPictureSection('c', 'concept');
    expect(roleForNewImage(c)).toBe('main');
    let a = newPictureSection('i', 'actual');
    a = addImage(a, img);
    a = addImage(a, img);
    a = addImage(a, img);
    expect(a.images.map((i) => i.role)).toEqual(['before', 'after', 'during']);
    expect(orderedImages(a).map((i) => i.role)).toEqual(['before', 'during', 'after']);
    const pair = addImage(addImage({ ...c, layout: 'pair' }, img), img);
    expect(pair.images.map((i) => i.role)).toEqual(['before', 'after']);
  });

  it('caps the pictures per section at 6', () => {
    let s = newPictureSection('c', 'concept');
    for (let i = 0; i < 8; i++) s = addImage(s, img);
    expect(s.images).toHaveLength(6);
  });

  it('prints 1, 2 or 3 columns from the layout and the picture count', () => {
    const s = newPictureSection('c', 'concept');
    expect(layoutColumns(s)).toBe(1);
    const two = addImage(addImage({ ...s, layout: 'two' }, img), img);
    expect(layoutColumns(two)).toBe(2);
    expect(layoutColumns(addImage(two, img))).toBe(3);
    expect(layoutColumns({ ...two, layout: 'one' })).toBe(1);
    expect(layoutColumns({ ...two, layout: 'pair' })).toBe(2);
  });

  it('labels concept pictures as illustrative and evidence with the date taken', () => {
    expect(imageLabel('concept', { role: 'main', takenOn: null })).toBe('Concept / Illustrative');
    expect(imageLabel('actual', { role: 'after', takenOn: '2026-10-12' })).toBe('Actual photo — after · 12 Oct 2026');
    expect(imageLabel('actual', { role: 'before', takenOn: null })).toBe('Actual photo — before · date not recorded');
    expect(imageLabel('concept', { role: 'main', takenOn: null }, 'ar')).toMatch(/توضيحية/);
  });

  it('counts statuses and knows when a section has something to print', () => {
    const s = newPictureSection('c', 'actual');
    expect(hasContent(s)).toBe(false);
    expect(hasContent({ ...s, description: 'x' })).toBe(true);
    expect(statusCounts([s, { ...s, status: 'done' }, { ...s, status: 'snag' }])).toEqual({ proposed: 0, 'in-progress': 1, done: 1, snag: 1 });
  });
});

describe('simple rich text', () => {
  it('splits paragraphs on blank lines and bullets on "- " (also • and *)', () => {
    expect(parseRichText('First line\nsecond line\n\n- one\n• two\n* three\nAfter')).toEqual([
      { kind: 'p', lines: ['First line', 'second line'] },
      { kind: 'ul', items: ['one', 'two', 'three'] },
      { kind: 'p', lines: ['After'] },
    ]);
    expect(parseRichText('  \n\n')).toEqual([]);
    expect(parseRichText('-not a bullet')).toEqual([{ kind: 'p', lines: ['-not a bullet'] }]);
  });

  it('toggles bullets on the selected lines', () => {
    const t = 'Intro\nA\nB';
    const on = toggleBullets(t, 6, 9);
    expect(on.text).toBe('Intro\n- A\n- B');
    expect(on.text.slice(on.start, on.end)).toBe('- A\n- B');
    expect(toggleBullets(on.text, on.start, on.end).text).toBe(t);
    expect(toggleBullets('', 0, 0).text).toBe('');
    expect(toggleBullets('One', 3, 3).text).toBe('- One');
  });
});

describe('date taken, read before the metadata is removed', () => {
  it('reads EXIF DateTimeOriginal (little and big endian) and never the location', () => {
    expect(exifDateTaken(jpegWithDate())).toBe('2025-03-14');
    expect(exifDateTaken(jpegWithDate('2024:12:01 08:00:00', true))).toBe('2024-12-01');
    expect(exifDateTaken(jpegWithDate('0000:00:00 00:00:00'))).toBeNull();
    expect(exifDateTaken(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(exifDateTaken(Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBeNull();
  });

  it('the imported picture itself no longer carries EXIF', () => {
    const bytes = jpegWithDate();
    expect(hasExif(bytes)).toBe(true);
    const r = photoFromBytes('x.jpg', bytes);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const b = Uint8Array.from(atob(r.photo.dataUri.split(',')[1]!), (c) => c.charCodeAt(0));
    expect(hasExif(b)).toBe(false);
    expect(exifDateTaken(b)).toBeNull();
  });
});

describe('schemas (a validation boundary when a file is opened)', () => {
  const good = addImage({ ...newPictureSection('concept-1', 'concept', 'Hall'), description: '- a' }, img);

  it('accepts a full section and refuses unknown fields, wrong enums and non-image data', () => {
    expect(pictureSectionSchema.safeParse(good).success).toBe(true);
    const path = (v: unknown) => {
      const r = pictureSectionSchema.safeParse(v);
      return r.success ? null : r.error.issues[0]?.path.join('.');
    };
    expect(path({ ...good, extra: 1 })).toBe('');
    expect(path({ ...good, status: 'finished' })).toBe('status');
    expect(path({ ...good, layout: 'grid' })).toBe('layout');
    expect(path({ ...good, images: [{ ...good.images[0]!, dataUri: 'data:text/html;base64,AAAA' }] })).toBe('images.0.dataUri');
    expect(path({ ...good, images: [{ ...good.images[0]!, takenOn: '12/10/2026' }] })).toBe('images.0.takenOn');
    expect(path({ ...good, title: 'x'.repeat(201) })).toBe('title');
    expect(pictureSectionsSchema.safeParse(Array.from({ length: 61 }, (_, i) => ({ ...good, id: `c-${i}` }))).success).toBe(false);
  });

  it('a completion report round-trips through JSON', () => {
    const report = {
      createdOn: '2026-10-12',
      source: { proposalStatus: 'final' as const, proposalRevision: 'A' },
      summary: '',
      items: [{ ...good, kind: 'actual' as const, status: 'done' as const, doneOn: '2026-10-20', doneBy: 'Crew A', signOff: true }],
      state: { status: 'draft' as const, finalisedOn: null, revision: '', preparedBy: null },
    };
    const back = completionReportSchema.parse(JSON.parse(JSON.stringify(report)));
    expect(back).toEqual(report);
    expect(completionReportSchema.safeParse({ ...report, state: { ...report.state, status: 'issued' } }).success).toBe(false);
  });
});
