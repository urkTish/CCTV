/**
 * The library (spec 6.1, 6.7, 5.2.5, Appendix B): materials, colours with
 * codes, unit rates and rule constants. Each entry carries its source, a date
 * and an Unverified flag.
 *
 * The seed below is a SAMPLE so the portal can be tried end to end (owner
 * decision Q5). Every seeded rate and material is marked `sample: true` and
 * `unverified: true` and says "sample, replace with your rates". A proposal
 * that prices anything with a sample rate cannot be made Final (boq.ts).
 *
 * Colours are seeded only with RAL Classic codes, a public colour standard, so
 * no manufacturer's code is invented; the hex is a screen approximation and
 * is marked Unverified. LRV is left empty because no manufacturer card was read.
 */

import { z } from 'zod';

const id = z.string().min(1).max(64);
const text = (max: number) => z.string().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const MATERIAL_CATEGORIES = ['paint', 'primer', 'tile', 'adhesive', 'grout', 'skirting', 'board', 'other'] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];
export const MATERIAL_CATEGORY_LABEL: Readonly<Record<MaterialCategory, string>> = {
  paint: 'Paint',
  primer: 'Primer / sealer',
  tile: 'Tile',
  adhesive: 'Tile adhesive',
  grout: 'Grout',
  skirting: 'Skirting',
  board: 'Gypsum board',
  other: 'Other',
};

const provenance = {
  source: text(300),
  /** When the source was read (YYYY-MM-DD). */
  date: isoDate.nullable(),
  unverified: z.boolean(),
  /** Seeded sample data: "sample, replace with your rates". */
  sample: z.boolean(),
};

export const materialSchema = z
  .object({
    id,
    category: z.enum(MATERIAL_CATEGORIES),
    name: text(160),
    manufacturer: text(120),
    finish: text(80),
    /** Paint / primer: m² per litre per coat, from the TDS. */
    spreadingM2PerL: z.number().min(0.5).max(40).nullable(),
    /** Paint / primer: purchasable pack sizes in litres. */
    packSizesL: z.array(z.number().min(0.1).max(1000)).max(6),
    /** Tile: sides and thickness (mm) and tiles per box. */
    tileLengthMm: z.number().min(10).max(4000).nullable(),
    tileWidthMm: z.number().min(10).max(4000).nullable(),
    tileThicknessMm: z.number().min(2).max(60).nullable(),
    tilesPerBox: z.number().int().min(1).max(500).nullable(),
    /** Adhesive: kg per m² for the stated notch. Grout: density kg/dm³. */
    consumptionKgPerM2: z.number().min(0.1).max(50).nullable(),
    densityKgPerDm3: z.number().min(0.5).max(5).nullable(),
    /** Adhesive / grout: bag size, kg. */
    bagKg: z.number().min(0.5).max(100).nullable(),
    /** Board: sheet size (m). */
    boardLengthM: z.number().min(0.3).max(6).nullable(),
    boardWidthM: z.number().min(0.3).max(3).nullable(),
    /** Skirting: piece length (m). */
    pieceLengthM: z.number().min(0.1).max(6).nullable(),
    tdsUrl: text(500),
    ...provenance,
  })
  .strict();
export type Material = z.infer<typeof materialSchema>;

export const colourSchema = z
  .object({
    id,
    manufacturer: text(120),
    collection: text(120),
    name: text(120),
    code: text(60),
    /** Screen approximation only — check the physical sample. */
    hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    lrv: z.number().min(0).max(100).nullable(),
    ...provenance,
  })
  .strict();
export type ColourRef = z.infer<typeof colourSchema>;

export const UNITS = ['m²', 'm', 'no.', 'item', 'm³', 'kg', 'L', 'day'] as const;

export const rateSchema = z
  .object({
    code: z.string().min(1).max(40),
    description: text(240),
    unit: z.enum(UNITS),
    trade: z.enum(['prelims', 'demolition', 'repairs', 'floor', 'wall', 'ceiling', 'joinery', 'electrical', 'plumbing', 'painting', 'fixtures', 'cleaning']),
    /** All-in unit rate (materials, labour, plant, O&P), in the project currency. Null = not priced yet. */
    rate: z.number().min(0).max(1e8).nullable(),
    validityDays: z.number().int().min(1).max(3650),
    ...provenance,
  })
  .strict();
export type RateItem = z.infer<typeof rateSchema>;

export const ruleSchema = z
  .object({
    key: z.string().min(1).max(60),
    label: text(160),
    value: z.number().min(0).max(1e6),
    unit: text(40),
    source: text(300),
    unverified: z.boolean(),
  })
  .strict();
