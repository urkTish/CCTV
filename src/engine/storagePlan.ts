/**
 * Drive-configuration search (H4): the smallest set of N × capacity that gives
 * the required usable capacity, within a recorder's bay count and per-bay
 * maximum, at the chosen RAID level.
 *
 * "Smallest" means least raw capacity bought, then fewest drives (more free bays
 * for later). Drives whose exact part number is on Hikvision's own NVR
 * compatibility list are preferred; others are used only when nothing on the
 * list fits, and then carry a warning.
 */

import type { Hdd } from '../data/products.ts';
import { HIKVISION_HDD_COMPAT_LIST_URL } from '../data/productSchemas.ts';
import { driveSetCapacity, raidMinimumDrives, RAID_LABELS, type RaidLevel } from '../domain/storage.ts';

export interface ExcludedDrive {
  readonly drive: Hdd;
  readonly reason: string;
}

/**
 * Whether the engine may recommend a drive at all. See ASSUMPTIONS 7.2: the
 * Hikvision IoT HDD has a real datasheet but is positioned for enterprise data
 * storage, has no workload rating and is not on Hikvision's own NVR
 * compatibility list, so it is shown as excluded rather than recommended.
 */
export function isRecommendableDrive(drive: Hdd): { ok: true } | { ok: false; reason: string } {
  if (drive.manufacturer === 'Hikvision') {
    return {
      ok: false,
      reason:
        'Hikvision IoT HDD: the datasheet positions it for enterprise data storage, publishes no surveillance workload rating, and the part is not on Hikvision’s own NVR compatibility list.',
    };
  }
  if (drive.recordingTechnology === 'SMR') {
    return { ok: false, reason: 'SMR drive: rebuilds badly in RAID and under continuous writes.' };
  }
  return { ok: true };
}

export interface DriveConfig {
  readonly drive: Hdd;
  readonly level: RaidLevel;
  readonly dataDrives: number;
  readonly hotSpares: number;
  readonly totalDrives: number;
  readonly rawTb: number;
  readonly usableTb: number;
  readonly explanation: string;
  readonly warnings: readonly string[];
}

export interface DrivePlanInput {
  readonly requiredUsableTb: number;
  readonly level: RaidLevel;
  readonly hotSpare: boolean;
  readonly bays: number;
  readonly maxPerBayTb: number;
  readonly drives: readonly Hdd[];
}

export type DrivePlan =
  | {
      readonly ok: true;
      readonly config: DriveConfig;
      /** Best configuration from each other drive line, for comparison. */
      readonly alternatives: readonly DriveConfig[];
      readonly excludedDrives: readonly ExcludedDrive[];
    }
  | {
      readonly ok: false;
      readonly reason: string;
      /** The most usable capacity this bay set can offer at this RAID level. */
      readonly maxUsableTb: number;
      readonly excludedDrives: readonly ExcludedDrive[];
    };

function configFor(drive: Hdd, level: RaidLevel, dataDrives: number, hotSpares: number): DriveConfig | null {
  const cap = driveSetCapacity({ level, dataDrives, hotSpares, capacityTb: drive.capacityTb });
  if ('error' in cap) return null;
  const warnings: string[] = [];
  if (drive.onHikvisionCompatList === false) {
    warnings.push(
      `${drive.model} is not on Hikvision’s NVR compatibility list (${HIKVISION_HDD_COMPAT_LIST_URL}); confirm with the distributor before fitting it.`,
    );
  }
  return {
    drive,
    level,
    dataDrives,
    hotSpares,
    totalDrives: cap.totalDrives,
    rawTb: cap.rawTb,
    usableTb: cap.usableTb,
    explanation: `${cap.explanation} Model ${drive.model} (${drive.marketingName}).`,
    warnings,
  };
}

/** Smallest valid data-drive count for one drive model, or null if none fits. */
function smallestFit(drive: Hdd, input: DrivePlanInput, spares: number): DriveConfig | null {
  for (let n = raidMinimumDrives(input.level); n + spares <= input.bays; n++) {
    const c = configFor(drive, input.level, n, spares);
    if (c && c.usableTb >= input.requiredUsableTb) return c;
  }
  return null;
}

function better(a: DriveConfig, b: DriveConfig): number {
  // Compatibility-listed drives first, then least raw capacity, then fewest drives.
  const compat = (c: DriveConfig) => (c.drive.onHikvisionCompatList === true ? 0 : 1);
  return compat(a) - compat(b) || a.rawTb - b.rawTb || a.totalDrives - b.totalDrives;
}

export function planDrives(input: DrivePlanInput): DrivePlan {
  const excludedDrives: ExcludedDrive[] = [];
  const spares = input.hotSpare ? 1 : 0;

  if (!Number.isFinite(input.requiredUsableTb) || input.requiredUsableTb < 0) {
    return { ok: false, reason: 'The storage requirement could not be calculated.', maxUsableTb: 0, excludedDrives };
  }
  if (input.hotSpare && input.level === 'none') {
    return { ok: false, reason: 'A hot spare needs a RAID array; choose a RAID level or turn the spare off.', maxUsableTb: 0, excludedDrives };
  }

  const usableDrives: Hdd[] = [];
  for (const drive of input.drives) {
    const rec = isRecommendableDrive(drive);
    if (!rec.ok) {
      excludedDrives.push({ drive, reason: rec.reason });
      continue;
    }
    if (drive.capacityTb > input.maxPerBayTb) {
      excludedDrives.push({ drive, reason: `${drive.capacityTb} TB exceeds the recorder’s ${input.maxPerBayTb} TB per-bay maximum.` });
      continue;
    }
    if (drive.maxBaysSupported !== null && drive.maxBaysSupported < input.bays) {
      excludedDrives.push({
        drive,
        reason: `Rated by its manufacturer for systems of up to ${drive.maxBaysSupported} bays; this recorder has ${input.bays}.`,
      });
      continue;
    }
    usableDrives.push(drive);
  }

  const fits = usableDrives
    .map((d) => smallestFit(d, input, spares))
    .filter((c): c is DriveConfig => c !== null)
    .sort(better);

  const best = fits[0];
  if (!best) {
    let maxUsableTb = 0;
    for (const d of usableDrives) {
      for (let n = raidMinimumDrives(input.level); n + spares <= input.bays; n++) {
        const c = configFor(d, input.level, n, spares);
        if (c) maxUsableTb = Math.max(maxUsableTb, c.usableTb);
      }
    }
    const minDrives = raidMinimumDrives(input.level) + spares;
    const reason =
      input.bays < minDrives
        ? `${RAID_LABELS[input.level]}${spares ? ' with a hot spare' : ''} needs ${minDrives} bays; this recorder has ${input.bays}.`
        : usableDrives.length === 0
          ? 'No recommendable drive fits this recorder’s bays.'
          : `Needs ${input.requiredUsableTb.toFixed(2)} TB usable; the most this recorder can hold at ${RAID_LABELS[input.level]} is ${maxUsableTb.toFixed(2)} TB.`;
    return { ok: false, reason, maxUsableTb, excludedDrives };
  }

  // One alternative per other drive line, best first.
  const seenLines = new Set([best.drive.line]);
  const alternatives: DriveConfig[] = [];
  for (const c of fits.slice(1)) {
    if (seenLines.has(c.drive.line)) continue;
    seenLines.add(c.drive.line);
    alternatives.push(c);
    if (alternatives.length === 2) break;
  }

  return { ok: true, config: best, alternatives, excludedDrives };
}
