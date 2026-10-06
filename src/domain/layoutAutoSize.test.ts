/**
 * "Draw a new layout" from the place's size: the automatic canvas, grid and
 * margin rule, the generated building outline and label, growing the canvas
 * later without moving anything relative to anything else, and fitting the
 * canvas to shapes drawn past its edge (ASSUMPTIONS 13.11–13.14).
 */

import { describe, it, expect } from 'vitest';
import {
  AUTO_GRID_STEPS,
  LAYOUT_PX_PER_METRE,
  addShape,
  autoCanvasForPlace,
  autoGridMetres,
  canvasCalibration,
  ceilToStep,
  extendLayoutCanvas,
  fitCanvasToShapes,
  layoutOf,
  layoutOverflowMetres,
  placeLabelFit,
  setLayoutCanvas,
  shapeBounds,
  siteLayoutSchema,
  startLayoutFromPlace,
  type RectShape,
  type TextShape,
} from './layoutShapes.ts';
import { EMPTY_SITE_PLAN, SitePlanError, distancePx, horizontalRunBetween, metresPerPixel, type SitePlan } from './sitePlan.ts';
import { canvasSize, placeCamera, placeNvr, replaceImage, setRoute } from './sitePlanEdit.ts';
import { parseProjectFile, serializeProjectFile } from '../state/projectFile.ts';
import { defaultProject } from '../state/projectTypes.ts';

