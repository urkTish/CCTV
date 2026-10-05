/**
 * Section status and the project-wide warning list (U4, U5): pure functions
 * over what the engine already produced.
 */

import { describe, it, expect } from 'vitest';

import { buildBillOfMaterials } from '../../engine/billOfMaterials.ts';
import { designProject, recommendAll } from '../../engine/projectDesign.ts';
import { siteMapView } from '../../engine/siteMapView.ts';
import { defaultLocation, defaultProject, DEFAULT_GEOMETRY, type Project } from '../../state/projectTypes.ts';
import { collectWarnings, sectionStatuses, SECTIONS, type StatusInputs } from './sections.ts';

function inputs(project: Project, extra: Partial<StatusInputs> = {}): StatusInputs {
  const results = recommendAll(project);
  return {
    project,
    results,
    design: designProject(project, undefined, results),
    mapView: siteMapView(project, results),
    bom: buildBillOfMaterials(project),
    reportFinal: false,
    assumedByLocation: new Map(),
    ...extra,
  };
}

describe('workflow sections', () => {
  it('follow the brief’s order: overview, map, locations, recording, network, cabling, BOM, report', () => {
    expect(SECTIONS.map((s) => s.id)).toEqual(['overview', 'map', 'locations', 'recording', 'network', 'cabling', 'bom', 'report']);
  });
});

describe('collectWarnings', () => {
  it('includes every design warning and error, each routed to a section', () => {
    const p = defaultProject();
    const i = inputs(p);
    const w = collectWarnings(i);
    for (const dw of i.design.warnings) expect(w.some((x) => x.text === dw)).toBe(true);
    for (const x of w) expect(['overview', 'map', 'locations', 'recording', 'network', 'cabling', 'bom', 'report']).toContain(x.section);
  });

  it('routes a location’s calculation warnings to that location', () => {
    const p = defaultProject();
    const i = inputs(p);
    const calcWarnings = i.results.get('loc-1')!.primary!.calculation.warnings;
    const w = collectWarnings(i).filter((x) => x.locationId === 'loc-1' && x.id.startsWith('loc-warn'));
    expect(w.map((x) => x.text)).toEqual(calcWarnings.map((t) => `Main gate: ${t}`));
  });

  it('marks a location with no model as blocked, linked to that location', () => {
    const p: Project = {
      ...defaultProject(),
      locations: [
        { ...defaultLocation('loc-1', 'Far gate'), purpose: 'identify', geometry: { ...DEFAULT_GEOMETRY, targetDistanceMetres: 60, sceneWidthMetres: 30 } },
      ],
    };
    const w = collectWarnings(inputs(p));
    const none = w.find((x) => x.id === 'loc-none-loc-1');
    expect(none?.severity).toBe('blocked');
    expect(none?.section).toBe('locations');
    expect(none?.locationId).toBe('loc-1');
  });

  it('lists intake values still to confirm per location', () => {
    const p = defaultProject();
    const w = collectWarnings(inputs(p, { assumedByLocation: new Map([['loc-1', 4]]) }));
    expect(w.find((x) => x.id === 'loc-assumed-loc-1')?.text).toMatch(/4 values assumed from the client intake/);
  });

  it('never repeats a warning', () => {
    const w = collectWarnings(inputs(defaultProject()));
    const keys = w.map((x) => `${x.section}|${x.locationId ?? ''}|${x.text}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('sectionStatuses', () => {
  it('a fresh project: no map yet, recorder chosen, draft report', () => {
    const i = inputs(defaultProject());
    const s = sectionStatuses(i, collectWarnings(i));
    expect(s.map).toEqual({ kind: 'not-started', text: 'No plan yet' });
    expect(s.recording.kind).toBe('complete');
    expect(s.recording.text).toBe(i.design.nvr!.primary!.evaluation.nvr.model);
    expect(s.report).toEqual({ kind: 'in-progress', text: 'Draft' });
    expect(s.bom.kind).toBe(i.bom.complete ? 'complete' : 'blocked');
  });

  it('a location without a model blocks Locations and says how many', () => {
    const p: Project = {
      ...defaultProject(),
      locations: [
        defaultLocation('loc-1', 'Gate'),
        { ...defaultLocation('loc-2', 'Far'), purpose: 'identify', geometry: { ...DEFAULT_GEOMETRY, targetDistanceMetres: 60, sceneWidthMetres: 30 } },
      ],
    };
    const i = inputs(p);
    expect(sectionStatuses(i, collectWarnings(i)).locations).toEqual({ kind: 'blocked', text: '1 without a camera' });
  });

  it('an uncalibrated plan needs attention; calibrated, with the NVR and every camera placed, it is complete', () => {
    const p = defaultProject();
    const devices: Project['sitePlan']['devices'] = [
      { kind: 'nvr', id: 'nvr-1', label: 'Rack', x: 10, y: 10 },
      { kind: 'camera', id: 'cam-1', locationId: 'loc-1', index: 1, x: 100, y: 100, rotationDeg: 0, connectTo: null, runMetresOverride: 20 },
    ];
    const uncalibrated = inputs({ ...p, sitePlan: { ...p.sitePlan, devices } });
    expect(sectionStatuses(uncalibrated, collectWarnings(uncalibrated)).map.kind).toBe('attention');
    const placed: Project = {
      ...p,
      sitePlan: {
        ...p.sitePlan,
        calibration: { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, metres: 10 },
        devices: [
          { kind: 'nvr', id: 'nvr-1', label: 'Rack', x: 10, y: 10 },
          { kind: 'camera', id: 'cam-1', locationId: 'loc-1', index: 1, x: 100, y: 100, rotationDeg: 0, connectTo: null, runMetresOverride: 20 },
        ],
      },
    };
    const i = inputs(placed);
    expect(sectionStatuses(i, collectWarnings(i)).map.kind).toBe('complete');
  });

  it('a final report is complete', () => {
    const i = inputs(defaultProject(), { reportFinal: true });
    expect(sectionStatuses(i, collectWarnings(i)).report).toEqual({ kind: 'complete', text: 'Final' });
  });
});
