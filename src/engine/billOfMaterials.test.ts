import { describe, it, expect } from 'vitest';
import { buildBillOfMaterials } from './billOfMaterials.ts';
import { calibrate, connectCamera, placeCamera, placeNvr, placeSwitch, setRoute, setRunOverride } from '../domain/sitePlanEdit.ts';
import { EMPTY_SITE_PLAN, type SitePlan } from '../domain/sitePlan.ts';
import { DEFAULT_ENVIRONMENT, defaultLocation, defaultProject, type Location, type Project } from '../domain/types.ts';

function loc(
  id: string,
  name: string,
  patch: { count: number; indoor?: boolean; purpose?: Location['purpose']; retention?: number; economyFixed?: boolean },
): Location {
  const l = defaultLocation(id, name);
  return {
    ...l,
    purpose: patch.purpose ?? l.purpose,
    environment: patch.indoor ? { ...DEFAULT_ENVIRONMENT, site: 'indoor', mountSurface: 'ceiling' } : l.environment,
    requirements: {
      ...l.requirements,
      cameraCount: patch.count,
      retentionDays: patch.retention ?? 30,
      ...(patch.economyFixed ? { budgetTier: 'economy' as const, lensPreference: 'fixed' as const } : {}),
    },
  };
}

/**
 * A realistic site: a gatehouse, a lobby, a warehouse and a perimeter, 18
 * cameras. Comms room at the west end of a 200 m × 100 m plan (1 px = 0.2 m).
 * The perimeter cameras go to an IDF switch at the east end, whose uplink is
 * 120 m (fibre); one of them is 95 m out (104 m installed: over the channel).
 * The warehouse is on the rack with drawn/estimated runs; the lobby is not
 * placed at all (placeholder runs).
 */
function realisticProject(): Project {
  const locations = [
    loc('gate', 'Main gate', { count: 2 }),
    loc('lobby', 'Lobby', { count: 4, indoor: true, retention: 14, economyFixed: true }),
    loc('wh', 'Warehouse', { count: 6, indoor: true, purpose: 'observe' }),
    loc('per', 'Perimeter', { count: 6, purpose: 'detect' }),
  ];
  let plan: SitePlan = calibrate(EMPTY_SITE_PLAN, { a: { x: 0, y: 0 }, b: { x: 1000, y: 0 }, metres: 200 });
  plan = placeNvr(plan, { x: 20, y: 250 }, 'Comms room');
  plan = placeSwitch(plan, { x: 900, y: 250 }, 'IDF east');
  plan = setRunOverride(plan, 'sw-1', 120);
  plan = placeCamera(plan, 'gate', 1, { x: 100, y: 450 });
  plan = placeCamera(plan, 'gate', 2, { x: 140, y: 450 });
  plan = setRoute(plan, 'cam-1', 'nvr-1', [{ x: 100, y: 250 }]);
  for (let i = 1; i <= 6; i++) plan = placeCamera(plan, 'wh', i, { x: 200 + 40 * i, y: 100 });
  for (let i = 1; i <= 6; i++) {
    plan = placeCamera(plan, 'per', i, { x: 880, y: 50 + 60 * i });
    const id = plan.devices.at(-1)!.id;
    plan = connectCamera(plan, id, 'sw-1');
    if (i === 6) plan = setRunOverride(plan, id, 95);
  }
  return { ...defaultProject(), name: 'Logistics depot', locations, activeLocationId: 'gate', sitePlan: plan };
}