describe('automatic canvas from the place size', () => {
  it('10 × 6 m → 20 × 16 m canvas, 1 m grid, 5 m margin', () => {
    expect(autoCanvasForPlace(10, 6)).toEqual({ canvas: { widthMetres: 20, heightMetres: 16 }, gridMetres: 1, marginMetres: 5 });
  });

  it('3 × 3 m → 13 × 13 m canvas, 0.5 m grid (the 5 m minimum margin)', () => {
    expect(autoCanvasForPlace(3, 3)).toEqual({ canvas: { widthMetres: 13, heightMetres: 13 }, gridMetres: 0.5, marginMetres: 5 });
  });

  it('120 × 80 m → 240 × 200 m canvas, 5 m grid, 60 m margin (50% of the longer side)', () => {
    expect(autoCanvasForPlace(120, 80)).toEqual({ canvas: { widthMetres: 240, heightMetres: 200 }, gridMetres: 5, marginMetres: 60 });
  });

  it('rounds the margin and each canvas side up to whole grid squares', () => {
    // 10.3 m: margin max(5, 5.15) → 6 m; width 10.3 + 12 = 22.3 → 23 m; depth 4.2 + 12 = 16.2 → 17 m.
    expect(autoCanvasForPlace(10.3, 4.2)).toEqual({ canvas: { widthMetres: 23, heightMetres: 17 }, gridMetres: 1, marginMetres: 6 });
    // 45 × 12 m on a 2 m grid: margin 22.5 → 24 m; 45 + 48 = 93 → 94 m; 12 + 48 = 60 m.
    expect(autoCanvasForPlace(45, 12)).toEqual({ canvas: { widthMetres: 94, heightMetres: 60 }, gridMetres: 2, marginMetres: 24 });
    for (const [w, d] of [
      [1, 1],
      [7.7, 2.1],
      [33, 81],
      [199, 3],
      [500, 500],
    ] as const) {
      const a = autoCanvasForPlace(w, d);
      const squares = (m: number) => m / a.gridMetres;
      expect(Number.isInteger(Math.round(squares(a.canvas.widthMetres) * 1e6) / 1e6)).toBe(true);
      expect(Number.isInteger(Math.round(squares(a.canvas.heightMetres) * 1e6) / 1e6)).toBe(true);
      // Room on every side for at least the margin rule.
      expect(a.canvas.widthMetres - w).toBeGreaterThanOrEqual(2 * Math.max(5, 0.5 * Math.max(w, d)) - 1e-9);
      expect(a.canvas.heightMetres - d).toBeGreaterThanOrEqual(2 * Math.max(5, 0.5 * Math.max(w, d)) - 1e-9);
      expect(a.canvas.widthMetres).toBeLessThanOrEqual(1000);
    }
  });

  it('grid square by the longer side: 0.5 / 1 / 2 / 5 / 10 m', () => {
    expect([1, 5, 5.01, 30, 30.5, 80, 81, 200, 201, 500].map(autoGridMetres)).toEqual([0.5, 0.5, 1, 1, 2, 2, 5, 5, 10, 10]);
    expect(AUTO_GRID_STEPS.map((s) => s.gridMetres)).toEqual([0.5, 1, 2, 5, 10]);
    // The grid stays readable: 15–100 squares along the longer canvas side for any allowed place.
    for (const L of [1, 3, 5, 5.01, 6, 10, 30, 31, 80, 81, 200, 201, 500]) {
      const a = autoCanvasForPlace(L, L);
      const n = a.canvas.widthMetres / a.gridMetres;
      expect(n).toBeGreaterThanOrEqual(15);
      expect(n).toBeLessThanOrEqual(100);
    }
  });

  it('refuses a place outside 1–500 m with a clear reason', () => {
    expect(() => autoCanvasForPlace(0.5, 6)).toThrow(/place width must be between 1 and 500 m/);
    expect(() => autoCanvasForPlace(10, 501)).toThrow(/place depth must be between 1 and 500 m/);
    expect(() => autoCanvasForPlace(Number.NaN, 6)).toThrow(SitePlanError);
  });

  it('ceilToStep tolerates float noise', () => {
    expect(ceilToStep(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(ceilToStep(5, 0.5)).toBe(5);
    expect(ceilToStep(5.01, 0.5)).toBe(5.5);
  });
});

describe('start a layout from the place', () => {
  it('draws the place centred as a closed building rectangle with its name, and sets the scale', () => {
    const r = startLayoutFromPlace(EMPTY_SITE_PLAN, { widthMetres: 10, depthMetres: 6, name: '  Workshop ' });
    const layout = layoutOf(r.plan);
    expect(layout.canvas).toEqual({ widthMetres: 20, heightMetres: 16 });
    expect(layout.gridMetres).toBe(1);
    expect(canvasSize(r.plan)).toEqual({ widthPx: 400, heightPx: 320 });
    expect(r.plan.calibration).toEqual(canvasCalibration({ widthMetres: 20, heightMetres: 16 }));
    expect(metresPerPixel(r.plan.calibration!)).toBe(1 / LAYOUT_PX_PER_METRE);
    expect(layout.shapes).toHaveLength(2);
    const [place, label] = layout.shapes as [RectShape, TextShape];
    expect(place).toEqual({ kind: 'rect', id: r.placeId, cx: 200, cy: 160, width: 200, height: 120, rotationDeg: 0, stroke: 'wall', fill: 'building' });
    // 5 m (100 px) of margin on every side.
    const b = shapeBounds(place, 0.05);
    expect([b.minX, b.minY, 400 - b.maxX, 320 - b.maxY]).toEqual([100, 100, 100, 100]);
    expect(label).toMatchObject({ kind: 'text', id: r.labelId, x: 200, y: 160, text: 'Workshop', rotationDeg: 0 });
    // The label fits inside the place.
    const lb = shapeBounds(label, 0.05);
    expect(lb.minX).toBeGreaterThanOrEqual(b.minX);
    expect(lb.maxX).toBeLessThanOrEqual(b.maxX);
    expect(siteLayoutSchema.safeParse(layout).success).toBe(true);
  });

  it('names the place "Building" when no name is given', () => {
    const r = startLayoutFromPlace(EMPTY_SITE_PLAN, { widthMetres: 3, depthMetres: 3 });
    expect((layoutOf(r.plan).shapes[1] as TextShape).text).toBe('Building');
    expect(startLayoutFromPlace(EMPTY_SITE_PLAN, { widthMetres: 3, depthMetres: 3, name: '   ' }).plan.layout!.shapes[1]).toMatchObject({ text: 'Building' });
  });

  it('120 × 80 m: 4800 × 4000 px canvas, place 2400 × 1600 px centred', () => {
    const r = startLayoutFromPlace(EMPTY_SITE_PLAN, { widthMetres: 120, depthMetres: 80 });
    expect(canvasSize(r.plan)).toEqual({ widthPx: 4800, heightPx: 4000 });
    expect(layoutOf(r.plan).shapes[0]).toMatchObject({ cx: 2400, cy: 2000, width: 2400, height: 1600 });
  });

  it('keeps devices (pulled inside the canvas) and existing shapes, with fresh ids', () => {
    let plan = placeNvr(EMPTY_SITE_PLAN, { x: 900, y: 650 });
    plan = addShape(plan, { kind: 'text', id: 'x', x: 10, y: 10, text: 'Old', sizePx: 10, rotationDeg: 0 }).plan;
    const r = startLayoutFromPlace(plan, { widthMetres: 10, depthMetres: 6 });
    expect(r.plan.devices[0]).toMatchObject({ x: 400, y: 320 });
    expect(layoutOf(r.plan).shapes.map((s) => s.id)).toEqual(['label-1', r.placeId, r.labelId]);
    expect(r.labelId).toBe('label-2');
  });

  it('is refused while a plan image is loaded, and for a bad size', () => {
    const withImage = replaceImage(EMPTY_SITE_PLAN, { dataUri: 'data:image/png;base64,AA==', widthPx: 10, heightPx: 10, fileName: 'p.png' });
    expect(() => startLayoutFromPlace(withImage, { widthMetres: 10, depthMetres: 6 })).toThrow(/plan image is loaded/);
    expect(() => startLayoutFromPlace(EMPTY_SITE_PLAN, { widthMetres: 0, depthMetres: 6 })).toThrow(SitePlanError);
  });

  it('label: shrinks to fit a narrow place, or sits above it when it would be too small', () => {
    const inside = placeLabelFit('Building', 200, 120, 400, 320, 160);
    expect(inside).toEqual({ sizePx: 10.8, y: 160 });
    // A short, wide place: the height limits it (45% of 40 px = 18 px).
    expect(placeLabelFit('Shed', 600, 40, 1200, 640, 320)).toEqual({ sizePx: 18, y: 320 });
    // A long name in a 1 m wide place: usual size, just above the place.
    const above = placeLabelFit('Pump house and generator room', 20, 20, 220, 220, 110);
    expect(above.sizePx).toBe(3.96);
    expect(above.y).toBeLessThan(100);
  });

  it('saves and reopens through the project file unchanged (no schema change)', () => {
    const p = defaultProject();
    const project = { ...p, sitePlan: startLayoutFromPlace(p.sitePlan, { widthMetres: 10, depthMetres: 6, name: 'Shop' }).plan };
    const text = serializeProjectFile(project, 'metric');
    const result = parseProjectFile(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.opened.project.sitePlan).toEqual(project.sitePlan);
    expect(serializeProjectFile(result.opened.project, 'metric')).toBe(text);
  });
});

describe('extend the canvas later', () => {
  function drawn(): SitePlan {
    let plan = startLayoutFromPlace(EMPTY_SITE_PLAN, { widthMetres: 10, depthMetres: 6 }).plan;
    plan = placeNvr(plan, { x: 200, y: 160 });
    plan = placeCamera(plan, 'loc-1', 1, { x: 20, y: 20 });
    plan = setRoute(plan, 'cam-1', 'nvr-1', [{ x: 20, y: 160 }]);
    return plan;
  }

  it('adds metres on the left and top by moving everything together', () => {
    const before = drawn();
    const after = extendLayoutCanvas(before, { left: 5, right: 0, top: 2, bottom: 3 });
    expect(layoutOf(after).canvas).toEqual({ widthMetres: 25, heightMetres: 21 });
    expect(after.calibration).toEqual(canvasCalibration({ widthMetres: 25, heightMetres: 21 }));
    // Everything moved by (100, 40) px.
    expect(layoutOf(after).shapes[0]).toMatchObject({ cx: 300, cy: 200 });
    expect(layoutOf(after).shapes[1]).toMatchObject({ x: 300, y: 200 });
    expect(after.devices.map((d) => [d.x, d.y])).toEqual([
      [300, 200],
      [120, 60],
    ]);
    expect(after.routes[0]!.waypoints).toEqual([{ x: 120, y: 200 }]);
    // Distances and the cable run are unchanged.
    const cam = (p: SitePlan) => p.devices.find((d) => d.kind === 'camera')!;
    const nvr = (p: SitePlan) => p.devices.find((d) => d.kind === 'nvr')!;
    expect(distancePx(cam(after), nvr(after))).toBe(distancePx(cam(before), nvr(before)));
    expect(horizontalRunBetween(after, cam(after), nvr(after), 1.3)).toEqual(horizontalRunBetween(before, cam(before), nvr(before), 1.3));
  });

  it('adding only on the right and bottom moves nothing', () => {
    const before = drawn();
    const after = extendLayoutCanvas(before, { left: 0, right: 10, top: 0, bottom: 10 });
    expect(after.devices).toEqual(before.devices);
    expect(layoutOf(after).shapes).toEqual(layoutOf(before).shapes);
    expect(canvasSize(after)).toEqual({ widthPx: 600, heightPx: 520 });
  });

  it('keeps a hand-set calibration, moved with the drawing', () => {
    const plan = { ...drawn(), calibration: { a: { x: 10, y: 10 }, b: { x: 110, y: 10 }, metres: 4 } };
    const after = extendLayoutCanvas(plan, { left: 1, right: 0, top: 1, bottom: 0 });
    expect(after.calibration).toEqual({ a: { x: 30, y: 30 }, b: { x: 130, y: 30 }, metres: 4 });
  });

  it('refuses with no blank canvas, past 1000 m, or with a bad number; zero is no change', () => {
    expect(() => extendLayoutCanvas(EMPTY_SITE_PLAN, { left: 1, right: 0, top: 0, bottom: 0 })).toThrow(/no blank drawn layout/);
    const plan = drawn();
    expect(() => extendLayoutCanvas(plan, { left: 990, right: 0, top: 0, bottom: 0 })).toThrow(/between 2 and 1000 m/);
    expect(() => extendLayoutCanvas(plan, { left: Number.NaN, right: 0, top: 0, bottom: 0 })).toThrow(SitePlanError);
    expect(extendLayoutCanvas(plan, { left: 0, right: 0, top: 0, bottom: 0 })).toBe(plan);
  });

  it('finds shapes drawn past the edge and fits the canvas to them (plus one grid square)', () => {
    let plan = startLayoutFromPlace(EMPTY_SITE_PLAN, { widthMetres: 10, depthMetres: 6 }).plan;
    expect(layoutOverflowMetres(plan)).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
    expect(fitCanvasToShapes(plan)).toBe(plan);
    // A fence from 2 m left of the canvas to 3.5 m past its right edge.
    plan = addShape(plan, { kind: 'polyline', id: 'x', points: [{ x: -40, y: 10 }, { x: 470, y: 10 }], closed: false, stroke: 'fence', fill: 'none' }).plan;
    expect(layoutOverflowMetres(plan)).toEqual({ left: 2, right: 3.5, top: 0, bottom: 0 });
    const fitted = fitCanvasToShapes(plan);
    // left 2 → 2 + 1 = 3 m; right 3.5 → 4 + 1 = 5 m.
    expect(layoutOf(fitted).canvas).toEqual({ widthMetres: 28, heightMetres: 16 });
    expect(layoutOverflowMetres(fitted)).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
    expect(layoutOf(fitted).shapes[0]).toMatchObject({ cx: 260, cy: 160 });
  });

  it('a canvas set by hand (Advanced) still works as before', () => {
    const plan = setLayoutCanvas(startLayoutFromPlace(EMPTY_SITE_PLAN, { widthMetres: 10, depthMetres: 6 }).plan, 30, 20);
    expect(canvasSize(plan)).toEqual({ widthPx: 600, heightPx: 400 });
    expect(layoutOf(plan).shapes[0]).toMatchObject({ cx: 200, cy: 160 });
  });
});
