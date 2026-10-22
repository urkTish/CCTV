/**
 * The renovation intake: file and link round-trips, validation, and the
 * mapping to an Admin draft in which every assumed value is flagged.
 */

import { describe, it, expect } from 'vitest';

import { draftFromRenovationIntake, indicativeRenovation, parseRenovationIntake, parseRenovationLink, renovationLinkHash, RN_INTAKE_HASH_PREFIX, serializeRenovationIntake, SIZE_DEFAULTS } from './intake.ts';
import { sampleLibrary } from './library.ts';
import { assumedTotal, portalSchema } from './model.ts';
import { THREE_ROOM_PHOTOS, threeRoomAnswers } from './testFixtures.ts';

const lib = sampleLibrary();
const intake = { answers: threeRoomAnswers(), submittedOn: '2026-10-12', photos: THREE_ROOM_PHOTOS, planImage: null };

describe('intake file and link', () => {
  it('round-trips the file with photos', () => {
    const r = parseRenovationIntake(serializeRenovationIntake(intake));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.intake.answers).toEqual(intake.answers);
    expect(r.intake.photos).toEqual(intake.photos);
  });

  it('refuses a file whose rooms refer to a missing photo, and bad JSON, with a reason', () => {
    const bad = serializeRenovationIntake({ ...intake, photos: THREE_ROOM_PHOTOS.slice(0, 2) });
    const r = parseRenovationIntake(bad);
    expect(!r.ok && r.reason).toMatch(/photo "photo-3", which is not in the file/);
    expect(parseRenovationIntake('{').ok).toBe(false);
    const wrongEnum = serializeRenovationIntake(intake).replace('"apartment"', '"castle"');
    expect(!parseRenovationIntake(wrongEnum).ok && (parseRenovationIntake(wrongEnum) as { reason: string }).reason).toMatch(/answers\.place\.propertyType/);
  });

  it('carries the answers in a link but never the photos', () => {
    const hash = renovationLinkHash(intake.answers, '2026-10-12');
    expect(hash.startsWith(RN_INTAKE_HASH_PREFIX)).toBe(true);
    const r = parseRenovationLink(hash.slice(RN_INTAKE_HASH_PREFIX.length));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.intake.photos).toEqual([]);
    expect(r.intake.answers.rooms.every((x) => x.photoIds.length === 0)).toBe(true);
    expect(r.intake.answers.place.phone).toBe('+966 50 123 4567');
    expect(parseRenovationLink('not%%base64').ok).toBe(false);
  });
});

describe('mapping to a draft (spec 3.2 engine notes)', () => {
  const d = draftFromRenovationIntake(intake, lib);
  const [living, bedroom, bath] = d.portal.rooms;

  it('produces a valid renovation-only spine', () => {
    expect(portalSchema.safeParse(d.portal).success).toBe(true);
    expect(d.portal.lines).toEqual(['renovation']);
    expect(d.clientName).toBe('Sara Al-Qahtani');
    expect(d.projectName).toBe('Sara Al-Qahtani — Apartment renovation, Riyadh');
    expect(d.portal.client.consent).toEqual({ photoUse: true, marketing: false, recordedOn: '2026-10-12' });
  });

  it('uses typed sizes (flagged "typed by the client"), size pictograms (flagged Unverified default) and the default height', () => {
    expect([living!.lengthM, living!.widthM, living!.heightM]).toEqual([5, 4, 2.8]);
    expect(living!.assumed.lengthM).toMatch(/Typed by the client/);
    expect([bedroom!.lengthM, bedroom!.widthM]).toEqual([...SIZE_DEFAULTS.bedroom.M]);
    expect(bedroom!.assumed.lengthM).toMatch(/typical 4 × 4 m \(Unverified default\)/);
    expect(bath!.heightM).toBe(2.8);
    expect(bath!.assumed.heightM).toMatch(/default 2.8 m for a apartment|default 2.8 m/);
  });

  it('assumes one door per room and one window per habitable room, flagged', () => {
    expect(living!.openings.map((o) => o.type)).toEqual(['door', 'window']);
    expect(bath!.openings.map((o) => o.type)).toEqual(['door']);
    expect(living!.assumed.openings).toMatch(/one door 0.9 × 2.1 m and one window/);
    expect(assumedTotal(d.portal)).toBe(d.assumedTotal);
    expect(d.assumedTotal).toBe(15); // 5 per room: length, width, height, openings, finishes
  });

  it('proposes finishes from the ticked works and style, from the library only', () => {
    const spec = (id: string) => d.portal.renovation!.specs.find((s) => s.roomId === id)!;
    expect(spec('room-1').wallPaint?.colourId).toBe('col-ral-9001'); // warm neutrals → Cream RAL 9001
    expect(spec('room-1').floorTiles?.materialId).toBe('mat-porcelain-6060');
    expect(spec('room-1').gypsumBoardId).toBe('mat-gypsum-12');
    expect(spec('room-3').wallTiles?.heightM).toBe(2.4);
    expect(spec('room-3').skirtingId).toBeNull(); // wet room: no skirting
    for (const s of d.portal.renovation!.specs) {
      for (const id of [s.wallPaint?.productId, s.floorTiles?.materialId, s.wallTiles?.materialId, s.gypsumBoardId, s.skirtingId].filter(Boolean)) {
        expect(lib.materials.some((m) => m.id === id)).toBe(true);
      }
    }
  });

  it('turns each room photo into a view for the brief pack, and keeps the client’s words and must-keep list', () => {
    expect(d.portal.renovation!.views.map((v) => [v.id, v.roomId, v.photoId])).toEqual([
      ['view-1', 'room-1', 'photo-1'],
      ['view-2', 'room-1', 'photo-2'],
      ['view-3', 'room-2', 'photo-3'],
      ['view-4', 'room-3', 'photo-4'],
    ]);
    expect(d.portal.renovation!.style.clientWords).toEqual(['No dark wood.', 'We want it brighter']);
    expect(d.portal.renovation!.style.globalMustKeep).toContain('The existing furniture');
    expect(d.portal.renovation!.style.furniture).toBe('keep');
    expect(living!.clientNotes).toMatch(/Client reports: cracks/);
  });

  it('gives the client an indicative summary in m² and days, never a price', () => {
    const s = indicativeRenovation(intake.answers, lib);
    expect(s.wallsM2).toBeGreaterThan(50);
    expect(s.floorsM2).toBe(40); // 20 + 16 + 5 = 41 → rounded to 5 m²
    expect(s.days).toBeGreaterThan(0);
    expect(Object.keys(s)).not.toContain('price');
  });
});
