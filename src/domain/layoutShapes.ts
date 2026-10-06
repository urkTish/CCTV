/**
 * Drawn site layout: rooms, walls, fences, curved lines, doors, windows, gates
 * and text labels that the engineer draws on the site map — on a blank canvas
 * when there is no plan to upload, or over an uploaded plan to trace it.
 *
 * Pure data, pure geometry and the zod schema; the editor in `ui/` only renders
 * and forwards input. Shapes live in the same IMAGE-pixel coordinates as the
 * devices, so every distance still comes from the plan's one calibration.
 *
 * A blank drawn layout has a fixed scale (`LAYOUT_PX_PER_METRE`): the engineer
 * types the site's width × height in metres, and the calibration is set from
 * that, so the cable maths works on a drawn layout exactly as on an image.
 */

import { z } from 'zod';
import { SitePlanError, distancePx, metresPerPixel, type Calibration, type Point, type SitePlan } from './sitePlan.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** How a line is drawn. Walls are thick, partitions thin, fences ticked, boundaries dashed. */
export type LineStyle = 'wall' | 'partition' | 'fence' | 'boundary';
/** Optional area fill for closed shapes. */
export type AreaFill = 'none' | 'room' | 'building' | 'car-park' | 'grass' | 'paving';
export type OpeningVariant = 'door' | 'double-door' | 'window' | 'gate';

export const LINE_STYLES: readonly LineStyle[] = ['wall', 'partition', 'fence', 'boundary'];
export const AREA_FILLS: readonly AreaFill[] = ['none', 'room', 'building', 'car-park', 'grass', 'paving'];
export const OPENING_VARIANTS: readonly OpeningVariant[] = ['door', 'double-door', 'window', 'gate'];

export const LINE_STYLE_LABEL: Readonly<Record<LineStyle, string>> = {
  wall: 'Wall',
  partition: 'Thin line / partition',
  fence: 'Fence',
  boundary: 'Boundary (dashed)',
};
export const AREA_FILL_LABEL: Readonly<Record<AreaFill, string>> = {
  none: 'No fill',
  room: 'Room',
  building: 'Building',
  'car-park': 'Car park',
  grass: 'Grass / planting',
  paving: 'Paving / yard',
};
export const OPENING_LABEL: Readonly<Record<OpeningVariant, string>> = {
  door: 'Door',
  'double-door': 'Double door',
  window: 'Window',
  gate: 'Gate',
};
/** Typical clear widths, metres — starting values the engineer edits. */
export const OPENING_DEFAULT_WIDTH_M: Readonly<Record<OpeningVariant, number>> = {
  door: 0.9,
  'double-door': 1.8,
  window: 1.2,
  gate: 4,
};

/** Rectangle / square, stored by its centre so rotation is about the middle. */
export interface RectShape {
  readonly kind: 'rect';
  readonly id: string;
  readonly cx: number;
  readonly cy: number;
  readonly width: number;
  readonly height: number;
  readonly rotationDeg: number;
  readonly stroke: LineStyle;
  readonly fill: AreaFill;
}

/** Straight segments through the points; closed = back to the first point (an area). */
export interface PolylineShape {
  readonly kind: 'polyline';
  readonly id: string;
  readonly points: readonly Point[];
  readonly closed: boolean;
  readonly stroke: LineStyle;
  readonly fill: AreaFill;
}

/** A smooth curve through every point (Catmull–Rom drawn as cubic Béziers). */
export interface CurveShape {
  readonly kind: 'curve';
  readonly id: string;
  readonly points: readonly Point[];
  readonly closed: boolean;
  readonly stroke: LineStyle;
  readonly fill: AreaFill;
}

/**
 * Door, double door, window or gate. (cx, cy) is the middle of the opening;
 * the opening runs along the rotated x axis. `flip` swings it to the other side.
 */
export interface OpeningShape {
  readonly kind: 'opening';
  readonly id: string;
  readonly variant: OpeningVariant;
  readonly cx: number;
  readonly cy: number;
  readonly widthMetres: number;
  readonly rotationDeg: number;
  readonly flip: boolean;
}

export interface TextShape {
  readonly kind: 'text';
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly text: string;
  /** Font size in plan pixels. */
  readonly sizePx: number;
  readonly rotationDeg: number;
}

export type LayoutShape = RectShape | PolylineShape | CurveShape | OpeningShape | TextShape;
export type ShapeKind = LayoutShape['kind'];

/** A blank drawing canvas, in metres. Only used when there is no plan image. */
export interface LayoutCanvas {
  readonly widthMetres: number;
  readonly heightMetres: number;
}

