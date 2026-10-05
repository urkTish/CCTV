import { describe, it, expect } from 'vitest';
import { siteMapView } from './siteMapView.ts';
import { recommendAll } from './projectDesign.ts';
import { calibrate, connectCamera, placeCamera, placeNvr, placeSwitch, setRoute, setRunOverride } from '../domain/sitePlanEdit.ts';
import { EMPTY_SITE_PLAN, type SitePlan } from '../domain/sitePlan.ts';
import { defaultLocation, defaultProject, type Project } from '../domain/types.ts';

const cal = { a: { x: 0, y: 0 }, b: { x: 300, y: 400 }, metres: 25 }; // 0.05 m/px

function project(plan: SitePlan): Project {
  const loc = defaultLocation('loc-1', 'Gate');
  return { ...defaultProject(), locations: [{ ...loc, requirements: { ...loc.requirements, cameraCount: 2 } }], sitePlan: plan };
}

function view(plan: SitePlan) {
  const p = project(plan);
  return siteMapView(p, recommendAll(p));
}

describe('site map view model', () => {
  it('lists unplaced cameras and warns when the NVR is missing', () => {
    const v = view(placeCamera(EMPTY_SITE_PLAN, 'loc-1', 1, { x: 10, y: 10 }));
    expect(v.unplaced.map((c) => c.label)).toEqual(['Gate #2']);
    expect(v.warnings.join(' ')).toMatch(/Place the NVR/);
    expect(v.warnings.join(' ')).toMatch(/not calibrated/);
  });

  it('draws a drawn route solid and an undrawn one as an estimated line', () => {
    let plan = calibrate(EMPTY_SITE_PLAN, cal);
    plan = placeNvr(plan, { x: 0, y: 0 });
    plan = placeCamera(plan, 'loc-1', 1, { x: 100, y: 0 });
    plan = placeCamera(plan, 'loc-1', 2, { x: 0, y: 100 });
    plan = setRoute(plan, 'cam-1', 'nvr-1', [{ x: 100, y: 50 }, { x: 0, y: 50 }]);
    const v = view(plan);
    expect(v.lines.map((l) => [l.kind, l.points.length])).toEqual([
      ['drawn', 4],
      ['estimated', 2],
    ]);
    const cam1 = v.devices.find((d) => d.device.id === 'cam-1')!;
    // 50 + 100 + 50 px = 200 px = 10 m, drawn → not an estimate.
    expect(cam1.run).toMatchObject({ basis: 'drawn', isEstimate: false });
    expect(cam1.run!.metres).toBeCloseTo(10, 9);
    expect(cam1.cone.length).toBeGreaterThan(2);
  });

  it('a typed length removes the estimated line, for cameras and switch uplinks', () => {
    let plan = calibrate(EMPTY_SITE_PLAN, cal);
    plan = placeNvr(plan, { x: 0, y: 0 });
    plan = placeSwitch(plan, { x: 500, y: 0 });
    plan = placeCamera(plan, 'loc-1', 1, { x: 500, y: 100 });
    plan = connectCamera(plan, 'cam-1', 'sw-1');
    plan = setRunOverride(plan, 'cam-1', 12);
    plan = setRunOverride(plan, 'sw-1', 140);
    const v = view(plan);
    expect(v.lines).toEqual([]);
    expect(v.devices.find((d) => d.device.id === 'sw-1')!.run).toMatchObject({ metres: 140, basis: 'entered', isEstimate: false });
    expect(v.endpoints.map((e) => e.label)).toEqual(['NVR / rack', 'Switch 1']);
  });

  it('draws no cone before calibration and says why', () => {
    const v = view(placeCamera(EMPTY_SITE_PLAN, 'loc-1', 1, { x: 10, y: 10 }));
    expect(v.devices[0]!.cone).toEqual([]);
    expect(v.devices[0]!.coneNote).toMatch(/Calibrate the scale/);
  });
});
