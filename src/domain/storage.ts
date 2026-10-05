/**
 * Project storage sizing and RAID arithmetic. Pure; no product data.
 *
 * ## The chain, in the order the brief asks for it to be shown
 *
 *   1. Recorded data   = Σ cameras  bitrate × recording seconds/day × retention days
 *   2. RAID overhead   — handled when drives are chosen (`raidUsableDrives`): the
 *                        drives bought must deliver step 3 as USABLE capacity.
 *   3. Filesystem      = (data incl. headroom) ÷ (1 − formatting overhead)
 *   4. Headroom        = data × (1 + growth headroom)
 *
 * Steps 3 and 4 are both multiplicative, so their order does not change the
 * result; the trace applies headroom first so every intermediate is a figure an
 * engineer would recognise ("data plus 20%").
 *
 * Bitrate per camera comes from phase 1 (Hikvision's published recommended
 * bit-rate tables), already in decimal kilobits per second. Everything here stays
 * decimal (1 TB = 10^12 bytes) because drives are sold that way — see
 * `standards.ts`.
 */

import { BITRATE_SOURCE_URL } from './bitrate.ts';
import { DECIMAL_BYTES_PER_TB, DRIVE_CAPACITY_SOURCE_URL } from './standards.ts';
import type { TracedValue } from './types.ts';

export const SECONDS_PER_DAY = 86_400;

// ---------------------------------------------------------------------------
// Recording mode (H1)
// ---------------------------------------------------------------------------

export type RecordingMode = 'continuous' | 'motion-only' | 'scheduled';

export interface RecordingSchedule {
  readonly mode: RecordingMode;
  /**
   * Motion-only: share of the day on which motion triggers recording, percent.
   * There is no published figure for this — it depends entirely on the site — so
   * it is always flagged as an estimate.
   */
  readonly motionDutyPercent: number;
  /** Scheduled: hours of recording per day. */
  readonly scheduledHoursPerDay: number;
}

/**
 * Default motion duty. An engineering placeholder, not a sourced figure: an
 * office corridor may see motion 10% of the day, a car-park entrance 60%. The
 * UI labels it as unverified and the engineer is expected to change it.
 */
export const DEFAULT_MOTION_DUTY_PERCENT = 30;

export const DEFAULT_RECORDING_SCHEDULE: RecordingSchedule = {
  mode: 'continuous',
  motionDutyPercent: DEFAULT_MOTION_DUTY_PERCENT,
  scheduledHoursPerDay: 12,
};

export class StorageInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageInputError';
  }
}

export interface RecordingTime {
  readonly secondsPerDay: number;
  readonly isEstimate: boolean;
  readonly explanation: string;
}

