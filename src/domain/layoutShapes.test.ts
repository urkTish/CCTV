import { describe, it, expect } from 'vitest';
import {
  addShape,
  angleFromUp,
  canvasCalibration,
  canvasPx,
  constrainAngle,
  duplicateShape,
  EMPTY_HISTORY,
  EMPTY_LAYOUT,
  formatPoints,
  gridSpacingPx,
  isEmptyLayout,
  LAYOUT_PX_PER_METRE,
  layoutOf,
  moveShapeTo,
  nextShapeId,
  openingFromDrag,
  openingGeometry,
  parsePoints,
  recordHistory,
  rectCorners,
  rectFromCorners,
  redoHistory,
  removeLayoutCanvas,
  removeShape,
  reorderShape,
  resizeRectFromCorner,
  rotateAbout,
  rotateShape,
  sampleSmooth,
  setGridMetres,
  setLayoutCanvas,
  shapeAreaPx2,
  shapeBounds,
  shapeLengthPx,
  siteLayoutSchema,
  smoothPathD,
  smoothSegments,
  snapPoint,
  translateShape,
  undoHistory,
  updateShape,
  type CurveShape,
  type LayoutShape,
  type OpeningShape,
  type PolylineShape,
  type RectShape,
} from './layoutShapes.ts';
import { EMPTY_SITE_PLAN, SitePlanError, horizontalRunBetween, metresPerPixel, type SitePlan } from './sitePlan.ts';
import { canvasSize, placeNvr, placeCamera, removeImage, replaceImage } from './sitePlanEdit.ts';

const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

const rect = (over: Partial<RectShape> = {}): RectShape => ({
  kind: 'rect',
  id: 'x',
  cx: 50,
  cy: 30,
  width: 100,
  height: 60,
  rotationDeg: 0,
  stroke: 'wall',
  fill: 'room',
  ...over,
});

const line = (points: { x: number; y: number }[], closed = false): PolylineShape => ({
  kind: 'polyline',
  id: 'x',
  points,
  closed,
  stroke: 'wall',
  fill: 'none',
});

const door = (over: Partial<OpeningShape> = {}): OpeningShape => ({
  kind: 'opening',
  id: 'x',
  variant: 'door',
  cx: 100,
  cy: 100,
  widthMetres: 1,
  rotationDeg: 0,
  flip: false,
  ...over,
});

describe('blank drawn layout: canvas and its scale', () => {
  it('sizes the canvas at 20 px per metre and calibrates the plan from it', () => {
    const plan = setLayoutCanvas(EMPTY_SITE_PLAN, 40, 25);
    expect(canvasSize(plan)).toEqual({ widthPx: 800, heightPx: 500 });
    expect(plan.calibration).toEqual({ a: { x: 0, y: 0 }, b: { x: 800, y: 0 }, metres: 40 });
    expect(metresPerPixel(plan.calibration!)).toBe(1 / LAYOUT_PX_PER_METRE);
    expect(canvasPx({ widthMetres: 12.5, heightMetres: 3 })).toEqual({ widthPx: 250, heightPx: 60 });
  });

  it('measures cable runs on a drawn layout exactly as on a calibrated image', () => {
    // NVR at (0,0), camera 30 m right and 40 m down: 50 m straight, × 1.3 = 65 m.
    let plan = setLayoutCanvas(EMPTY_SITE_PLAN, 60, 60);
    plan = placeNvr(plan, { x: 0, y: 0 });
    plan = placeCamera(plan, 'loc-1', 1, { x: 600, y: 800 });
    const run = horizontalRunBetween(plan, plan.devices[1]!, plan.devices[0]!, 1.3);
    expect(run.basis).toBe('estimated');
    close(run.metres!, 65, 1e-9);
  });

  it('refuses a size outside 2–1000 m and refuses while an image is loaded', () => {
    expect(() => setLayoutCanvas(EMPTY_SITE_PLAN, 1, 10)).toThrow(SitePlanError);
    expect(() => setLayoutCanvas(EMPTY_SITE_PLAN, 10, 1001)).toThrow(/between 2 and 1000 m/);
    expect(() => setLayoutCanvas(EMPTY_SITE_PLAN, Number.NaN, 10)).toThrow(SitePlanError);
    const withImage = replaceImage(EMPTY_SITE_PLAN, { dataUri: 'data:image/png;base64,AA==', widthPx: 10, heightPx: 10, fileName: 'p.png' });
    expect(() => setLayoutCanvas(withImage, 10, 10)).toThrow(/plan image is loaded/);
  });

  it('pulls devices and route bends inside a smaller canvas', () => {
    let plan = placeNvr(EMPTY_SITE_PLAN, { x: 900, y: 650 });
    plan = { ...plan, routes: [{ id: 'r', fromId: 'nvr-1', toId: 'nvr-1', waypoints: [{ x: 950, y: 10 }] }] };
    const small = setLayoutCanvas(plan, 10, 10);
    expect(small.devices[0]).toMatchObject({ x: 200, y: 200 });
    expect(small.routes[0]!.waypoints[0]).toEqual({ x: 200, y: 10 });
  });

  it('removing the image falls back to the drawn canvas scale; removing the canvas drops it', () => {
    const plan = setLayoutCanvas(EMPTY_SITE_PLAN, 20, 10);
    const withImg = { ...plan, image: { dataUri: 'data:image/png;base64,AA==', widthPx: 5, heightPx: 5, fileName: 'a.png' } };
    expect(removeImage(withImg).calibration).toEqual(canvasCalibration({ widthMetres: 20, heightMetres: 10 }));
    expect(removeImage({ ...EMPTY_SITE_PLAN, calibration: plan.calibration }).calibration).toBeNull();
    const removed = removeLayoutCanvas(plan);
    expect(layoutOf(removed).canvas).toBeNull();
    expect(removed.calibration).toBeNull();
    expect(canvasSize(removed)).toEqual({ widthPx: 1000, heightPx: 700 });
  });

  it('grid: spacing in px from the scale; none without a scale; validated', () => {
    expect(gridSpacingPx(1, 0.05)).toBe(20);
    expect(gridSpacingPx(0.5, 0.01)).toBe(50);
    expect(gridSpacingPx(1, null)).toBeNull();
    expect(layoutOf(setGridMetres(EMPTY_SITE_PLAN, 2)).gridMetres).toBe(2);
    expect(() => setGridMetres(EMPTY_SITE_PLAN, 0)).toThrow(SitePlanError);
  });
});