export type RuleConstant = z.infer<typeof ruleSchema>;

export const librarySchema = z
  .object({
    materials: z.array(materialSchema).max(500),
    colours: z.array(colourSchema).max(1000),
    rates: z.array(rateSchema).max(1000),
    rules: z.array(ruleSchema).max(200),
  })
  .strict();
export type Library = z.infer<typeof librarySchema>;

// ---------------------------------------------------------------------------
// Rule constants (Appendix B and section 6.8; all Unverified unless stated)
// ---------------------------------------------------------------------------

const ROT = 'Rule of thumb, spec Appendix B';

export const DEFAULT_RULES: readonly RuleConstant[] = [
  { key: 'heightApartment', label: 'Default ceiling height, apartment', value: 2.8, unit: 'm', source: ROT, unverified: true },
  { key: 'heightVilla', label: 'Default ceiling height, villa', value: 3.2, unit: 'm', source: ROT, unverified: true },
  { key: 'doorWidth', label: 'Default door width', value: 0.9, unit: 'm', source: ROT, unverified: true },
  { key: 'doorHeight', label: 'Default door height', value: 2.1, unit: 'm', source: ROT, unverified: true },
  { key: 'windowWidth', label: 'Default window width', value: 1.5, unit: 'm', source: ROT, unverified: true },
  { key: 'windowHeight', label: 'Default window height', value: 1.5, unit: 'm', source: ROT, unverified: true },
  { key: 'windowSill', label: 'Default window sill height', value: 0.9, unit: 'm', source: 'Company practice (assumed)', unverified: true },
  { key: 'deductOpeningsMin', label: 'Deduct openings at or above', value: 0.5, unit: 'm²', source: 'Measurement convention setting, spec 6.2', unverified: true },
  { key: 'emulsionSpreading', label: 'Emulsion spreading rate (no TDS)', value: 10, unit: 'm²/L per coat', source: ROT, unverified: true },
  { key: 'primerSpreading', label: 'Primer spreading rate (no TDS)', value: 8, unit: 'm²/L', source: ROT, unverified: true },
  { key: 'roughFactor', label: 'Rough / porous surface factor on spreading rate', value: 0.8, unit: '×', source: 'Rule of thumb, spec 6.3', unverified: true },
  { key: 'paintWaste', label: 'Paint waste', value: 5, unit: '%', source: ROT, unverified: true },
  {
    key: 'packAllowance',
    label: 'Pack-handling allowance when choosing paint packs',
    value: 0.5,
    unit: 'L per pack',
    source: 'Company rule: each extra pack counts as this much leftover, so fewer, larger packs win small differences',
    unverified: true,
  },
  { key: 'tileWasteStraight', label: 'Tile waste, straight lay', value: 7, unit: '%', source: ROT, unverified: true },
  { key: 'tileWasteOffset', label: 'Tile waste, brick / offset', value: 10, unit: '%', source: ROT, unverified: true },
  { key: 'tileWasteDiagonal', label: 'Tile waste, diagonal', value: 15, unit: '%', source: ROT, unverified: true },
  { key: 'tileWasteHerringbone', label: 'Tile waste, herringbone', value: 18, unit: '%', source: 'Rule of thumb, spec Appendix B (15–20%)', unverified: true },
  { key: 'tileWasteCutOuts', label: 'Extra tile waste, many cut-outs', value: 3, unit: '%', source: ROT, unverified: true },
  { key: 'tileWasteLargeFormat', label: 'Extra tile waste, large format (≥ 120 cm)', value: 2, unit: '%', source: ROT, unverified: true },
  { key: 'adhesiveKgPerM2', label: 'Tile adhesive, 10 mm notch (no TDS)', value: 5, unit: 'kg/m²', source: ROT, unverified: true },
  { key: 'adhesiveBackButter', label: 'Extra adhesive, back-buttering large format', value: 1.5, unit: 'kg/m²', source: ROT, unverified: true },
  { key: 'groutDensity', label: 'Grout density ρ (no TDS)', value: 1.6, unit: 'kg/dm³', source: 'Grout manufacturers’ published formula; product TDS governs', unverified: true },
  { key: 'groutWaste', label: 'Grout waste', value: 10, unit: '%', source: ROT, unverified: true },
  { key: 'skirtingWaste', label: 'Skirting waste', value: 5, unit: '%', source: 'Rule of thumb, spec 6.3', unverified: true },
  { key: 'boardWaste', label: 'Gypsum board waste', value: 10, unit: '%', source: ROT, unverified: true },
  { key: 'debrisBulking', label: 'Debris bulking factor', value: 1.3, unit: '×', source: ROT, unverified: true },
  { key: 'floorStripDepth', label: 'Floor strip-out depth (tile + bed)', value: 0.05, unit: 'm', source: 'Company practice (assumed)', unverified: true },
  { key: 'wallTileStripDepth', label: 'Wall tile strip-out depth (tile + adhesive)', value: 0.02, unit: 'm', source: 'Company practice (assumed)', unverified: true },
  { key: 'skipCapacity', label: 'Skip / truck capacity', value: 6, unit: 'm³', source: 'Company practice (assumed)', unverified: true },
  { key: 'prodPaint', label: 'Productivity: paint, rolled walls, per coat', value: 35, unit: 'm²/worker-day', source: 'Rule of thumb, spec 6.8 (30–40)', unverified: true },
  { key: 'prodPrep', label: 'Productivity: surface preparation and filling', value: 30, unit: 'm²/worker-day', source: 'Rule of thumb, spec 6.8 (25–40)', unverified: true },
  { key: 'prodFloorTile', label: 'Productivity: floor tiling 60×60', value: 12, unit: 'm²/worker-day', source: 'Rule of thumb, spec 6.8 (10–15)', unverified: true },
  { key: 'prodFloorTileLarge', label: 'Productivity: floor tiling ≥ 120 cm', value: 8, unit: 'm²/worker-day', source: 'Rule of thumb, spec 6.8 (6–10)', unverified: true },
  { key: 'prodWallTile', label: 'Productivity: wall tiling', value: 8, unit: 'm²/worker-day', source: 'Rule of thumb, spec 6.8 (6–10)', unverified: true },
  { key: 'prodGypsum', label: 'Productivity: gypsum ceiling, per 2-person team', value: 15, unit: 'm²/team-day', source: 'Rule of thumb, spec 6.8 (12–18)', unverified: true },
  { key: 'prodDemolition', label: 'Productivity: tile strip-out', value: 15, unit: 'm²/worker-day', source: 'Company practice (assumed; not in spec 6.8)', unverified: true },
  { key: 'prodSkirting', label: 'Productivity: skirting', value: 25, unit: 'm/worker-day', source: 'Company practice (assumed; not in spec 6.8)', unverified: true },
  { key: 'holdAdhesiveGrout', label: 'Hold: tile adhesive to grout', value: 1, unit: 'day', source: 'Rule of thumb, spec 6.8 (24 h); product TDS governs', unverified: true },
  { key: 'holdPaintRecoat', label: 'Hold: paint recoat', value: 0, unit: 'day', source: 'Rule of thumb, spec 6.8 (2–4 h, within the day)', unverified: true },
];

