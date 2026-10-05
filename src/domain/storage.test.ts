import { describe, it, expect } from 'vitest';
import {
  recordingSecondsPerDay,
  storageRequirement,
  raidUsableDrives,
  raidMinimumDrives,
  driveSetCapacity,
  retentionDaysThatFit,
  StorageInputError,
  DEFAULT_RECORDING_SCHEDULE,
  type StorageRequirementInput,
} from './storage.ts';

describe('recording seconds per day (H1)', () => {
  it('continuous is the whole day', () => {
    const r = recordingSecondsPerDay({ ...DEFAULT_RECORDING_SCHEDULE, mode: 'continuous' });
    expect(r.secondsPerDay).toBe(86_400);
    expect(r.isEstimate).toBe(false);
  });

  it('motion-only scales by the motion share and is always an estimate', () => {
    const r = recordingSecondsPerDay({ ...DEFAULT_RECORDING_SCHEDULE, mode: 'motion-only', motionDutyPercent: 25 });
    expect(r.secondsPerDay).toBe(21_600);
    expect(r.isEstimate).toBe(true);
  });

  it('scheduled uses hours × 3600', () => {
    const r = recordingSecondsPerDay({ ...DEFAULT_RECORDING_SCHEDULE, mode: 'scheduled', scheduledHoursPerDay: 10 });
    expect(r.secondsPerDay).toBe(36_000);
  });

  it('rejects impossible schedules', () => {
    expect(() => recordingSecondsPerDay({ ...DEFAULT_RECORDING_SCHEDULE, mode: 'scheduled', scheduledHoursPerDay: 25 })).toThrow(StorageInputError);
    expect(() => recordingSecondsPerDay({ ...DEFAULT_RECORDING_SCHEDULE, mode: 'motion-only', motionDutyPercent: 0 })).toThrow(StorageInputError);
  });
});

describe('project storage requirement (H2)', () => {
  // Hand-computed worked example:
  //   8 cameras × 4096 kbps (8 MP H.265+ target @25 fps) × 30 days, continuous
  //   4096 kbps = 512 000 bytes/s; × 86 400 = 44.2368 GB/day per camera
  //   × 8 × 30 = 10 616.832 GB = 10.616832 TB
  //   + 20 % headroom = 12.7401984 TB
  //   ÷ (1 − 0.05) = 13.41073516 TB usable needed
  const input: StorageRequirementInput = {
    streams: [{ label: 'Car park', quantity: 8, targetKbps: 4096, retentionDays: 30, bitrateIsEstimate: false }],
    schedule: DEFAULT_RECORDING_SCHEDULE,
    formattingOverhead: 0.05,
    formattingOverheadIsEstimate: true,
    headroomPercent: 20,
  };

  it('matches the hand-computed example step by step', () => {
    const r = storageRequirement(input);
    expect(r.dataBytes / 1e12).toBeCloseTo(10.616832, 6);
    expect(r.withHeadroomBytes / 1e12).toBeCloseTo(12.7401984, 6);
    expect(r.requiredUsableTb).toBeCloseTo(13.41073516, 6);
  });

  it('sums streams with different retention periods', () => {
    const r = storageRequirement({
      ...input,
      streams: [
        ...input.streams,
        { label: 'Lobby', quantity: 2, targetKbps: 2048, retentionDays: 90, bitrateIsEstimate: false },
      ],
    });
    // Lobby: 2 × 256 000 B/s × 86 400 × 90 = 3.981312 TB
    expect(r.dataBytes / 1e12).toBeCloseTo(10.616832 + 3.981312, 6);
    expect(r.perStream).toHaveLength(2);
  });

  it('traces every step and flags the estimate', () => {
    const r = storageRequirement(input);
    expect(r.rows.map((row) => row.label)).toEqual([
      'Recorded data over the retention period',
      'With growth headroom',
      'Usable capacity needed after formatting',
    ]);
    expect(r.rows[2]!.isEstimate).toBe(true);
    expect(r.isEstimate).toBe(true);
    expect(r.rows[0]!.formula).toContain('8 × 4096 kbps × 30 d');
  });

  it('motion-only recording cuts the requirement proportionally', () => {
    const r = storageRequirement({ ...input, schedule: { ...DEFAULT_RECORDING_SCHEDULE, mode: 'motion-only', motionDutyPercent: 50 } });
    expect(r.dataBytes / 1e12).toBeCloseTo(10.616832 / 2, 6);
  });

  it('rejects bad inputs at the boundary', () => {
    expect(() => storageRequirement({ ...input, formattingOverhead: 0.6 })).toThrow(StorageInputError);
    expect(() => storageRequirement({ ...input, headroomPercent: -1 })).toThrow(StorageInputError);
    expect(() =>
      storageRequirement({ ...input, streams: [{ ...input.streams[0]!, retentionDays: 1.5 }] }),
    ).toThrow(StorageInputError);
  });

  it('inverts to a retention that fits a capacity', () => {
    const daily = 8 * 512_000 * 86_400; // bytes/day for the 8 cameras
    // 13.41073516 TB usable holds exactly 30 days at 20% headroom, 5% formatting.
    expect(retentionDaysThatFit(13.4108, daily, 0.05, 20)).toBe(30);
    expect(retentionDaysThatFit(6.7, daily, 0.05, 20)).toBe(14);
  });
});

describe('RAID arithmetic (H3)', () => {
  it('knows the minimum drive count per level', () => {
    expect([raidMinimumDrives('none'), raidMinimumDrives('1'), raidMinimumDrives('5'), raidMinimumDrives('6'), raidMinimumDrives('10')]).toEqual([1, 2, 3, 4, 4]);
  });

  it('computes usable drives per level', () => {
    expect(raidUsableDrives('none', 3)).toEqual({ ok: true, usableDrives: 3 });
    expect(raidUsableDrives('1', 2)).toEqual({ ok: true, usableDrives: 1 });
    expect(raidUsableDrives('5', 4)).toEqual({ ok: true, usableDrives: 3 });
    expect(raidUsableDrives('6', 6)).toEqual({ ok: true, usableDrives: 4 });
    expect(raidUsableDrives('10', 8)).toEqual({ ok: true, usableDrives: 4 });
  });

  it('refuses invalid drive counts with a reason', () => {
    const cases: [Parameters<typeof raidUsableDrives>[0], number][] = [
      ['5', 2],
      ['6', 3],
      ['10', 5],
      ['1', 3],
      ['none', 0],
    ];
    for (const [level, n] of cases) {
      const r = raidUsableDrives(level, n);
      expect(r.ok, `${level}/${n}`).toBe(false);
      if (!r.ok) expect(r.reason.length).toBeGreaterThan(10);
    }
  });

  it('counts a hot spare as raw but not usable capacity', () => {
    const r = driveSetCapacity({ level: '5', dataDrives: 4, hotSpares: 1, capacityTb: 8 });
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.totalDrives).toBe(5);
    expect(r.rawTb).toBe(40);
    expect(r.usableTb).toBe(24);
  });

  it('refuses a hot spare without RAID', () => {
    expect('error' in driveSetCapacity({ level: 'none', dataDrives: 2, hotSpares: 1, capacityTb: 4 })).toBe(true);
  });
});