describe('shape edits', () => {
  it('adds with fresh ids that never clash with devices, updates, removes, duplicates and reorders', () => {
    let plan: SitePlan = placeNvr(EMPTY_SITE_PLAN, { x: 1, y: 1 });
    const a = addShape(plan, rect());
    expect(a.shape.id).toBe('area-1');
    plan = a.plan;
    const b = addShape(plan, line([{ x: 0, y: 0 }, { x: 10, y: 0 }]));
    expect(b.shape.id).toBe('line-1');
    plan = b.plan;
    expect(nextShapeId(plan, 'rect')).toBe('area-2');
    plan = updateShape(plan, { ...rect(), id: 'area-1', width: 200 });
    expect((layoutOf(plan).shapes[0] as RectShape).width).toBe(200);
    const d = duplicateShape(plan, 'area-1', { x: 10, y: 5 });
    expect(d.shape).toMatchObject({ id: 'area-2', cx: 60, cy: 35, width: 200 });
    plan = reorderShape(d.plan, 'area-2', 'back');
    expect(layoutOf(plan).shapes.map((s) => s.id)).toEqual(['area-2', 'area-1', 'line-1']);
    plan = removeShape(plan, 'area-1');
    expect(layoutOf(plan).shapes.map((s) => s.id)).toEqual(['area-2', 'line-1']);
    expect(removeShape(plan, 'ghost')).toBe(plan);
  });

  it('refuses invalid shapes and unknown ids', () => {
    expect(() => addShape(EMPTY_SITE_PLAN, rect({ width: 0 }))).toThrow(SitePlanError);
    expect(() => addShape(EMPTY_SITE_PLAN, line([{ x: 0, y: 0 }]))).toThrow(/at least two points/);
    expect(() => addShape(EMPTY_SITE_PLAN, line([{ x: 0, y: 0 }, { x: 1, y: 1 }], true))).toThrow(/three points/);
    expect(() => addShape(EMPTY_SITE_PLAN, { kind: 'text', id: 'x', x: 0, y: 0, text: '  ', sizePx: 10, rotationDeg: 0 })).toThrow(/some text/);
    expect(() => addShape(EMPTY_SITE_PLAN, door({ widthMetres: 0 }))).toThrow(SitePlanError);
    expect(() => updateShape(EMPTY_SITE_PLAN, rect({ id: 'nope' }))).toThrow(/No shape/);
    const { plan } = addShape(EMPTY_SITE_PLAN, rect());
    expect(() => updateShape(plan, { ...line([{ x: 0, y: 0 }, { x: 1, y: 0 }]), id: 'area-1' })).toThrow(/kind/);
  });

  it('truncates label text to 120 characters', () => {
    const { shape } = addShape(EMPTY_SITE_PLAN, { kind: 'text', id: 'x', x: 0, y: 0, text: 'a'.repeat(200), sizePx: 10, rotationDeg: 0 });
    expect(shape.kind === 'text' && shape.text.length).toBe(120);
  });

  it('moves, translates and rotates every kind', () => {
    expect(translateShape(rect(), 5, -5)).toMatchObject({ cx: 55, cy: 25 });
    expect(translateShape(line([{ x: 0, y: 0 }, { x: 10, y: 0 }]), 1, 2).points).toEqual([{ x: 1, y: 2 }, { x: 11, y: 2 }]);
    expect(moveShapeTo(door(), { x: 7, y: 8 })).toMatchObject({ cx: 7, cy: 8 });
    expect(moveShapeTo(line([{ x: 5, y: 5 }, { x: 10, y: 5 }]), { x: 0, y: 0 }).points[1]).toEqual({ x: 5, y: 0 });
    expect(rotateShape(rect(), -90).rotationDeg).toBe(270);
    expect(rotateShape(rect(), 450).rotationDeg).toBe(90);
    const l = line([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    expect(rotateShape(l, 45)).toBe(l);
  });
});

describe('geometry', () => {
  it('rotates clockwise on screen (y down)', () => {
    const p = rotateAbout({ x: 10, y: 0 }, { x: 0, y: 0 }, 90);
    close(p.x, 0);
    close(p.y, 10);
  });

  it('snaps to the grid, and not at all without one', () => {
    expect(snapPoint({ x: 29, y: 31 }, 20)).toEqual({ x: 20, y: 40 });
    expect(snapPoint({ x: 29, y: 31 }, null)).toEqual({ x: 29, y: 31 });
    expect(snapPoint({ x: 29, y: 31 }, 0)).toEqual({ x: 29, y: 31 });
  });

  it('constrains a line to 45° steps and keeps its length', () => {
    const p = constrainAngle({ x: 0, y: 0 }, { x: 100, y: 10 });
    close(p.x, Math.hypot(100, 10));
    close(p.y, 0);
    const q = constrainAngle({ x: 0, y: 0 }, { x: 50, y: 45 });
    close(q.x, q.y);
  });

  it('builds a rectangle from two corners, with Shift giving a square', () => {
    expect(rectFromCorners({ x: 10, y: 10 }, { x: 110, y: 60 })).toEqual({ cx: 60, cy: 35, width: 100, height: 50 });
    expect(rectFromCorners({ x: 10, y: 10 }, { x: -40, y: 30 }, true)).toEqual({ cx: -15, cy: 35, width: 50, height: 50 });
  });

  it('gives rotated rectangle corners', () => {
    const c = rectCorners(rect({ cx: 0, cy: 0, width: 4, height: 2, rotationDeg: 90 }));
    close(c[0]!.x, 1);
    close(c[0]!.y, -2);
    close(c[2]!.x, -1);
    close(c[2]!.y, 2);
  });

  it('resizes from a corner keeping the opposite corner fixed, also when rotated', () => {
    const r = rect({ cx: 50, cy: 30, width: 100, height: 60 });
    const out = resizeRectFromCorner(r, 2, { x: 200, y: 100 });
    expect(out).toMatchObject({ cx: 100, cy: 50, width: 200, height: 100 });
    const sq = resizeRectFromCorner(r, 2, { x: 200, y: 50 }, true);
    expect(sq).toMatchObject({ width: 200, height: 200 });
    const rot = rect({ cx: 0, cy: 0, width: 10, height: 10, rotationDeg: 30 });
    const fixed = rectCorners(rot)[0]!;
    const moved = resizeRectFromCorner(rot, 2, rotateAbout({ x: 20, y: 20 }, { x: 0, y: 0 }, 30));
    const after = rectCorners(moved)[0]!;
    close(after.x, fixed.x, 1e-9);
    close(after.y, fixed.y, 1e-9);
    close(moved.width, 25, 1e-9);
    // Crossing over the fixed corner flips without a negative size.
    const flipped = resizeRectFromCorner(r, 2, { x: -50, y: -30 });
    expect(flipped.width).toBeGreaterThan(0);
    expect(flipped.height).toBeGreaterThan(0);
  });

  it('measures the angle for a rotation handle clockwise from up', () => {
    close(angleFromUp({ x: 0, y: 0 }, { x: 0, y: -5 }), 0);
    close(angleFromUp({ x: 0, y: 0 }, { x: 5, y: 0 }), 90);
    close(angleFromUp({ x: 0, y: 0 }, { x: -5, y: 0 }), 270);
  });

  it('draws a smooth curve through every point (Catmull–Rom)', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    const segs = smoothSegments(pts, false);
    expect(segs).toHaveLength(2);
    expect(segs[0]!.from).toEqual(pts[0]);
    expect(segs[1]!.to).toEqual(pts[2]);
    // c1 of the first segment uses the repeated end point: P0 + (P1 − P0)/6.
    close(segs[0]!.c1.x, 100 / 6);
    expect(smoothSegments(pts, true)).toHaveLength(3);
    expect(smoothPathD(pts, false)).toMatch(/^M0,0 C16\.67,0 /);
    expect(smoothPathD(pts, true).endsWith(' Z')).toBe(true);
    expect(smoothPathD([{ x: 1, y: 1 }], false)).toBe('');
    // The sampled curve passes through each control point.
    const samples = sampleSmooth(pts, false, 10);
    expect(samples).toHaveLength(21);
    expect(samples[10]).toEqual({ x: 100, y: 0 });
  });

  it('a curve through collinear points is the straight line, so lengths agree', () => {
    const c: CurveShape = { kind: 'curve', id: 'c', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }], closed: false, stroke: 'fence', fill: 'none' };
    close(shapeLengthPx(c), 100, 1e-6);
  });

  it('measures lengths, perimeters and areas', () => {
    expect(shapeLengthPx(rect())).toBe(320);
    expect(shapeAreaPx2(rect())).toBe(6000);
    const tri = line([{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 40 }], true);
    expect(shapeLengthPx(tri)).toBe(120);
    expect(shapeAreaPx2(tri)).toBe(600);
    expect(shapeAreaPx2(line([{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 40 }]))).toBe(0);
    // A closed smooth curve through a square's corners encloses more than the square's inner diamond.
    const blob: CurveShape = { kind: 'curve', id: 'b', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], closed: true, stroke: 'wall', fill: 'grass' };
    expect(shapeAreaPx2(blob)).toBeGreaterThan(100);
    expect(shapeAreaPx2(blob)).toBeLessThan(160);
  });

  it('draws a door: gap, leaf open at 90° from the hinge, and a swing arc; flip swings to the other side', () => {
    const g = openingGeometry(door(), 20);
    expect(g.gap).toEqual([{ x: 90, y: 100 }, { x: 110, y: 100 }]);
    expect(g.leaves).toHaveLength(1);
    expect(g.leaves[0]![0]).toEqual({ x: 90, y: 100 });
    close(g.leaves[0]![1].x, 90);
    close(g.leaves[0]![1].y, 80);
    expect(g.arcs[0]).toBe('M110,100 A20,20 0 0 0 90,80');
    const flipped = openingGeometry(door({ flip: true }), 20);
    close(flipped.leaves[0]![1].y, 120);
    expect(flipped.arcs[0]).toBe('M110,100 A20,20 0 0 1 90,120');
    const turned = openingGeometry(door({ rotationDeg: 90 }), 20);
    close(turned.gap[0].x, 100);
    close(turned.gap[0].y, 90);
  });

  it('draws double doors and gates with two half leaves, and a window as a frame', () => {
    const g = openingGeometry(door({ variant: 'gate' }), 40);
    expect(g.leaves).toHaveLength(2);
    expect(g.arcs).toHaveLength(2);
    close(g.leaves[1]![1].y, 80);
    const w = openingGeometry(door({ variant: 'window' }), 40);
    expect(w.leaves).toHaveLength(0);
    expect(w.frame).toHaveLength(4);
  });

  it('places an opening from a drag along a wall', () => {
    const o = openingFromDrag('door', { x: 0, y: 0 }, { x: 0, y: 18 }, 0.05);
    expect(o).toMatchObject({ cx: 0, cy: 9, rotationDeg: 90 });
    close(o.widthMetres, 0.9);
    expect(openingFromDrag('gate', { x: 5, y: 5 }, { x: 5, y: 5 }, 0.05).widthMetres).toBe(4);
  });

  it('bounds every kind', () => {
    expect(shapeBounds(rect(), 0.05)).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 60 });
    const b = shapeBounds(door(), 0.05);
    expect(b.minX).toBe(90);
    close(b.minY, 80);
    const t = shapeBounds({ kind: 'text', id: 't', x: 0, y: 0, text: 'abcd', sizePx: 10, rotationDeg: 0 }, 0.05);
    close(t.maxX - t.minX, 24);
  });
});