describe('buildBillOfMaterials (N2) on a realistic multi-location project', () => {
  const project = realisticProject();
  const bom = buildBillOfMaterials(project);
  const design = bom.design;
  const of = (c: string) => bom.lines.filter((l) => l.category === c);
  const sum = (c: string) => of(c).reduce((s, l) => s + l.quantity, 0);

  it('is complete, and every product line carries its datasheet', () => {
    expect(bom.complete).toBe(true);
    expect(bom.incompleteReasons).toEqual([]);
    for (const l of bom.lines) {
      if (l.generic) {
        expect(l.datasheetUrl, l.id).toBeNull();
        expect(l.model, l.id).toBeNull();
      } else {
        expect(l.datasheetUrl, l.id).toMatch(/^https:\/\//);
        expect(l.verifiedOn, l.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(l.model, l.id).toBeTruthy();
      }
    }
    // Lines come out in a fixed category order.
    expect([...new Set(bom.lines.map((l) => l.category))]).toEqual(['camera', 'recorder', 'drive', 'switch', 'cable', 'connector', 'patch-cord', 'fibre']);
  });

  it('lists every camera model × quantity, matching the locations', () => {
    expect(sum('camera')).toBe(18); // 2 + 4 + 6 + 6
    expect(bom.totals.cameras).toBe(18);
    const lobby = bom.locations.find((l) => l.locationId === 'lobby')!;
    const lobbyLine = of('camera').find((l) => l.model === lobby.cameraModel)!;
    expect(lobbyLine.notes.join(' ')).toMatch(/Lobby/);
    // Two different models: the economy fixed-lens lobby is not the same camera.
    expect(of('camera').length).toBeGreaterThanOrEqual(2);
  });

  it('sizes storage exactly as a hand calculation does', () => {
    // 2×30 + 4×14 + 6×30 + 6×30 = 476 camera-days × 2355 kbps ÷ 8 × 86 400 s = 12.1066 TB;
    // × 1.20 headroom = 14.5279 TB; ÷ 0.95 formatting = 15.2925 TB usable needed.
    const kbps = design.instances[0]!.targetKbps;
    expect(design.instances.every((i) => i.targetKbps === kbps)).toBe(true);
    const tb = (476 * (kbps * 1000) / 8 * 86_400) / 1e12;
    expect(bom.totals.requiredUsableTb).toBeCloseTo((tb * 1.2) / 0.95, 9);
    expect(bom.totals.usableTb).toBeGreaterThanOrEqual(bom.totals.requiredUsableTb!);
  });

  it('lists one recorder and the drives that fit its bays', () => {
    expect(of('recorder')).toHaveLength(1);
    const plan = design.nvr!.primary!.evaluation.drivePlan;
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(of('drive')[0]).toMatchObject({ model: plan.config.drive.model, quantity: plan.config.totalDrives });
    expect(of('recorder')[0]!.notes.join(' ')).toMatch(/external PoE switch/);
  });

  it('lists the switches and which cameras land on each', () => {
    expect(sum('switch')).toBe(design.switches!.switchCount);
    expect(bom.totals.switches).toBe(2); // the rack + IDF east
    const notes = of('switch').flatMap((l) => l.notes).join(' ');
    expect(notes).toMatch(/IDF east: Perimeter #1, Perimeter #2, Perimeter #3, Perimeter #4, Perimeter #5, Perimeter #6\./);
    expect(notes).toMatch(/NVR rack: .*Lobby #1/);
  });

  it('counts CAT6 boxes by bin packing, plus connectors and patch cords per copper run', () => {
    const box = of('cable')[0]!;
    expect(box.quantity).toBe(design.cables!.packing.boxes.length);
    expect(box.quantity).toBeGreaterThanOrEqual(design.cables!.packing.naiveBoxCount);
    expect(box.isEstimate).toBe(true); // the lobby runs are placeholders
    // 18 camera runs on copper; the only uplink is fibre.
    expect(of('connector')[0]!.quantity).toBe(36);
    expect(of('patch-cord')[0]!.quantity).toBe(18);
  });

  it('lists the long uplink as flagged fibre, not CAT6', () => {
    const fibre = of('fibre');
    expect(fibre).toHaveLength(1);
    // 120 m typed + 2 × 3 m rack drops + 3 m loop = 129 m installed; × 1.10 waste = 141.9 m.
    expect(fibre[0]).toMatchObject({ unit: 'm', quantity: 141.9, flagged: true, generic: true });
    expect(fibre[0]!.notes[0]).toMatch(/129 m installed/);
  });

  it('carries every warning that applies', () => {
    const w = bom.warnings.join('\n');
    expect(w).toMatch(/4 camera\(s\) are not on the site plan/);
    expect(w).toMatch(/Perimeter #6: 104\.0 m — EXCEEDS the 100 m TIA-568 channel limit/);
    expect(w).toMatch(/IDF east uplink: 129\.0 m — an uplink over 90 m must be fibre/);
    expect(w).toMatch(/extend mode/);
  });
});

describe('buildBillOfMaterials (N2): never silently short', () => {
  it('marks the BOM incomplete when a location has no camera', () => {
    const p = realisticProject();
    const impossible: Location = {
      ...loc('far', 'Far fence', { count: 2 }),
      purpose: 'identify',
      geometry: { ...p.locations[0]!.geometry, targetDistanceMetres: 60, sceneWidthMetres: 30 },
    };
    const bom = buildBillOfMaterials({ ...p, locations: [...p.locations, impossible] });
    expect(bom.complete).toBe(false);
    expect(bom.incompleteReasons.join(' ')).toMatch(/No camera model satisfies: Far fence/);
    expect(bom.locations.find((l) => l.locationId === 'far')!.cameraModel).toBeNull();
    expect(bom.totals.cameras).toBe(18);
  });

  it('marks it incomplete when the storage fits no recorder', () => {
    const p = realisticProject();
    const huge = { ...p, locations: p.locations.map((l) => ({ ...l, requirements: { ...l.requirements, retentionDays: 3000 } })) };
    const bom = buildBillOfMaterials(huge);
    expect(bom.complete).toBe(false);
    expect(bom.lines.some((l) => l.category === 'drive')).toBe(false);
    expect(bom.incompleteReasons.join(' ')).toMatch(/Storage does not fit/);
  });

  it('flags an engineer-pinned recorder that fails a check', () => {
    const p = realisticProject();
    const pinned = { ...p, settings: { ...p.settings, recorder: { ...p.settings.recorder, pinnedNvrId: 'ds-7104ni-q1-4p' } } };
    const bom = buildBillOfMaterials(pinned);
    const rec = bom.lines.find((l) => l.category === 'recorder')!;
    expect(rec.flagged).toBe(true);
    expect(bom.complete).toBe(false);
    expect(bom.incompleteReasons.join(' ')).toMatch(/engineer-chosen recorder/);
  });
});
