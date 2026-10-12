/**
 * The shared project spine and the renovation line's data (spec sections 9.3,
 * 10.2–10.4). Everything here rides in the workspace envelope's optional
 * `portal` field (src/state/workspace.ts): a CCTV-only project has no `portal`
 * and is saved byte for byte as before.
 *
 * Every object schema is strict and every string and list is capped, because
 * opening a file is a validation boundary. Types are inferred from the schemas
 * so the two cannot drift apart.
 *
 * Calculated numbers are never stored here: quantities, BOQ totals and the
 * programme are recomputed from these inputs every time (quantities.ts,
 * boq.ts, programme.ts), as the CCTV engine does.
 */

import { z } from 'zod';

import { completionReportSchema, pictureSectionsSchema } from '../pictures/pictureSection.ts';
import { librarySchema, type Library } from './library.ts';

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a YYYY-MM-DD date');
const id = z.string().min(1).max(64);
const text = (max: number) => z.string().max(max);

// ---------------------------------------------------------------------------
// Enumerations (with the labels the Admin uses; the client wizard has its own
// bilingual wording in intake/i18n.ts)
// ---------------------------------------------------------------------------

export const SERVICE_LINES = ['cctv', 'renovation'] as const;
export type ServiceLine = (typeof SERVICE_LINES)[number];
export const SERVICE_LINE_LABEL: Readonly<Record<ServiceLine, string>> = { cctv: 'CCTV', renovation: 'Renovation' };