export const DEFAULT_RULE_VALUE: Readonly<Record<string, number>> = Object.fromEntries(DEFAULT_RULES.map((r) => [r.key, r.value]));

// ---------------------------------------------------------------------------
// Sample seed
// ---------------------------------------------------------------------------

export const SAMPLE_SOURCE = 'SAMPLE — replace with your rates / the product TDS';

const sample = { source: SAMPLE_SOURCE, date: '2026-10-12', unverified: true, sample: true } as const;

const blankMaterial = {
  manufacturer: 'Generic (sample)',
  finish: '',
  spreadingM2PerL: null,
  packSizesL: [] as number[],
  tileLengthMm: null,
  tileWidthMm: null,
  tileThicknessMm: null,
  tilesPerBox: null,
  consumptionKgPerM2: null,
  densityKgPerDm3: null,
  bagKg: null,
  boardLengthM: null,
  boardWidthM: null,
  pieceLengthM: null,
  tdsUrl: '',
  ...sample,
};

export const SAMPLE_MATERIALS: readonly Material[] = [
  { ...blankMaterial, id: 'mat-emulsion-matt', category: 'paint', name: 'Interior emulsion, matt (sample)', finish: 'matt', spreadingM2PerL: 10, packSizesL: [18, 3.6, 1] },
  { ...blankMaterial, id: 'mat-emulsion-eggshell', category: 'paint', name: 'Interior emulsion, eggshell (sample)', finish: 'eggshell', spreadingM2PerL: 10, packSizesL: [18, 3.6, 1] },
  { ...blankMaterial, id: 'mat-ceiling-white', category: 'paint', name: 'Ceiling emulsion, flat (sample)', finish: 'matt', spreadingM2PerL: 10, packSizesL: [18, 3.6] },
  { ...blankMaterial, id: 'mat-primer', category: 'primer', name: 'Primer / sealer, water-based (sample)', spreadingM2PerL: 8, packSizesL: [18, 3.6] },
  { ...blankMaterial, id: 'mat-porcelain-6060', category: 'tile', name: 'Porcelain floor tile 60×60, light stone look (sample)', finish: 'matt', tileLengthMm: 600, tileWidthMm: 600, tileThicknessMm: 10, tilesPerBox: 4 },
  { ...blankMaterial, id: 'mat-porcelain-60120', category: 'tile', name: 'Porcelain floor tile 60×120, marble look (sample)', finish: 'polished', tileLengthMm: 1200, tileWidthMm: 600, tileThicknessMm: 10, tilesPerBox: 2 },
  { ...blankMaterial, id: 'mat-wall-3060', category: 'tile', name: 'Ceramic wall tile 30×60, white gloss (sample)', finish: 'gloss', tileLengthMm: 600, tileWidthMm: 300, tileThicknessMm: 8, tilesPerBox: 8 },
  { ...blankMaterial, id: 'mat-adhesive-c2te', category: 'adhesive', name: 'Cementitious tile adhesive C2TE (sample)', consumptionKgPerM2: 5, bagKg: 20 },
  { ...blankMaterial, id: 'mat-grout-cg2', category: 'grout', name: 'Cementitious grout CG2, light grey (sample)', densityKgPerDm3: 1.6, bagKg: 5 },
  { ...blankMaterial, id: 'mat-skirting-porcelain', category: 'skirting', name: 'Porcelain skirting 10×60 cm, to match floor (sample)', pieceLengthM: 0.6 },
  { ...blankMaterial, id: 'mat-gypsum-12', category: 'board', name: 'Gypsum board 12.5 mm, 1.2 × 2.4 m (sample)', boardLengthM: 2.4, boardWidthM: 1.2 },
];

