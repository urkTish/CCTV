import { describe, it, expect } from 'vitest';
import {
  evaluateSwitch,
  groupCameras,
  groupingInputsFromTopology,
  managementFor,
  planSwitches,
  selectSwitchesForGroup,
  RACK_GROUP_ID,
  type GroupingInput,
  type SwitchCamera,
  type SwitchCheckId,
  type SwitchGroup,
} from './switchEngine.ts';
import { buildTopology, type CameraInstance, type Topology } from './topology.ts';
import { poeSwitches, switchById } from '../data/products.ts';
import { cameras } from '../data/cameras.ts';
import { DEFAULT_DESIGN_SETTINGS, type SwitchSettings } from '../domain/designSettings.ts';
import { cameraKey } from '../domain/sitePlan.ts';
import { defaultProject } from '../domain/types.ts';

const SETTINGS: SwitchSettings = DEFAULT_DESIGN_SETTINGS.switches; // 25% PoE headroom, 20% spare ports, auto/auto

/** A 4 MP-class PoE camera: 6.5 W, 4 Mbps peak, 40 m installed run. */
function cam(n: number, patch: Partial<SwitchCamera> = {}): SwitchCamera {
  return {
    key: `loc-1#${String(n).padStart(2, '0')}`,
    label: `Camera ${n}`,
    poeStandard: '802.3af',
    drawWatts: 6.5,
    peakKbps: 4096,
    runMetres: 40,
    ...patch,
  };
}
const cams = (count: number, patch: Partial<SwitchCamera> = {}) => Array.from({ length: count }, (_, i) => cam(i + 1, patch));

function group(cameraList: readonly SwitchCamera[], patch: Partial<SwitchGroup> = {}): SwitchGroup {
  return { id: RACK_GROUP_ID, label: 'NVR rack', atRack: true, cameras: cameraList, uplinkMetres: null, ...patch };
}

const check = (
  modelId: string,
  cameraList: readonly SwitchCamera[],
  id: SwitchCheckId,
  opts: { group?: Partial<SwitchGroup>; settings?: Partial<SwitchSettings>; management?: 'managed' | 'unmanaged' } = {},
) => {
  const model = switchById(modelId);
  if (!model) throw new Error(`fixture ${modelId} missing`);
  const g = group(cameraList, opts.group);
  const c = evaluateSwitch(model, cameraList, g, { ...SETTINGS, ...opts.settings }, opts.management ?? 'unmanaged', 'any').checks.find(
    (x) => x.id === id,
  );
  if (!c) throw new Error(`check ${id} missing`);
  return c;
};

// ---------------------------------------------------------------------------