export const PROPERTY_TYPES = ['apartment', 'villa', 'office', 'shop', 'restaurant', 'clinic', 'other'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export const PROPERTY_LABEL: Readonly<Record<PropertyType, string>> = {
  apartment: 'Apartment',
  villa: 'Villa / house',
  office: 'Office',
  shop: 'Shop',
  restaurant: 'Restaurant / café',
  clinic: 'Clinic',
  other: 'Other',
};

export const OCCUPANCY = ['occupied', 'empty', 'partly'] as const;
export type Occupancy = (typeof OCCUPANCY)[number];
export const OCCUPANCY_LABEL: Readonly<Record<Occupancy, string>> = { occupied: 'Occupied during the works', empty: 'Empty during the works', partly: 'Partly occupied' };

export const BUILDING_AGES = ['under-5', '5-15', '15-30', 'over-30', 'not-sure'] as const;
export type BuildingAge = (typeof BUILDING_AGES)[number];
export const BUILDING_AGE_LABEL: Readonly<Record<BuildingAge, string>> = {
  'under-5': 'Under 5 years',
  '5-15': '5–15 years',
  '15-30': '15–30 years',
  'over-30': 'Over 30 years',
  'not-sure': 'Not sure',
};

export const ROOM_TYPES = ['living', 'majlis', 'bedroom', 'kitchen', 'bathroom', 'corridor', 'balcony', 'office', 'shop-floor', 'other'] as const;
export type RoomType = (typeof ROOM_TYPES)[number];
export const ROOM_TYPE_LABEL: Readonly<Record<RoomType, string>> = {
  living: 'Living room',
  majlis: 'Majlis',
  bedroom: 'Bedroom',
  kitchen: 'Kitchen',
  bathroom: 'Bathroom',
  corridor: 'Corridor',
  balcony: 'Balcony',
  office: 'Office',
  'shop-floor': 'Shop floor',
  other: 'Other',
};

export const OPENING_TYPES = ['door', 'double-door', 'window', 'arch', 'opening'] as const;
export type OpeningType = (typeof OPENING_TYPES)[number];
export const OPENING_TYPE_LABEL: Readonly<Record<OpeningType, string>> = {
  door: 'Door',
  'double-door': 'Double door',
  window: 'Window',
  arch: 'Arch',
  opening: 'Opening',
};
/** Openings that interrupt the skirting (the floor runs through them). */
export const FLOOR_LEVEL_OPENINGS: ReadonlySet<OpeningType> = new Set(['door', 'double-door', 'arch', 'opening']);

export const SUBSTRATES = ['plaster', 'block', 'gypsum', 'concrete', 'tile', 'wood', 'other', 'unknown'] as const;
export type Substrate = (typeof SUBSTRATES)[number];

export const CONDITION_LABEL: Readonly<Record<number, string>> = { 5: '5 Good', 4: '4 Fair', 3: '3 Worn', 2: '2 Poor', 1: '1 Failed / unsafe' };

export const DEFECT_TYPES = ['crack', 'damp', 'efflorescence', 'spalling', 'peeling', 'hollow-tile', 'leak', 'mould', 'corrosion', 'electrical', 'hvac', 'plumbing', 'other'] as const;
export type DefectType = (typeof DEFECT_TYPES)[number];
export const DEFECT_LABEL: Readonly<Record<DefectType, string>> = {
  crack: 'Crack',
  damp: 'Damp / stain',
  efflorescence: 'Efflorescence',
  spalling: 'Spalling',
  peeling: 'Peeling',
  'hollow-tile': 'Hollow tile',
  leak: 'Leak',
  mould: 'Mould',
  corrosion: 'Corrosion',
  electrical: 'Electrical',
  hvac: 'HVAC',
  plumbing: 'Plumbing',
  other: 'Other',
};

export const SURFACE_KINDS = ['walls', 'floor', 'ceiling'] as const;
export type SurfaceKind = (typeof SURFACE_KINDS)[number];

export const PHOTO_PURPOSES = ['before', 'survey', 'defect', 'inspiration', 'plan'] as const;
export type PhotoPurpose = (typeof PHOTO_PURPOSES)[number];

export const STYLES = ['modern-minimal', 'warm-contemporary', 'contemporary-arabic', 'classic', 'scandinavian', 'industrial'] as const;
export type StyleId = (typeof STYLES)[number];
export const STYLE_LABEL: Readonly<Record<StyleId, string>> = {
  'modern-minimal': 'Modern minimal',
  'warm-contemporary': 'Warm contemporary',
  'contemporary-arabic': 'Contemporary Arabic',
  classic: 'Classic / neo-classic',
  scandinavian: 'Scandinavian / natural',
  industrial: 'Industrial',
};

export const PALETTES = ['warm-neutrals', 'cool-greys', 'earthy', 'white-wood', 'bold-accent', 'dark-dramatic'] as const;
export type PaletteId = (typeof PALETTES)[number];
export const PALETTE_LABEL: Readonly<Record<PaletteId, string>> = {
  'warm-neutrals': 'Warm neutrals',
  'cool-greys': 'Cool greys',
  earthy: 'Earthy',
  'white-wood': 'White and wood',
  'bold-accent': 'Bold accent',
  'dark-dramatic': 'Dark and dramatic',
};

export const MOODS = ['calm', 'bright', 'cosy', 'luxurious', 'fresh', 'practical', 'family-friendly', 'impressive'] as const;
export type Mood = (typeof MOODS)[number];
export const MOOD_LABEL: Readonly<Record<Mood, string>> = {
  calm: 'calm',
  bright: 'bright',
  cosy: 'cosy',
  luxurious: 'luxurious',
  fresh: 'fresh',
  practical: 'practical',
  'family-friendly': 'family-friendly',
  impressive: 'impressive for guests',
};

export const BUDGET_TIERS = ['essential', 'good', 'premium'] as const;
export type BudgetTier = (typeof BUDGET_TIERS)[number];
export const BUDGET_LABEL: Readonly<Record<BudgetTier, string>> = { essential: 'Essential refresh', good: 'Good quality', premium: 'Premium finish' };

export const LANGUAGES = ['en', 'ar'] as const;
export type Lang = (typeof LANGUAGES)[number];

// ---------------------------------------------------------------------------
// Spine: client, site, rooms, photos
// ---------------------------------------------------------------------------

export const photoSchema = z
  .object({
    id,
    roomId: id.nullable(),
    purpose: z.enum(PHOTO_PURPOSES),
    /** Which wall or corner it faces, from the compass sketch ("from the door, facing the window wall"). */
    facing: text(200),
    fileName: text(200),
    dataUri: z
      .string()
      .max(12_000_000)
      .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/, 'expected a PNG or JPEG data URI'),
    widthPx: z.number().int().min(1).max(20000),
    heightPx: z.number().int().min(1).max(20000),
    addedOn: isoDate.nullable(),
    /** Location (GPS) and camera metadata removed on import (section 13). */
    metadataStripped: z.boolean(),
    note: text(300),
  })
  .strict();
