/**
 * The renovation intake's journey to the engineer (spec 3.1, 3.2), reusing the
 * CCTV handoff pattern: a file (answers + photos + optional plan) or a link
 * (answers only — photos are far too big for a URL). Admin opens either as a
 * DRAFT in which every value not measured on site is recorded as "assumed from
 * client intake — please confirm".
 *
 * Mapping notes (spec 3.2): a size pictogram becomes L × W from the typical
 * sizes below (Unverified defaults), with the property's default height; each
 * room gets one door 0.9 × 2.1 m and, if habitable, one window 1.5 × 1.5 m —
 * all marked assumed. Finishes are proposed from the client's ticked works and
 * style answers, from the library, and flagged for the engineer to specify.
 */

import { z } from 'zod';

import type { PlanImage } from '../domain/sitePlan.ts';
import { sitePlanSchema } from '../state/projectSchemas.ts';
import { PALETTE_COLOURS, ruleOf, type Library } from './library.ts';
import {
  emptySpec,
  isoDate,
  MUST_STAY,
  newRenovationLine,
  newRoom,
  photoSchema,
  PROPERTY_LABEL,
  renovationAnswersSchema,
  type ClientRoom,
  type MustStay,
  type Opening,
  type Photo,
  type PortalData,
  type RenovationAnswers,
  type Room,
  type RoomSpec,
  type RoomType,
  type SizeClass,
  type VisualView,
  emptyPortal,
} from './model.ts';
import { buildProgramme } from './programme.ts';
import { projectQuantities } from './quantities.ts';
import { ceilSafe } from './trace.ts';

export const RN_INTAKE_FORMAT = 'contractech-renovation-intake';
export const RN_INTAKE_VERSION = 1;
export const RN_INTAKE_HASH_PREFIX = '#/renovation-intake/';
export const MAX_RN_LINK_CHARS = 8000;
export const MAX_INTAKE_PHOTOS = 60;

export interface RenovationIntake {
  readonly answers: RenovationAnswers;
  readonly submittedOn: string | null;
  readonly photos: readonly Photo[];
  readonly planImage: PlanImage | null;
}

const fileSchema = z
  .object({
    format: z.literal(RN_INTAKE_FORMAT),
    v: z.literal(RN_INTAKE_VERSION),
    submittedOn: isoDate.nullable(),
    answers: renovationAnswersSchema,
    photos: z.array(photoSchema).max(MAX_INTAKE_PHOTOS),
    sitePlan: sitePlanSchema.nullable(),
  })
  .strict();

const linkSchema = z.object({ v: z.literal(RN_INTAKE_VERSION), submittedOn: isoDate.nullable(), answers: renovationAnswersSchema }).strict();

export type RnIntakeResult = { readonly ok: true; readonly intake: RenovationIntake } | { readonly ok: false; readonly reason: string };

export function serializeRenovationIntake(i: RenovationIntake): string {
  return JSON.stringify(
    {
      format: RN_INTAKE_FORMAT,
      v: RN_INTAKE_VERSION,
      submittedOn: i.submittedOn,
      answers: i.answers,
      photos: i.photos,
      sitePlan: i.planImage ? { image: i.planImage, calibration: null, devices: [], routes: [] } : null,
    },
    null,
    2,
  );
}

function firstIssue(err: z.ZodError): string {
  const f = err.issues[0];
  return `The renovation intake failed validation at "${(f?.path ?? []).join('.')}": ${f?.message ?? 'unknown'}.`;
}

export function parseRenovationIntake(text: string): RnIntakeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, reason: `The intake file is not valid JSON (${err instanceof Error ? err.message : 'parse error'}).` };
  }
  const r = fileSchema.safeParse(parsed);
  if (!r.success) return { ok: false, reason: firstIssue(r.error) };
  const ids = new Set(r.data.photos.map((p) => p.id));
  const missing = r.data.answers.rooms.flatMap((room) => room.photoIds).find((id) => !ids.has(id));
  if (missing) return { ok: false, reason: `The renovation intake refers to photo "${missing}", which is not in the file.` };
  return { ok: true, intake: { answers: r.data.answers, submittedOn: r.data.submittedOn, photos: r.data.photos, planImage: r.data.sitePlan?.image ?? null } };
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)));
}

