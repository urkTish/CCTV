import { describe, it, expect } from 'vitest';
import { decidePoeMode, designProject, projectBudgetTier, projectRecorderAnalytics, recommendAll } from './projectDesign.ts';
import { buildTopology, expandCameras } from './topology.ts';
import { DEFAULT_DESIGN_SETTINGS } from '../domain/designSettings.ts';
import { calibrate, connectCamera, placeCamera, placeNvr, placeSwitch, setRunOverride } from '../domain/sitePlanEdit.ts';
import { EMPTY_SITE_PLAN } from '../domain/sitePlan.ts';
import { defaultLocation, defaultProject, type Location, type Project } from '../domain/types.ts';

function loc(id: string, name: string, cameraCount: number, patch: Partial<Location['requirements']> = {}): Location {
  const l = defaultLocation(id, name);
  return { ...l, requirements: { ...l.requirements, cameraCount, ...patch } };
}

function project(locations: Location[], patch: Partial<Project> = {}): Project {
  return { ...defaultProject(), locations, activeLocationId: locations[0]!.id, ...patch };
}

function poe(p: Project) {
  const { instances } = expandCameras(p, recommendAll(p));
  return decidePoeMode(p, buildTopology(p, instances), instances.length);
}

describe('PoE mode, brief default rule', () => {
  it('built-in when ≤ 16 channels and every run is within 90 m of cable', () => {
    // 4 cameras + 25 % = 5 channels; unplaced → 40 m + 3 + 3 + 3 = 49 m installed.
    const d = poe(project([loc('loc-1', 'Gate', 4)]));
    expect(d.mode).toBe('built-in');
    expect(d.reason).toMatch(/5 channels \(≤ 16\).*longest 49\.0 m/);
    expect(d.reason).toMatch(/estimates/);
  });

  it('external when more than 16 channels are needed', () => {
    // 13 cameras + 25 % = 16.25 → 17 channels.
    expect(poe(project([loc('loc-1', 'Gate', 13)])).reason).toMatch(/17 channels needed \(more than 16\)/);
  });

  it('external when a run is over 90 m of cable', () => {
    let plan = placeNvr(EMPTY_SITE_PLAN, { x: 0, y: 0 });
    plan = placeCamera(plan, 'loc-1', 1, { x: 10, y: 10 });
    plan = setRunOverride(plan, 'cam-1', 85); // 85 + 3 + 3 + 3 = 94 m installed
    const d = poe(project([loc('loc-1', 'Gate', 1)], { sitePlan: plan }));
    expect(d.mode).toBe('external');
    expect(d.reason).toMatch(/94\.0 m of cable from the NVR/);
  });

  it('external when a camera is cabled to a switch on the plan; an explicit choice always wins', () => {
    let plan = placeNvr(EMPTY_SITE_PLAN, { x: 0, y: 0 });
    plan = placeSwitch(plan, { x: 5, y: 5 });
    plan = placeCamera(plan, 'loc-1', 1, { x: 10, y: 10 });
    plan = connectCamera(plan, 'cam-1', 'sw-1');
    const p = project([loc('loc-1', 'Gate', 1)], { sitePlan: plan });
    expect(poe(p).reason).toMatch(/cabled to a switch/);
    const forced = { ...p, settings: { ...p.settings, recorder: { ...p.settings.recorder, poeMode: 'built-in' as const } } };
    expect(poe(forced).mode).toBe('built-in');
  });
});

describe('project-wide inputs', () => {
  it('uses the single budget tier when every location agrees, otherwise any', () => {
    expect(projectBudgetTier(project([loc('a', 'A', 1, { budgetTier: 'economy' }), loc('b', 'B', 1, { budgetTier: 'economy' })]))).toBe('economy');
    expect(projectBudgetTier(project([loc('a', 'A', 1, { budgetTier: 'economy' }), loc('b', 'B', 1, { budgetTier: 'premium' })]))).toBe('any');
  });

  it('inherits recorder analytics from the cameras unless set explicitly', () => {
    const p = project([loc('a', 'A', 1, { requiredCapabilities: ['anpr'] }), loc('b', 'B', 1, { requiredCapabilities: ['face-capture'] })]);
    expect(projectRecorderAnalytics(p, new Set(['a', 'b']))).toEqual(['anpr', 'face-recognition']);
    // An unresolved location's analytics are not inherited.
    expect(projectRecorderAnalytics(p, new Set(['a']))).toEqual(['anpr']);
    const explicit = { ...p, settings: { ...p.settings, recorder: { ...p.settings.recorder, analytics: [] } } };
    expect(projectRecorderAnalytics(explicit, new Set(['a', 'b']))).toEqual([]);
  });
});

describe('designProject (N1)', () => {
  it('chains storage → recorder → switches → cables on the default project', () => {
    const d = designProject(defaultProject());
    expect(d.errors).toEqual([]);
    expect(d.instances).toHaveLength(1);
    expect(d.storage!.requiredUsableTb).toBeGreaterThan(0);
    expect(d.nvr!.primary).not.toBeNull();
    expect(d.nvr!.primary!.evaluation.drivePlan.ok).toBe(true);
    // One camera, 49 m placeholder run → built-in PoE, so no switch group.
    expect(d.poeMode.mode).toBe('built-in');
    expect(d.switches!.switchCount).toBe(0);
    expect(d.cables!.runs).toHaveLength(1);
    expect(d.cables!.packing.boxes).toHaveLength(1);
    expect(d.warnings.join(' ')).toMatch(/placeholder/);
  });

  it('reports a bad setting as an error and still runs the other stages', () => {
    const p = defaultProject();
    const bad = { ...p, settings: { ...p.settings, cabling: { ...p.settings.cabling, boxMetres: 0 } } };
    const d = designProject(bad);
    expect(d.errors.join(' ')).toMatch(/Cabling: Box length must be positive/);
    expect(d.cables).toBeNull();
    expect(d.nvr!.primary).not.toBeNull();
  });

  it('sends a long uplink to fibre and the long camera run to the switch, never silently', () => {
    let plan = calibrate(EMPTY_SITE_PLAN, { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, metres: 10 });
    plan = placeNvr(plan, { x: 0, y: 0 });
    plan = placeSwitch(plan, { x: 900, y: 0 });
    plan = setRunOverride(plan, 'sw-1', 120);
    for (let i = 1; i <= 3; i++) {
      plan = placeCamera(plan, 'loc-1', i, { x: 900, y: 100 * i });
      plan = connectCamera(plan, `cam-${i}`, 'sw-1');
    }
    plan = setRunOverride(plan, 'cam-3', 95); // 95 + 3 + 3 + 3 = 104 m: over the channel
    const d = designProject(project([loc('loc-1', 'Yard', 3)], { sitePlan: plan }));
    expect(d.cables!.fibreUplinks.map((f) => f.label)).toEqual(['Switch 1 uplink']);
    expect(d.cables!.over100.map((r) => r.label)).toEqual(['Yard #3']);
    expect(d.warnings.some((w) => /Yard #3: 104\.0 m — EXCEEDS/.test(w))).toBe(true);
    expect(d.switches!.groups[0]!.group.uplinkMetres).toBe(129); // 120 + 2 × 3 + 3
  });

  it('defaults are what the brief says', () => {
    expect(DEFAULT_DESIGN_SETTINGS.recorder.channelHeadroomPercent).toBe(25);
    expect(DEFAULT_DESIGN_SETTINGS.switches.poeHeadroomPercent).toBe(25);
    expect(DEFAULT_DESIGN_SETTINGS.storage.headroomPercent).toBe(20);
  });
});