export type Photo = z.infer<typeof photoSchema>;

export const openingSchema = z
  .object({
    id,
    type: z.enum(OPENING_TYPES),
    widthM: z.number().min(0.1).max(20),
    heightM: z.number().min(0.1).max(10),
    sillM: z.number().min(0).max(5),
    wall: text(60),
  })
  .strict();
export type Opening = z.infer<typeof openingSchema>;

export const surfaceSchema = z
  .object({
    substrate: z.enum(SUBSTRATES),
    existingFinish: text(120),
    existingColour: text(120),
    /** 1 (failed / unsafe) … 5 (good); null = not rated yet. */
    condition: z.number().int().min(1).max(5).nullable(),
  })
  .strict();
export type Surface = z.infer<typeof surfaceSchema>;

export const roomSchema = z
  .object({
    id,
    name: text(120),
    type: z.enum(ROOM_TYPES),
    floor: text(40),
    occupiedDuringWorks: z.boolean(),
    /** Typed dimensions (metres). They override the drawn plan shape when both exist. */
    lengthM: z.number().min(0.3).max(200).nullable(),
    widthM: z.number().min(0.3).max(200).nullable(),
    heightM: z.number().min(1.8).max(12).nullable(),
    /** A closed shape on the site plan drawing this room was promoted from. */
    planShapeId: id.nullable(),
    openings: z.array(openingSchema).max(40),
    surfaces: z.object({ walls: surfaceSchema, floor: surfaceSchema, ceiling: surfaceSchema }).strict(),
    /** Field key → why it was assumed ("assumed from client intake — please confirm"). Confirmed keys are removed. */
    assumed: z.record(text(40), text(300)),
    /** The engineer marked this room as surveyed on site. */
    surveyed: z.boolean(),
    clientNotes: text(600),
    notes: text(1000),
  })
  .strict();
export type Room = z.infer<typeof roomSchema>;

// ---------------------------------------------------------------------------
// Survey: defects and the safety checklist (spec 4.4, 4.5)
// ---------------------------------------------------------------------------

export const defectSchema = z
  .object({
    id,
    roomId: id,
    type: z.enum(DEFECT_TYPES),
    surface: z.enum(SURFACE_KINDS),
    location: text(200),
    /** Crack width in mm, when a crack. */
    widthMm: z.number().min(0).max(500).nullable(),
    lengthM: z.number().min(0).max(500).nullable(),
    moisturePct: z.number().min(0).max(100).nullable(),
    severity: z.number().int().min(1).max(5),
    probableCause: text(300),
    action: text(400),
    fixNow: z.boolean(),
    specialist: text(160),
    photoIds: z.array(id).max(10),
  })
  .strict();
export type Defect = z.infer<typeof defectSchema>;

export interface SafetyItemDef {
  readonly id: string;
  readonly text: string;
  /** "Yes" blocks Final until the engineer records an action (spec 4.5). */
  readonly blocking: boolean;
}

export const SAFETY_ITEMS: readonly SafetyItemDef[] = [
  { id: 'live-conductors', text: 'Exposed live conductors, missing DB covers, or no RCD/RCBO protection on wet-area circuits', blocking: true },
  { id: 'burnt-fittings', text: 'Burnt or discoloured sockets or switches', blocking: false },
  { id: 'gas', text: 'Gas appliances, smell of gas, or unvented water heaters', blocking: true },
  { id: 'structural', text: 'Structural concerns: wide or growing cracks, deflected beams, exposed corroded rebar', blocking: true },
  { id: 'asbestos', text: 'Asbestos-suspect materials in an older building (old ceiling boards, pipe lagging) — do not disturb; specialist survey', blocking: true },
  { id: 'height', text: 'Working at height needed (façade, high ceilings, roofs without parapets)', blocking: false },
  { id: 'fire', text: 'Fire safety: blocked exits, missing smoke detectors, expired extinguishers', blocking: false },
  { id: 'occupants', text: 'Occupants at risk during the works: children, elderly, people with breathing conditions (dust and paint fumes)', blocking: false },
];

export const safetyAnswerSchema = z
  .object({
    itemId: id,
    answer: z.enum(['yes', 'no', 'na']).nullable(),
    action: text(400),
    photoId: id.nullable(),
  })
  .strict();
