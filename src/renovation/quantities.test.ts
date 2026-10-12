/**
 * The renovation quantity engine reproduces the worked examples of spec
 * section 6 exactly, and every figure carries its trace.
 */

import { describe, it, expect } from 'vitest';

import { buildBoq, paymentSchedule, priceRange } from './boq.ts';
import { measureShape, roomGeometry, tiledWallArea } from './geometry.ts';
import { DEFAULT_RULES, materialById, sampleLibrary, type Library } from './library.ts';
import { DEFAULT_SETTINGS, emptyPortal, emptySpec, emptySurvey, EMPTY_STYLE, newRoom, type PortalData, type Room, type RoomSpec } from './model.ts';
import { buildProgramme } from './programme.ts';
import { choosePacks, debrisVolume, gypsumBoards, paintLitres, projectQuantities, roomQuantities, skirtingPieces, tileQuantities } from './quantities.ts';
import { isUnverified } from './trace.ts';

const lib: Library = sampleLibrary();
const mat = (id: string) => materialById(lib, id)!;

/** The spec's bedroom: 5.0 × 4.0 m, H 2.8 m, door 0.9 × 2.1, window 1.5 × 1.5. */
function bedroom(): Room {
  return {
    ...newRoom('r1', 'Bedroom'),
    lengthM: 5,
    widthM: 4,
    heightM: 2.8,
    openings: [
      { id: 'o1', type: 'door', widthM: 0.9, heightM: 2.1, sillM: 0, wall: 'south' },
      { id: 'o2', type: 'window', widthM: 1.5, heightM: 1.5, sillM: 0.9, wall: 'north' },
    ],
  };
}

describe('geometry (spec 6.2 worked example)', () => {
  it('reproduces A_f, P, A_wg, A_o, A_w, A_c and S', () => {
    const g = roomGeometry(bedroom(), lib, 'apartment', null);
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    const { geo } = g;
    expect(geo.floorArea.value).toBeCloseTo(20.0, 10);
    expect(geo.perimeter.value).toBeCloseTo(18.0, 10);
    expect(geo.grossWall.value).toBeCloseTo(50.4, 10);
    expect(geo.openingArea.value).toBeCloseTo(4.14, 10);
    expect(geo.netWall.value).toBeCloseTo(46.26, 10);
    expect(geo.ceilingArea.value).toBeCloseTo(20.0, 10);
    expect(geo.skirting.value).toBeCloseTo(17.1, 10);
    expect(geo.netWall.formula).toBe('A_w = A_wg − A_o = 50.4 − 4.14 = 46.26 m²');
    expect(g.warnings).toEqual([]);
  });

  it('does not deduct openings under the 0.5 m² convention, and says so', () => {
    const r = { ...bedroom(), openings: [{ id: 'o', type: 'window' as const, widthM: 0.6, heightM: 0.6, sillM: 1.5, wall: '' }] };
    const g = roomGeometry(r, lib, 'apartment', null);
    expect(g.ok && g.geo.openingArea.value).toBe(0);
    expect(g.ok && g.geo.openingArea.notes[0]).toMatch(/under 0.5 m² not deducted/);
  });

  it('assumes the default height when none is typed, and warns by name', () => {
    const g = roomGeometry({ ...bedroom(), heightM: null }, lib, 'villa', null);
    expect(g.ok && g.geo.height.value).toBe(3.2);
    expect(g.ok && g.warnings[0]).toBe('Bedroom has no ceiling height; default 3.2 m assumed — please confirm.');
    expect(g.ok && isUnverified(g.geo.height)).toBe(true);
  });

  it('refuses a room with no dimensions and no drawn shape, with a reason', () => {
    const g = roomGeometry({ ...bedroom(), lengthM: null, widthM: null }, lib, 'apartment', null);
    expect(g.ok).toBe(false);
    expect(!g.ok && g.reason).toMatch(/has no dimensions/);
  });

  it('measures a drawn room: a 5 × 4 m rectangle at 20 px/m gives 20.00 m² and 18.00 m, matching the typed size to 0.01 m²', () => {
    const m = measureShape({ kind: 'rect', id: 's1', cx: 100, cy: 100, width: 100, height: 80, rotationDeg: 0, stroke: 'wall', fill: 'room' }, null);
    expect(m.areaM2).toBeCloseTo(20, 2);
    expect(m.perimeterM).toBeCloseTo(18, 2);
    const g = roomGeometry({ ...bedroom(), lengthM: null, widthM: null }, lib, 'apartment', m);
    expect(g.ok && g.geo.source).toBe('plan');
    expect(g.ok && Math.abs(g.geo.floorArea.value - 20)).toBeLessThan(0.01);
    // A rotated polygon measures the same.
    const poly = measureShape({ kind: 'polyline', id: 's2', closed: true, stroke: 'wall', fill: 'room', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 0, y: 80 }] }, null);
    expect(poly.areaM2).toBeCloseTo(20, 6);
  });

  it('tiled wall area deducts only the part of each opening inside the tiled band', () => {
    const g = roomGeometry(bedroom(), lib, 'apartment', null);
    if (!g.ok) throw new Error('geometry');
    // to 1.2 m: 18 × 1.2 = 21.6; door 0.9 × 1.2 = 1.08; window from 0.9 to 1.2 → 1.5 × 0.3 = 0.45
    expect(tiledWallArea(bedroom(), g.geo, 1.2, lib).value).toBeCloseTo(21.6 - 1.08 - 0.45, 10);
  });
});

