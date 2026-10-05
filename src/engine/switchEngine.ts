/**
 * PoE switch selection (J1–J3).
 *
 * Cameras are grouped by where their cable terminates (a switch placed on the
 * site plan, or the NVR rack). Each group gets the fewest switches that pass
 * every check; within that, the least oversized, budget-matched model. The
 * output says how many switches, which model each is, and which cameras land
 * on each.
 */

import type { PoeSwitch } from '../data/products.ts';
import type { PriceTier } from '../data/shared.ts';
import { computeRun } from '../domain/cabling.ts';
import type { CableSettings, SwitchSettings } from '../domain/designSettings.ts';
import { poeStandard, type PoeStandard } from '../domain/power.ts';
import { HIKVISION_EXTEND_MODE, TIA568 } from '../domain/standards.ts';
import type { Topology } from './topology.ts';

export interface SwitchCamera {
  readonly key: string;
  readonly label: string;
  readonly poeStandard: PoeStandard;
  readonly drawWatts: number | null;
  readonly peakKbps: number;
  /** Installed cable length to the switch port, metres. */
  readonly runMetres: number;
}

export interface SwitchGroup {
  readonly id: string;
  readonly label: string;
  /** True for the switch(es) in the NVR rack itself (uplink is a patch cord). */
  readonly atRack: boolean;
  readonly cameras: readonly SwitchCamera[];
  /** Installed uplink length to the NVR, metres; null at the rack. */
  readonly uplinkMetres: number | null;
}

export type SwitchCheckId =
  | 'ports'
  | 'poe-budget'
  | 'poe-standard'
  | 'port-power'
  | 'port-speed'
  | 'uplink-bandwidth'
  | 'uplink-type'
  | 'long-range'
  | 'management';

export interface SwitchCheck {
  readonly id: SwitchCheckId;
  readonly label: string;
  readonly verdict: 'pass' | 'fail';
  readonly required: string;
  readonly offered: string;
  readonly margin: string;
  /** True when the check used an estimated figure (extend-mode speed not in this model's own documents). */
  readonly isEstimate: boolean;
}

export interface SwitchEvaluation {
  readonly model: PoeSwitch;
  readonly checks: readonly SwitchCheck[];
  readonly failed: readonly SwitchCheck[];
  readonly score: number;
}

export interface SelectedSwitch {
  readonly id: string;
  readonly groupId: string;
  readonly groupLabel: string;
  readonly cameras: readonly SwitchCamera[];
  readonly evaluation: SwitchEvaluation;
  readonly alternatives: readonly SwitchEvaluation[];
  readonly why: string;
}

export interface GroupResult {
  readonly group: SwitchGroup;
  readonly managementRequired: 'unmanaged' | 'managed';
  readonly managementReason: string;
  readonly switches: readonly SelectedSwitch[];
  /** Set when no number of switches of any model satisfies the group. */
  readonly failure: { readonly message: string; readonly nearMiss: SwitchEvaluation | null; readonly fixes: readonly string[] } | null;
  readonly rejections: readonly { readonly model: PoeSwitch; readonly reasons: readonly string[] }[];
  readonly warnings: readonly string[];
}

export interface SwitchPlan {
  readonly groups: readonly GroupResult[];
  readonly switchCount: number;
  readonly warnings: readonly string[];
}

const POE_RANK: Readonly<Record<PoeStandard, number>> = {
  none: 0,
  '802.3af': 1,
  '802.3at': 2,
  '802.3bt-type3': 3,
  '802.3bt-type4': 4,
};
const TIER_RANK: Readonly<Record<PriceTier, number>> = { economy: 0, standard: 1, premium: 2 };

function drawOf(c: SwitchCamera): number {
  if (c.poeStandard === 'none') return 0;
  return c.drawWatts ?? poeStandard(c.poeStandard).maxPdWatts;
}

