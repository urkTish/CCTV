import { describe, it, expect } from 'vitest';
import { findCamerasForNvr, lensFor, CameraFinderError, type CameraFinderRequest } from './cameraFinder.ts';
import { cameraById } from '../data/cameras.ts';

function request(patch: Partial<CameraFinderRequest> = {}): CameraFinderRequest {
  return {
    nvrId: 'ds-7616ni-m2-16p',
    minMegapixels: null,
    focalLengthMm: null,
    formFactor: 'any',
    placement: 'any',
    quantity: 1,
    poeFromNvr: false,
    ...patch,
  };
}

describe('camera finder', () => {
  it('returns only cameras that meet the resolution and lens asked for, closest resolution first', () => {
    const r = findCamerasForNvr(request({ minMegapixels: 4, focalLengthMm: 4 }));
    expect(r.matches.length).toBeGreaterThan(0);
    for (const m of r.matches) {
      expect(m.megapixels).toBeGreaterThanOrEqual(4);
      expect(lensFor(m.camera, 4)).not.toBeNull();
    }
    expect(r.matches[0]?.megapixels).toBe(4);
    expect(r.nearMisses).toEqual([]);
  });

  it('matches a fixed lens exactly but lets a varifocal span the focal length', () => {
    const fixed = cameraById('ds-2cd2143g2-iu');
    const vari = cameraById('ds-2cd2646g2h-izs');
    if (!fixed || !vari) throw new Error('fixtures missing');
    expect(lensFor(fixed, 4)?.label).toBe('4 mm');
    expect(lensFor(fixed, 6)).toBeNull();
    expect(lensFor(vari, 6)).not.toBeNull();
  });

  it('drops cameras the recorder cannot record at full resolution', () => {
    // DS-7104NI-Q1/4P records up to 6 MP; the 8 MP models must be rejected for it.
    const r = findCamerasForNvr(request({ nvrId: 'ds-7104ni-q1-4p', minMegapixels: 8 }));
    expect(r.matches).toEqual([]);
    expect(r.notices.some((n) => n.includes('records up to 6 MP'))).toBe(true);
    expect(r.nearMisses.every((m) => m.megapixels <= 6)).toBe(true);
  });

  it('says so when nothing in the catalogue is that resolution, and shows the nearest cameras', () => {
    const r = findCamerasForNvr(request({ nvrId: 'ds-9632ni-m8', minMegapixels: 12, focalLengthMm: 4 }));
    expect(r.matches).toEqual([]);
    expect(r.notices.some((n) => n.includes("highest resolution is 8 MP"))).toBe(true);
    expect(r.nearMisses.length).toBeGreaterThan(0);
    expect(r.nearMisses[0]?.megapixels).toBe(8);
    expect(r.nearMisses[0]?.failed.map((f) => f.id)).toEqual(['megapixels']);
  });

  it('checks channels and incoming bandwidth for the quantity asked', () => {
    const r = findCamerasForNvr(request({ nvrId: 'ds-7104ni-q1-4p', quantity: 5 }));
    expect(r.matches).toEqual([]);
    expect(r.rejected.every((m) => m.failed.some((f) => f.id === 'channels'))).toBe(true);
  });

  it('checks PoE ports, class and budget when the recorder powers the cameras', () => {
    const noPoe = findCamerasForNvr(request({ nvrId: 'ds-7716ni-m4', poeFromNvr: true }));
    expect(noPoe.matches).toEqual([]);
    const poe = findCamerasForNvr(request({ nvrId: 'ds-7616ni-m2-16p', poeFromNvr: true, quantity: 16 }));
    for (const m of poe.matches) expect(m.checks.some((c) => c.id === 'poe-budget' && c.pass)).toBe(true);
  });

  it('filters on form factor and placement', () => {
    const r = findCamerasForNvr(request({ formFactor: 'turret', placement: 'outdoor' }));
    expect(r.matches.length).toBeGreaterThan(0);
    for (const m of r.matches) {
      expect(m.camera.formFactor).toBe('turret');
      expect(m.camera.indoorOutdoor).not.toBe('indoor');
    }
  });

  it('rejects an unknown recorder and a bad quantity', () => {
    expect(() => findCamerasForNvr(request({ nvrId: 'nope' }))).toThrow(CameraFinderError);
    expect(() => findCamerasForNvr(request({ quantity: 0 }))).toThrow(CameraFinderError);
  });
});
