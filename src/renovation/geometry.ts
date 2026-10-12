/**
 * Room geometry (spec 6.2), pure. A room is measured from its typed L × W × H,
 * or from the closed shape it was promoted from on the drawn plan (area and
 * perimeter from the polygon); typed dimensions override the drawing. A
 * missing height falls back to the property's default height (Unverified) and
 * says so.
 *
 * Worked example (spec 6.2): bedroom 5.0 × 4.0 m, H 2.8 m, one door
 * 0.9 × 2.1 m, one window 1.5 × 1.5 m → A_f 20.0 m², P 18.0 m, A_wg 50.4 m²,
 * A_o 4.14 m², A_w 46.26 m², A_c 20.0 m², S 17.1 m.
 */

import { drawingMetresPerPx, shapeAreaPx2, shapeLengthPx, type LayoutShape, type SiteLayout } from '../domain/layoutShapes.ts';
import type { Calibration } from '../domain/sitePlan.ts';
import { ruleOf, type Library } from './library.ts';
import { FLOOR_LEVEL_OPENINGS, type Opening, type PropertyType, type Room } from './model.ts';
import { constantOf, figure, num, type Figure } from './trace.ts';

export interface PlanMeasure {
  readonly shapeId: string;
  readonly areaM2: number;
  readonly perimeterM: number;
}

export interface RoomGeometry {
  readonly floorArea: Figure;
  readonly perimeter: Figure;
  readonly height: Figure;
  readonly grossWall: Figure;
  readonly openingArea: Figure;
  readonly netWall: Figure;
  readonly ceilingArea: Figure;
  readonly skirting: Figure;
  /** Where L × W came from. */
  readonly source: 'typed' | 'plan';
}

export type GeometryResult = { readonly ok: true; readonly geo: RoomGeometry; readonly warnings: readonly string[] } | { readonly ok: false; readonly reason: string };

type ClosedShape = Extract<LayoutShape, { kind: 'rect' | 'polyline' | 'curve' }>;

export function isClosedArea(s: LayoutShape): s is ClosedShape {
  return s.kind === 'rect' || ((s.kind === 'polyline' || s.kind === 'curve') && s.closed && s.points.length >= 3);
}

/** Area (m²) and perimeter (m) of a closed shape on the drawn plan. */
export function measureShape(s: ClosedShape, calibration: Calibration | null): PlanMeasure {
  const mpp = drawingMetresPerPx(calibration);
  return { shapeId: s.id, areaM2: shapeAreaPx2(s) * mpp * mpp, perimeterM: shapeLengthPx(s) * mpp };
}

/** Every closed area on the drawn plan, with its measure. */
export function planRooms(layout: SiteLayout | undefined, calibration: Calibration | null): PlanMeasure[] {
  return (layout?.shapes ?? []).filter(isClosedArea).map((s) => measureShape(s, calibration));
}

export function defaultHeightKey(propertyType: PropertyType): 'heightVilla' | 'heightApartment' {
  return propertyType === 'villa' ? 'heightVilla' : 'heightApartment';
}

/** Openings counted against the wall area: those at or above the deduction threshold. */
export function deductedOpenings(openings: readonly Opening[], thresholdM2: number): Opening[] {
  return openings.filter((o) => o.widthM * o.heightM >= thresholdM2 - 1e-9);
}