export interface SiteLayout {
  readonly canvas: LayoutCanvas | null;
  /** Grid spacing in metres (shown and snapped to once the plan has a scale). */
  readonly gridMetres: number;
  readonly shapes: readonly LayoutShape[];
}

export const DEFAULT_GRID_METRES = 1;
export const EMPTY_LAYOUT: SiteLayout = { canvas: null, gridMetres: DEFAULT_GRID_METRES, shapes: [] };

/** Pixels per metre of a blank drawn layout: 1 m = 20 px, so a 1 m grid square is 20 px. */
export const LAYOUT_PX_PER_METRE = 20;
export const MIN_CANVAS_METRES = 2;
export const MAX_CANVAS_METRES = 1000;
export const MAX_SHAPES = 2000;
export const MAX_SHAPE_POINTS = 500;
export const MAX_LABEL_CHARS = 120;
/** When the plan has no scale, opening widths are drawn at this assumed scale. */
export const FALLBACK_PX_PER_METRE = LAYOUT_PX_PER_METRE;

// ---------------------------------------------------------------------------
// Schema (project file, autosave, workspace envelope)
// ---------------------------------------------------------------------------

const coord = z.number().finite().min(-1e6).max(1e6);
const pointSchema = z.object({ x: coord, y: coord }).strict();
const shapeId = z.string().min(1).max(64);
const lineStyleSchema = z.enum(['wall', 'partition', 'fence', 'boundary']);
const fillSchema = z.enum(['none', 'room', 'building', 'car-park', 'grass', 'paving']);
const size = z.number().finite().positive().max(1e6);
const angle = z.number().finite().min(-3600).max(3600);

const pathShape = <K extends 'polyline' | 'curve'>(kind: K) =>
  z
    .object({
      kind: z.literal(kind),
      id: shapeId,
      points: z.array(pointSchema).min(2).max(MAX_SHAPE_POINTS),
      closed: z.boolean(),
      stroke: lineStyleSchema,
      fill: fillSchema,
    })
    .strict();

export const layoutShapeSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('rect'),
      id: shapeId,
      cx: coord,
      cy: coord,
      width: size,
      height: size,
      rotationDeg: angle,
      stroke: lineStyleSchema,
      fill: fillSchema,
    })
    .strict(),
  pathShape('polyline'),
  pathShape('curve'),
  z
    .object({
      kind: z.literal('opening'),
      id: shapeId,
      variant: z.enum(['door', 'double-door', 'window', 'gate']),
      cx: coord,
      cy: coord,
      widthMetres: z.number().finite().positive().max(100),
      rotationDeg: angle,
      flip: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('text'),
      id: shapeId,
      x: coord,
      y: coord,
      text: z.string().min(1).max(MAX_LABEL_CHARS),
      sizePx: z.number().finite().positive().max(10_000),
      rotationDeg: angle,
    })
    .strict(),
]);

export const layoutCanvasSchema = z
  .object({
    widthMetres: z.number().finite().min(MIN_CANVAS_METRES).max(MAX_CANVAS_METRES),
    heightMetres: z.number().finite().min(MIN_CANVAS_METRES).max(MAX_CANVAS_METRES),
  })
  .strict();

export const siteLayoutSchema = z
  .object({
    canvas: layoutCanvasSchema.nullable(),
    gridMetres: z.number().finite().positive().max(100),
    shapes: z.array(layoutShapeSchema).max(MAX_SHAPES),
  })
  .strict()
  .superRefine((layout, ctx) => {
    const ids = new Set<string>();
    layout.shapes.forEach((s, i) => {
      if (ids.has(s.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['shapes', i, 'id'], message: `Duplicate shape id "${s.id}"` });
      ids.add(s.id);
    });
  });

// ---------------------------------------------------------------------------
// Layout on a plan
// ---------------------------------------------------------------------------

/** The plan's layout; plans saved before drawing existed have none. */
export function layoutOf(plan: SitePlan): SiteLayout {
  return plan.layout ?? EMPTY_LAYOUT;
}

/** True when there is nothing worth saving: no canvas, no shapes, default grid. */
export function isEmptyLayout(layout: SiteLayout | undefined): boolean {
  return !layout || (layout.canvas === null && layout.shapes.length === 0 && layout.gridMetres === DEFAULT_GRID_METRES);
}

export function canvasPx(canvas: LayoutCanvas): { readonly widthPx: number; readonly heightPx: number } {
  return {
    widthPx: Math.round(canvas.widthMetres * LAYOUT_PX_PER_METRE),
    heightPx: Math.round(canvas.heightMetres * LAYOUT_PX_PER_METRE),
  };
}

