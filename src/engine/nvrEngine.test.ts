import { describe, it, expect } from 'vitest';
import { recommendNvr, evaluateNvr, channelsNeeded, type NvrRequirement, type NvrCheckId } from './nvrEngine.ts';
import { assertNvrWeightsSumToOne } from './weights.ts';
import { nvrs, hdds, nvrById } from '../data/products.ts';
import { storageRequirement, DEFAULT_RECORDING_SCHEDULE } from '../domain/storage.ts';

/** 12 × 4 MP H.265+ cameras (2048 kbps target, 4096 kbps peak), 30 days, continuous. */
function requirement(patch: Partial<NvrRequirement> = {}, cameras = 12, retentionDays = 30, kbps = 2048): NvrRequirement {
  const storage = storageRequirement({
    streams: [{ label: 'All', quantity: cameras, targetKbps: kbps, retentionDays, bitrateIsEstimate: false }],
    schedule: DEFAULT_RECORDING_SCHEDULE,
    formattingOverhead: 0.05,
    formattingOverheadIsEstimate: true,
    headroomPercent: 20,
  });
  return {
    cameraCount: cameras,
    channelHeadroomPercent: 25,
    incomingMbps: (cameras * kbps * 2) / 1000,
    maxCameraMegapixels: 4,
    storage,
    raidLevel: 'none',
    hotSpare: false,
    poeMode: 'external',
    builtInPoeLoads: [],
    poeHeadroomPercent: 25,
    analytics: [],
    monitors: 1,
    outputResolution: '1080p',
    formFactor: 'any',
    redundantPsu: false,
    budgetTier: 'any',
    pinnedNvrId: null,
    ...patch,
  };
}

const check = (nvrId: string, req: NvrRequirement, id: NvrCheckId) => {
  const nvr = nvrById(nvrId);
  if (!nvr) throw new Error(`fixture ${nvrId} missing`);
  const c = evaluateNvr(nvr, req, hdds).checks.find((x) => x.id === id);
  if (!c) throw new Error(`check ${id} missing`);
  return c;
};

describe('NVR hard checks (I2), each with a failing case and a margin', () => {
  it('weights sum to one', () => expect(() => assertNvrWeightsSumToOne()).not.toThrow());

  it('channels: 12 cameras + 25% = 15 needed', () => {
    expect(channelsNeeded(12, 25)).toBe(15);
    expect(channelsNeeded(13, 25)).toBe(17);
    const r = requirement();
    expect(check('ds-7616ni-m2-16p', r, 'channels')).toMatchObject({ verdict: 'pass', margin: '+1 channels' });
    expect(check('ds-7608nxi-k2-8p', r, 'channels')).toMatchObject({ verdict: 'fail', margin: '−7 channels' });
  });

  it('incoming bandwidth against the sum of peak bitrates', () => {
    const r = requirement(); // 12 × 4.096 Mbps peak = 49.152 Mbps
    expect(check('ds-7616ni-m2-16p', r, 'bandwidth').verdict).toBe('pass');
    expect(check('ds-7104ni-q1-4p', r, 'bandwidth')).toMatchObject({ verdict: 'fail' });
    expect(check('ds-7104ni-q1-4p', r, 'bandwidth').margin).toMatch(/^−9\.2 Mbps$/);
  });

  it('recording resolution: an 8 MP camera on a 6 MP recorder fails', () => {
    const r = requirement({ maxCameraMegapixels: 8 });
    expect(check('ds-7108ni-q1-8p', r, 'resolution').verdict).toBe('fail');
    expect(check('ds-7616ni-m2-16p', r, 'resolution').verdict).toBe('pass');
  });

  it('storage: bays × capacity, with the drive set named', () => {
    const r = requirement(); // ≈ 23.5 TB usable needed
    const ok = check('ds-7716ni-m4', r, 'storage');
    expect(ok.verdict).toBe('pass');
    expect(ok.offered).toMatch(/TB usable/);
    expect(check('ds-7104ni-q1-4p', r, 'storage').verdict).toBe('fail');
  });

  it('RAID: requested level must be supported, hot spare too', () => {
    const r = requirement({ raidLevel: '5', hotSpare: true });
    expect(check('ds-7716ni-m4', r, 'raid').verdict).toBe('fail');
    expect(check('ds-9616nxi-i8-s', r, 'raid').verdict).toBe('pass');
    // A RAID failure also means storage cannot be configured.
    expect(check('ds-7716ni-m4', r, 'storage').verdict).toBe('fail');
  });

  it('built-in PoE: ports, budget with headroom, and per-port standard', () => {
    const loads = Array.from({ length: 8 }, () => ({ standard: '802.3at' as const, drawWatts: 12 }));
    const r = requirement({ cameraCount: 8, poeMode: 'built-in', builtInPoeLoads: loads });
    // 8 × 12 W × 1.25 = 120 W > 80 W on the K2/8P
    const budget = check('ds-7608nxi-k2-8p', r, 'poe-budget');
    expect(budget.verdict).toBe('fail');
    expect(budget.margin).toBe('−40.0 W');
    expect(check('ds-7608nxi-k2-8p', r, 'poe-ports').verdict).toBe('pass');
    expect(check('ds-7604ni-k1-4p', r, 'poe-ports').verdict).toBe('fail');
    const bt = requirement({ cameraCount: 1, poeMode: 'built-in', builtInPoeLoads: [{ standard: '802.3bt-type3', drawWatts: 40 }] });
    expect(check('ds-7616ni-m2-16p', bt, 'poe-standard').verdict).toBe('fail');
  });

  it('PoE is informational only when an external switch powers the cameras', () => {
    expect(check('ds-7716ni-m4', requirement(), 'poe-ports').verdict).toBe('info');
  });

  it('recorder analytics must all be present', () => {
    const r = requirement({ analytics: ['anpr', 'face-recognition'] });
    expect(check('ds-7616ni-m2-16p', r, 'analytics')).toMatchObject({ verdict: 'fail', margin: 'missing Face recognition' });
    expect(check('ds-9616nxi-i8-s', r, 'analytics').verdict).toBe('pass');
  });

  it('monitor outputs count HDMI only, and output resolution must reach the target', () => {
    const r = requirement({ monitors: 2, outputResolution: '4K' });
    expect(check('ds-7616ni-m2-16p', r, 'outputs').verdict).toBe('fail');
    expect(check('ds-7716ni-m4', r, 'outputs').verdict).toBe('pass');
    expect(check('ds-7108ni-q1-8p', requirement({ outputResolution: '4K' }), 'output-resolution').verdict).toBe('fail');
  });

  it('form factor and redundancy', () => {
    expect(check('ds-7616ni-m2-16p', requirement({ formFactor: 'rack' }), 'form-factor').verdict).toBe('fail');
    expect(check('ds-7716ni-m4', requirement({ formFactor: '1.5U' }), 'form-factor').verdict).toBe('pass');
    expect(check('ds-9632ni-m8', requirement({ redundantPsu: true }), 'redundancy').verdict).toBe('fail');
    expect(check('ds-9632ni-m8-r', requirement({ redundantPsu: true }), 'redundancy').verdict).toBe('pass');
  });
});