describe('grouping cameras per switch (J1)', () => {
  const rackInput = (n: number): GroupingInput => ({ camera: cam(n), switchId: null, switchLabel: null });
  const swInput = (n: number, id: string, label: string): GroupingInput => ({ camera: cam(n), switchId: id, switchLabel: label });

  it('with no site plan every camera is in one default rack group', () => {
    const groups = groupCameras([1, 2, 3].map(rackInput), new Map(), 'external');
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ id: RACK_GROUP_ID, label: 'NVR rack', atRack: true, uplinkMetres: null });
    expect(groups[0]!.cameras.map((c) => c.label)).toEqual(['Camera 1', 'Camera 2', 'Camera 3']);
  });

  it('one group per placed switch, carrying its label and uplink length', () => {
    const groups = groupCameras(
      [swInput(1, 'sw-a', 'IDF North'), rackInput(2), swInput(3, 'sw-a', 'IDF North'), swInput(4, 'sw-b', 'IDF South')],
      new Map([['sw-a', 72]]),
      'external',
    );
    const byId = new Map(groups.map((g) => [g.id, g]));
    expect([...byId.keys()].sort()).toEqual(['rack', 'sw-a', 'sw-b']);
    expect(byId.get('sw-a')).toMatchObject({ label: 'IDF North', atRack: false, uplinkMetres: 72 });
    expect(byId.get('sw-a')!.cameras.map((c) => c.label)).toEqual(['Camera 1', 'Camera 3']);
    // An unmeasured uplink stays null — never a silent zero.
    expect(byId.get('sw-b')!.uplinkMetres).toBeNull();
  });

  it('cameras cabled to the rack are left out when the recorder powers them (built-in PoE)', () => {
    const groups = groupCameras([rackInput(1), swInput(2, 'sw-a', 'IDF')], new Map(), 'built-in');
    expect(groups.map((g) => g.id)).toEqual(['sw-a']);
  });

  it('reads groups off the topology with INSTALLED run lengths, the same formula the cable plan uses', () => {
    const camera = cameras[0]!;
    const inst = (i: number): CameraInstance => ({
      key: cameraKey('loc-1', i),
      locationId: 'loc-1',
      locationName: 'Yard',
      index: i,
      label: `Yard #${i}`,
      camera,
      lensLabel: '4 mm',
      targetKbps: 2048,
      peakKbps: 4096,
      bitrateIsEstimate: false,
      poeStandard: '802.3at',
      poeDrawWatts: 9,
      megapixels: 4,
      mountHeightMetres: 4,
      retentionDays: 30,
      placed: null,
    });
    const topology: Topology = {
      links: [
        { instance: inst(1), endpoint: { kind: 'switch', switchId: 'sw-a', label: 'IDF' }, horizontalMetres: 50, basis: 'drawn', isEstimate: false, explanation: '' },
        { instance: inst(2), endpoint: { kind: 'nvr' }, horizontalMetres: 20, basis: 'estimated', isEstimate: true, explanation: '' },
      ],
      uplinks: [{ switchId: 'sw-a', label: 'IDF', horizontalMetres: 80, basis: 'drawn', isEstimate: false, explanation: '' }],
      warnings: [],
    };
    const { inputs, uplinkMetresBySwitch } = groupingInputsFromTopology(topology, DEFAULT_DESIGN_SETTINGS.cabling);
    // 50 m route + 4 m camera drop + 3 m rack drop + 3 m service loop = 60 m
    expect(inputs[0]).toMatchObject({ switchId: 'sw-a', switchLabel: 'IDF' });
    expect(inputs[0]!.camera).toMatchObject({ key: 'loc-1#1', poeStandard: '802.3at', drawWatts: 9, peakKbps: 4096, runMetres: 60 });
    expect(inputs[1]).toMatchObject({ switchId: null, switchLabel: null });
    expect(inputs[1]!.camera.runMetres).toBe(30);
    // Uplink: 80 m route + 2 × 3 m rack drops + 3 m loop = 89 m
    expect(uplinkMetresBySwitch.get('sw-a')).toBe(89);
  });

  it('end to end with no site plan: the topology puts every camera in the single rack group', () => {
    const project = defaultProject(); // empty site plan
    const camera = cameras[0]!;
    const instances: CameraInstance[] = [1, 2, 3].map((i) => ({
      key: cameraKey('loc-1', i),
      locationId: 'loc-1',
      locationName: 'Main gate',
      index: i,
      label: `Main gate #${i}`,
      camera,
      lensLabel: '4 mm',
      targetKbps: 2048,
      peakKbps: 4096,
      bitrateIsEstimate: false,
      poeStandard: camera.poeStandard,
      poeDrawWatts: camera.poeMaxWatts,
      megapixels: 2,
      mountHeightMetres: 3,
      retentionDays: 30,
      placed: null,
    }));
    const topology = buildTopology(project, instances);
    const { inputs, uplinkMetresBySwitch } = groupingInputsFromTopology(topology, project.settings.cabling);
    const groups = groupCameras(inputs, uplinkMetresBySwitch, 'external');
    expect(groups).toHaveLength(1);
    expect(groups[0]!.id).toBe(RACK_GROUP_ID);
    expect(groups[0]!.cameras).toHaveLength(3);
    // Placeholder horizontal run + 3 m drop + 3 m rack drop + 3 m loop.
    expect(groups[0]!.cameras[0]!.runMetres).toBe(project.settings.cabling.unplacedRunMetres + 9);
  });
});

// ---------------------------------------------------------------------------

