/**
 * CAT6 cable maths: run lengths, the TIA-568 distance limits, and how many
 * boxes to buy.
 *
 * ## Run length
 *
 *   installed = horizontal route + camera-end vertical + rack-end drop + service loop
 *   purchased = installed × (1 + waste)
 *
 * The camera-end vertical is the camera's mounting height (brief); an uplink has
 * a rack-end drop at both ends and no camera drop. Waste is a purchasing
 * allowance, so the TIA check is made on the INSTALLED length.
 *
 * ## The 100 m limit (TIA-568, see `standards.ts`)
 *
 *   ≤ 90 m        pass
 *   90 to 100 m   flagged: the permanent link exceeds 90 m; the 100 m channel is
 *                 only met if all patch/equipment cords together are ≤ 100 − L
 *   > 100 m       fail: outside the channel model. Remedies named every time.
 *
 * Nothing over 90 m ever passes quietly.
 *
 * ## Boxes
 *
 * A run cannot be spliced across two boxes, so boxes are counted by bin packing
 * the purchased run lengths into boxes — first-fit decreasing — never by
 * total ÷ box length. Both figures are reported so the difference is visible.
 */

import { HIKVISION_EXTEND_MODE, TIA568 } from './standards.ts';
import type { CableSettings } from './designSettings.ts';
import type { RunLengthBasis } from './sitePlan.ts';

export type RunKind = 'camera' | 'uplink';

export interface RunInput {
  readonly id: string;
  readonly label: string;
  readonly kind: RunKind;
  readonly horizontalMetres: number;
  /** Camera-end vertical, metres. 0 for an uplink. */
  readonly cameraDropMetres: number;
  readonly basis: RunLengthBasis;
  readonly isEstimate: boolean;
}

export type TiaVerdict = 'pass' | 'marginal' | 'fail';

export interface TiaCheck {
  readonly verdict: TiaVerdict;
  readonly message: string;
  readonly remedies: readonly string[];
}

export interface CableRun extends RunInput {
  readonly installedMetres: number;
  readonly purchasedMetres: number;
  readonly tia: TiaCheck;
  /** True when this uplink must be fibre rather than CAT6. */
  readonly needsFibre: boolean;
  readonly formula: string;
}

export class CableInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CableInputError';
  }
}

function assertSettings(s: CableSettings): void {
  const nonNeg = (v: number, what: string) => {
    if (!Number.isFinite(v) || v < 0) throw new CableInputError(`${what} must be zero or more, got ${String(v)}`);
  };
  nonNeg(s.rackDropMetres, 'Rack drop');
  nonNeg(s.serviceLoopMetres, 'Service loop');
  nonNeg(s.wastePercent, 'Waste allowance');
  if (!Number.isFinite(s.boxMetres) || s.boxMetres <= 0) throw new CableInputError('Box length must be positive');
  if (!Number.isInteger(s.connectorsPerRun) || s.connectorsPerRun < 0) throw new CableInputError('Connectors per run must be a whole number');
  if (!Number.isInteger(s.patchCordsPerRun) || s.patchCordsPerRun < 0) throw new CableInputError('Patch cords per run must be a whole number');
}

export function tiaCheck(installedMetres: number, kind: RunKind): TiaCheck {
  const L = installedMetres;
  const cameraRemedies = [
    'Move the switch closer: add or move an IDF switch on the site plan so the run is under 90 m.',
    `Use a Hikvision long-range PoE port in extend mode (up to ${HIKVISION_EXTEND_MODE.maxMetres} m, but the link drops to ${HIKVISION_EXTEND_MODE.linkSpeedMbps} Mbps).`,
    'Fit a PoE extender part-way along the run.',
  ];
  const uplinkRemedies = ['Run the uplink as fibre (SFP at both ends) — listed as a separate line item, not CAT6.'];
  const remedies = kind === 'camera' ? cameraRemedies : uplinkRemedies;

  if (L <= TIA568.permanentLinkMaxMetres) {
    return { verdict: 'pass', message: `${L.toFixed(1)} m — within the ${TIA568.permanentLinkMaxMetres} m TIA-568 permanent link.`, remedies: [] };
  }
  if (L <= TIA568.channelMaxMetres) {
    return {
      verdict: 'marginal',
      message:
        `${L.toFixed(1)} m — OVER the ${TIA568.permanentLinkMaxMetres} m permanent link. The ${TIA568.channelMaxMetres} m channel is only met if ` +
        `all patch and equipment cords together are no longer than ${(TIA568.channelMaxMetres - L).toFixed(1)} m.`,
      remedies,
    };
  }
  return {
    verdict: 'fail',
    message: `${L.toFixed(1)} m — EXCEEDS the ${TIA568.channelMaxMetres} m TIA-568 channel limit. Standard Ethernet/PoE is not guaranteed on this run.`,
    remedies,
  };
}

export function computeRun(input: RunInput, s: CableSettings): CableRun {
  if (!Number.isFinite(input.horizontalMetres) || input.horizontalMetres < 0) {
    throw new CableInputError(`${input.label}: horizontal length must be zero or more`);
  }
  if (!Number.isFinite(input.cameraDropMetres) || input.cameraDropMetres < 0) {
    throw new CableInputError(`${input.label}: camera drop must be zero or more`);
  }
  const rackDrops = input.kind === 'uplink' ? 2 : 1;
  const installed = input.horizontalMetres + input.cameraDropMetres + s.rackDropMetres * rackDrops + s.serviceLoopMetres;
  const purchased = installed * (1 + s.wastePercent / 100);
  const tia = tiaCheck(installed, input.kind);
  const needsFibre = input.kind === 'uplink' && installed > TIA568.permanentLinkMaxMetres;
  const parts =
    input.kind === 'uplink'
      ? `${input.horizontalMetres.toFixed(1)} m route + 2 × ${s.rackDropMetres} m rack drops + ${s.serviceLoopMetres} m service loop`
      : `${input.horizontalMetres.toFixed(1)} m route + ${input.cameraDropMetres.toFixed(1)} m camera drop + ${s.rackDropMetres} m rack drop + ${s.serviceLoopMetres} m service loop`;
  return {
    ...input,
    installedMetres: installed,
    purchasedMetres: purchased,
    tia,
    needsFibre,
    formula: `${parts} = ${installed.toFixed(1)} m installed; × (1 + ${s.wastePercent}% waste) = ${purchased.toFixed(1)} m to buy.`,
  };
}