/** The calibration a blank layout implies: its top edge, `widthMetres` long. */
export function canvasCalibration(canvas: LayoutCanvas): Calibration {
  const { widthPx } = canvasPx(canvas);
  return { a: { x: 0, y: 0 }, b: { x: widthPx, y: 0 }, metres: widthPx / LAYOUT_PX_PER_METRE };
}

function checkCanvas(widthMetres: number, heightMetres: number): LayoutCanvas {
  for (const [name, v] of [
    ['width', widthMetres],
    ['height', heightMetres],
  ] as const) {
    if (!Number.isFinite(v) || v < MIN_CANVAS_METRES || v > MAX_CANVAS_METRES) {
      throw new SitePlanError(`The site ${name} must be between ${MIN_CANVAS_METRES} and ${MAX_CANVAS_METRES} m.`);
    }
  }
  return { widthMetres, heightMetres };
}

const clampTo = (v: number, max: number) => Math.min(max, Math.max(0, v));

/**
 * Start (or resize) a blank drawn layout of `widthMetres × heightMetres`. Sets
 * the plan's calibration from it (1 m = `LAYOUT_PX_PER_METRE` px), so every
 * distance works at once. Devices and route bends are kept, pulled inside the
 * canvas if it shrank; shapes keep their metre positions. Refused while a plan
 * image is loaded — draw over the image instead.
 */
export function setLayoutCanvas(plan: SitePlan, widthMetres: number, heightMetres: number): SitePlan {
  if (plan.image) throw new SitePlanError('A plan image is loaded. Draw over it, or remove the image to draw a blank layout.');
  const canvas = checkCanvas(widthMetres, heightMetres);
  const { widthPx, heightPx } = canvasPx(canvas);
  const inside = <P extends Point>(p: P): P => ({ ...p, x: clampTo(p.x, widthPx), y: clampTo(p.y, heightPx) });
  return {
    ...plan,
    calibration: canvasCalibration(canvas),
    devices: plan.devices.map(inside),
    routes: plan.routes.map((r) => ({ ...r, waypoints: r.waypoints.map(inside) })),
    layout: { ...layoutOf(plan), canvas },
  };
}

/** Drop the blank canvas (and its scale); the shapes stay for the next canvas or image. */
export function removeLayoutCanvas(plan: SitePlan): SitePlan {
  const layout = layoutOf(plan);
  if (!layout.canvas) return plan;
  return { ...plan, calibration: plan.image ? plan.calibration : null, layout: { ...layout, canvas: null } };
}

export function setGridMetres(plan: SitePlan, gridMetres: number): SitePlan {
  if (!Number.isFinite(gridMetres) || gridMetres <= 0 || gridMetres > 100) {
    throw new SitePlanError('The grid spacing must be more than 0 and at most 100 m.');
  }
  return { ...plan, layout: { ...layoutOf(plan), gridMetres } };
}

// ---------------------------------------------------------------------------
// Shape edits
// ---------------------------------------------------------------------------

const ID_PREFIX: Readonly<Record<ShapeKind, string>> = {
  rect: 'area',
  polyline: 'line',
  curve: 'curve',
  opening: 'opening',
  text: 'label',
};

/** First id `${prefix}-${n}` used by no shape, device or route. */
export function nextShapeId(plan: SitePlan, kind: ShapeKind): string {
  const taken = new Set<string>([
    ...layoutOf(plan).shapes.map((s) => s.id),
    ...plan.devices.map((d) => d.id),
    ...plan.routes.map((r) => r.id),
  ]);
  let n = 1;
  while (taken.has(`${ID_PREFIX[kind]}-${n}`)) n += 1;
  return `${ID_PREFIX[kind]}-${n}`;
}

export function shapeById(plan: SitePlan, id: string): LayoutShape | null {
  return layoutOf(plan).shapes.find((s) => s.id === id) ?? null;
}

/** Throws `SitePlanError` when a shape cannot be drawn as given. */
export function validateShape(shape: LayoutShape): void {
  const finite = (...v: number[]) => v.every((n) => Number.isFinite(n));
  switch (shape.kind) {
    case 'rect':
      if (!finite(shape.cx, shape.cy, shape.rotationDeg) || !(shape.width > 0) || !(shape.height > 0)) {
        throw new SitePlanError('A rectangle needs a position and a width and height above zero.');
      }
      return;
    case 'polyline':
    case 'curve':
      if (shape.points.length < 2) throw new SitePlanError('A line needs at least two points.');
      if (shape.closed && shape.points.length < 3) throw new SitePlanError('A closed area needs at least three points.');
      if (shape.points.length > MAX_SHAPE_POINTS) throw new SitePlanError(`A line can have at most ${MAX_SHAPE_POINTS} points.`);
      if (!shape.points.every((p) => finite(p.x, p.y))) throw new SitePlanError('Every point needs a finite x and y.');
      return;
    case 'opening':
      if (!finite(shape.cx, shape.cy, shape.rotationDeg)) throw new SitePlanError('An opening needs a position.');
      if (!(shape.widthMetres > 0) || shape.widthMetres > 100) throw new SitePlanError('An opening must be more than 0 and at most 100 m wide.');
      return;
    case 'text':
      if (!finite(shape.x, shape.y, shape.rotationDeg)) throw new SitePlanError('A label needs a position.');
      if (shape.text.trim() === '') throw new SitePlanError('A label needs some text.');
      if (!(shape.sizePx > 0)) throw new SitePlanError('The text size must be above zero.');
      return;
  }
}