describe('paint (spec 6.3)', () => {
  it('walls 46.26 m², 2 coats at 10 m²/L, 5% waste → 9.7 L; primer → 6.1 L', () => {
    const l = paintLitres(46.26, { coats: 2, primer: true, roughSurface: false }, mat('mat-emulsion-matt'), mat('mat-primer'), lib);
    expect(l.finish.value).toBeCloseTo(9.7146, 4);
    expect(l.primer?.value).toBeCloseTo(6.0716, 4);
    expect(l.finish.formula).toBe('Finish: 46.26 m² × 2 coats ÷ (10 m²/L) × 1.05 = 9.71 L');
    expect(isUnverified(l.finish)).toBe(true);
  });

  it('rough surfaces use 0.8 × the spreading rate', () => {
    const l = paintLitres(10, { coats: 1, primer: false, roughSurface: true }, mat('mat-emulsion-matt'), null, lib);
    expect(l.finish.value).toBeCloseTo((10 / 8) * 1.05, 10);
  });

  it('chooses 3 × 3.6 L for 9.7 L with packs of 18 / 3.6 / 1 L, as in the spec', () => {
    const p = choosePacks(9.7146, [18, 3.6, 1], lib);
    expect(p.packs).toEqual([{ sizeL: 3.6, count: 3 }]);
    expect(p.totalL).toBeCloseTo(10.8, 10);
    expect(p.figure.formula).toMatch(/3 × 3.6 L = 10.8 L/);
  });

  it('aggregates rooms that share a colour before choosing packs (an 18 L pack wins)', () => {
    expect(choosePacks(17.5, [18, 3.6, 1], lib).packs).toEqual([{ sizeL: 18, count: 1 }]);
    expect(choosePacks(1, [18, 3.6, 1], lib).packs).toEqual([{ sizeL: 1, count: 1 }]);
    expect(choosePacks(0, [18], lib).packs).toEqual([]);
  });
});

describe('tiles, adhesive and grout (spec 6.3)', () => {
  it('20 m² of 60×60 straight lay → 60 tiles, 15 boxes (21.6 m²); adhesive 100 kg; grout 0.16 kg/m² → 3.2 kg + 10%', () => {
    const t = tileQuantities(20, mat('mat-porcelain-6060'), { layout: 'straight', jointMm: 3, manyCutOuts: false }, mat('mat-adhesive-c2te'), mat('mat-grout-cg2'), lib);
    if ('error' in t) throw new Error(t.error);
    expect(t.wastePct.value).toBe(7);
    expect(t.tiles.value).toBe(60);
    expect(t.tiles.formula).toMatch(/ceil\(59.44\) = 60/);
    expect(t.boxes?.value).toBe(15);
    expect(t.boxes?.formula).toMatch(/\(21.6 m²\)/);
    expect(t.adhesiveKg.value).toBe(100);
    expect(t.groutKgPerM2?.value).toBeCloseTo(0.16, 10);
    expect(t.groutKg?.value).toBeCloseTo(3.2 * 1.1, 10);
  });

  it('adds waste for layout, cut-outs and large format, and back-butter adhesive for large format', () => {
    const t = tileQuantities(10, mat('mat-porcelain-60120'), { layout: 'diagonal', jointMm: 2, manyCutOuts: true }, null, null, lib);
    if ('error' in t) throw new Error(t.error);
    expect(t.wastePct.value).toBe(15 + 3 + 2);
    expect(t.adhesiveKg.value).toBeCloseTo(10 * 6.5, 10);
  });
});

describe('skirting, gypsum, demolition', () => {
  it('skirting 17.1 m + 5% in 0.6 m pieces → 30 pieces', () => {
    const p = skirtingPieces(17.1, mat('mat-skirting-porcelain'), lib);
    expect('error' in p ? -1 : p.value).toBe(30); // 17.955 / 0.6 = 29.9 → 30
  });

  it('gypsum 20 m² × 1.1 ÷ 2.88 → 7.6 → 8 boards', () => {
    const b = gypsumBoards(20, mat('mat-gypsum-12'), lib);
    expect('error' in b ? -1 : b.value).toBe(8);
  });

  it('debris volume uses the strip depth and the 1.3 bulking factor', () => {
    expect(debrisVolume(20, 'floorStripDepth', lib).value).toBeCloseTo(20 * 0.05 * 1.3, 10);
  });
});