// ---------------------------------------------------------------------------
// Bin packing
// ---------------------------------------------------------------------------

export interface PackItem {
  readonly id: string;
  readonly metres: number;
}

export interface Box {
  readonly runIds: readonly string[];
  readonly usedMetres: number;
  readonly offcutMetres: number;
}

export interface Packing {
  readonly boxes: readonly Box[];
  /** Runs longer than a whole box: cannot be pulled from any box. */
  readonly oversize: readonly PackItem[];
  readonly totalMetres: number;
  /** total ÷ box length, rounded up — shown only to make the difference visible. */
  readonly naiveBoxCount: number;
}

/** First-fit decreasing into fixed-size boxes. */
export function packIntoBoxes(items: readonly PackItem[], boxMetres: number): Packing {
  if (!Number.isFinite(boxMetres) || boxMetres <= 0) throw new CableInputError('Box length must be positive');
  const sorted = [...items].sort((a, b) => b.metres - a.metres || a.id.localeCompare(b.id));
  const bins: { ids: string[]; used: number }[] = [];
  const oversize: PackItem[] = [];
  let total = 0;
  for (const item of sorted) {
    if (!Number.isFinite(item.metres) || item.metres < 0) throw new CableInputError(`Run ${item.id} has an invalid length`);
    total += item.metres;
    if (item.metres > boxMetres) {
      oversize.push(item);
      continue;
    }
    // Small tolerance so a run of exactly the remaining length still fits despite
    // floating-point rounding in the waste multiplication.
    const bin = bins.find((b) => b.used + item.metres <= boxMetres + 1e-9);
    if (bin) {
      bin.ids.push(item.id);
      bin.used += item.metres;
    } else {
      bins.push({ ids: [item.id], used: item.metres });
    }
  }
  return {
    boxes: bins.map((b) => ({ runIds: b.ids, usedMetres: b.used, offcutMetres: Math.max(0, boxMetres - b.used) })),
    oversize,
    totalMetres: total,
    naiveBoxCount: Math.ceil(total / boxMetres - 1e-9),
  };
}

// ---------------------------------------------------------------------------
// The whole plan
// ---------------------------------------------------------------------------

export interface FibreUplink {
  readonly id: string;
  readonly label: string;
  readonly installedMetres: number;
  readonly purchasedMetres: number;
  readonly isEstimate: boolean;
}

export interface CablePlan {
  readonly runs: readonly CableRun[];
  readonly cameraRuns: readonly CableRun[];
  /** Switch-to-NVR uplinks that stay on CAT6 (≤ 90 m). */
  readonly copperUplinks: readonly CableRun[];
  readonly fibreUplinks: readonly FibreUplink[];
  readonly packing: Packing;
  readonly boxMetres: number;
  readonly connectors: number;
  readonly patchCords: number;
  readonly over90: readonly CableRun[];
  readonly over100: readonly CableRun[];
  readonly isEstimate: boolean;
  readonly warnings: readonly string[];
}

export function cablePlan(inputs: readonly RunInput[], s: CableSettings): CablePlan {
  assertSettings(s);
  const runs = inputs.map((r) => computeRun(r, s));
  const cameraRuns = runs.filter((r) => r.kind === 'camera');
  const uplinks = runs.filter((r) => r.kind === 'uplink');
  const copperUplinks = uplinks.filter((r) => !r.needsFibre);
  const fibreUplinks: FibreUplink[] = uplinks
    .filter((r) => r.needsFibre)
    .map((r) => ({ id: r.id, label: r.label, installedMetres: r.installedMetres, purchasedMetres: r.purchasedMetres, isEstimate: r.isEstimate }));

  const copper = [...cameraRuns, ...copperUplinks];
  const packing = packIntoBoxes(
    copper.map((r) => ({ id: r.id, metres: r.purchasedMetres })),
    s.boxMetres,
  );

  const over90 = cameraRuns.filter((r) => r.tia.verdict === 'marginal');
  const over100 = cameraRuns.filter((r) => r.tia.verdict === 'fail');
  const warnings: string[] = [];
  for (const r of [...over100, ...over90]) warnings.push(`${r.label}: ${r.tia.message}`);
  for (const f of fibreUplinks) {
    warnings.push(`${f.label} uplink is ${f.installedMetres.toFixed(1)} m — over 90 m, so it must be fibre (listed separately, not as CAT6).`);
  }
  for (const o of packing.oversize) {
    warnings.push(`Run ${o.id} needs ${o.metres.toFixed(1)} m — longer than a whole ${s.boxMetres} m box. It cannot be pulled as one CAT6 run.`);
  }

  return {
    runs,
    cameraRuns,
    copperUplinks,
    fibreUplinks,
    packing,
    boxMetres: s.boxMetres,
    connectors: copper.length * s.connectorsPerRun,
    patchCords: copper.length * s.patchCordsPerRun,
    over90,
    over100,
    isEstimate: runs.some((r) => r.isEstimate),
    warnings,
  };
}