export type SafetyAnswer = z.infer<typeof safetyAnswerSchema>;

export const surveySchema = z
  .object({
    date: isoDate.nullable(),
    engineer: text(120),
    accessNotes: text(600),
    defects: z.array(defectSchema).max(300),
    safety: z.array(safetyAnswerSchema).max(40),
  })
  .strict();
export type Survey = z.infer<typeof surveySchema>;

// ---------------------------------------------------------------------------
// Specification: proposed finishes per room (only library items are priced)
// ---------------------------------------------------------------------------

export const TILE_LAYOUTS = ['straight', 'offset', 'diagonal', 'herringbone'] as const;
export type TileLayout = (typeof TILE_LAYOUTS)[number];
export const TILE_LAYOUT_LABEL: Readonly<Record<TileLayout, string>> = { straight: 'Straight lay', offset: 'Brick / offset', diagonal: 'Diagonal', herringbone: 'Herringbone' };

export const PAINT_FINISHES = ['matt', 'eggshell', 'satin', 'gloss'] as const;

export const paintSpecSchema = z
  .object({
    productId: id,
    colourId: id.nullable(),
    finish: z.enum(PAINT_FINISHES),
    /** Finish coats. */
    coats: z.number().int().min(1).max(5),
    primer: z.boolean(),
    roughSurface: z.boolean(),
  })
  .strict();
export type PaintSpec = z.infer<typeof paintSpecSchema>;

export const tileSpecSchema = z
  .object({
    materialId: id,
    layout: z.enum(TILE_LAYOUTS),
    jointMm: z.number().min(0.5).max(20),
    adhesiveId: id.nullable(),
    groutId: id.nullable(),
    manyCutOuts: z.boolean(),
    /** Wall tiles only: tiled height from the floor (m). */
    heightM: z.number().min(0.1).max(12).nullable(),
  })
  .strict();
export type TileSpec = z.infer<typeof tileSpecSchema>;

export const simpleItemSchema = z
  .object({
    id,
    rateCode: text(40),
    description: text(200),
    quantity: z.number().min(0).max(1e6),
  })
  .strict();
export type SimpleItem = z.infer<typeof simpleItemSchema>;

export const roomSpecSchema = z
  .object({
    roomId: id,
    wallPaint: paintSpecSchema.nullable(),
    ceilingPaint: paintSpecSchema.nullable(),
    floorTiles: tileSpecSchema.nullable(),
    wallTiles: tileSpecSchema.nullable(),
    skirtingId: id.nullable(),
    gypsumBoardId: id.nullable(),
    removeFloor: z.boolean(),
    removeWallTiles: z.boolean(),
    items: z.array(simpleItemSchema).max(60),
    /** Room-specific "must stay as it is" (visual brief). */
    mustKeep: z.array(text(200)).max(20),
    lighting: text(300),
  })
  .strict();
export type RoomSpec = z.infer<typeof roomSpecSchema>;

// ---------------------------------------------------------------------------
// Style profile (spec 5.2.2) and visuals (5.2.4, 5.5)
// ---------------------------------------------------------------------------

export const styleProfileSchema = z
  .object({
    primaryStyle: z.enum(STYLES).nullable(),
    secondaryStyle: z.enum(STYLES).nullable(),
    palette: z.enum(PALETTES).nullable(),
    moods: z.array(z.enum(MOODS)).max(3),
    likes: text(800),
    dislikes: text(800),
    floorsLiked: text(80),
    lightingMood: z.enum(['warm', 'neutral', 'mixed']),
    furniture: z.enum(['keep', 'suggest', 'unfurnished']),
    budgetTier: z.enum(BUDGET_TIERS).nullable(),
    clientWords: z.array(text(300)).max(10),
    globalMustKeep: z.array(text(200)).max(20),
  })
  .strict();
export type StyleProfile = z.infer<typeof styleProfileSchema>;

export const QA_CHECKS: readonly string[] = [
  'Same camera position and perspective',
  'Walls, ceiling height, doors and windows unchanged in position and size',
  'Every "must keep" item present and unchanged',
  'No "must not show" item appears',
  'Proposed finishes visible and plausibly matching the schedule',
  'Nothing added that is not in scope (openings, fixtures, structure, views outside)',
  'No people, text, logos or watermarks',
  'Overall realism: proportions believable for the room',
];