describe('point list text form (keyboard alternative)', () => {
  it('formats and parses x,y lists', () => {
    expect(formatPoints([{ x: 1.4, y: 2.6 }, { x: 10, y: 20 }])).toBe('1,3 10,20');
    expect(parsePoints('0,0 10,5;20,-3\n4.5,6')).toEqual({ ok: true, points: [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: -3 }, { x: 4.5, y: 6 }] });
    const bad = parsePoints('0,0 abc');
    expect(!bad.ok && bad.reason).toMatch(/"abc" is not a point/);
    const one = parsePoints('3,4');
    expect(!one.ok && one.reason).toMatch(/at least two/);
  });
});

describe('undo / redo history', () => {
  it('undoes and redoes, and a new edit clears redo', () => {
    let h = recordHistory(EMPTY_HISTORY, 'a');
    h = recordHistory(h, 'b');
    const u = undoHistory(h, 'c')!;
    expect(u.state).toBe('b');
    const u2 = undoHistory(u.history, u.state)!;
    expect(u2.state).toBe('a');
    expect(undoHistory(u2.history, u2.state)).toBeNull();
    const r = redoHistory(u2.history, 'a')!;
    expect(r.state).toBe('b');
    expect(recordHistory(r.history, 'b').future).toEqual([]);
    expect(redoHistory(EMPTY_HISTORY, 'x')).toBeNull();
  });

  it('keeps at most the limit', () => {
    let h: typeof EMPTY_HISTORY | { past: readonly number[]; future: readonly number[] } = EMPTY_HISTORY;
    for (let i = 0; i < 5; i++) h = recordHistory(h as { past: readonly number[]; future: readonly number[] }, i, 3);
    expect(h.past).toEqual([2, 3, 4]);
  });
});

