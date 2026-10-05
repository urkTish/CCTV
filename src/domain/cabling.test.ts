import { describe, it, expect } from 'vitest';
import { computeRun, tiaCheck, packIntoBoxes, cablePlan, CableInputError, type RunInput } from './cabling.ts';
import { DEFAULT_DESIGN_SETTINGS } from './designSettings.ts';

const S = DEFAULT_DESIGN_SETTINGS.cabling; // rack drop 3 m, loop 3 m, waste 10 %, 305 m box

const run = (id: string, horizontal: number, drop = 3, kind: RunInput['kind'] = 'camera'): RunInput => ({
  id,
  label: id,
  kind,
  horizontalMetres: horizontal,
  cameraDropMetres: kind === 'uplink' ? 0 : drop,
  basis: 'drawn',
  isEstimate: false,
});

describe('run length (L1)', () => {
  it('adds route, camera drop, rack drop and service loop, then waste', () => {
    // 40 + 3 (camera at 3 m) + 3 (rack) + 3 (loop) = 49 m installed; × 1.10 = 53.9 m bought
    const r = computeRun(run('c1', 40), S);
    expect(r.installedMetres).toBeCloseTo(49, 9);
    expect(r.purchasedMetres).toBeCloseTo(53.9, 9);
    expect(r.formula).toContain('49.0 m installed');
  });

  it('gives an uplink a rack drop at both ends and no camera drop', () => {
    // 50 + 2 × 3 + 3 = 59 m
    expect(computeRun(run('u1', 50, 0, 'uplink'), S).installedMetres).toBeCloseTo(59, 9);
  });

  it('rejects a negative length', () => {
    expect(() => computeRun(run('bad', -1), S)).toThrow(CableInputError);
  });
});

describe('TIA-568 limits (L2)', () => {
  it('passes at exactly 90 m installed', () => {
    expect(tiaCheck(90, 'camera').verdict).toBe('pass');
  });

  it('flags anything over 90 m, with remedies and the cord budget left', () => {
    const t = tiaCheck(95, 'camera');
    expect(t.verdict).toBe('marginal');
    expect(t.message).toMatch(/OVER the 90 m permanent link/);
    expect(t.message).toMatch(/5\.0 m/);
    expect(t.remedies.join(' ')).toMatch(/closer/);
    expect(t.remedies.join(' ')).toMatch(/extend mode/);
    expect(t.remedies.join(' ')).toMatch(/extender/);
  });

  it('never passes a run over 100 m', () => {
    for (const L of [100.01, 120, 290, 1000]) expect(tiaCheck(L, 'camera').verdict).toBe('fail');
  });

  it('a run whose installed length crosses 90 m only because of drops and slack is still flagged', () => {
    // 82 m on the plan looks fine, but 82 + 3 + 3 + 3 = 91 m installed.
    const plan = cablePlan([run('sneaky', 82)], S);
    expect(plan.over90.map((r) => r.id)).toEqual(['sneaky']);
    expect(plan.warnings.join(' ')).toMatch(/sneaky/);
  });

  it('turns an uplink over 90 m into a fibre line item, not CAT6', () => {
    const plan = cablePlan([run('c1', 20), run('IDF-2', 120, 0, 'uplink'), run('IDF-1', 30, 0, 'uplink')], S);
    expect(plan.fibreUplinks.map((f) => f.id)).toEqual(['IDF-2']);
    expect(plan.copperUplinks.map((r) => r.id)).toEqual(['IDF-1']);
    // The fibre run is not packed into CAT6 boxes.
    expect(plan.packing.boxes.flatMap((b) => b.runIds)).not.toContain('IDF-2');
    expect(plan.warnings.join(' ')).toMatch(/must be fibre/);
  });
});

describe('box bin packing (L3)', () => {
  it('needs MORE boxes than total ÷ 305 when runs cannot share a box', () => {
    // Four 160 m runs: 640 m total → naive 3 boxes, but no box holds two runs.
    const p = packIntoBoxes(['a', 'b', 'c', 'd'].map((id) => ({ id, metres: 160 })), 305);
    expect(p.naiveBoxCount).toBe(3);
    expect(p.boxes).toHaveLength(4);
    for (const b of p.boxes) expect(b.offcutMetres).toBeCloseTo(145, 9);
  });

  it('packs first-fit decreasing', () => {
    // Sorted: 200, 150, 100, 90, 50 → box1: 200+100 = 300; box2: 150+90+50 = 290
    const p = packIntoBoxes(
      [50, 100, 200, 90, 150].map((m, i) => ({ id: `r${i}`, metres: m })),
      305,
    );
    expect(p.boxes.map((b) => b.usedMetres)).toEqual([300, 290]);
    expect(p.boxes.map((b) => b.offcutMetres)).toEqual([5, 15]);
    expect(p.totalMetres).toBe(590);
  });

  it('fits a run of exactly the remaining length', () => {
    const p = packIntoBoxes([{ id: 'a', metres: 200 }, { id: 'b', metres: 105 }], 305);
    expect(p.boxes).toHaveLength(1);
  });

  it('reports a run longer than a box instead of hiding it', () => {
    const p = packIntoBoxes([{ id: 'huge', metres: 400 }], 305);
    expect(p.boxes).toHaveLength(0);
    expect(p.oversize.map((o) => o.id)).toEqual(['huge']);
  });

  it('honours a different box length', () => {
    expect(packIntoBoxes([{ id: 'a', metres: 400 }], 500).boxes).toHaveLength(1);
  });
});

describe('connectors and patch cords (L4)', () => {
  it('counts per copper run, including copper uplinks but not fibre', () => {
    const plan = cablePlan([run('c1', 20), run('c2', 30), run('u1', 40, 0, 'uplink'), run('uf', 150, 0, 'uplink')], S);
    expect(plan.connectors).toBe(3 * 2);
    expect(plan.patchCords).toBe(3);
  });

  it('uses the configured counts', () => {
    const plan = cablePlan([run('c1', 20)], { ...S, connectorsPerRun: 4, patchCordsPerRun: 2 });
    expect(plan.connectors).toBe(4);
    expect(plan.patchCords).toBe(2);
  });
});