export const visualViewSchema = z
  .object({
    id,
    roomId: id,
    photoId: id,
    facing: text(200),
    visibleSurfaces: z.array(z.enum(SURFACE_KINDS)).max(3),
    timeOfDay: z.enum(['daytime', 'evening']),
    cameraNotes: text(200),
  })
  .strict();
export type VisualView = z.infer<typeof visualViewSchema>;

export const visualAssetSchema = z
  .object({
    id,
    viewId: id,
    fileName: text(200),
    /** The after image as imported, with the "Illustrative" label burned in when `labelBurned`. */
    dataUri: z
      .string()
      .max(12_000_000)
      .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/, 'expected a PNG or JPEG data URI'),
    widthPx: z.number().int().min(1).max(20000),
    heightPx: z.number().int().min(1).max(20000),
    labelBurned: z.boolean(),
    variant: z.number().int().min(1).max(99),
    provider: text(120),
    modelName: text(120),
    templateId: text(40),
    templateVersion: text(20),
    promptText: text(20000),
    inputPhotoIds: z.array(id).max(10),
    importedOn: isoDate.nullable(),
    qa: z.array(z.enum(['pass', 'fail', 'unsure']).nullable()).length(8),
    qaNotes: text(1000),
    recommend: z.enum(['use', 'regenerate', 'engineer']).nullable(),
    overrideReason: text(400),
    approvedBy: text(120),
    approvedOn: isoDate.nullable(),
    selected: z.boolean(),
  })
  .strict();
export type VisualAsset = z.infer<typeof visualAssetSchema>;

export const narrativeSchema = z
  .object({
    text: text(20000),
    reviewed: z.boolean(),
    provider: text(120),
    modelName: text(120),
    templateVersion: text(20),
    importedOn: isoDate.nullable(),
  })
  .strict();
export type Narrative = z.infer<typeof narrativeSchema>;

// ---------------------------------------------------------------------------
// Settings (Q4, Q6, Q8, Q9: all owner decisions with recommended defaults)
// ---------------------------------------------------------------------------

export const milestoneSchema = z.object({ id, label: text(160), percent: z.number().min(0).max(100), trigger: text(160) }).strict();
export type Milestone = z.infer<typeof milestoneSchema>;

export const settingsSchema = z
  .object({
    currency: text(12),
    vatPercent: z.number().min(0).max(100),
    locale: text(120),
    proposalLanguage: z.enum(LANGUAGES),
    freeDesignRounds: z.number().int().min(0).max(20),
    contingencyPercent: z.number().min(0).max(50),
    /** Q8: before the survey the client sees a range around the estimate. */
    rangeLowPercent: z.number().min(0).max(90),
    rangeHighPercent: z.number().min(0).max(300),
    validityDays: z.number().int().min(1).max(3650),
    milestones: z.array(milestoneSchema).max(12),
    warrantyText: text(4000),
    termsText: text(6000),
    visualsDisclaimer: text(2000),
    exclusionsText: text(4000),
    legalApproved: z.boolean(),
  })
  .strict();
export type RnSettings = z.infer<typeof settingsSchema>;

export const LEGAL_PLACEHOLDER = 'PLACEHOLDER — to be approved by a lawyer before the first Final proposal (owner decision Q6).';