export function roomGeometry(room: Room, lib: Library, propertyType: PropertyType, plan: PlanMeasure | null): GeometryResult {
  const warnings: string[] = [];
  let area: Figure;
  let perimeter: Figure;
  let source: RoomGeometry['source'];
  if (room.lengthM !== null && room.widthM !== null) {
    const L = room.lengthM;
    const W = room.widthM;
    area = figure(L * W, 'm²', `A_f = L × W = ${num(L)} × ${num(W)} = ${num(L * W)} m²`);
    perimeter = figure(2 * (L + W), 'm', `P = 2 × (L + W) = 2 × (${num(L)} + ${num(W)}) = ${num(2 * (L + W))} m`);
    source = 'typed';
    if (plan && Math.abs(plan.areaM2 - L * W) > 0.5) {
      warnings.push(`${room.name}: the typed ${num(L)} × ${num(W)} m (${num(L * W)} m²) differs from the drawn room (${num(plan.areaM2)} m²); the typed size is used.`);
    }
  } else if (plan) {
    area = figure(plan.areaM2, 'm²', `A_f = area of the drawn room (polygon) = ${num(plan.areaM2)} m²`, [], ['Measured from the drawn plan at its scale.']);
    perimeter = figure(plan.perimeterM, 'm', `P = perimeter of the drawn room = ${num(plan.perimeterM)} m`, [], ['Measured from the drawn plan at its scale.']);
    source = 'plan';
  } else {
    return { ok: false, reason: `${room.name} has no dimensions — type its length and width, or create it from a room drawn on the site plan.` };
  }

  let height: Figure;
  if (room.heightM !== null) {
    height = figure(room.heightM, 'm', `H = ${num(room.heightM)} m (measured)`);
  } else {
    const r = ruleOf(lib, defaultHeightKey(propertyType));
    height = figure(r.value, 'm', `H = ${num(r.value)} m (default for this property type)`, [constantOf(r)]);
    warnings.push(`${room.name} has no ceiling height; default ${num(r.value)} m assumed — please confirm.`);
  }
  const H = height.value;
  const A = area.value;
  const P = perimeter.value;

  const threshold = ruleOf(lib, 'deductOpeningsMin');
  const deducted = deductedOpenings(room.openings, threshold.value);
  const Ao = deducted.reduce((s, o) => s + o.widthM * o.heightM, 0);
  const skipped = room.openings.length - deducted.length;
  const openingArea = figure(
    Ao,
    'm²',
    deducted.length ? `A_o = Σ w × h = ${deducted.map((o) => `${num(o.widthM)} × ${num(o.heightM)}`).join(' + ')} = ${num(Ao)} m²` : 'A_o = 0 m² (no openings deducted)',
    [constantOf(threshold)],
    skipped ? [`${skipped} opening(s) under ${num(threshold.value)} m² not deducted (measurement convention).`] : [],
  );
  const grossWall = figure(P * H, 'm²', `A_wg = P × H = ${num(P)} × ${num(H)} = ${num(P * H)} m²`);
  const net = Math.max(0, P * H - Ao);
  const netWall = figure(net, 'm²', `A_w = A_wg − A_o = ${num(P * H)} − ${num(Ao)} = ${num(net)} m²`, openingArea.constants);
  const ceilingArea = figure(A, 'm²', `A_c = A_f = ${num(A)} m² (flat ceiling)`);
  const floorOpenings = room.openings.filter((o) => FLOOR_LEVEL_OPENINGS.has(o.type));
  const doorWidths = floorOpenings.reduce((s, o) => s + o.widthM, 0);
  const S = Math.max(0, P - doorWidths);
  const skirting = figure(
    S,
    'm',
    floorOpenings.length ? `S = P − Σ door widths = ${num(P)} − ${floorOpenings.map((o) => num(o.widthM)).join(' − ')} = ${num(S)} m` : `S = P = ${num(P)} m (no doors)`,
  );
  return { ok: true, geo: { floorArea: area, perimeter, height, grossWall, openingArea, netWall, ceilingArea, skirting, source }, warnings };
}

/**
 * Wall area tiled from the floor to `tileHeight`: P × h less the part of each
 * deducted opening inside that band.
 */
export function tiledWallArea(room: Room, geo: RoomGeometry, tileHeight: number, lib: Library): Figure {
  const threshold = ruleOf(lib, 'deductOpeningsMin');
  const h = Math.min(tileHeight, geo.height.value);
  const parts: string[] = [];
  let deduct = 0;
  for (const o of deductedOpenings(room.openings, threshold.value)) {
    const overlap = Math.max(0, Math.min(o.sillM + o.heightM, h) - Math.max(o.sillM, 0));
    if (overlap > 0) {
      deduct += overlap * o.widthM;
      parts.push(`${num(o.widthM)} × ${num(overlap)}`);
    }
  }
  const gross = geo.perimeter.value * h;
  const value = Math.max(0, gross - deduct);
  return figure(
    value,
    'm²',
    `A_tiled = P × h − openings in the band = ${num(geo.perimeter.value)} × ${num(h)}${parts.length ? ` − (${parts.join(' + ')})` : ''} = ${num(value)} m²`,
    [constantOf(threshold)],
  );
}