describe('NVR recommendation (I3)', () => {
  it('picks a passing recorder for a realistic 12-camera project and explains it', () => {
    const result = recommendNvr(requirement(), nvrs, hdds);
    expect(result.primary).not.toBeNull();
    const p = result.primary!;
    expect(p.evaluation.failed).toHaveLength(0);
    expect(p.evaluation.nvr.channels).toBeGreaterThanOrEqual(15);
    expect(p.why).toMatch(/channels for 12 camera/);
    expect(p.weakPoint.length).toBeGreaterThan(10);
    expect(result.alternatives.length).toBeGreaterThan(0);
    for (const a of result.alternatives) expect(a.evaluation.failed).toHaveLength(0);
    // Every rejected recorder has at least one reason.
    for (const r of result.rejections) expect(r.reasons.length).toBeGreaterThan(0);
    expect(result.rejections.length + 1 + result.alternatives.length).toBeLessThanOrEqual(nvrs.length);
  });

  it('respects a budget tier when one is set', () => {
    const r = recommendNvr(requirement({ budgetTier: 'premium', raidLevel: '5' }), nvrs, hdds);
    expect(r.primary?.evaluation.nvr.priceTier).toBe('premium');
  });

  it('never returns nothing silently: near misses and fixes when nothing passes', () => {
    // 80 cameras: more than any recorder's channel count.
    const result = recommendNvr(requirement({}, 80), nvrs, hdds);
    expect(result.primary).toBeNull();
    expect(result.nearMisses.length).toBeGreaterThan(0);
    expect(result.suggestedFixes.join(' ')).toMatch(/two recorders/);
  });
});

describe('storage ↔ recorder compatibility (I4)', () => {
  it('says the storage does not fit and suggests a larger NVR, fewer days, lower bitrate', () => {
    // 64 × 8 MP H.265 (8192 kbps) for 365 days ≈ 2.3 PB: nothing holds it.
    const result = recommendNvr(requirement({ maxCameraMegapixels: 8 }, 40, 365, 8192), nvrs, hdds);
    expect(result.primary).toBeNull();
    expect(result.storageAdvice).not.toBeNull();
    const s = result.storageAdvice!.suggestions.join(' ');
    expect(s).toMatch(/larger recorder/i);
    expect(s).toMatch(/Fewer retention days/);
    expect(s).toMatch(/Lower bitrate/);
  });

  it('a chosen recorder that cannot hold the storage is shown, failing, with storage advice', () => {
    const result = recommendNvr(requirement({ pinnedNvrId: 'ds-7608nxi-k2-8p' }, 6, 365), nvrs, hdds);
    expect(result.primary?.label).toBe('chosen by engineer');
    expect(result.primary?.evaluation.failed.map((c) => c.id)).toEqual(['storage']);
    expect(result.primary?.weakPoint).toMatch(/^FAILS:/);
    expect(result.storageAdvice?.suggestions.join(' ')).toMatch(/Fewer retention days/);
    expect(result.notices.join(' ')).toMatch(/fails/);
  });

  it('a chosen recorder that fits gets no storage advice', () => {
    const result = recommendNvr(requirement({ pinnedNvrId: 'ds-9632ni-m8' }), nvrs, hdds);
    expect(result.primary?.evaluation.failed).toHaveLength(0);
    expect(result.storageAdvice).toBeNull();
  });

  it('a stale chosen id falls back to the engine with a notice', () => {
    const result = recommendNvr(requirement({ pinnedNvrId: 'no-such-nvr' }), nvrs, hdds);
    expect(result.primary?.label).toBe('primary recommendation');
    expect(result.notices.join(' ')).toMatch(/not in the catalogue/);
  });
});