// ---------------------------------------------------------------------------

function portalWith(rooms: Room[], specs: RoomSpec[]): PortalData {
  return {
    ...emptyPortal(['renovation']),
    rooms,
    renovation: {
      intakeAnswers: null,
      intakeSubmittedOn: null,
      style: EMPTY_STYLE,
      specs,
      survey: emptySurvey(),
      library: lib,
      settings: DEFAULT_SETTINGS,
      views: [],
      assets: [],
      narrative: { text: '', reviewed: false, provider: '', modelName: '', templateVersion: '', importedOn: null },
      crews: {},
      designRoundsUsed: 0,
      proposal: { status: 'draft', finalisedOn: null, revision: '', preparedBy: null },
    },
  };
}

const fullSpec = (roomId: string): RoomSpec => ({
  ...emptySpec(roomId),
  wallPaint: { productId: 'mat-emulsion-matt', colourId: 'col-ral-9001', finish: 'matt', coats: 2, primer: true, roughSurface: false },
  ceilingPaint: { productId: 'mat-ceiling-white', colourId: 'col-ral-9010', finish: 'matt', coats: 2, primer: false, roughSurface: false },
  floorTiles: { materialId: 'mat-porcelain-6060', layout: 'straight', jointMm: 3, adhesiveId: 'mat-adhesive-c2te', groutId: 'mat-grout-cg2', manyCutOuts: false, heightM: null },
  skirtingId: 'mat-skirting-porcelain',
  gypsumBoardId: 'mat-gypsum-12',
  removeFloor: true,
});

describe('room and project quantities', () => {
  it('makes one work item per specified finish, each with a trace', () => {
    const q = roomQuantities(bedroom(), fullSpec('r1'), lib, 'apartment', null);
    expect(q.items.map((i) => i.rateCode)).toEqual(['RN-DEM-FLR', 'RN-FLR-TILE', 'RN-FLR-SKRT', 'RN-CLG-GYP', 'RN-PNT-WALL', 'RN-PNT-CLG']);
    expect(q.items.find((i) => i.rateCode === 'RN-PNT-WALL')?.quantity.value).toBeCloseTo(46.26, 10);
    expect(q.items.every((i) => i.quantity.formula.length > 0)).toBe(true);
    expect(q.warnings).toEqual([]);
  });

  it('paints only the wall above wall tiles', () => {
    const spec: RoomSpec = { ...emptySpec('r1'), wallPaint: fullSpec('r1').wallPaint, wallTiles: { materialId: 'mat-wall-3060', layout: 'straight', jointMm: 2, adhesiveId: null, groutId: null, manyCutOuts: false, heightM: 1.2 } };
    const q = roomQuantities(bedroom(), spec, lib, 'apartment', null);
    const tiled = q.items.find((i) => i.rateCode === 'RN-WAL-TILE')!.quantity.value;
    const painted = q.items.find((i) => i.rateCode === 'RN-PNT-WALL')!.quantity.value;
    expect(tiled + painted).toBeCloseTo(46.26, 10);
  });

  it('aggregates paint of the same product and colour across rooms before choosing packs', () => {
    const r2 = { ...bedroom(), id: 'r2', name: 'Bedroom 2' };
    const p = portalWith([bedroom(), r2], [fullSpec('r1'), fullSpec('r2')]);
    const q = projectQuantities(p)!;
    const wall = q.order.find((o) => o.kind === 'paint-L' && o.colourId === 'col-ral-9001')!;
    expect(wall.net.value).toBeCloseTo(9.7146 * 2, 3);
    expect(wall.purchase.formula).toMatch(/19.43 L needed → 1 × 18 L \+ 2 × 1 L = 20 L/);
    expect(wall.rooms).toEqual(['Bedroom', 'Bedroom 2']);
    const tiles = q.order.find((o) => o.kind === 'tiles')!;
    expect(tiles.purchase.value).toBe(30); // 120 tiles ÷ 4
    // Project items: protection, skips, final clean
    expect(q.projectItems.map((i) => i.rateCode)).toEqual(['RN-PRL-PROT', 'RN-DEM-SKIP', 'RN-CLN-FINAL']);
    expect(q.projectItems[1]!.quantity.value).toBe(1); // 2 × 20 × 0.05 × 1.3 = 2.6 m³ → 1 skip
  });
});