function normaliseShape(shape: LayoutShape): LayoutShape {
  if (shape.kind === 'text') return { ...shape, text: shape.text.slice(0, MAX_LABEL_CHARS) };
  return shape;
}

/** Add a shape. Its id is replaced by a fresh one; the new shape is returned with the plan. */
export function addShape(plan: SitePlan, shape: LayoutShape): { readonly plan: SitePlan; readonly shape: LayoutShape } {
  validateShape(shape);
  const layout = layoutOf(plan);
  if (layout.shapes.length >= MAX_SHAPES) throw new SitePlanError(`The layout already has ${MAX_SHAPES} shapes, the most a project file holds.`);
  const added = normaliseShape({ ...shape, id: nextShapeId(plan, shape.kind) });
  return { plan: { ...plan, layout: { ...layout, shapes: [...layout.shapes, added] } }, shape: added };
}

/** Replace a shape by id (same kind); throws for an unknown id or an invalid shape. */
export function updateShape(plan: SitePlan, shape: LayoutShape): SitePlan {
  const layout = layoutOf(plan);
  const old = layout.shapes.find((s) => s.id === shape.id);
  if (!old) throw new SitePlanError(`No shape "${shape.id}" on the layout`);
  if (old.kind !== shape.kind) throw new SitePlanError('A shape cannot change its kind.');
  validateShape(shape);
  const next = normaliseShape(shape);
  return { ...plan, layout: { ...layout, shapes: layout.shapes.map((s) => (s.id === shape.id ? next : s)) } };
}

export function removeShape(plan: SitePlan, id: string): SitePlan {
  const layout = layoutOf(plan);
  if (!layout.shapes.some((s) => s.id === id)) return plan;
  return { ...plan, layout: { ...layout, shapes: layout.shapes.filter((s) => s.id !== id) } };
}

/** Copy of a shape moved by (dx, dy), with a fresh id. */
export function duplicateShape(plan: SitePlan, id: string, offset: Point): { readonly plan: SitePlan; readonly shape: LayoutShape } {
  const s = shapeById(plan, id);
  if (!s) throw new SitePlanError(`No shape "${id}" on the layout`);
  return addShape(plan, translateShape(s, offset.x, offset.y));
}

/** Move a shape earlier (drawn underneath) or later (drawn on top). */
export function reorderShape(plan: SitePlan, id: string, where: 'front' | 'back'): SitePlan {
  const layout = layoutOf(plan);
  const s = layout.shapes.find((x) => x.id === id);
  if (!s) return plan;
  const rest = layout.shapes.filter((x) => x.id !== id);
  return { ...plan, layout: { ...layout, shapes: where === 'front' ? [...rest, s] : [s, ...rest] } };
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Rotate `p` by `deg` (clockwise on screen, where y grows downwards) about `origin`. */
export function rotateAbout(p: Point, origin: Point, deg: number): Point {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c };
}

/** A point given in a shape's local frame (origin at its centre, unrotated) → plan pixels. */
export function localToPlan(centre: Point, rotationDeg: number, local: Point): Point {
  return rotateAbout({ x: centre.x + local.x, y: centre.y + local.y }, centre, rotationDeg);
}

/** Plan pixels → a shape's local frame. */
export function planToLocal(centre: Point, rotationDeg: number, p: Point): Point {
  const q = rotateAbout(p, centre, -rotationDeg);
  return { x: q.x - centre.x, y: q.y - centre.y };
}

/** Nearest grid point; a grid of 0 or less (or not finite) means no snapping. */
export function snapPoint(p: Point, gridPx: number | null): Point {
  if (gridPx === null || !(gridPx > 0) || !Number.isFinite(gridPx)) return p;
  return { x: Math.round(p.x / gridPx) * gridPx, y: Math.round(p.y / gridPx) * gridPx };
}

/** Grid spacing in plan pixels, or null when the plan has no scale (no metre grid then). */
export function gridSpacingPx(gridMetres: number, metresPerPx: number | null): number | null {
  if (metresPerPx === null || !(metresPerPx > 0) || !(gridMetres > 0)) return null;
  return gridMetres / metresPerPx;
}