export const DEFAULT_SETTINGS: RnSettings = {
  currency: 'SAR',
  vatPercent: 15,
  locale: 'Riyadh, Saudi Arabia',
  proposalLanguage: 'en',
  freeDesignRounds: 2,
  contingencyPercent: 5,
  rangeLowPercent: 10,
  rangeHighPercent: 20,
  validityDays: 30,
  milestones: [
    { id: 'ms-1', label: 'Advance on signing', percent: 25, trigger: 'Contract signed' },
    { id: 'ms-2', label: 'Strip-out and first fix complete', percent: 25, trigger: 'End of strip-out' },
    { id: 'ms-3', label: 'Tiling and ceilings complete', percent: 25, trigger: 'End of tiling' },
    { id: 'ms-4', label: 'Handover', percent: 20, trigger: 'Handover' },
    { id: 'ms-5', label: 'Retention, released after the defects period', percent: 5, trigger: 'End of defects period' },
  ],
  warrantyText: `${LEGAL_PLACEHOLDER}\nWorkmanship: [period] from handover for painting, tiling and gypsum works, covering defects in workmanship. Manufacturer warranties on materials are passed through to the client.`,
  termsText: `${LEGAL_PLACEHOLDER}\nPrices are based on the quantities in the bill of quantities. Hidden conditions found during the works (damp behind tiles, corroded pipes, weak substrates) are handled by a variation order agreed before the work proceeds.`,
  visualsDisclaimer:
    'Illustrative visual — for guidance only. Actual colours, materials and finishes may differ. Refer to the samples and the schedule. Visuals are not contractual; the finishes schedule and the bill of quantities are.',
  exclusionsText:
    'Furniture, curtains and appliances unless listed\nAuthority fees and permit drawings\nStructural alterations\nHidden defects found during the works (handled by a variation order)\nAsbestos removal (specialist only)\nMEP works not listed in the bill of quantities',
  legalApproved: false,
};

// ---------------------------------------------------------------------------
// The client's renovation intake answers (spec 3.2), kept with the line as
// provenance. Photos travel separately (the intake file's `photos`).
// ---------------------------------------------------------------------------

export const WORKS = ['repaint', 'floors', 'ceilings-lighting', 'kitchen', 'bathroom', 'doors-wardrobes', 'full', 'outside', 'repairs', 'not-sure'] as const;
export type Work = (typeof WORKS)[number];
export const PROBLEMS = ['damp', 'cracks', 'peeling', 'broken-tiles', 'leaks', 'ac', 'electrical'] as const;
export type Problem = (typeof PROBLEMS)[number];
export const MUST_STAY = ['furniture', 'kitchen', 'floors', 'doors'] as const;
export type MustStay = (typeof MUST_STAY)[number];
export const FLOOR_LIKES = ['light-stone', 'marble', 'wood', 'concrete', 'keep'] as const;
export type FloorLike = (typeof FLOOR_LIKES)[number];
export const START_WHEN = ['asap', '1m', '1-3m', 'later'] as const;
export type StartWhen = (typeof START_WHEN)[number];
export const SIZE_CLASSES = ['S', 'M', 'L'] as const;
export type SizeClass = (typeof SIZE_CLASSES)[number];

export const roomSizeSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('class'), cls: z.enum(SIZE_CLASSES) }).strict(),
  z.object({ mode: z.literal('typed'), lengthM: z.number().min(0.3).max(200), widthM: z.number().min(0.3).max(200), heightM: z.number().min(1.8).max(12).nullable() }).strict(),
  z.object({ mode: z.literal('engineer') }).strict(),
]);
export type RoomSize = z.infer<typeof roomSizeSchema>;

export const clientRoomSchema = z
  .object({
    id,
    type: z.enum(ROOM_TYPES),
    name: text(120),
    works: z.array(z.enum(WORKS)).max(WORKS.length),
    size: roomSizeSchema,
    photoIds: z.array(id).max(6),
    problems: z.array(z.enum(PROBLEMS)).max(PROBLEMS.length),
    note: text(600),
  })
  .strict();
export type ClientRoom = z.infer<typeof clientRoomSchema>;

export const MAX_CLIENT_ROOMS = 20;

export const renovationAnswersSchema = z
  .object({
    lang: z.enum(LANGUAGES),
    place: z
      .object({
        propertyType: z.enum(PROPERTY_TYPES),
        occupancy: z.enum(OCCUPANCY),
        name: text(120),
        phone: text(60),
        email: text(160),
        city: text(120),
        buildingAge: z.enum(BUILDING_AGES),
      })
      .strict(),
    works: z.array(z.enum(WORKS)).max(WORKS.length),
    rooms: z.array(clientRoomSchema).max(MAX_CLIENT_ROOMS),
    style: z
      .object({
        styles: z.array(z.enum(STYLES)).max(2),
        palette: z.enum(PALETTES).nullable(),
        moods: z.array(z.enum(MOODS)).max(3),
        floors: z.enum(FLOOR_LIKES).nullable(),
        loveHate: text(800),
        mustStay: z.array(z.enum(MUST_STAY)).max(MUST_STAY.length),
        mustStayText: text(300),
        inspirationIds: z.array(id).max(5),
      })
      .strict(),
    budget: z.object({ tier: z.enum(BUDGET_TIERS).nullable(), min: z.number().min(0).max(1e9).nullable(), max: z.number().min(0).max(1e9).nullable() }).strict(),
    timing: z.object({ start: z.enum(START_WHEN).nullable(), finishBy: isoDate.nullable(), restrictions: text(400) }).strict(),
    consent: z.object({ photoUse: z.boolean(), marketing: z.boolean() }).strict(),
  })
  .strict();
