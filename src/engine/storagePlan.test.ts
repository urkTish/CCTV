import { describe, it, expect } from 'vitest';
import { planDrives, isRecommendableDrive } from './storagePlan.ts';
import { hdds } from '../data/products.ts';

describe('drive configuration search (H4)', () => {
  it('fits a small requirement on one compatibility-listed drive', () => {
    const plan = planDrives({ requiredUsableTb: 3.5, level: 'none', hotSpare: false, bays: 2, maxPerBayTb: 16, drives: hdds });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.config.totalDrives).toBe(1);
    expect(plan.config.drive.capacityTb).toBe(4);
    expect(plan.config.drive.onHikvisionCompatList).toBe(true);
    expect(plan.config.usableTb).toBeGreaterThanOrEqual(3.5);
  });

  it('spreads over several bays when one drive is not enough', () => {
    // 13.4 TB on a 2-bay recorder capped at 8 TB per bay: 2 × 8 TB.
    const plan = planDrives({ requiredUsableTb: 13.4, level: 'none', hotSpare: false, bays: 2, maxPerBayTb: 8, drives: hdds });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.config.totalDrives).toBe(2);
    expect(plan.config.drive.capacityTb).toBe(8);
  });

  it('says it does not fit, with the most the recorder could hold', () => {
    const plan = planDrives({ requiredUsableTb: 40, level: 'none', hotSpare: false, bays: 2, maxPerBayTb: 16, drives: hdds });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.maxUsableTb).toBe(32);
    expect(plan.reason).toMatch(/32\.00 TB/);
  });

  it('RAID 6 with a hot spare needs more bays — and more drives — than no RAID', () => {
    const none = planDrives({ requiredUsableTb: 30, level: 'none', hotSpare: false, bays: 8, maxPerBayTb: 16, drives: hdds });
    const raid6 = planDrives({ requiredUsableTb: 30, level: '6', hotSpare: true, bays: 8, maxPerBayTb: 16, drives: hdds });
    expect(none.ok && raid6.ok).toBe(true);
    if (!none.ok || !raid6.ok) return;
    expect(raid6.config.totalDrives).toBeGreaterThan(none.config.totalDrives);
    expect(raid6.config.hotSpares).toBe(1);
    expect(raid6.config.usableTb).toBeGreaterThanOrEqual(30);
    expect(raid6.config.rawTb).toBeGreaterThan(raid6.config.usableTb);
  });

  it('refuses RAID 6 on a 2-bay recorder with the bay count as the reason', () => {
    const plan = planDrives({ requiredUsableTb: 1, level: '6', hotSpare: false, bays: 2, maxPerBayTb: 16, drives: hdds });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toMatch(/needs 4 bays/);
  });

  it('never picks a drive above the per-bay maximum, and says why it was excluded', () => {
    const plan = planDrives({ requiredUsableTb: 5, level: 'none', hotSpare: false, bays: 1, maxPerBayTb: 6, drives: hdds });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.config.drive.capacityTb).toBeLessThanOrEqual(6);
    expect(plan.excludedDrives.some((e) => /per-bay maximum/.test(e.reason))).toBe(true);
  });

  it('excludes drives rated for fewer bays than the recorder has', () => {
    const plan = planDrives({ requiredUsableTb: 2, level: 'none', hotSpare: false, bays: 16, maxPerBayTb: 16, drives: hdds });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.config.drive.maxBaysSupported ?? 99).toBeGreaterThanOrEqual(16);
    expect(plan.excludedDrives.some((e) => /up to 8 bays/.test(e.reason))).toBe(true);
  });

  it('never recommends the Hikvision IoT HDD, and gives the reason', () => {
    const hik = hdds.filter((d) => d.manufacturer === 'Hikvision');
    expect(hik.length).toBeGreaterThan(0);
    for (const d of hik) expect(isRecommendableDrive(d).ok).toBe(false);
    const plan = planDrives({ requiredUsableTb: 15, level: 'none', hotSpare: false, bays: 1, maxPerBayTb: 16, drives: hdds });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.config.drive.manufacturer).not.toBe('Hikvision');
  });

  it('offers alternatives from other drive lines', () => {
    const plan = planDrives({ requiredUsableTb: 7, level: 'none', hotSpare: false, bays: 4, maxPerBayTb: 16, drives: hdds });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const lines = [plan.config.drive.line, ...plan.alternatives.map((a) => a.drive.line)];
    expect(new Set(lines).size).toBe(lines.length);
    expect(plan.alternatives.length).toBeGreaterThan(0);
  });
});