/** Keep the direction from `from` to `to` on a multiple of 45° (Shift while drawing a line). */
export function constrainAngle(from: Point, to: Point, stepDeg = 45): Point {
  const len = distancePx(from, to);
  if (len === 0) return to;
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  const step = rad(stepDeg);
  const snapped = Math.round(a / step) * step;
  return { x: from.x + len * Math.cos(snapped), y: from.y + len * Math.sin(snapped) };
}

/** Axis-aligned rectangle from two dragged corners; `square` keeps the larger side (Shift). */
export function rectFromCorners(a: Point, b: Point, square = false): { cx: number; cy: number; width: number; height: number } {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  if (square) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = (dx < 0 ? -1 : 1) * side;
    dy = (dy < 0 ? -1 : 1) * side;
  }
  return { cx: a.x + dx / 2, cy: a.y + dy / 2, width: Math.abs(dx), height: Math.abs(dy) };
}

/** The four corners of a rectangle in plan pixels, clockwise from its top-left. */
export function rectCorners(r: Pick<RectShape, 'cx' | 'cy' | 'width' | 'height' | 'rotationDeg'>): Point[] {
  const c = { x: r.cx, y: r.cy };
  const w = r.width / 2;
  const h = r.height / 2;
  return [
    { x: -w, y: -h },
    { x: w, y: -h },
    { x: w, y: h },
    { x: -w, y: h },
  ].map((p) => localToPlan(c, r.rotationDeg, p));
}

/**
 * Resize a rectangle by dragging corner `corner` (0–3, as `rectCorners`) to
 * `to`, keeping the opposite corner where it is. `square` keeps it square.
 * The rotation is kept; a corner dragged past the opposite one flips cleanly.
 */
export function resizeRectFromCorner(r: RectShape, corner: 0 | 1 | 2 | 3, to: Point, square = false, minPx = 1): RectShape {
  const fixed = rectCorners(r)[(corner + 2) % 4]!;
  const local = planToLocal(fixed, r.rotationDeg, to);
  let lx = local.x;
  let ly = local.y;
  if (square) {
    const side = Math.max(Math.abs(lx), Math.abs(ly));
    lx = (lx < 0 ? -1 : 1) * side;
    ly = (ly < 0 ? -1 : 1) * side;
  }
  const width = Math.max(minPx, Math.abs(lx));
  const height = Math.max(minPx, Math.abs(ly));
  const sx = lx < 0 ? -1 : 1;
  const sy = ly < 0 ? -1 : 1;
  const centre = localToPlan(fixed, r.rotationDeg, { x: (sx * width) / 2, y: (sy * height) / 2 });
  return { ...r, cx: centre.x, cy: centre.y, width, height };
}