export type RenovationAnswers = z.infer<typeof renovationAnswersSchema>;

export function emptyRenovationAnswers(lang: Lang = 'en'): RenovationAnswers {
  return {
    lang,
    place: { propertyType: 'apartment', occupancy: 'occupied', name: '', phone: '', email: '', city: '', buildingAge: 'not-sure' },
    works: [],
    rooms: [],
    style: { styles: [], palette: null, moods: [], floors: null, loveHate: '', mustStay: [], mustStayText: '', inspirationIds: [] },
    budget: { tier: null, min: null, max: null },
    timing: { start: null, finishBy: null, restrictions: '' },
    consent: { photoUse: false, marketing: false },
  };
}

// ---------------------------------------------------------------------------
// The renovation line and the portal spine
// ---------------------------------------------------------------------------

export const TRADES = ['prelims', 'demolition', 'repairs', 'floor', 'wall', 'ceiling', 'joinery', 'electrical', 'plumbing', 'painting', 'fixtures', 'cleaning'] as const;
export type Trade = (typeof TRADES)[number];
/** BOQ sections by trade, numbered as in spec 6.6. */
export const TRADE_LABEL: Readonly<Record<Trade, string>> = {
  prelims: '01 Preliminaries',
  demolition: '02 Demolition and strip-out',
  repairs: '03 Civil repairs',
  floor: '05 Floor finishes',
  wall: '06 Wall finishes',
  ceiling: '07 Ceilings',
  joinery: '08 Joinery',
  electrical: '09 MEP — electrical',
  plumbing: '10 MEP — plumbing',
  painting: '12 Painting',
  fixtures: '13 Fixtures',
  cleaning: '14 Cleaning and handover',
};

export const proposalStateSchema = z
  .object({
    status: z.enum(['draft', 'final']),
    finalisedOn: isoDate.nullable(),
    revision: z.string().max(4),
    preparedBy: z.object({ name: text(120), title: text(120), phone: text(60), email: text(160) }).strict().nullable(),
  })
  .strict();
export type ProposalState = z.infer<typeof proposalStateSchema>;

export const renovationLineSchema = z
  .object({
    /** The client's intake answers (without photos) the draft was made from. */
    intakeAnswers: renovationAnswersSchema.nullable(),
    intakeSubmittedOn: isoDate.nullable(),
    style: styleProfileSchema,
    specs: z.array(roomSpecSchema).max(80),
    survey: surveySchema,
    library: librarySchema,
    settings: settingsSchema,
    views: z.array(visualViewSchema).max(200),
    assets: z.array(visualAssetSchema).max(200),
    narrative: narrativeSchema,
    /** Crew size per trade for the programme (default 2). */
    crews: z.record(z.enum(TRADES), z.number().int().min(1).max(20)),
    designRoundsUsed: z.number().int().min(0).max(50),
    proposal: proposalStateSchema,
    /**
     * The proposal's Concept chapter (picture sections). Optional: absent in
     * files from earlier releases and until the first section is added, so
     * those files open and re-save byte for byte.
     */
    concepts: pictureSectionsSchema.optional(),
    /** The completion / photo report, once generated from the proposal. Optional, as above. */
    completion: completionReportSchema.optional(),
  })
  .strict();
export type RenovationLine = z.infer<typeof renovationLineSchema>;