function signed(n: number, unit: string, digits = 0): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(digits)} ${unit}`;
}

/** Brief: unmanaged for ≤ 8 cameras on the economy tier, managed otherwise. */
export function managementFor(
  cameraCount: number,
  tier: PriceTier | 'any',
  pref: SwitchSettings['management'],
): { required: 'unmanaged' | 'managed'; reason: string } {
  if (pref === 'unmanaged') return { required: 'unmanaged', reason: 'Unmanaged, as chosen.' };
  if (pref === 'managed') return { required: 'managed', reason: 'Managed, as chosen.' };
  if (cameraCount <= 8 && tier === 'economy') {
    return { required: 'unmanaged', reason: `Default rule: ${cameraCount} camera(s) on the economy tier → unmanaged.` };
  }
  return {
    required: 'managed',
    reason:
      tier === 'economy'
        ? `Default rule: more than 8 cameras (${cameraCount}) → managed (VLANs, PoE monitoring).`
        : `Default rule: ${tier === 'any' ? 'no single budget tier' : `${tier} tier`} → managed.`,
  };
}

export function evaluateSwitch(
  model: PoeSwitch,
  cameras: readonly SwitchCamera[],
  group: SwitchGroup,
  settings: SwitchSettings,
  management: 'unmanaged' | 'managed',
  tier: PriceTier | 'any',
): SwitchEvaluation {
  const checks: SwitchCheck[] = [];
  const n = cameras.length;
  const portsNeeded = Math.ceil(n * (1 + settings.sparePortsPercent / 100) - 1e-9);
  checks.push({
    id: 'ports',
    label: 'PoE ports',
    verdict: model.poePorts >= portsNeeded ? 'pass' : 'fail',
    required: `${portsNeeded} (${n} cameras + ${settings.sparePortsPercent}% spare)`,
    offered: `${model.poePorts}`,
    margin: signed(model.poePorts - portsNeeded, 'ports'),
    isEstimate: false,
  });

  const load = cameras.reduce((s, c) => s + drawOf(c), 0);
  const needW = load * (1 + settings.poeHeadroomPercent / 100);
  checks.push({
    id: 'poe-budget',
    label: 'PoE budget',
    verdict: model.poeBudgetWatts >= needW ? 'pass' : 'fail',
    required: `${needW.toFixed(1)} W (${load.toFixed(1)} W draw + ${settings.poeHeadroomPercent}%)`,
    offered: `${model.poeBudgetWatts} W`,
    margin: signed(model.poeBudgetWatts - needW, 'W', 1),
    isEstimate: false,
  });

  // Per-port class: 802.3bt cameras need Hi-PoE ports; everything else needs a
  // port whose standard is at least the camera's.
  const btCams = cameras.filter((c) => POE_RANK[c.poeStandard] >= 3);
  const maxNonBt = model.poeStandards.reduce((m, s) => (POE_RANK[s] < 3 ? Math.max(m, POE_RANK[s]) : m), 0);
  const maxBt = model.poeStandards.reduce((m, s) => Math.max(m, POE_RANK[s]), 0);
  const nonBtOk = cameras.every((c) => POE_RANK[c.poeStandard] >= 3 || POE_RANK[c.poeStandard] <= maxNonBt);
  const btOk = btCams.length <= model.hiPoePorts && btCams.every((c) => POE_RANK[c.poeStandard] <= maxBt);
  checks.push({
    id: 'poe-standard',
    label: 'Per-port PoE standard',
    verdict: nonBtOk && btOk ? 'pass' : 'fail',
    required: btCams.length ? `${btCams.length} × 802.3bt (Hi-PoE) port(s) for PTZ/heated cameras` : 'af/at on every port',
    offered: `${model.poeStandards.join(', ')}; ${model.hiPoePorts} Hi-PoE port(s)`,
    margin: nonBtOk && btOk ? 'covers every camera' : btCams.length > model.hiPoePorts ? `${btCams.length - model.hiPoePorts} Hi-PoE port(s) short` : 'a camera needs a higher class',
    isEstimate: false,
  });

  const overPower = cameras.filter((c) => {
    const limit = POE_RANK[c.poeStandard] >= 3 ? (model.hiPoeMaxPortPowerWatts ?? 0) : model.maxPortPowerWatts;
    return drawOf(c) > limit;
  });
  checks.push({
    id: 'port-power',
    label: 'Per-port power',
    verdict: overPower.length === 0 ? 'pass' : 'fail',
    required: `largest camera draw ${Math.max(0, ...cameras.map(drawOf)).toFixed(1)} W`,
    offered: `${model.maxPortPowerWatts} W per port${model.hiPoeMaxPortPowerWatts ? `, ${model.hiPoeMaxPortPowerWatts} W Hi-PoE` : ''}`,
    margin: overPower.length ? `${overPower.length} camera(s) over the port limit` : 'ok',
    isEstimate: false,
  });

  const maxPeakMbps = Math.max(0, ...cameras.map((c) => c.peakKbps / 1000));
  checks.push({
    id: 'port-speed',
    label: 'Port speed',
    verdict: model.poePortSpeedMbps >= maxPeakMbps ? 'pass' : 'fail',
    required: `${maxPeakMbps.toFixed(1)} Mbps (highest camera peak)`,
    offered: `${model.poePortSpeedMbps} Mbps`,
    margin: signed(model.poePortSpeedMbps - maxPeakMbps, 'Mbps', 1),
    isEstimate: false,
  });

  const aggMbps = cameras.reduce((s, c) => s + c.peakKbps / 1000, 0);
  checks.push({
    id: 'uplink-bandwidth',
    label: 'Uplink bandwidth',
    verdict: model.uplinkSpeedMbps >= aggMbps ? 'pass' : 'fail',
    required: `${aggMbps.toFixed(1)} Mbps (sum of camera peaks)`,
    offered: `${model.uplinkSpeedMbps} Mbps`,
    margin: signed(model.uplinkSpeedMbps - aggMbps, 'Mbps', 1),
    isEstimate: false,
  });

  const copper = model.uplinkCopperPorts + model.uplinkComboPorts > 0;
  const sfp = model.uplinkSfpPorts + model.uplinkComboPorts > 0;
  const fibreNeeded = group.uplinkMetres !== null && group.uplinkMetres > TIA568.permanentLinkMaxMetres;
  const wantType = settings.uplink === 'auto' ? (fibreNeeded ? 'sfp' : 'any') : settings.uplink;
  const typeOk = wantType === 'any' ? copper || sfp : wantType === 'sfp' ? sfp : copper;
  checks.push({
    id: 'uplink-type',
    label: 'Uplink type',
    verdict: typeOk ? 'pass' : 'fail',
    required:
      wantType === 'any'
        ? 'copper or SFP'
        : wantType === 'sfp'
          ? `SFP fibre${fibreNeeded ? ` (uplink ${group.uplinkMetres?.toFixed(0)} m > 90 m)` : ''}`
          : 'copper GbE',
    offered: `${model.uplinkCopperPorts} copper, ${model.uplinkSfpPorts} SFP, ${model.uplinkComboPorts} combo`,
    margin: typeOk ? 'available' : 'missing',
    isEstimate: false,
  });

  const longRun = cameras.filter((c) => c.runMetres > TIA568.channelMaxMetres);
  const extendSpeed = model.longRangeSpeedMbps ?? HIKVISION_EXTEND_MODE.linkSpeedMbps;
  const reach = model.longRangeMaxMetres ?? 0;
  const lrFails = longRun.filter((c) => c.runMetres > reach || c.peakKbps / 1000 > extendSpeed);
  const lrOk = longRun.length <= model.longRangePorts && lrFails.length === 0;
  checks.push({
    id: 'long-range',
    label: 'Long-range PoE (extend mode)',
    verdict: lrOk ? 'pass' : 'fail',
    required: longRun.length
      ? `${longRun.length} run(s) over 100 m (longest ${Math.max(...longRun.map((c) => c.runMetres)).toFixed(0)} m, peak ≤ ${Math.max(...longRun.map((c) => c.peakKbps / 1000)).toFixed(1)} Mbps)`
      : 'none',
    offered: model.longRangePorts ? `${model.longRangePorts} port(s), ${reach} m at ${extendSpeed} Mbps` : 'no extend mode',
    margin: lrOk ? (longRun.length ? `fits — the link runs at ${extendSpeed} Mbps on those ports` : 'n/a') : lrFails.length ? `${lrFails.length} run(s) too long or too fast for extend mode` : 'too few long-range ports',
    isEstimate: longRun.length > 0 && model.longRangeSpeedMbps === null,
  });

  const isManaged = model.management !== 'unmanaged';
  checks.push({
    id: 'management',
    label: 'Management',
    verdict: (management === 'managed') === isManaged ? 'pass' : 'fail',
    required: management,
    offered: model.management,
    margin: (management === 'managed') === isManaged ? 'matches' : 'does not match',
    isEstimate: false,
  });

  const failed = checks.filter((c) => c.verdict === 'fail');
  // Prefer the least oversized and the budget-matched; ports then power.
  const fit = portsNeeded > 0 ? Math.min(1, portsNeeded / model.poePorts) : 1;
  const tierRank = TIER_RANK[model.priceTier];
  const budget = tier === 'any' ? [1, 0.7, 0.4][tierRank] ?? 0.4 : tierRank === TIER_RANK[tier] ? 1 : tierRank < TIER_RANK[tier] ? 0.8 : 0.2;
  const powerFit = model.poeBudgetWatts > 0 ? Math.min(1, needW / model.poeBudgetWatts) : 0;
  return { model, checks, failed, score: 0.5 * fit + 0.3 * budget + 0.2 * powerFit };
}

/**
 * Split cameras into k groups as evenly as possible, spreading long runs and
 * Hi-PoE cameras so no single switch takes them all.
 */
function split(cameras: readonly SwitchCamera[], k: number): SwitchCamera[][] {
  const priority = (c: SwitchCamera) => (c.runMetres > TIA568.channelMaxMetres ? 2 : 0) + (POE_RANK[c.poeStandard] >= 3 ? 1 : 0);
  const sorted = [...cameras].sort((a, b) => priority(b) - priority(a) || a.key.localeCompare(b.key));
  const buckets: SwitchCamera[][] = Array.from({ length: k }, () => []);
  sorted.forEach((c, i) => buckets[i % k]!.push(c));
  return buckets.map((b) => b.sort((a, c) => a.key.localeCompare(c.key)));
}

const FIX_FOR: Readonly<Record<SwitchCheckId, string>> = {
  ports: 'Lower the spare-port percentage, or place a second switch on the site plan.',
  'poe-budget': 'Lower the PoE headroom, or move some cameras to another switch.',
  'poe-standard': 'Hi-PoE (802.3bt) ports are scarce: power PTZ/heated cameras from a PoE++ injector or a Hi-PoE switch.',
  'port-power': 'Use an injector for the highest-draw camera.',
  'port-speed': 'Use a Gigabit switch for 4K / high-bitrate cameras.',
  'uplink-bandwidth': 'Spread the cameras over more switches, or use a 10G uplink switch.',
  'uplink-type': 'Change the uplink preference, or use a switch with an SFP port for a fibre uplink.',
  'long-range': 'Move the switch closer, or use a PoE extender; extend mode reaches 300 m at 10 Mbps only.',
  management: 'Change the managed/unmanaged preference.',
};

export function selectSwitchesForGroup(
  group: SwitchGroup,
  models: readonly PoeSwitch[],
  settings: SwitchSettings,
  tier: PriceTier | 'any',
): GroupResult {
  const mgmt = managementFor(group.cameras.length, tier, settings.management);
  const warnings: string[] = [];
  const maxReach = Math.max(0, ...models.map((m) => m.longRangeMaxMetres ?? 0));
  for (const c of group.cameras) {
    if (c.runMetres > maxReach) {
      warnings.push(`${c.label}: ${c.runMetres.toFixed(0)} m is beyond any switch's reach (${maxReach} m in extend mode) — needs a PoE extender or a fibre media converter.`);
    }
  }

  const evalAll = (cams: readonly SwitchCamera[]) =>
    models.map((m) => evaluateSwitch(m, cams, group, settings, mgmt.required, tier));

  const firstPass = evalAll(group.cameras);
  const rejections = firstPass
    .filter((e) => e.failed.length)
    .map((e) => ({ model: e.model, reasons: e.failed.map((c) => `${c.label}: needs ${c.required}, has ${c.offered}`) }));

  // Fewer switches than ports-needed ÷ the largest port count can never work, so
  // start there rather than at 1 (keeps large projects fast).
  const maxPorts = Math.max(1, ...models.map((m) => m.poePorts));
  const minK = Math.max(1, Math.ceil((group.cameras.length * (1 + settings.sparePortsPercent / 100)) / maxPorts - 1e-9));
  for (let k = minK; k <= group.cameras.length; k++) {
    const chunks = split(group.cameras, k);
    const chosen: SelectedSwitch[] = [];
    let ok = true;
    for (let i = 0; i < chunks.length; i++) {
      const cams = chunks[i]!;
      const passing = evalAll(cams)
        .filter((e) => e.failed.length === 0)
        .sort((a, b) => b.score - a.score || a.model.poePorts - b.model.poePorts);
      const best = passing[0];
      if (!best) {
        ok = false;
        break;
      }
      const id = k === 1 ? group.id : `${group.id}-${i + 1}`;
      chosen.push({
        id,
        groupId: group.id,
        groupLabel: k === 1 ? group.label : `${group.label} (${i + 1} of ${k})`,
        cameras: cams,
        evaluation: best,
        alternatives: passing.slice(1, 3),
        why:
          `${best.model.model}: ${best.model.poePorts} ports for ${cams.length} camera(s), ` +
          `${best.model.poeBudgetWatts} W PoE, ${best.model.uplinkSpeedMbps} Mbps uplink, ${best.model.management}.` +
          (k > 1 ? ` ${k} switches are needed because no single model passes every check for all ${group.cameras.length} cameras.` : ''),
      });
    }
    if (ok) {
      for (const s of chosen) {
        const lr = s.evaluation.checks.find((c) => c.id === 'long-range');
        if (lr && lr.required !== 'none') {
          warnings.push(`${s.groupLabel}: long-range ports in extend mode — ${lr.margin}.${lr.isEstimate ? ' The 10 Mbps extend-mode speed is Hikvision’s figure for its dedicated long-range models, applied here as an estimate.' : ''}`);
        }
      }
      return { group, managementRequired: mgmt.required, managementReason: mgmt.reason, switches: chosen, failure: null, rejections, warnings };
    }
  }

  const nearMiss = [...firstPass].sort((a, b) => a.failed.length - b.failed.length || b.score - a.score)[0] ?? null;
  return {
    group,
    managementRequired: mgmt.required,
    managementReason: mgmt.reason,
    switches: [],
    failure: {
      message: `No switch model in the catalogue serves ${group.label}, even one camera per switch.`,
      nearMiss,
      fixes: nearMiss ? nearMiss.failed.map((c) => FIX_FOR[c.id]) : [],
    },
    rejections,
    warnings,
  };
}