/** The link never carries photos: they are stripped from the answers' references too. */
export function renovationLinkHash(answers: RenovationAnswers, submittedOn: string | null): string {
  const lean: RenovationAnswers = { ...answers, rooms: answers.rooms.map((r) => ({ ...r, photoIds: [] })), style: { ...answers.style, inspirationIds: [] } };
  return `${RN_INTAKE_HASH_PREFIX}${toBase64Url(JSON.stringify({ v: RN_INTAKE_VERSION, submittedOn, answers: lean }))}`;
}

export function parseRenovationLink(payload: string): RnIntakeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(payload));
  } catch {
    return { ok: false, reason: 'The renovation intake link is not valid — it was probably cut short when it was copied.' };
  }
  const r = linkSchema.safeParse(parsed);
  if (!r.success) return { ok: false, reason: firstIssue(r.error) };
  return { ok: true, intake: { answers: r.data.answers, submittedOn: r.data.submittedOn, photos: [], planImage: null } };
}

// ---------------------------------------------------------------------------
// Mapping to a draft
// ---------------------------------------------------------------------------

/** Typical sizes per room type for the S / M / L pictograms (L × W, metres). Unverified defaults. */
export const SIZE_DEFAULTS: Readonly<Record<RoomType, Readonly<Record<SizeClass, readonly [number, number]>>>> = {
  living: { S: [4, 4], M: [5, 5], L: [6, 7] },
  majlis: { S: [4, 5], M: [5, 6], L: [6, 8] },
  bedroom: { S: [3, 3], M: [4, 4], L: [5, 5] },
  kitchen: { S: [2.5, 3], M: [3, 4], L: [4, 5] },
  bathroom: { S: [1.5, 2], M: [2, 2.5], L: [2.5, 3] },
  corridor: { S: [1.2, 4], M: [1.5, 6], L: [2, 8] },
  balcony: { S: [1.5, 3], M: [2, 4], L: [3, 5] },
  office: { S: [3, 3], M: [4, 4], L: [5, 6] },
  'shop-floor': { S: [5, 6], M: [8, 10], L: [10, 15] },
  other: { S: [3, 3], M: [4, 4], L: [5, 5] },
};

const HABITABLE: ReadonlySet<RoomType> = new Set(['living', 'majlis', 'bedroom', 'kitchen', 'office', 'shop-floor']);

export const ASSUMED_FROM_INTAKE = 'assumed from client intake — please confirm';

const MUST_STAY_TEXT: Readonly<Record<MustStay, string>> = {
  furniture: 'The existing furniture',
  kitchen: 'The existing kitchen units',
  floors: 'The existing floors',
  doors: 'The existing doors',
};

function roomFromClient(c: ClientRoom, answers: RenovationAnswers, lib: Library): Room {
  const assumed: Record<string, string> = {};
  const heightRule = ruleOf(lib, answers.place.propertyType === 'villa' ? 'heightVilla' : 'heightApartment');
  let lengthM: number | null = null;
  let widthM: number | null = null;
  let heightM: number | null = heightRule.value;
  if (c.size.mode === 'class') {
    const [L, W] = SIZE_DEFAULTS[c.type][c.size.cls];
    lengthM = L;
    widthM = W;
    const word = { S: 'small', M: 'medium', L: 'large' }[c.size.cls];
    assumed.lengthM = `The client chose “${word}”: typical ${L} × ${W} m (Unverified default) — please measure.`;
    assumed.widthM = assumed.lengthM;
  } else if (c.size.mode === 'typed') {
    lengthM = c.size.lengthM;
    widthM = c.size.widthM;
    assumed.lengthM = 'Typed by the client — please confirm on site.';
    assumed.widthM = assumed.lengthM;
    if (c.size.heightM !== null) {
      heightM = c.size.heightM;
      assumed.heightM = 'Typed by the client — please confirm on site.';
    }
  } else {
    assumed.lengthM = 'The client asked the engineer to measure this room.';
    assumed.widthM = assumed.lengthM;
  }
  if (!assumed.heightM) assumed.heightM = `Not asked: default ${heightRule.value} m for a ${PROPERTY_LABEL[answers.place.propertyType].toLowerCase()} (Unverified) — please measure.`;
  const door = ruleOf(lib, 'doorWidth').value;
  const doorH = ruleOf(lib, 'doorHeight').value;
  const openings: Opening[] = [{ id: 'op-1', type: 'door', widthM: door, heightM: doorH, sillM: 0, wall: '' }];
  if (HABITABLE.has(c.type)) {
    openings.push({ id: 'op-2', type: 'window', widthM: ruleOf(lib, 'windowWidth').value, heightM: ruleOf(lib, 'windowHeight').value, sillM: ruleOf(lib, 'windowSill').value, wall: '' });
  }
  assumed.openings = `Not asked: one door ${door} × ${doorH} m${HABITABLE.has(c.type) ? ' and one window 1.5 × 1.5 m' : ''} assumed (Unverified defaults) — please record the real openings.`;
  assumed.spec = 'Finishes proposed from the client’s answers and the sample library — please specify.';
  const problems = c.problems.length ? `Client reports: ${c.problems.join(', ')}.` : '';
  return {
    ...newRoom(c.id, c.name.trim() || 'Room', c.type),
    lengthM,
    widthM,
    heightM,
    openings,
    occupiedDuringWorks: answers.place.occupancy !== 'empty',
    assumed,
    clientNotes: [problems, c.note.trim()].filter(Boolean).join(' '),
  };
}