describe('layout schema', () => {
  const sample = (): { canvas: { widthMetres: number; heightMetres: number } | null; gridMetres: number; shapes: LayoutShape[] } => ({
    canvas: { widthMetres: 40, heightMetres: 25 },
    gridMetres: 1,
    shapes: [
      rect({ id: 'area-1' }),
      line([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], true),
      { kind: 'curve', id: 'curve-1', points: [{ x: 0, y: 0 }, { x: 5, y: 5 }], closed: false, stroke: 'fence', fill: 'none' },
      door({ id: 'opening-1', variant: 'double-door', flip: true }),
      { kind: 'text', id: 'label-1', x: 1, y: 2, text: 'Reception', sizePx: 14, rotationDeg: 0 },
    ],
  });

  it('accepts every shape kind and round-trips through JSON', () => {
    const l = sample();
    const parsed = siteLayoutSchema.parse(JSON.parse(JSON.stringify(l)));
    expect(parsed).toEqual(l);
  });

  it('rejects unknown kinds, unknown fields, bad values and duplicate ids', () => {
    const bad = (mut: (l: Record<string, unknown> & { shapes: Record<string, unknown>[] }) => void) => {
      const l = JSON.parse(JSON.stringify(sample())) as Record<string, unknown> & { shapes: Record<string, unknown>[] };
      mut(l);
      return siteLayoutSchema.safeParse(l).success;
    };
    expect(bad(() => undefined)).toBe(true);
    expect(bad((l) => (l.shapes[0]!.kind = 'hexagon'))).toBe(false);
    expect(bad((l) => (l.shapes[0]!.colour = 'red'))).toBe(false);
    expect(bad((l) => (l.shapes[0]!.width = -1))).toBe(false);
    expect(bad((l) => (l.shapes[3]!.variant = 'portal'))).toBe(false);
    expect(bad((l) => (l.shapes[4]!.text = ''))).toBe(false);
    expect(bad((l) => (l.shapes[2]!.points = [{ x: 0, y: 0 }]))).toBe(false);
    expect(bad((l) => (l.canvas = { widthMetres: 0.5, heightMetres: 10 }))).toBe(false);
    expect(bad((l) => (l.shapes[1]!.id = 'area-1'))).toBe(false);
    expect(bad((l) => (l.extra = true))).toBe(false);
  });

  it('knows an empty layout', () => {
    expect(isEmptyLayout(undefined)).toBe(true);
    expect(isEmptyLayout(EMPTY_LAYOUT)).toBe(true);
    expect(isEmptyLayout({ ...EMPTY_LAYOUT, gridMetres: 2 })).toBe(false);
    expect(isEmptyLayout({ ...EMPTY_LAYOUT, canvas: { widthMetres: 5, heightMetres: 5 } })).toBe(false);
    expect(layoutOf(EMPTY_SITE_PLAN)).toBe(EMPTY_LAYOUT);
  });
});
