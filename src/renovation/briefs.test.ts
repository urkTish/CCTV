/**
 * The visual brief pack, the ZIP writer, photo metadata stripping, pairing by
 * file name, and the portal-drawn swatch sheet.
 */

import { describe, it, expect } from 'vitest';

import { buildBriefPack, inkOn, moodBoardPrompt, narrativePrompt, preamble, qaPrompt, schedulePrompt, swatchSheetSvg, TEMPLATES, viewBriefPrompt, viewFromFileName } from './briefs.ts';
import { draftFromRenovationIntake } from './intake.ts';
import { sampleLibrary } from './library.ts';
import { fitWithin, hasExif, photoFromBytes, stripImageMetadata } from './photos.ts';
import { THREE_ROOM_PHOTOS, threeRoomAnswers, jpegWithGps } from './testFixtures.ts';
import { buildZip, crc32, readZip } from './zip.ts';

const portal = draftFromRenovationIntake({ answers: threeRoomAnswers(), submittedOn: '2026-10-12', photos: THREE_ROOM_PHOTOS, planImage: null }, sampleLibrary()).portal;
const views = portal.renovation!.views;

describe('prompt templates (spec 5.3)', () => {
  it('T0 carries the honesty rules and the market', () => {
    const t = preamble(portal);
    expect(t).toMatch(/\[RN-PRE v1.0\]/);
    expect(t).toMatch(/Never invent measurements, prices, quantities/);
    expect(t).toMatch(/apartment works in Riyadh, Saudi Arabia/);
  });

  it('T1 narrative quotes the client and names colours by code, without money', () => {
    const t = narrativePrompt(portal);
    expect(t).toMatch(/\[RN-NARR v1.0\]/);
    expect(t).toMatch(/"No dark wood\."/);
    expect(t).toMatch(/Cream \(RAL 9001, approx\. #E9E0D2\)/);
    expect(t).toMatch(/do not mention money/);
    expect(t).toMatch(/MISSING OR UNCLEAR/);
  });

  it('T2 per view lists only the visible surfaces, the preserve and avoid lists, and the result file name', () => {
    const v = { ...views[0]!, visibleSurfaces: ['walls' as const] };
    const t = viewBriefPrompt(portal, v);
    expect(t).toMatch(/\[RN-IMG-EDIT v1.0\] view view-1/);
    expect(t).toMatch(/- Walls: .*Cream/);
    expect(t).not.toMatch(/- Floor: from/);
    expect(t).toMatch(/PRESERVE EXACTLY/);
    expect(t).toMatch(/The existing furniture/);
    expect(t).toMatch(/after\/view-1-v1\.jpg/);
  });

  it('T4, T5 and T8 use the schedule and never ask for painted swatches', () => {
    expect(moodBoardPrompt(portal)).toMatch(/do not paint them/);
    expect(schedulePrompt(portal)).toMatch(/\| F01 \| Family living room \| Walls \|/);
    expect(qaPrompt(portal, views[0]!)).toMatch(/RECOMMEND = USE \/ REGENERATE \/ NEEDS ENGINEER LOOK/);
  });

  it('exports one pack: prompts, before photos, swatches, QA prompts, README and a manifest', () => {
    const { entries, manifest } = buildBriefPack(portal, 'Test project', '2026-10-12');
    const names = entries.map((e) => e.name);
    expect(names[0]).toBe('README.txt');
    expect(names).toEqual(expect.arrayContaining(['01-narrative-RN-NARR.txt', 'swatches.svg', 'manifest.json', 'before/view-1.jpg', 'qa/view-4-main-bathroom-RN-QA.txt']));
    expect(manifest.views).toHaveLength(4);
    expect(manifest.templates).toEqual(Object.fromEntries(Object.values(TEMPLATES).map((t) => [t.id, t.version])));
  });
});

describe('pairing imported images by file name', () => {
  const ids = views.map((v) => v.id);
  it.each([
    ['view-1-v1.jpg', { viewId: 'view-1', variant: 1 }],
    ['VIEW-3_v2.png', { viewId: 'view-3', variant: 2 }],
    ['after view-4.jpg', { viewId: 'view-4', variant: 1 }],
    ['bathroom result.jpg', null],
    ['view-9-v1.jpg', null],
  ])('%s', (name, expected) => {
    expect(viewFromFileName(name, ids)).toEqual(expected);
  });
});

describe('ZIP writer', () => {
  it('computes the standard CRC-32 check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('writes a stored archive that reads back byte for byte, with UTF-8 names', () => {
    const z = buildZip([
      { name: 'a.txt', data: 'hello' },
      { name: 'مجلد/ب.txt', data: 'عربي' },
      { name: 'bin', data: Uint8Array.from([0, 1, 2, 255]) },
    ]);
    const back = readZip(z)!;
    expect(back.map((e) => e.name)).toEqual(['a.txt', 'مجلد/ب.txt', 'bin']);
    expect(new TextDecoder().decode(back[1]!.data)).toBe('عربي');
    expect([...back[2]!.data]).toEqual([0, 1, 2, 255]);
  });
});

describe('photo privacy (spec 3.1, 13)', () => {
  it('removes the EXIF (GPS) block from a JPEG but keeps the picture data and size', () => {
    const src = jpegWithGps(1600, 1200);
    expect(hasExif(src)).toBe(true);
    const clean = stripImageMetadata(src);
    expect(hasExif(clean)).toBe(false);
    expect(clean.length).toBeLessThan(src.length);
    const r = photoFromBytes('room.jpg', src);
    expect(r.ok && r.photo.widthPx).toBe(1600);
    expect(r.ok && r.photo.metadataStripped).toBe(true);
    expect(r.ok && hasExif(Uint8Array.from(atob(r.photo.dataUri.split(',')[1]!), (c) => c.charCodeAt(0)))).toBe(false);
  });
  it('refuses something that is not a photo', () => {
    expect(photoFromBytes('x.pdf', new TextEncoder().encode('%PDF-1.4')).ok).toBe(false);
    expect(photoFromBytes('empty.jpg', new Uint8Array()).ok).toBe(false);
  });
  it('downscales to the longest side, keeping the aspect ratio', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ w: 1600, h: 1200 });
    expect(fitWithin(800, 600, 1600)).toEqual({ w: 800, h: 600 });
  });
});

describe('swatches drawn by the portal', () => {
  it('draws each colour from its library hex with its code, and picks legible text', () => {
    const svg = swatchSheetSvg([{ name: 'Cream', code: 'RAL 9001', hex: '#E9E0D2', where: ['walls'] }], 'Schedule');
    expect(svg).toMatch(/fill="#E9E0D2"/);
    expect(svg).toMatch(/RAL 9001/);
    expect(svg).toMatch(/check the physical sample/);
    expect(inkOn('#E9E0D2')).toBe('#10151c');
    expect(inkOn('#383E42')).toBe('#ffffff');
  });
});