/** Finishes proposed from the ticked works (the engineer specifies them for real in Admin). */
export function proposedSpec(c: ClientRoom, answers: RenovationAnswers, lib: Library): RoomSpec {
  const works = new Set([...c.works, ...(answers.works.includes('full') ? (['full'] as const) : [])]);
  const full = works.has('full');
  const has = (id: string) => lib.materials.some((m) => m.id === id);
  const pick = (id: string, category: string) => (has(id) ? id : lib.materials.find((m) => m.category === category)?.id ?? null);
  const palette = answers.style.palette ? PALETTE_COLOURS[answers.style.palette] ?? [] : [];
  const wallColour = palette[0] && lib.colours.some((x) => x.id === palette[0]) ? palette[0] : (lib.colours[0]?.id ?? null);
  const white = lib.colours.find((x) => x.code === 'RAL 9010')?.id ?? wallColour;
  const spec: RoomSpec = { ...emptySpec(c.id) };
  const paint = pick('mat-emulsion-matt', 'paint');
  const keepFloors = answers.style.mustStay.includes('floors') || answers.style.floors === 'keep';
  const wet = c.type === 'bathroom' || c.type === 'kitchen';
  if ((works.has('repaint') || full) && paint) {
    spec.wallPaint = { productId: paint, colourId: wallColour, finish: 'matt', coats: 2, primer: true, roughSurface: false };
    spec.ceilingPaint = { productId: pick('mat-ceiling-white', 'paint') ?? paint, colourId: white, finish: 'matt', coats: 2, primer: false, roughSurface: false };
  }
  if ((works.has('floors') || full || (works.has('bathroom') && c.type === 'bathroom')) && !keepFloors) {
    const tile = answers.style.floors === 'marble' ? pick('mat-porcelain-60120', 'tile') : pick('mat-porcelain-6060', 'tile');
    if (tile) {
      spec.floorTiles = { materialId: tile, layout: 'straight', jointMm: 3, adhesiveId: pick('mat-adhesive-c2te', 'adhesive'), groutId: pick('mat-grout-cg2', 'grout'), manyCutOuts: wet, heightM: null };
      spec.removeFloor = true;
      if (!wet) spec.skirtingId = pick('mat-skirting-porcelain', 'skirting');
    }
  }
  if (works.has('ceilings-lighting') || full) {
    spec.gypsumBoardId = pick('mat-gypsum-12', 'board');
    if (!spec.ceilingPaint && paint) spec.ceilingPaint = { productId: pick('mat-ceiling-white', 'paint') ?? paint, colourId: white, finish: 'matt', coats: 2, primer: true, roughSurface: false };
  }
  if ((works.has('bathroom') && c.type === 'bathroom') || (works.has('kitchen') && c.type === 'kitchen')) {
    const wt = pick('mat-wall-3060', 'tile');
    if (wt) {
      spec.wallTiles = { materialId: wt, layout: 'straight', jointMm: 2, adhesiveId: pick('mat-adhesive-c2te', 'adhesive'), groutId: pick('mat-grout-cg2', 'grout'), manyCutOuts: true, heightM: c.type === 'bathroom' ? 2.4 : 0.6 };
      spec.removeWallTiles = true;
    }
  }
  if (answers.style.mustStay.includes('furniture')) spec.mustKeep = [];
  return spec;
}

export interface RenovationDraft {
  readonly portal: PortalData;
  readonly projectName: string;
  readonly clientName: string;
  readonly clientContact: string;
  readonly assumedTotal: number;
}