export const portalSchema = z
  .object({
    v: z.literal(1),
    lines: z.array(z.enum(SERVICE_LINES)).min(1).max(SERVICE_LINES.length),
    client: z
      .object({
        phone: text(60),
        email: text(160),
        language: z.enum(LANGUAGES),
        consent: z.object({ photoUse: z.boolean(), marketing: z.boolean(), recordedOn: isoDate.nullable() }).strict(),
      })
      .strict(),
    site: z
      .object({
        name: text(160),
        address: text(300),
        city: text(120),
        propertyType: z.enum(PROPERTY_TYPES),
        buildingAge: z.enum(BUILDING_AGES),
        occupancy: z.enum(OCCUPANCY),
        workingRestrictions: text(400),
      })
      .strict(),
    rooms: z.array(roomSchema).max(80),
    photos: z.array(photoSchema).max(200),
    renovation: renovationLineSchema.nullable(),
  })
  .strict();
export type PortalData = z.infer<typeof portalSchema>;

// ---------------------------------------------------------------------------
// Defaults and small helpers
// ---------------------------------------------------------------------------

export const EMPTY_SURFACE: Surface = { substrate: 'unknown', existingFinish: '', existingColour: '', condition: null };

export const EMPTY_STYLE: StyleProfile = {
  primaryStyle: null,
  secondaryStyle: null,
  palette: null,
  moods: [],
  likes: '',
  dislikes: '',
  floorsLiked: '',
  lightingMood: 'warm',
  furniture: 'suggest',
  budgetTier: null,
  clientWords: [],
  globalMustKeep: ['Window and door positions and sizes'],
};

export function emptySurvey(): Survey {
  return { date: null, engineer: '', accessNotes: '', defects: [], safety: SAFETY_ITEMS.map((s) => ({ itemId: s.id, answer: null, action: '', photoId: null })) };
}

export function emptyPortal(lines: readonly ServiceLine[] = ['cctv']): PortalData {
  return {
    v: 1,
    lines: [...lines],
    client: { phone: '', email: '', language: 'en', consent: { photoUse: false, marketing: false, recordedOn: null } },
    site: { name: '', address: '', city: '', propertyType: 'apartment', buildingAge: 'not-sure', occupancy: 'occupied', workingRestrictions: '' },
    rooms: [],
    photos: [],
    renovation: null,
  };
}

export function newRoom(roomId: string, name: string, type: RoomType = 'bedroom'): Room {
  return {
    id: roomId,
    name,
    type,
    floor: 'Ground',
    occupiedDuringWorks: false,
    lengthM: null,
    widthM: null,
    heightM: null,
    planShapeId: null,
    openings: [],
    surfaces: { walls: { ...EMPTY_SURFACE }, floor: { ...EMPTY_SURFACE }, ceiling: { ...EMPTY_SURFACE } },
    assumed: {},
    surveyed: false,
    clientNotes: '',
    notes: '',
  };
}

export function emptySpec(roomId: string): RoomSpec {
  return {
    roomId,
    wallPaint: null,
    ceilingPaint: null,
    floorTiles: null,
    wallTiles: null,
    skirtingId: null,
    gypsumBoardId: null,
    removeFloor: false,
    removeWallTiles: false,
    items: [],
    mustKeep: [],
    lighting: '',
  };
}

/** The next free id of the form `${prefix}-${n}`. */
export function nextId(prefix: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  let n = 1;
  while (set.has(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

export function specFor(line: RenovationLine, roomId: string): RoomSpec {
  return line.specs.find((s) => s.roomId === roomId) ?? emptySpec(roomId);
}

export function hasLine(portal: PortalData | undefined, line: ServiceLine): boolean {
  if (!portal) return line === 'cctv';
  return portal.lines.includes(line);
}

/** Values still assumed from the client intake, over every room. */
export function assumedTotal(portal: PortalData): number {
  return portal.rooms.reduce((n, r) => n + Object.keys(r.assumed).length, 0);
}

export function newRenovationLine(library: Library): RenovationLine {
  return {
    intakeAnswers: null,
    intakeSubmittedOn: null,
    style: { ...EMPTY_STYLE },
    specs: [],
    survey: emptySurvey(),
    library,
    settings: { ...DEFAULT_SETTINGS, milestones: DEFAULT_SETTINGS.milestones.map((m) => ({ ...m })) },
    views: [],
    assets: [],
    narrative: { text: '', reviewed: false, provider: '', modelName: '', templateVersion: '', importedOn: null },
    crews: {},
    designRoundsUsed: 0,
    proposal: { status: 'draft', finalisedOn: null, revision: '', preparedBy: null },
  };
}