export function planSwitches(
  groups: readonly SwitchGroup[],
  models: readonly PoeSwitch[],
  settings: SwitchSettings,
  tier: PriceTier | 'any',
): SwitchPlan {
  const results = groups.filter((g) => g.cameras.length > 0).map((g) => selectSwitchesForGroup(g, models, settings, tier));
  return {
    groups: results,
    switchCount: results.reduce((s, r) => s + r.switches.length, 0),
    warnings: results.flatMap((r) => [...r.warnings, ...(r.failure ? [r.failure.message] : [])]),
  };
}

// ---------------------------------------------------------------------------
// Grouping (J1)
// ---------------------------------------------------------------------------

export interface GroupingInput {
  readonly camera: SwitchCamera;
  /** null = cabled back to the NVR rack. */
  readonly switchId: string | null;
  readonly switchLabel: string | null;
}

export const RACK_GROUP_ID = 'rack';

/**
 * One group per placed switch, plus — when the recorder does not power the
 * cameras itself — one group for the cameras cabled straight back to the rack.
 * With no site plan every camera is in that rack group.
 */
export function groupCameras(
  inputs: readonly GroupingInput[],
  uplinkMetresBySwitch: ReadonlyMap<string, number>,
  poeMode: 'built-in' | 'external',
): SwitchGroup[] {
  const groups = new Map<string, { label: string; atRack: boolean; cameras: SwitchCamera[]; uplink: number | null }>();
  for (const i of inputs) {
    if (i.switchId === null) {
      if (poeMode === 'built-in') continue; // powered by the NVR's own ports
      const g = groups.get(RACK_GROUP_ID) ?? { label: 'NVR rack', atRack: true, cameras: [], uplink: null };
      g.cameras.push(i.camera);
      groups.set(RACK_GROUP_ID, g);
    } else {
      const g = groups.get(i.switchId) ?? {
        label: i.switchLabel ?? i.switchId,
        atRack: false,
        cameras: [],
        uplink: uplinkMetresBySwitch.get(i.switchId) ?? null,
      };
      g.cameras.push(i.camera);
      groups.set(i.switchId, g);
    }
  }
  return [...groups.entries()].map(([id, g]) => ({ id, label: g.label, atRack: g.atRack, cameras: g.cameras, uplinkMetres: g.uplink }));
}