export function recordingSecondsPerDay(schedule: RecordingSchedule): RecordingTime {
  switch (schedule.mode) {
    case 'continuous':
      return {
        secondsPerDay: SECONDS_PER_DAY,
        isEstimate: false,
        explanation: 'Continuous recording: 24 h × 3600 s = 86 400 s per day.',
      };
    case 'motion-only': {
      const p = schedule.motionDutyPercent;
      if (!Number.isFinite(p) || p <= 0 || p > 100) {
        throw new StorageInputError(`Motion share of the day must be above 0 and at most 100%, got ${String(p)}`);
      }
      const seconds = (SECONDS_PER_DAY * p) / 100;
      return {
        secondsPerDay: seconds,
        isEstimate: true,
        explanation: `Motion-only recording: 86 400 s × ${p}% of the day with motion = ${Math.round(seconds)} s per day. The motion share is a site estimate, not a published figure.`,
      };
    }
    case 'scheduled': {
      const h = schedule.scheduledHoursPerDay;
      if (!Number.isFinite(h) || h <= 0 || h > 24) {
        throw new StorageInputError(`Scheduled recording hours must be above 0 and at most 24, got ${String(h)}`);
      }
      const seconds = h * 3600;
      return {
        secondsPerDay: seconds,
        isEstimate: false,
        explanation: `Scheduled recording: ${h} h × 3600 s = ${seconds} s per day.`,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Project storage requirement (H2)
// ---------------------------------------------------------------------------

/** One group of identical cameras recording to the same recorder. */
export interface StorageStream {
  readonly label: string;
  readonly quantity: number;
  /** Sustained (target) bitrate per camera, decimal kbps. */
  readonly targetKbps: number;
  readonly retentionDays: number;
  /** True when the bitrate itself was an estimate (phase-1 flag). */
  readonly bitrateIsEstimate: boolean;
}

export interface StorageRequirementInput {
  readonly streams: readonly StorageStream[];
  readonly schedule: RecordingSchedule;
  /** Fraction of a drive's sold capacity lost to formatting, 0 to <0.5. */
  readonly formattingOverhead: number;
  readonly formattingOverheadIsEstimate: boolean;
  /** Growth headroom, percent. */
  readonly headroomPercent: number;
}

export interface StreamStorage {
  readonly label: string;
  readonly quantity: number;
  readonly bytes: number;
}

export interface StorageRequirement {
  readonly recording: RecordingTime;
  readonly perStream: readonly StreamStorage[];
  /** Step 1: what the cameras write over their retention periods, bytes. */
  readonly dataBytes: number;
  /** Step 4 (applied first): data plus growth headroom, bytes. */
  readonly withHeadroomBytes: number;
  /** Step 3: usable capacity the drive set must present after RAID, decimal TB. */
  readonly requiredUsableTb: number;
  readonly isEstimate: boolean;
  readonly rows: readonly TracedValue[];
}

function tb(bytes: number): number {
  return bytes / DECIMAL_BYTES_PER_TB;
}

function fmtTb(value: number): string {
  return `${value.toFixed(2)} TB`;
}

export function storageRequirement(input: StorageRequirementInput): StorageRequirement {
  const { streams, schedule, formattingOverhead, headroomPercent } = input;
  if (!Number.isFinite(formattingOverhead) || formattingOverhead < 0 || formattingOverhead >= 0.5) {
    throw new StorageInputError(`Formatting overhead must be between 0 and 50%, got ${String(formattingOverhead)}`);
  }
  if (!Number.isFinite(headroomPercent) || headroomPercent < 0 || headroomPercent > 500) {
    throw new StorageInputError(`Growth headroom must be between 0 and 500%, got ${String(headroomPercent)}`);
  }

  const recording = recordingSecondsPerDay(schedule);
  const perStream: StreamStorage[] = [];
  let dataBytes = 0;
  let bitrateEstimate = false;

  for (const s of streams) {
    if (!Number.isInteger(s.quantity) || s.quantity < 0) {
      throw new StorageInputError(`${s.label}: camera quantity must be a non-negative integer`);
    }
    if (!Number.isFinite(s.targetKbps) || s.targetKbps <= 0) {
      throw new StorageInputError(`${s.label}: bitrate must be positive`);
    }
    if (!Number.isInteger(s.retentionDays) || s.retentionDays <= 0) {
      throw new StorageInputError(`${s.label}: retention must be a positive whole number of days`);
    }
    // kbps × 1000 / 8 = bytes per second.
    const bytes = s.quantity * ((s.targetKbps * 1000) / 8) * recording.secondsPerDay * s.retentionDays;
    perStream.push({ label: s.label, quantity: s.quantity, bytes });
    dataBytes += bytes;
    bitrateEstimate ||= s.bitrateIsEstimate;
  }

  const withHeadroomBytes = dataBytes * (1 + headroomPercent / 100);
  const requiredUsableTb = tb(withHeadroomBytes) / (1 - formattingOverhead);

  const streamTerms = streams
    .map((s) => {
      return `${s.quantity} × ${s.targetKbps} kbps × ${s.retentionDays} d`;
    })
    .join(' + ');

  const rows: TracedValue[] = [
    {
      label: 'Recorded data over the retention period',
      display: fmtTb(tb(dataBytes)),
      value: tb(dataBytes),
      formula:
        `Σ cameras × bitrate ÷ 8 × ${Math.round(recording.secondsPerDay)} s/day × retention = ` +
        `(${streamTerms || 'no cameras'}) ÷ 8 × ${Math.round(recording.secondsPerDay)} s = ${fmtTb(tb(dataBytes))}. ` +
        recording.explanation,
      sourceUrl: BITRATE_SOURCE_URL,
      isEstimate: bitrateEstimate || recording.isEstimate,
      verdict: 'info',
    },
    {
      label: 'With growth headroom',
      display: fmtTb(tb(withHeadroomBytes)),
      value: tb(withHeadroomBytes),
      formula: `${fmtTb(tb(dataBytes))} × (1 + ${headroomPercent}%) = ${fmtTb(tb(withHeadroomBytes))}`,
      sourceUrl: null,
      isEstimate: false,
      verdict: 'info',
    },
    {
      label: 'Usable capacity needed after formatting',
      display: fmtTb(requiredUsableTb),
      value: requiredUsableTb,
      formula:
        `${fmtTb(tb(withHeadroomBytes))} ÷ (1 − ${(formattingOverhead * 100).toFixed(1)}% formatting overhead) = ` +
        `${fmtTb(requiredUsableTb)}. This is what the drives must deliver AFTER RAID redundancy.`,
      sourceUrl: DRIVE_CAPACITY_SOURCE_URL,
      isEstimate: input.formattingOverheadIsEstimate,
      verdict: 'info',
    },
  ];

  return {
    recording,
    perStream,
    dataBytes,
    withHeadroomBytes,
    requiredUsableTb,
    isEstimate: bitrateEstimate || recording.isEstimate || input.formattingOverheadIsEstimate,
    rows,
  };
}

/**
 * Inverse of `storageRequirement` for a single retention figure: how many days
 * of retention fit into a usable capacity, with every camera on the same
 * retention. Used to tell the engineer "this recorder holds N days".
 */
export function retentionDaysThatFit(
  usableTb: number,
  dailyBytesAllCameras: number,
  formattingOverhead: number,
  headroomPercent: number,
): number {
  if (dailyBytesAllCameras <= 0) return Number.POSITIVE_INFINITY;
  const dataBytesAllowed = (usableTb * (1 - formattingOverhead) * DECIMAL_BYTES_PER_TB) / (1 + headroomPercent / 100);
  return Math.floor(dataBytesAllowed / dailyBytesAllCameras);
}

// ---------------------------------------------------------------------------
// RAID (H3)
// ---------------------------------------------------------------------------

/**
 * RAID levels offered. 'none' means independent disks (Hikvision's default
 * overwrite mode across disks): no redundancy, every byte usable.
 *
 * Usable-capacity arithmetic is the textbook definition of each level, as given
 * in TechTarget's "RAID 5 vs. RAID 6" (verified 2026-10-05: "(N-1)*S", "(N-2)*S"):
 *   RAID 1  — mirroring: one drive's capacity from a mirrored pair
 *   RAID 5  — single rotating parity: (n − 1) drives' capacity, n ≥ 3
 *   RAID 6  — double parity: (n − 2) drives' capacity, n ≥ 4
 *   RAID 10 — striped mirrors: n / 2 drives' capacity, n even, n ≥ 4
 * A hot spare is an idle extra drive: it adds no capacity.
 */
export type RaidLevel = 'none' | '1' | '5' | '6' | '10';
export const RAID_LEVELS: readonly RaidLevel[] = ['none', '1', '5', '6', '10'];
export const RAID_SOURCE_URL = 'https://www.techtarget.com/searchdatabackup/tip/RAID-5-vs-RAID-6-Capacity-performance-durability';

export const RAID_LABELS: Readonly<Record<RaidLevel, string>> = {
  none: 'No RAID (independent disks)',
  '1': 'RAID 1 (mirror)',
  '5': 'RAID 5 (single parity)',
  '6': 'RAID 6 (double parity)',
  '10': 'RAID 10 (striped mirrors)',
};

export function raidMinimumDrives(level: RaidLevel): number {
  switch (level) {
    case 'none':
      return 1;
    case '1':
      return 2;
    case '5':
      return 3;
    case '6':
      return 4;
    case '10':
      return 4;
  }
}

export type RaidUsable =
  | { readonly ok: true; readonly usableDrives: number }
  | { readonly ok: false; readonly reason: string };

/** How many drives' worth of capacity `n` data drives give at a RAID level. */
export function raidUsableDrives(level: RaidLevel, n: number): RaidUsable {
  if (!Number.isInteger(n) || n < 1) return { ok: false, reason: `Drive count must be a positive integer, got ${String(n)}` };
  const min = raidMinimumDrives(level);
  if (n < min) return { ok: false, reason: `${RAID_LABELS[level]} needs at least ${min} drives, got ${n}` };
  switch (level) {
    case 'none':
      return { ok: true, usableDrives: n };
    case '1':
      // A mirror is a pair. More copies add no capacity, so they are refused
      // rather than silently priced in.
      if (n !== 2) return { ok: false, reason: `RAID 1 is a mirrored pair: exactly 2 drives, got ${n}` };
      return { ok: true, usableDrives: 1 };
    case '5':
      return { ok: true, usableDrives: n - 1 };
    case '6':
      return { ok: true, usableDrives: n - 2 };
    case '10':
      if (n % 2 !== 0) return { ok: false, reason: `RAID 10 needs an even number of drives, got ${n}` };
      return { ok: true, usableDrives: n / 2 };
  }
}

export interface DriveSet {
  readonly level: RaidLevel;
  readonly dataDrives: number;
  readonly hotSpares: number;
  readonly capacityTb: number;
}

export interface DriveSetCapacity {
  readonly totalDrives: number;
  readonly rawTb: number;
  readonly usableTb: number;
  readonly explanation: string;
}

export function driveSetCapacity(set: DriveSet): DriveSetCapacity | { readonly error: string } {
  if (!Number.isFinite(set.capacityTb) || set.capacityTb <= 0) return { error: 'Drive capacity must be positive' };
  if (!Number.isInteger(set.hotSpares) || set.hotSpares < 0) return { error: 'Hot spares must be a non-negative integer' };
  if (set.level === 'none' && set.hotSpares > 0) {
    return { error: 'A hot spare only makes sense with a RAID array' };
  }
  const usable = raidUsableDrives(set.level, set.dataDrives);
  if (!usable.ok) return { error: usable.reason };
  const totalDrives = set.dataDrives + set.hotSpares;
  const rawTb = totalDrives * set.capacityTb;
  const usableTb = usable.usableDrives * set.capacityTb;
  return {
    totalDrives,
    rawTb,
    usableTb,
    explanation:
      `${set.dataDrives} × ${set.capacityTb} TB in ${RAID_LABELS[set.level]}` +
      `${set.hotSpares ? ` + ${set.hotSpares} hot spare` : ''} = ${rawTb} TB raw, ` +
      `${usable.usableDrives} × ${set.capacityTb} TB = ${usableTb} TB usable.`,
  };
}