export function draftFromRenovationIntake(intake: RenovationIntake, lib: Library, lines: PortalData['lines'] = ['renovation']): RenovationDraft {
  const a = intake.answers;
  const rooms = a.rooms.map((c) => roomFromClient(c, a, lib));
  const specs = a.rooms.map((c) => proposedSpec(c, a, lib));
  const photos: Photo[] = [...intake.photos];
  const views: VisualView[] = [];
  for (const c of a.rooms) {
    for (const pid of c.photoIds) {
      const p = photos.find((x) => x.id === pid);
      if (!p) continue;
      views.push({ id: `view-${views.length + 1}`, roomId: c.id, photoId: p.id, facing: p.facing, visibleSurfaces: ['walls', 'floor', 'ceiling'], timeOfDay: 'daytime', cameraNotes: 'phone photo, eye level' });
    }
  }
  const mustKeep = [
    'Window and door positions and sizes',
    ...a.style.mustStay.map((m) => MUST_STAY_TEXT[m]),
    ...(a.style.mustStayText.trim() ? [a.style.mustStayText.trim()] : []),
  ];
  const clientWords = [a.style.loveHate.trim(), ...a.rooms.map((r) => r.note.trim())].filter(Boolean).slice(0, 10);
  const line = newRenovationLine(lib);
  const portal: PortalData = {
    ...emptyPortal(lines),
    client: { phone: a.place.phone.trim(), email: a.place.email.trim(), language: a.lang, consent: { photoUse: a.consent.photoUse, marketing: a.consent.marketing, recordedOn: intake.submittedOn } },
    site: {
      name: '',
      address: '',
      city: a.place.city.trim(),
      propertyType: a.place.propertyType,
      buildingAge: a.place.buildingAge,
      occupancy: a.place.occupancy,
      workingRestrictions: a.timing.restrictions.trim(),
    },
    rooms,
    photos,
    renovation: {
      ...line,
      intakeAnswers: a,
      intakeSubmittedOn: intake.submittedOn,
      specs,
      views,
      style: {
        ...line.style,
        primaryStyle: a.style.styles[0] ?? null,
        secondaryStyle: a.style.styles[1] ?? null,
        palette: a.style.palette,
        moods: [...a.style.moods],
        likes: a.style.loveHate.trim(),
        floorsLiked: a.style.floors ?? '',
        furniture: a.style.mustStay.includes('furniture') ? 'keep' : 'suggest',
        budgetTier: a.budget.tier,
        clientWords,
        globalMustKeep: mustKeep,
      },
    },
  };
  const assumedTotal = rooms.reduce((n, r) => n + Object.keys(r.assumed).length, 0);
  const who = a.place.name.trim();
  return {
    portal,
    projectName: `${who ? `${who} — ` : ''}${PROPERTY_LABEL[a.place.propertyType]} renovation${a.place.city.trim() ? `, ${a.place.city.trim()}` : ''}`.slice(0, 120),
    clientName: who,
    clientContact: [a.place.phone.trim(), a.place.email.trim()].filter(Boolean).join(' · '),
    assumedTotal,
  };
}

/** Field keys that are confirmed by typing a value (removes the "assumed" mark). */
export function confirmRoomFields(room: Room, keys: readonly string[]): Room {
  if (!keys.some((k) => k in room.assumed)) return room;
  return { ...room, assumed: Object.fromEntries(Object.entries(room.assumed).filter(([k]) => !keys.includes(k))) };
}

export { MUST_STAY };

// ---------------------------------------------------------------------------
// The client's indicative summary (review step): quantities and days only
// ---------------------------------------------------------------------------

export interface IndicativeRenovation {
  readonly wallsM2: number;
  readonly floorsM2: number;
  readonly days: number;
  readonly roomsMeasuredLater: number;
}

export function indicativeRenovation(answers: RenovationAnswers, lib: Library): IndicativeRenovation {
  const d = draftFromRenovationIntake({ answers, submittedOn: null, photos: [], planImage: null }, lib);
  const q = projectQuantities(d.portal);
  if (!q) return { wallsM2: 0, floorsM2: 0, days: 0, roomsMeasuredLater: 0 };
  const sumBy = (code: string) => q.rooms.flatMap((r) => r.items).filter((i) => i.rateCode === code).reduce((s, i) => s + i.quantity.value, 0);
  const prog = buildProgramme(q, lib, {}, () => '');
  return {
    wallsM2: Math.round(sumBy('RN-PNT-WALL') / 5) * 5,
    floorsM2: Math.round(sumBy('RN-FLR-TILE') / 5) * 5,
    days: ceilSafe(prog.totalDays),
    roomsMeasuredLater: answers.rooms.filter((r) => r.size.mode === 'engineer').length,
  };
}