/** Angle in degrees (clockwise from "up") from `centre` towards `p` — for a rotation handle. */
export function angleFromUp(centre: Point, p: Point): number {
  const deg = (Math.atan2(p.x - centre.x, -(p.y - centre.y)) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

/** Shape moved by (dx, dy). */
export function translateShape<S extends LayoutShape>(s: S, dx: number, dy: number): S {
  switch (s.kind) {
    case 'rect':
    case 'opening':
      return { ...s, cx: s.cx + dx, cy: s.cy + dy };
    case 'text':
      return { ...s, x: s.x + dx, y: s.y + dy };
    case 'polyline':
    case 'curve':
      return { ...s, points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  }
}

/** Where a shape "is": its centre, label position or first point. Used to move and list it. */
export function shapeAnchor(s: LayoutShape): Point {
  switch (s.kind) {
    case 'rect':
    case 'opening':
      return { x: s.cx, y: s.cy };
    case 'text':
      return { x: s.x, y: s.y };
    case 'polyline':
    case 'curve':
      return s.points[0]!;
  }
}

/** Move a shape so its anchor sits at `to`. */
export function moveShapeTo<S extends LayoutShape>(s: S, to: Point): S {
  const a = shapeAnchor(s);
  return translateShape(s, to.x - a.x, to.y - a.y);
}

export function rotateShape<S extends LayoutShape>(s: S, rotationDeg: number): S {
  if (s.kind === 'polyline' || s.kind === 'curve') return s;
  const deg = Number.isFinite(rotationDeg) ? ((rotationDeg % 360) + 360) % 360 : 0;
  return { ...s, rotationDeg: deg };
}

/**
 * Catmull–Rom spline through `points`, as cubic Bézier control points: segment
 * i goes from P[i] to P[i+1] with controls P[i] + (P[i+1] − P[i−1]) / 6 and
 * P[i+1] − (P[i+2] − P[i]) / 6. Open curves repeat their end points; closed
 * ones wrap round.
 */
export function smoothSegments(points: readonly Point[], closed: boolean): { from: Point; c1: Point; c2: Point; to: Point }[] {
  const n = points.length;
  if (n < 2) return [];
  const at = (i: number): Point => (closed ? points[((i % n) + n) % n]! : points[Math.min(n - 1, Math.max(0, i))]!);
  const count = closed ? n : n - 1;
  const segs: { from: Point; c1: Point; c2: Point; to: Point }[] = [];
  for (let i = 0; i < count; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    segs.push({
      from: p1,
      c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      to: p2,
    });
  }
  return segs;
}

const f = (v: number) => Number(v.toFixed(2));

/** SVG path data for a smooth curve through the points. */
export function smoothPathD(points: readonly Point[], closed: boolean): string {
  const segs = smoothSegments(points, closed);
  if (segs.length === 0) return '';
  const first = segs[0]!.from;
  const body = segs.map((s) => `C${f(s.c1.x)},${f(s.c1.y)} ${f(s.c2.x)},${f(s.c2.y)} ${f(s.to.x)},${f(s.to.y)}`).join(' ');
  return `M${f(first.x)},${f(first.y)} ${body}${closed ? ' Z' : ''}`;
}

/** SVG path data for straight segments. */
export function polylinePathD(points: readonly Point[], closed: boolean): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${f(p.x)},${f(p.y)}`).join(' ') + (closed ? ' Z' : '');
}

function cubicAt(s: { from: Point; c1: Point; c2: Point; to: Point }, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return { x: a * s.from.x + b * s.c1.x + c * s.c2.x + d * s.to.x, y: a * s.from.y + b * s.c1.y + c * s.c2.y + d * s.to.y };
}

/** Points along a smooth curve (the first point, then `perSegment` per segment). */
export function sampleSmooth(points: readonly Point[], closed: boolean, perSegment = 24): Point[] {
  const segs = smoothSegments(points, closed);
  if (segs.length === 0) return [...points];
  const out: Point[] = [segs[0]!.from];
  for (const s of segs) for (let i = 1; i <= perSegment; i++) out.push(cubicAt(s, i / perSegment));
  return out;
}

/** The outline a shape traces, as points (closed shapes do not repeat their first point). */
export function shapeOutline(s: RectShape | PolylineShape | CurveShape): { points: Point[]; closed: boolean } {
  if (s.kind === 'rect') return { points: rectCorners(s), closed: true };
  if (s.kind === 'polyline') return { points: [...s.points], closed: s.closed };
  const pts = sampleSmooth(s.points, s.closed);
  return { points: s.closed ? pts.slice(0, -1) : pts, closed: s.closed };
}

/** Length of a line, or perimeter of an area, in plan pixels. */
export function shapeLengthPx(s: RectShape | PolylineShape | CurveShape): number {
  const { points, closed } = shapeOutline(s);
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distancePx(points[i - 1]!, points[i]!);
  if (closed && points.length > 2) total += distancePx(points[points.length - 1]!, points[0]!);
  return total;
}

/** Enclosed area in square plan pixels (shoelace); 0 for an open line. */
export function shapeAreaPx2(s: RectShape | PolylineShape | CurveShape): number {
  if (s.kind === 'rect') return s.width * s.height;
  const { points, closed } = shapeOutline(s);
  if (!closed || points.length < 3) return 0;
  let twice = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
}

/** Metres per plan pixel to draw openings with: the plan's scale, or the assumed layout scale. */
export function drawingMetresPerPx(cal: Calibration | null): number {
  return cal ? metresPerPixel(cal) : 1 / FALLBACK_PX_PER_METRE;
}

export interface OpeningGeometry {
  /** The gap in the wall, end to end, along the opening. */
  readonly gap: readonly [Point, Point];
  /** Door leaves (open at 90°), each from its hinge. */
  readonly leaves: readonly (readonly [Point, Point])[];
  /** Swing arcs as SVG path data. */
  readonly arcs: readonly string[];
  /** Window: the frame outline (closed), empty for doors and gates. */
  readonly frame: readonly Point[];
}

/**
 * Plan symbol for an opening of `widthPx`: the gap, the leaves drawn open at
 * 90° and their swing arcs (door: one leaf hinged at the left end; double door
 * and gate: two half leaves meeting in the middle), or a window's frame with
 * its glazing line. `flip` swings to the other side of the wall.
 */
export function openingGeometry(o: OpeningShape, widthPx: number): OpeningGeometry {
  const c = { x: o.cx, y: o.cy };
  const P = (x: number, y: number) => localToPlan(c, o.rotationDeg, { x, y });
  const w = widthPx;
  const side = o.flip ? 1 : -1; // swing towards local −y (up) unless flipped
  const left = P(-w / 2, 0);
  const right = P(w / 2, 0);
  const sweep = o.flip ? 1 : 0;
  const arc = (from: Point, to: Point, r: number, sw: number) =>
    `M${f(from.x)},${f(from.y)} A${f(r)},${f(r)} 0 0 ${sw} ${f(to.x)},${f(to.y)}`;
  switch (o.variant) {
    case 'door': {
      const tip = P(-w / 2, side * w);
      return { gap: [left, right], leaves: [[left, tip]], arcs: [arc(right, tip, w, sweep)], frame: [] };
    }
    case 'double-door':
    case 'gate': {
      const h = w / 2;
      const tipL = P(-w / 2, side * h);
      const tipR = P(w / 2, side * h);
      const mid = P(0, 0);
      return {
        gap: [left, right],
        leaves: [
          [left, tipL],
          [right, tipR],
        ],
        arcs: [arc(mid, tipL, h, sweep), arc(mid, tipR, h, 1 - sweep)],
        frame: [],
      };
    }
    case 'window': {
      const t = Math.max(w * 0.08, 1);
      return { gap: [left, right], leaves: [], arcs: [], frame: [P(-w / 2, -t), P(w / 2, -t), P(w / 2, t), P(-w / 2, t)] };
    }
  }
}

/**
 * An opening from a drag along a wall: centred between `a` and `b`, as wide as
 * the drag (metres at `metresPerPx`), turned to match its direction.
 */
export function openingFromDrag(variant: OpeningVariant, a: Point, b: Point, metresPerPx: number): Pick<OpeningShape, 'cx' | 'cy' | 'widthMetres' | 'rotationDeg'> {
  const widthMetres = distancePx(a, b) * metresPerPx;
  const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return {
    cx: (a.x + b.x) / 2,
    cy: (a.y + b.y) / 2,
    widthMetres: widthMetres > 0 ? widthMetres : OPENING_DEFAULT_WIDTH_M[variant],
    rotationDeg: ((deg % 360) + 360) % 360,
  };
}

/** Axis-aligned bounds of a shape in plan pixels (text uses an estimated width). */
export function shapeBounds(s: LayoutShape, metresPerPx: number): { minX: number; minY: number; maxX: number; maxY: number } {
  let pts: Point[];
  switch (s.kind) {
    case 'rect':
    case 'polyline':
    case 'curve':
      pts = shapeOutline(s).points;
      break;
    case 'opening': {
      const g = openingGeometry(s, s.widthMetres / metresPerPx);
      pts = [...g.gap, ...g.leaves.flat(), ...g.frame];
      break;
    }
    case 'text': {
      const w = s.text.length * s.sizePx * 0.6;
      const c = { x: s.x, y: s.y };
      pts = [
        { x: -w / 2, y: -s.sizePx * 0.8 },
        { x: w / 2, y: -s.sizePx * 0.8 },
        { x: w / 2, y: s.sizePx * 0.3 },
        { x: -w / 2, y: s.sizePx * 0.3 },
      ].map((p) => localToPlan(c, s.rotationDeg, p));
      break;
    }
  }
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

// ---------------------------------------------------------------------------
// Text form of a point list (the keyboard alternative edits lines with it)
// ---------------------------------------------------------------------------

export function formatPoints(points: readonly Point[]): string {
  return points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ');
}

/**
 * "x,y x,y …" (spaces, semicolons or new lines between points) → points.
 * Returns a reason instead of throwing, for showing beside the field.
 */
export function parsePoints(text: string): { ok: true; points: Point[] } | { ok: false; reason: string } {
  const parts = text.trim().split(/[\s;]+/).filter(Boolean);
  const points: Point[] = [];
  for (const part of parts) {
    const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(part);
    if (!m) return { ok: false, reason: `"${part}" is not a point; write points as x,y separated by spaces.` };
    points.push({ x: Number(m[1]), y: Number(m[2]) });
  }
  if (points.length < 2) return { ok: false, reason: 'A line needs at least two points.' };
  if (points.length > MAX_SHAPE_POINTS) return { ok: false, reason: `A line can have at most ${MAX_SHAPE_POINTS} points.` };
  return { ok: true, points };
}

// ---------------------------------------------------------------------------
// Undo / redo history (pure)
// ---------------------------------------------------------------------------

export interface History<T> {
  readonly past: readonly T[];
  readonly future: readonly T[];
}

export const EMPTY_HISTORY: History<never> = { past: [], future: [] };
export const HISTORY_LIMIT = 100;

/** Record `before` as an undo step; a new edit clears the redo stack. */
export function recordHistory<T>(h: History<T>, before: T, limit = HISTORY_LIMIT): History<T> {
  const past = [...h.past, before];
  return { past: past.length > limit ? past.slice(past.length - limit) : past, future: [] };
}

/** Step back: returns the state to show and the new history, or null when there is nothing to undo. */
export function undoHistory<T>(h: History<T>, current: T): { state: T; history: History<T> } | null {
  const prev = h.past[h.past.length - 1];
  if (prev === undefined) return null;
  return { state: prev, history: { past: h.past.slice(0, -1), future: [current, ...h.future] } };
}

export function redoHistory<T>(h: History<T>, current: T): { state: T; history: History<T> } | null {
  const next = h.future[0];
  if (next === undefined) return null;
  return { state: next, history: { past: [...h.past, current], future: h.future.slice(1) } };
}

// ---------------------------------------------------------------------------
// Starting shapes (the keyboard alternative's "Add …" buttons)
// ---------------------------------------------------------------------------

/** What the drawing tools make: a shape kind, or one of the opening variants. */
export type DrawTool = 'rect' | 'polyline' | 'curve' | 'text' | OpeningVariant;

/**
 * A sensible first shape of each kind, centred on `at`: a 6 × 4 m room, a 6 m
 * wall, a 6 m curve, an opening at its usual width, a label. Sizes are in
 * metres when the plan has a scale (else at the blank-layout scale), and never
 * more than 40% of the canvas.
 */
export function defaultShape(
  tool: DrawTool,
  at: Point,
  metresPerPx: number | null,
  canvas: { readonly widthPx: number; readonly heightPx: number },
  text = 'Label',
): LayoutShape {
  const pxPerM = metresPerPx && metresPerPx > 0 ? 1 / metresPerPx : FALLBACK_PX_PER_METRE;
  const cap = (px: number, of: number) => Math.min(px, of * 0.4);
  const w = cap(6 * pxPerM, canvas.widthPx);
  const h = cap(4 * pxPerM, canvas.heightPx);
  switch (tool) {
    case 'rect':
      return { kind: 'rect', id: 'new', cx: at.x, cy: at.y, width: w, height: h, rotationDeg: 0, stroke: 'wall', fill: 'room' };
    case 'polyline':
      return { kind: 'polyline', id: 'new', points: [{ x: at.x - w / 2, y: at.y }, { x: at.x + w / 2, y: at.y }], closed: false, stroke: 'wall', fill: 'none' };
    case 'curve':
      return {
        kind: 'curve',
        id: 'new',
        points: [
          { x: at.x - w / 2, y: at.y },
          { x: at.x, y: at.y - h / 2 },
          { x: at.x + w / 2, y: at.y },
        ],
        closed: false,
        stroke: 'fence',
        fill: 'none',
      };
    case 'text':
      return { kind: 'text', id: 'new', x: at.x, y: at.y, text, sizePx: (Math.max(canvas.widthPx, canvas.heightPx) / 100) * 1.8, rotationDeg: 0 };
    default:
      return { kind: 'opening', id: 'new', variant: tool, cx: at.x, cy: at.y, widthMetres: OPENING_DEFAULT_WIDTH_M[tool], rotationDeg: 0, flip: false };
  }
}

/** A short name for a shape, for lists and screen readers ("Room 6.0 × 4.0 m", "Fence 23.5 m"…). */
export function describeShape(s: LayoutShape, metresPerPx: number | null): string {
  const m = (px: number) => (metresPerPx ? `${(px * metresPerPx).toFixed(1)} m` : `${Math.round(px)} px`);
  switch (s.kind) {
    case 'rect': {
      const what = s.fill === 'none' ? (s.width === s.height ? 'Square' : 'Rectangle') : AREA_FILL_LABEL[s.fill];
      const dims = metresPerPx
        ? `${(s.width * metresPerPx).toFixed(1)} × ${(s.height * metresPerPx).toFixed(1)} m`
        : `${Math.round(s.width)} × ${Math.round(s.height)} px`;
      return `${what} ${dims}`;
    }
    case 'polyline':
    case 'curve': {
      const style = LINE_STYLE_LABEL[s.stroke].split(' ')[0]!;
      const what = s.closed && s.fill !== 'none' ? AREA_FILL_LABEL[s.fill] : `${s.kind === 'curve' ? 'Curved ' : ''}${s.kind === 'curve' ? style.toLowerCase() : style}`;
      return `${what} ${s.closed ? 'outline ' : ''}${m(shapeLengthPx(s))}`;
    }
    case 'opening':
      return `${OPENING_LABEL[s.variant]} ${s.widthMetres.toFixed(2)} m`;
    case 'text':
      return `Label “${s.text}”`;
  }
}