const RAL = { manufacturer: 'RAL', collection: 'RAL Classic', lrv: null, source: 'RAL Classic code (public standard); hex is a screen approximation', date: '2026-10-12', unverified: true, sample: true } as const;

export const SAMPLE_COLOURS: readonly ColourRef[] = [
  { ...RAL, id: 'col-ral-9010', name: 'Pure white', code: 'RAL 9010', hex: '#F1ECE1' },
  { ...RAL, id: 'col-ral-9001', name: 'Cream', code: 'RAL 9001', hex: '#E9E0D2' },
  { ...RAL, id: 'col-ral-1013', name: 'Oyster white', code: 'RAL 1013', hex: '#E3D9C6' },
  { ...RAL, id: 'col-ral-1015', name: 'Light ivory', code: 'RAL 1015', hex: '#E6D2B5' },
  { ...RAL, id: 'col-ral-1001', name: 'Beige', code: 'RAL 1001', hex: '#D0B084' },
  { ...RAL, id: 'col-ral-1019', name: 'Grey beige', code: 'RAL 1019', hex: '#A48F7A' },
  { ...RAL, id: 'col-ral-8025', name: 'Pale brown', code: 'RAL 8025', hex: '#755847' },
  { ...RAL, id: 'col-ral-8017', name: 'Chocolate brown', code: 'RAL 8017', hex: '#45322E' },
  { ...RAL, id: 'col-ral-7035', name: 'Light grey', code: 'RAL 7035', hex: '#CBD0CC' },
  { ...RAL, id: 'col-ral-7044', name: 'Silk grey', code: 'RAL 7044', hex: '#B7B3A8' },
  { ...RAL, id: 'col-ral-7016', name: 'Anthracite grey', code: 'RAL 7016', hex: '#383E42' },
  { ...RAL, id: 'col-ral-6013', name: 'Reed green', code: 'RAL 6013', hex: '#7B7B5B' },
  { ...RAL, id: 'col-ral-5014', name: 'Pigeon blue', code: 'RAL 5014', hex: '#637D96' },
  { ...RAL, id: 'col-ral-3012', name: 'Beige red', code: 'RAL 3012', hex: '#CB8D73' },
  { ...RAL, id: 'col-ral-9005', name: 'Jet black', code: 'RAL 9005', hex: '#0E0E10' },
];

const rate = (code: string, description: string, unit: RateItem['unit'], trade: RateItem['trade'], value: number): RateItem => ({
  code,
  description,
  unit,
  trade,
  rate: value,
  validityDays: 90,
  ...sample,
});