describe('switch hard checks (J2), each with a failing case', () => {
  it('ports: cameras + 20% spare, rounded up', () => {
    // 6 cameras × 1.2 = 7.2 → 8 ports; 7 cameras → 8.4 → 9 ports
    expect(check('ds-3e0510p-e-m', cams(6), 'ports')).toMatchObject({ verdict: 'pass', required: '8 (6 cameras + 20% spare)', margin: '+0 ports' });
    expect(check('ds-3e0510p-e-m', cams(7), 'ports')).toMatchObject({ verdict: 'fail', margin: '−1 ports' });
    expect(check('ds-3e0518p-e-m', cams(7), 'ports')).toMatchObject({ verdict: 'pass', margin: '+7 ports' });
  });

  it('PoE budget: summed draw + 25% headroom', () => {
    // 7 × 6.5 W = 45.5 W × 1.25 = 56.875 W against 58 W
    expect(check('ds-3e0510p-e-m', cams(7), 'poe-budget')).toMatchObject({ verdict: 'pass', margin: '+1.1 W' });
    // 8 × 6.5 W = 52 W × 1.25 = 65 W against 58 W
    expect(check('ds-3e0510p-e-m', cams(8), 'poe-budget')).toMatchObject({ verdict: 'fail', margin: '−7.0 W' });
  });

  it('PoE budget: a camera with no published draw is counted at its standard’s PD maximum', () => {
    // 2 × 802.3at at 25.5 W = 51 W × 1.25 = 63.75 W > 58 W
    const c = check('ds-3e0510p-e-m', cams(2, { poeStandard: '802.3at', drawWatts: null }), 'poe-budget');
    expect(c.verdict).toBe('fail');
    expect(c.required).toMatch(/^63\.8 W \(51\.0 W draw/);
  });

  it('per-port standard: PTZ/heated (802.3bt) cameras need Hi-PoE ports', () => {
    const ptz = cam(9, { poeStandard: '802.3bt-type3', drawWatts: 40 });
    expect(check('ds-3e0510p-e-m', [cam(1), ptz], 'poe-standard')).toMatchObject({ verdict: 'fail', margin: '1 Hi-PoE port(s) short' });
    expect(check('ds-3e0505hp-e', [cam(1), ptz], 'poe-standard')).toMatchObject({ verdict: 'pass' });
    // Only one Hi-PoE port on that model.
    expect(check('ds-3e0505hp-e', [ptz, { ...ptz, key: 'ptz-2' }], 'poe-standard').verdict).toBe('fail');
  });

  it('per-port power: a camera drawing more than its port can give fails', () => {
    // 802.3bt Type 4 with no published draw → 71 W, over the 60 W Hi-PoE port.
    const big = cam(1, { poeStandard: '802.3bt-type4', drawWatts: null });
    expect(check('ds-3e0505hp-e', [big], 'port-power')).toMatchObject({ verdict: 'fail', margin: '1 camera(s) over the port limit' });
    expect(check('ds-3e0505hp-e', [cam(1, { poeStandard: '802.3bt-type3', drawWatts: 55 })], 'port-power').verdict).toBe('pass');
  });

  it('port speed: the highest camera peak must fit a Fast Ethernet port', () => {
    expect(check('ds-3e0318p-e-c', cams(2, { peakKbps: 16384 }), 'port-speed')).toMatchObject({ verdict: 'pass', margin: '+83.6 Mbps' });
    expect(check('ds-3e0318p-e-c', cams(1, { peakKbps: 120000 }), 'port-speed')).toMatchObject({ verdict: 'fail', margin: '−20.0 Mbps' });
  });

  it('uplink bandwidth: sum of camera peaks on that switch', () => {
    // 4 × 30 Mbps = 120 Mbps over a 100 Mbps uplink
    expect(check('ds-3e0105p-e-m-b', cams(4, { peakKbps: 30000 }), 'uplink-bandwidth')).toMatchObject({ verdict: 'fail', margin: '−20.0 Mbps' });
    expect(check('ds-3e0505p-e-m', cams(4, { peakKbps: 30000 }), 'uplink-bandwidth').verdict).toBe('pass');
  });

  it('uplink type: an uplink over 90 m needs an SFP (fibre) port; a stated preference is honoured', () => {
    const far = { group: { atRack: false, uplinkMetres: 120 } };
    expect(check('ds-3e0505p-e-m', cams(2), 'uplink-type', far)).toMatchObject({ verdict: 'fail', required: 'SFP fibre (uplink 120 m > 90 m)' });
    expect(check('ds-3e0510p-e-m', cams(2), 'uplink-type', far).verdict).toBe('pass');
    expect(check('ds-3e0505p-e-m', cams(2), 'uplink-type', { group: { atRack: false, uplinkMetres: 60 } }).verdict).toBe('pass');
    expect(check('ds-3e0518p-e-m', cams(2), 'uplink-type', { settings: { uplink: 'copper' } }).verdict).toBe('fail');
  });

  it('long-range PoE: runs over 100 m need an extend-mode port, its reach and its 10 Mbps speed', () => {
    const long = [cam(1, { runMetres: 150 }), cam(2)];
    // Datasheet gives both distance and speed: not an estimate.
    expect(check('ds-3e0326p-e-m-b', long, 'long-range')).toMatchObject({ verdict: 'pass', isEstimate: false });
    // Datasheet gives the distance only: the 10 Mbps figure is applied and flagged.
    expect(check('ds-3e1518p-si', long, 'long-range')).toMatchObject({ verdict: 'pass', isEstimate: true });
    // No extend mode at all.
    expect(check('ds-3e0518p-e-m', long, 'long-range')).toMatchObject({ verdict: 'fail', offered: 'no extend mode' });
    // A 16 Mbps camera cannot run over a 10 Mbps extend-mode link.
    expect(check('ds-3e0326p-e-m-b', [cam(1, { runMetres: 150, peakKbps: 16384 })], 'long-range').verdict).toBe('fail');
    // Beyond 300 m nothing reaches.
    expect(check('ds-3e0326p-e-m-b', [cam(1, { runMetres: 320 })], 'long-range').verdict).toBe('fail');
    // Runs within 100 m need nothing.
    expect(check('ds-3e0518p-e-m', [cam(1, { runMetres: 95 })], 'long-range')).toMatchObject({ verdict: 'pass', required: 'none' });
  });

  it('management: the model must match the managed/unmanaged requirement', () => {
    expect(check('ds-3e0518p-e-m', cams(2), 'management', { management: 'managed' }).verdict).toBe('fail');
    expect(check('ds-3e1518p-si', cams(2), 'management', { management: 'managed' }).verdict).toBe('pass');
    expect(check('ds-3e1518p-si', cams(2), 'management', { management: 'unmanaged' }).verdict).toBe('fail');
  });
});

describe('managed / unmanaged default rule (J3)', () => {
  it('unmanaged for ≤ 8 cameras on the economy tier, managed otherwise', () => {
    expect(managementFor(8, 'economy', 'auto').required).toBe('unmanaged');
    expect(managementFor(9, 'economy', 'auto').required).toBe('managed');
    expect(managementFor(4, 'standard', 'auto').required).toBe('managed');
    expect(managementFor(4, 'any', 'auto').required).toBe('managed');
  });

  it('an explicit preference wins over the default rule', () => {
    expect(managementFor(30, 'economy', 'unmanaged')).toMatchObject({ required: 'unmanaged', reason: 'Unmanaged, as chosen.' });
    expect(managementFor(2, 'economy', 'managed').required).toBe('managed');
  });
});

// ---------------------------------------------------------------------------

describe('switch selection (J3)', () => {
  it('six economy cameras at the rack: one small unmanaged switch, every camera listed on it', () => {
    const r = selectSwitchesForGroup(group(cams(6)), poeSwitches, SETTINGS, 'economy');
    expect(r.failure).toBeNull();
    expect(r.managementRequired).toBe('unmanaged');
    expect(r.switches).toHaveLength(1);
    const s = r.switches[0]!;
    expect(s.evaluation.model.id).toBe('ds-3e0510p-e-m');
    expect(s.evaluation.failed).toHaveLength(0);
    expect(s.cameras.map((c) => c.label)).toEqual(cams(6).map((c) => c.label));
    expect(s.why).toMatch(/8 ports for 6 camera\(s\)/);
    // Every model that fails is listed with a reason.
    expect(r.rejections.find((x) => x.model.id === 'ds-3e1510p-si')?.reasons.join(' ')).toMatch(/Management/);
  });

  it('more cameras than any single switch can take: splits evenly over the fewest managed switches', () => {
    // 30 cameras × 1.2 = 36 ports > 24, so at least 2 switches; 15 + 15 → 18 ports each.
    const r = selectSwitchesForGroup(group(cams(30)), poeSwitches, SETTINGS, 'economy');
    expect(r.managementRequired).toBe('managed');
    expect(r.switches).toHaveLength(2);
    expect(r.switches.map((s) => s.evaluation.model.id)).toEqual(['ds-3e1526p-ei', 'ds-3e1526p-ei']);
    expect(r.switches.map((s) => s.cameras.length)).toEqual([15, 15]);
    expect(r.switches.map((s) => s.id)).toEqual(['rack-1', 'rack-2']);
    expect(r.switches[0]!.groupLabel).toBe('NVR rack (1 of 2)');
    expect(r.switches[0]!.why).toMatch(/2 switches are needed/);
    // No camera lost or doubled.
    const keys = r.switches.flatMap((s) => s.cameras.map((c) => c.key)).sort();
    expect(keys).toEqual(cams(30).map((c) => c.key).sort());
  });

  it('a long run picks a switch with extend-mode ports and warns about the 10 Mbps link', () => {
    const r = selectSwitchesForGroup(group([cam(1, { runMetres: 160 }), ...cams(5).map((c, i) => ({ ...c, key: `k${i}` }))]), poeSwitches, SETTINGS, 'economy');
    expect(r.failure).toBeNull();
    const model = r.switches[0]!.evaluation.model;
    expect(model.longRangePorts).toBeGreaterThan(0);
    expect(r.warnings.join(' ')).toMatch(/extend mode/);
  });

  it('a PTZ on an economy job gets the Hi-PoE switch when unmanaged is allowed', () => {
    // 6.5 + 6.5 + 30 W = 43 W × 1.25 = 53.75 W, inside the 60 W budget.
    const ptz = cam(3, { poeStandard: '802.3bt-type3', drawWatts: 30 });
    const r = selectSwitchesForGroup(group([cam(1), cam(2), ptz]), poeSwitches, SETTINGS, 'economy');
    expect(r.switches.map((s) => s.evaluation.model.id)).toEqual(['ds-3e0505hp-e']);
  });

  it('over the Hi-PoE switch’s budget, the PTZ keeps the Hi-PoE port and the rest move to a second switch', () => {
    // 6.5 + 6.5 + 40 W = 53 W × 1.25 = 66.25 W > 60 W, so one switch cannot do it.
    const ptz = cam(3, { poeStandard: '802.3bt-type3', drawWatts: 40 });
    const r = selectSwitchesForGroup(group([cam(1), cam(2), ptz]), poeSwitches, SETTINGS, 'economy');
    expect(r.switches).toHaveLength(2);
    const withPtz = r.switches.find((s) => s.cameras.some((c) => c.key === ptz.key))!;
    expect(withPtz.evaluation.model.hiPoePorts).toBeGreaterThan(0);
    expect(r.switches.every((s) => s.evaluation.failed.length === 0)).toBe(true);
  });

  it('no model can serve the group: says so, with the nearest miss and fixes — never an empty success', () => {
    const r = selectSwitchesForGroup(group([cam(1, { runMetres: 400 })]), poeSwitches, SETTINGS, 'economy');
    expect(r.switches).toHaveLength(0);
    expect(r.failure?.message).toMatch(/No switch model/);
    expect(r.failure?.nearMiss).not.toBeNull();
    expect(r.failure?.fixes.join(' ')).toMatch(/extender/);
    expect(r.warnings.join(' ')).toMatch(/400 m is beyond any switch's reach/);
  });

  it('plans every group, skipping empty ones, and counts switches across them', () => {
    const plan = planSwitches(
      [
        group(cams(6)),
        group(cams(3).map((c) => ({ ...c, key: `n-${c.key}` })), { id: 'sw-n', label: 'IDF North', atRack: false, uplinkMetres: 40 }),
        group([], { id: 'sw-empty', label: 'Empty', atRack: false }),
      ],
      poeSwitches,
      SETTINGS,
      'economy',
    );
    expect(plan.groups.map((g) => g.group.id)).toEqual([RACK_GROUP_ID, 'sw-n']);
    expect(plan.switchCount).toBe(2);
    expect(plan.groups[1]!.switches[0]!.groupLabel).toBe('IDF North');
  });
});

