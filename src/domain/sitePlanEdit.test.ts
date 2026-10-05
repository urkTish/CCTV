import { describe, it, expect } from 'vitest';
import {
  calibrate,
  connectCamera,
  fovCone,
  moveDevice,
  nextId,
  normaliseDeg,
  placeCamera,
  placeNvr,
  placeSwitch,
  pruneCameras,
  removeDevice,
  replaceImage,
  rotateCamera,
  routeBetween,
  setRoute,
  setRunOverride,
  endpointIdOf,
  placedCamera,
} from './sitePlanEdit.ts';
import { EMPTY_SITE_PLAN, SitePlanError, metresPerPixel, horizontalRunBetween, type PlacedCamera, type SitePlan } from './sitePlan.ts';
import {
  readImageHeader,
  planImageFromBytes,
  checkPlanFile,
  PDF_UNSUPPORTED_MESSAGE,
  MAX_PLAN_IMAGE_BYTES,
} from './planImage.ts';

const cal = { a: { x: 0, y: 0 }, b: { x: 300, y: 400 }, metres: 25 }; // 0.05 m/px

function basePlan(): SitePlan {
  let p = calibrate(EMPTY_SITE_PLAN, cal);
  p = placeNvr(p, { x: 100, y: 100 });
  p = placeSwitch(p, { x: 600, y: 100 });
  p = placeCamera(p, 'loc-1', 1, { x: 600, y: 500 });
  return p;
}

function cam(p: SitePlan): PlacedCamera {
  return placedCamera(p, 'loc-1', 1)!;
}

describe('plan edits (M2–M4)', () => {
  it('gives each new device a fresh id and a default label', () => {
    const p = basePlan();
    expect(p.devices.map((d) => d.id)).toEqual(['nvr-1', 'sw-1', 'cam-1']);
    expect(nextId(p, 'sw')).toBe('sw-2');
    const p2 = placeSwitch(p, { x: 0, y: 0 });
    expect(p2.devices.at(-1)).toMatchObject({ id: 'sw-2', label: 'Switch 2' });
  });

  it('moves rather than duplicates a camera that is already placed', () => {
    const p = placeCamera(basePlan(), 'loc-1', 1, { x: 10, y: 20 });
    expect(p.devices.filter((d) => d.kind === 'camera')).toHaveLength(1);
    expect(cam(p)).toMatchObject({ x: 10, y: 20 });
  });

  it('keeps positions on the canvas', () => {
    const p = moveDevice(basePlan(), 'cam-1', { x: -50, y: 99_999 });
    // No image → the 1000 × 700 blank canvas.
    expect(cam(p)).toMatchObject({ x: 0, y: 700 });
  });

  it('normalises rotation into 0–360°', () => {
    expect(normaliseDeg(-90)).toBe(270);
    expect(normaliseDeg(725)).toBe(5);
    expect(cam(rotateCamera(basePlan(), 'cam-1', -45)).rotationDeg).toBe(315);
  });

  it('re-cabling a camera drops the route drawn to its old endpoint', () => {
    let p = setRoute(basePlan(), 'cam-1', 'nvr-1', [{ x: 100, y: 500 }]);
    expect(routeBetween(p, 'cam-1', 'nvr-1')).not.toBeNull();
    p = connectCamera(p, 'cam-1', 'sw-1');
    expect(endpointIdOf(p, cam(p))).toBe('sw-1');
    expect(p.routes).toHaveLength(0);
    expect(() => connectCamera(p, 'cam-1', 'cam-1')).toThrow(SitePlanError);
  });

  it('removing a switch frees its cameras back to the NVR and removes its routes', () => {
    let p = connectCamera(basePlan(), 'cam-1', 'sw-1');
    p = setRoute(p, 'cam-1', 'sw-1', []);
    p = removeDevice(p, 'sw-1');
    expect(cam(p).connectTo).toBeNull();
    expect(p.routes).toHaveLength(0);
    expect(endpointIdOf(p, cam(p))).toBe('nvr-1');
  });

  it('a typed run length overrides the plan, and is not an estimate', () => {
    const p = setRunOverride(basePlan(), 'cam-1', 42);
    const run = horizontalRunBetween(p, cam(p), p.devices[0]!, 1.3);
    expect(run).toMatchObject({ metres: 42, basis: 'entered' });
    // Works on an uncalibrated plan too — the list alternative needs no drawing.
    const uncal = { ...p, calibration: null };
    expect(horizontalRunBetween(uncal, cam(uncal), uncal.devices[0]!, 1.3).metres).toBe(42);
    expect(() => setRunOverride(p, 'cam-1', -1)).toThrow(SitePlanError);
  });

  it('a new image invalidates the calibration but keeps the devices', () => {
    const p = replaceImage(basePlan(), { dataUri: 'data:image/png;base64,AA==', widthPx: 2000, heightPx: 1000, fileName: 'x.png' });
    expect(p.calibration).toBeNull();
    expect(p.devices).toHaveLength(3);
  });

  it('refuses a degenerate calibration', () => {
    expect(() => calibrate(EMPTY_SITE_PLAN, { ...cal, b: cal.a })).toThrow(SitePlanError);
    expect(() => calibrate(EMPTY_SITE_PLAN, { ...cal, metres: -3 })).toThrow(SitePlanError);
  });

  it('prunes cameras whose location is gone or whose index is past the count', () => {
    let p = placeCamera(basePlan(), 'loc-1', 2, { x: 0, y: 0 });
    p = placeCamera(p, 'loc-9', 1, { x: 0, y: 0 });
    const pruned = pruneCameras(p, [{ id: 'loc-1', cameraCount: 1 }]);
    expect(pruned.devices.filter((d) => d.kind === 'camera').map((d) => d.id)).toEqual(['cam-1']);
  });
});

