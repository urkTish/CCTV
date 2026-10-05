import { describe, it, expect } from 'vitest';
import {
  metresPerPixel,
  polylineLengthMetres,
  estimatedRouteMetres,
  horizontalRunBetween,
  SitePlanError,
  EMPTY_SITE_PLAN,
  type SitePlan,
  type PlacedCamera,
  type PlacedNvr,
} from './sitePlan.ts';

// A 3-4-5 triangle makes the arithmetic checkable by eye: a 500 px calibration
// line declared as 25 m gives exactly 0.05 m per pixel.
const cal = { a: { x: 0, y: 0 }, b: { x: 300, y: 400 }, metres: 25 };

describe('scale maths (K2)', () => {
  it('derives metres per pixel from a calibration line', () => {
    expect(metresPerPixel(cal)).toBeCloseTo(0.05, 12);
  });

  it('measures a polyline', () => {
    // 200 px right then 100 px down = 300 px = 15 m
    expect(polylineLengthMetres([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }], cal)).toBeCloseTo(15, 9);
  });

  it('estimates an undrawn route as straight line × routing factor', () => {
    // 500 px straight = 25 m; × 1.3 = 32.5 m
    expect(estimatedRouteMetres({ x: 0, y: 0 }, { x: 300, y: 400 }, cal, 1.3)).toBeCloseTo(32.5, 9);
  });

  it('refuses a degenerate calibration or a routing factor below 1', () => {
    expect(() => metresPerPixel({ ...cal, b: cal.a })).toThrow(SitePlanError);
    expect(() => metresPerPixel({ ...cal, metres: 0 })).toThrow(SitePlanError);
    expect(() => estimatedRouteMetres(cal.a, cal.b, cal, 0.9)).toThrow(SitePlanError);
  });
});

describe('run between two placed devices', () => {
  const cam: PlacedCamera = { kind: 'camera', id: 'c1', locationId: 'loc-1', index: 1, x: 0, y: 0, rotationDeg: 0, connectTo: null, runMetresOverride: null };
  const nvr: PlacedNvr = { kind: 'nvr', id: 'n1', label: 'Rack', x: 300, y: 400 };
  const plan: SitePlan = { ...EMPTY_SITE_PLAN, calibration: cal, devices: [cam, nvr] };

  it('uses the drawn route when there is one, in either direction', () => {
    const drawn: SitePlan = { ...plan, routes: [{ id: 'r1', fromId: 'n1', toId: 'c1', waypoints: [{ x: 300, y: 0 }] }] };
    const run = horizontalRunBetween(drawn, cam, nvr, 1.3);
    // c1 → (300,0) → n1 = 300 + 400 px = 700 px = 35 m
    expect(run.basis).toBe('drawn');
    expect(run.metres).toBeCloseTo(35, 9);
  });

  it('falls back to the flagged estimate', () => {
    const run = horizontalRunBetween(plan, cam, nvr, 1.3);
    expect(run.basis).toBe('estimated');
    expect(run.metres).toBeCloseTo(32.5, 9);
    expect(run.explanation).toMatch(/Estimated route/);
  });

  it('gives no distance at all on an uncalibrated plan', () => {
    const run = horizontalRunBetween({ ...plan, calibration: null }, cam, nvr, 1.3);
    expect(run.metres).toBeNull();
    expect(run.basis).toBe('uncalibrated');
  });
});