/** Sample all-in rates. NOT market prices: placeholders to replace with ContracTech's own rates. */
export const SAMPLE_RATES: readonly RateItem[] = [
  rate('RN-PRL-PROT', 'Protection of floors, furniture and fittings; set-up and daily clean-up', 'item', 'prelims', 1500),
  rate('RN-DEM-FLR', 'Remove existing floor tiles and bed, cart away to skip', 'm²', 'demolition', 25),
  rate('RN-DEM-WTL', 'Remove existing wall tiles, cart away to skip', 'm²', 'demolition', 22),
  rate('RN-DEM-SKIP', 'Skip / truck for debris disposal, including tipping', 'no.', 'demolition', 450),
  rate('RN-REP-CRACK', 'Rake out and fill crack, make good', 'm', 'repairs', 25),
  rate('RN-FLR-TILE', 'Supply and lay porcelain floor tiles, incl. adhesive and grout', 'm²', 'floor', 120),
  rate('RN-FLR-SKRT', 'Supply and fix tile skirting, incl. adhesive and grout', 'm', 'floor', 35),
  rate('RN-WAL-TILE', 'Supply and fix wall tiles, incl. adhesive and grout', 'm²', 'wall', 130),
  rate('RN-CLG-GYP', 'Gypsum board ceiling on metal framing, taped and jointed, incl. perimeter angle', 'm²', 'ceiling', 95),
  rate('RN-PNT-WALL', 'Prepare and paint walls: fill, primer where specified, emulsion coats as specified', 'm²', 'painting', 18),
  rate('RN-PNT-CLG', 'Prepare and paint ceilings: primer where specified, emulsion coats as specified', 'm²', 'painting', 20),
  rate('RN-JNR-DOOR', 'Supply and fix internal door with frame and ironmongery', 'no.', 'joinery', 1800),
  rate('RN-ELE-DOWN', 'Supply and fix LED downlight in gypsum ceiling, incl. wiring from existing point', 'no.', 'electrical', 120),
  rate('RN-CLN-FINAL', 'Final builder’s clean', 'm²', 'cleaning', 8),
];

export function sampleLibrary(): Library {
  return {
    materials: SAMPLE_MATERIALS.map((m) => ({ ...m, packSizesL: [...m.packSizesL] })),
    colours: SAMPLE_COLOURS.map((c) => ({ ...c })),
    rates: SAMPLE_RATES.map((r) => ({ ...r })),
    rules: DEFAULT_RULES.map((r) => ({ ...r })),
  };
}

/** Client palette cards (wizard step 4) → library colour ids, most dominant first. */
export const PALETTE_COLOURS: Readonly<Record<string, readonly string[]>> = {
  'warm-neutrals': ['col-ral-9001', 'col-ral-1015', 'col-ral-1019', 'col-ral-8025'],
  'cool-greys': ['col-ral-9010', 'col-ral-7035', 'col-ral-7044', 'col-ral-7016'],
  earthy: ['col-ral-1015', 'col-ral-1001', 'col-ral-6013', 'col-ral-8025'],
  'white-wood': ['col-ral-9010', 'col-ral-1013', 'col-ral-1001', 'col-ral-8017'],
  'bold-accent': ['col-ral-9010', 'col-ral-7035', 'col-ral-5014', 'col-ral-3012'],
  'dark-dramatic': ['col-ral-7016', 'col-ral-9005', 'col-ral-1019', 'col-ral-9001'],
};

/** Hex chips for a palette card, from the sample colours (the client wizard has no library). */
export function paletteHexes(palette: string): string[] {
  return (PALETTE_COLOURS[palette] ?? []).map((cid) => SAMPLE_COLOURS.find((c) => c.id === cid)?.hex ?? '#cccccc');
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export interface RuleLookup {
  readonly value: number;
  readonly rule: RuleConstant;
  /** True when the library lacks the key and the built-in default was used. */
  readonly missing: boolean;
}

export function ruleOf(lib: Library, key: string): RuleLookup {
  const r = lib.rules.find((x) => x.key === key);
  if (r) return { value: r.value, rule: r, missing: false };
  const d = DEFAULT_RULES.find((x) => x.key === key);
  if (!d) throw new Error(`Unknown rule constant "${key}"`);
  return { value: d.value, rule: d, missing: true };
}

export const materialById = (lib: Library, mid: string | null): Material | null => (mid ? lib.materials.find((m) => m.id === mid) ?? null : null);
export const colourById = (lib: Library, cid: string | null): ColourRef | null => (cid ? lib.colours.find((c) => c.id === cid) ?? null : null);
export const rateByCode = (lib: Library, code: string): RateItem | null => lib.rates.find((r) => r.code === code) ?? null;

/** "Rate may be out of date": older than its validity on `today`. */
export function rateExpired(r: RateItem, today: string): boolean {
  if (!r.date) return false;
  const age = (Date.parse(today) - Date.parse(r.date)) / 86_400_000;
  return Number.isFinite(age) && age > r.validityDays;
}