describe('BOQ, totals, VAT, payment schedule, programme', () => {
  const p = portalWith([bedroom()], [fullSpec('r1')]);
  const q = projectQuantities(p)!;
  const boq = buildBoq(p, q, '2026-10-12');

  it('prices every line from a library rate; totals reconcile to the sum of the lines', () => {
    expect(boq.complete).toBe(true);
    const sum = boq.lines.reduce((s, l) => s + (l.amount ?? 0), 0);
    expect(boq.subtotal).toBeCloseTo(sum, 6);
    expect(boq.byTrade.reduce((s, g) => s + g.subtotal, 0)).toBeCloseTo(sum, 6);
    expect(boq.byRoom.reduce((s, g) => s + g.subtotal, 0)).toBeCloseTo(sum, 6);
    expect(boq.contingency.value).toBeCloseTo(sum * 0.05, 2);
    expect(boq.vat.value).toBeCloseTo((sum + boq.contingency.value) * 0.15, 2);
    expect(boq.total).toBeCloseTo(boq.beforeVat + boq.vat.value, 6);
    expect(boq.currency).toBe('SAR');
    // Walls: 46.26 m² × 18 = 832.68
    expect(boq.lines.find((l) => l.rateCode === 'RN-PNT-WALL')?.amount).toBeCloseTo(832.68, 2);
    expect(boq.lines[0]?.ref).toBe('01.01');
  });

  it('counts sample-rate lines, so Final can be blocked until real rates are entered', () => {
    expect(boq.sampleRateLines).toBe(boq.lines.length);
  });

  it('marks the BOQ incomplete with a reason when a rate is missing or empty — nothing is priced without a library rate', () => {
    const noRate = portalWith([bedroom()], [fullSpec('r1')]);
    const l = noRate.renovation!;
    const lib2 = { ...l.library, rates: l.library.rates.filter((r) => r.code !== 'RN-FLR-TILE').map((r) => (r.code === 'RN-PNT-CLG' ? { ...r, rate: null } : r)) };
    const p2 = { ...noRate, renovation: { ...l, library: lib2 } };
    const b = buildBoq(p2, projectQuantities(p2)!, '2026-10-12');
    expect(b.complete).toBe(false);
    expect(b.incompleteReasons.join(' ')).toMatch(/RN-FLR-TILE is not in the library/);
    expect(b.incompleteReasons.join(' ')).toMatch(/RN-PNT-CLG has no price yet/);
    expect(b.lines.find((x) => x.rateCode === 'RN-FLR-TILE')?.amount).toBeNull();
  });

  it('splits the payment schedule on the total, the last row taking the rounding remainder', () => {
    const s = paymentSchedule(1000.01, DEFAULT_SETTINGS.milestones);
    expect(s.ok).toBe(true);
    expect(s.rows.reduce((a, r) => a + r.amount, 0)).toBeCloseTo(1000.01, 6);
    expect(paymentSchedule(100, [{ id: 'a', label: 'x', percent: 50, trigger: '' }]).ok).toBe(false);
  });

  it('gives the pre-survey range rounded outwards to 100', () => {
    const r = priceRange(10_000, DEFAULT_SETTINGS);
    expect(r.low).toBe(9000);
    expect(r.high).toBe(12000);
  });

  it('programme durations follow quantity ÷ (productivity × crew), rounded up to half days, plus holds', () => {
    const prog = buildProgramme(q, lib, {}, (id) => id ?? 'Project');
    const floor = prog.activities.find((a) => a.id === 'floor-tile')!;
    // 20 m² ÷ (12 × 2) = 0.83 → 1 day + 1 day adhesive-to-grout hold
    expect(floor.duration.value).toBe(2);
    const paint = prog.activities.find((a) => a.id === 'paint')!;
    // walls 46.26 × 3 coats + ceiling 20 × 2 = 178.78 ÷ 70 = 2.55 → 3 days
    expect(paint.duration.value).toBe(3);
    const gyp = prog.activities.find((a) => a.id === 'ceiling')!;
    // 20 ÷ (15 × 1 team) = 1.33 → 1.5
    expect(gyp.duration.value).toBe(1.5);
    expect(prog.activities.at(-1)?.milestone).toBe(true);
    expect(prog.totalDays).toBe(prog.activities.reduce((s, a) => s + a.duration.value, 0));
    // Activities are sequential.
    prog.activities.slice(1).forEach((a, i) => expect(a.start).toBe(prog.activities[i]!.end));
  });
});

describe('rule library', () => {
  it('flags every rule of thumb as Unverified with a source', () => {
    for (const r of DEFAULT_RULES) {
      expect(r.source.length).toBeGreaterThan(0);
      expect(r.unverified).toBe(true);
    }
  });
  it('marks every seeded rate and material as a sample, Unverified, "replace with your rates"', () => {
    for (const r of lib.rates) expect(r.sample && r.unverified && /SAMPLE — replace with your rates/.test(r.source)).toBe(true);
    for (const m of lib.materials) expect(m.sample && m.unverified).toBe(true);
    for (const c of lib.colours) expect(c.code).toMatch(/^RAL \d{4}$/);
  });
});