/**
 * The grouping inputs for a project, read off its topology: each camera's
 * endpoint (a placed switch, or the rack) and its INSTALLED run length — the
 * same route + camera drop + rack drop + service loop that the cable plan
 * uses, so the long-range check and the TIA check see the same metres.
 * Uplink lengths are installed lengths too (a rack drop at both ends).
 */
export function groupingInputsFromTopology(
  topology: Topology,
  cabling: CableSettings,
): { readonly inputs: readonly GroupingInput[]; readonly uplinkMetresBySwitch: ReadonlyMap<string, number> } {
  const inputs = topology.links.map<GroupingInput>((l) => {
    const run = computeRun(
      {
        id: l.instance.key,
        label: l.instance.label,
        kind: 'camera',
        horizontalMetres: l.horizontalMetres,
        cameraDropMetres: l.instance.mountHeightMetres,
        basis: l.basis,
        isEstimate: l.isEstimate,
      },
      cabling,
    );
    return {
      camera: {
        key: l.instance.key,
        label: l.instance.label,
        poeStandard: l.instance.poeStandard,
        drawWatts: l.instance.poeDrawWatts,
        peakKbps: l.instance.peakKbps,
        runMetres: run.installedMetres,
      },
      switchId: l.endpoint.kind === 'switch' ? l.endpoint.switchId : null,
      switchLabel: l.endpoint.kind === 'switch' ? l.endpoint.label : null,
    };
  });
  const uplinkMetresBySwitch = new Map(
    topology.uplinks.map((u) => [
      u.switchId,
      computeRun(
        { id: u.switchId, label: u.label, kind: 'uplink', horizontalMetres: u.horizontalMetres, cameraDropMetres: 0, basis: u.basis, isEstimate: u.isEstimate },
        cabling,
      ).installedMetres,
    ]),
  );
  return { inputs, uplinkMetresBySwitch };
}