describe('FOV cone geometry', () => {
  it('points up at 0° and has the coverage distance as its radius', () => {
    // 10 m at 0.05 m/px = 200 px. 90° wedge facing up.
    const pts = fovCone({ x: 500, y: 500 }, 0, 90, 10, 0.05, 2);
    expect(pts).toHaveLength(4);
    expect(pts[0]).toEqual({ x: 500, y: 500 });
    // Left edge at −45°, centre straight up, right edge at +45°.
    expect(pts[1]!.x).toBeCloseTo(500 - 200 * Math.SQRT1_2, 9);
    expect(pts[1]!.y).toBeCloseTo(500 - 200 * Math.SQRT1_2, 9);
    expect(pts[2]!.x).toBeCloseTo(500, 9);
    expect(pts[2]!.y).toBeCloseTo(300, 9);
    expect(pts[3]!.x).toBeCloseTo(500 + 200 * Math.SQRT1_2, 9);
  });

  it('rotates clockwise: 90° faces right on the plan', () => {
    const pts = fovCone({ x: 0, y: 0 }, 90, 10, 5, metresPerPixel(cal), 2);
    // 5 m = 100 px, centre ray along +x.
    expect(pts[2]!.x).toBeCloseTo(100, 9);
    expect(pts[2]!.y).toBeCloseTo(0, 9);
  });

  it('draws nothing without a scale', () => {
    expect(fovCone({ x: 0, y: 0 }, 0, 90, 10, 0)).toEqual([]);
  });
});

// --- M1: upload path ---------------------------------------------------------

function pngBytes(w: number, h: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const dv = new DataView(b.buffer);
  dv.setUint32(16, w);
  dv.setUint32(20, h);
  return b;
}

function jpegBytes(w: number, h: number): Uint8Array {
  // SOI, an APP0 segment of length 16, then SOF0 with height/width.
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...new Array<number>(14).fill(0)];
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff, 0x03];
  return Uint8Array.from([0xff, 0xd8, ...app0, ...sof, 0xff, 0xd9]);
}

describe('plan image upload (M1)', () => {
  it('reads the pixel size out of a PNG and a JPEG header', () => {
    expect(readImageHeader(pngBytes(2480, 1754))).toEqual({ format: 'png', widthPx: 2480, heightPx: 1754 });
    expect(readImageHeader(jpegBytes(4000, 3000))).toEqual({ format: 'jpeg', widthPx: 4000, heightPx: 3000 });
  });

  it('builds a data URI the project file accepts', () => {
    const r = planImageFromBytes('plan.png', pngBytes(10, 20));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.image).toMatchObject({ widthPx: 10, heightPx: 20, fileName: 'plan.png' });
    expect(r.image.dataUri).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/);
  });

  it('trusts the bytes, not the file name', () => {
    const r = planImageFromBytes('plan.png', jpegBytes(5, 5));
    expect(r.ok && r.image.dataUri.startsWith('data:image/jpeg')).toBe(true);
    const junk = planImageFromBytes('plan.png', new TextEncoder().encode('<svg></svg>'));
    expect(!junk.ok && junk.reason).toMatch(/not a PNG or JPEG/);
  });

  it('says plainly that PDF is not supported', () => {
    expect(checkPlanFile({ name: 'ground-floor.pdf', type: 'application/pdf', size: 1000 })).toBe(PDF_UNSUPPORTED_MESSAGE);
    const r = planImageFromBytes('scan', new TextEncoder().encode('%PDF-1.7 ...'));
    expect(!r.ok && r.reason).toBe(PDF_UNSUPPORTED_MESSAGE);
    expect(PDF_UNSUPPORTED_MESSAGE).toMatch(/export .* as PNG or JPG/);
  });

  it('refuses an empty or oversized file before reading it', () => {
    expect(checkPlanFile({ name: 'a.png', type: 'image/png', size: 0 })).toMatch(/empty/);
    expect(checkPlanFile({ name: 'a.png', type: 'image/png', size: MAX_PLAN_IMAGE_BYTES + 1 })).toMatch(/Downscale/);
    expect(checkPlanFile({ name: 'a.png', type: 'image/png', size: 1000 })).toBeNull();
  });
});
