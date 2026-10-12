/**
 * Shared test data for the renovation tests (imported by *.test.ts only, but
 * kept type-checked with the app). A tiny but well-formed JPEG carrying an
 * EXIF block with GPS, and a realistic 3-room intake.
 */

import { emptyRenovationAnswers, type Photo, type RenovationAnswers } from './model.ts';

/** SOI, APP1 "Exif" (with a GPS tag id inside), SOF0 640 × 480, SOS, a few scan bytes, EOI. */
export function jpegWithGps(width = 640, height = 480): Uint8Array {
  const exifPayload = [0x45, 0x78, 0x69, 0x66, 0, 0, 0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x25, 0x88, 4, 0, 1, 0, 0, 0, 26, 0, 0, 0];
  const app1 = [0xff, 0xe1, 0, exifPayload.length + 2, ...exifPayload];
  const app0 = [0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const sof = [0xff, 0xc0, 0, 17, 8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  const sos = [0xff, 0xda, 0, 12, 3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0, 0x12, 0x34, 0x56];
  return Uint8Array.from([0xff, 0xd8, ...app0, ...app1, ...sof, ...sos, 0xff, 0xd9]);
}

export function photo(id: string, roomId: string | null, facing = 'From the door'): Photo {
  return {
    id,
    roomId,
    purpose: 'before',
    facing,
    fileName: `${id}.jpg`,
    dataUri: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP////////////////////////////////////////////////////////////////////////////////////8=',
    widthPx: 640,
    heightPx: 480,
    addedOn: '2026-10-12',
    metadataStripped: true,
    note: '',
  };
}

/** A 3-room apartment: living (typed 5 × 4 × 2.8), bedroom (medium), bathroom (typed 2.5 × 2). */
export function threeRoomAnswers(): RenovationAnswers {
  const a = emptyRenovationAnswers('en');
  return {
    ...a,
    place: { propertyType: 'apartment', occupancy: 'occupied', name: 'Sara Al-Qahtani', phone: '+966 50 123 4567', email: 'sara@example.com', city: 'Riyadh', buildingAge: '15-30' },
    works: ['repaint', 'floors', 'ceilings-lighting', 'bathroom'],
    rooms: [
      { id: 'room-1', type: 'living', name: 'Family living room', works: ['repaint', 'floors', 'ceilings-lighting'], size: { mode: 'typed', lengthM: 5, widthM: 4, heightM: 2.8 }, photoIds: ['photo-1', 'photo-2'], problems: ['cracks'], note: 'We want it brighter' },
      { id: 'room-2', type: 'bedroom', name: 'Master bedroom', works: ['repaint', 'floors'], size: { mode: 'class', cls: 'M' }, photoIds: ['photo-3'], problems: [], note: '' },
      { id: 'room-3', type: 'bathroom', name: 'Main bathroom', works: ['bathroom'], size: { mode: 'typed', lengthM: 2.5, widthM: 2, heightM: null }, photoIds: ['photo-4'], problems: ['broken-tiles'], note: '' },
    ],
    style: { styles: ['warm-contemporary', 'contemporary-arabic'], palette: 'warm-neutrals', moods: ['calm', 'cosy'], floors: 'light-stone', loveHate: 'No dark wood.', mustStay: ['furniture'], mustStayText: '', inspirationIds: [] },
    budget: { tier: 'good', min: null, max: null },
    timing: { start: '1m', finishBy: null, restrictions: 'Not during prayer times' },
    consent: { photoUse: true, marketing: false },
  };
}

export const THREE_ROOM_PHOTOS: readonly Photo[] = [photo('photo-1', 'room-1'), photo('photo-2', 'room-1', 'From the window'), photo('photo-3', 'room-2'), photo('photo-4', 'room-3')];
