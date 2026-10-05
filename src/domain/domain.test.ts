import { describe, it, expect } from 'vitest';

import {
  METRES_PER_FOOT,
  feetToMetres,
  metresToFeet,
  pxPerMetreToPxPerFoot,
  squareMetresToSquareFeet,
  lengthToMetres,
  lengthFromMetres,
} from './units.ts';
import {
  PURPOSES,
  purposeSpec,
  requiredPxPerMetre,
  requiredPxPerFoot,
  LPR_REQUIRED_PX_PER_METRE,
  LPR_PLATE,
  datasheetDoriDistance,
} from './dori.ts';
import { sensorFormat, SENSOR_FORMATS } from './sensors.ts';
import {
  requiredHorizontalFovDeg,
  requiredFocalLengthMm,
  sceneWidthMetres,
  angleOfViewDeg,
  sceneWidthFromFovDeg,
  assessLensFit,
} from './optics.ts';
import {
  tilt,
  blindSpot,
  groundFootprint,
  camerasForArea,
  sceneWidthFromRoom,
  targetDistanceFromRoom,
} from './geometry.ts';
import {
  achievedPxPerMetre,
  assessPixelDensity,
  maxDistanceForDensity,
  MARGIN_ALLOWANCE,
} from './pixelDensity.ts';
import { assessIllumination } from './illumination.ts';
import { bitrateFor, storageGbForRetention, SUPPORTED_FPS } from './bitrate.ts';
import { poeStandard, checkPoeDraw, poeTotals } from './power.ts';

// ---------------------------------------------------------------------------
// units
// ---------------------------------------------------------------------------

describe('units', () => {
  it('uses the exact international foot', () => {
    expect(METRES_PER_FOOT).toBe(0.3048);
  });

  it('round-trips lengths', () => {
    for (const m of [0.1, 1, 4, 12.5, 100]) {
      expect(metresToFeet(feetToMetres(m))).toBeCloseTo(m, 10);
      expect(feetToMetres(metresToFeet(m))).toBeCloseTo(m, 10);
    }
  });

  it('converts px/m to px/ft in the right direction', () => {
    // A foot is shorter than a metre, so fewer pixels fit across it.
    expect(pxPerMetreToPxPerFoot(250)).toBeCloseTo(76.2, 4);
    expect(pxPerMetreToPxPerFoot(250)).toBeLessThan(250);
  });

  it('squares the factor for areas', () => {
    expect(squareMetresToSquareFeet(1)).toBeCloseTo(10.7639, 3);
  });

  it('treats metric input as a pass-through and imperial as a conversion', () => {
    expect(lengthToMetres(10, 'metric')).toBe(10);
    expect(lengthToMetres(10, 'imperial')).toBeCloseTo(3.048, 6);
    expect(lengthFromMetres(3.048, 'imperial')).toBeCloseTo(10, 6);
  });
});

// ---------------------------------------------------------------------------
// DORI
// ---------------------------------------------------------------------------

describe('DORI thresholds (IEC 62676-4:2014, via the Axis white paper)', () => {
  it('matches the published table exactly', () => {
    expect(requiredPxPerMetre('detect')).toBe(25);
    expect(requiredPxPerMetre('observe')).toBe(63);
    expect(requiredPxPerMetre('recognise')).toBe(125);
    expect(requiredPxPerMetre('identify')).toBe(250);
  });

  it('matches the published pixels-per-face figures', () => {
    expect(purposeSpec('detect').pxPerFace).toBe(4);
    expect(purposeSpec('observe').pxPerFace).toBe(10);
    expect(purposeSpec('recognise').pxPerFace).toBe(20);
    expect(purposeSpec('identify').pxPerFace).toBe(40);
  });

  it('reproduces the published px/ft column', () => {
    // The white paper prints 8 / 19 / 38 / 76 px/ft as the precise conversions.
    expect(Math.round(requiredPxPerFoot('detect'))).toBe(8);
    expect(Math.round(requiredPxPerFoot('observe'))).toBe(19);
    expect(Math.round(requiredPxPerFoot('recognise'))).toBe(38);
    expect(Math.round(requiredPxPerFoot('identify'))).toBe(76);
  });

  it('flags the four standard levels as sourced and the two inventions as estimates', () => {
    for (const id of ['detect', 'observe', 'recognise', 'identify'] as const) {
      expect(purposeSpec(id).isEstimate).toBe(false);
    }
    // Not in IEC 62676-4 — must be visibly unverified.
    expect(purposeSpec('monitor').isEstimate).toBe(true);
    expect(purposeSpec('till').isEstimate).toBe(true);
  });

  it('derives the LPR requirement from plate width, not from a made-up px/m', () => {
    // 170 px across a 0.52 m single-line EU plate.
    expect(LPR_REQUIRED_PX_PER_METRE).toBeCloseTo(326.92, 2);
    expect(LPR_REQUIRED_PX_PER_METRE * LPR_PLATE.plateWidthMetres).toBeCloseTo(170, 6);
    // ANPR is harder than face identification, which is the point.
    expect(LPR_REQUIRED_PX_PER_METRE).toBeGreaterThan(requiredPxPerMetre('identify'));
  });

  it('every purpose carries a source URL and a note', () => {
    for (const p of PURPOSES) {
      expect(p.sourceUrl).toMatch(/^https:\/\//);
      expect(p.sourceNote.length).toBeGreaterThan(10);
    }
  });

  it('maps purposes onto the datasheet DORI columns, and refuses where there is no equivalent', () => {
    const d = { detectMetres: 80, observeMetres: 31, recogniseMetres: 16, identifyMetres: 8 };
    expect(datasheetDoriDistance(d, 'detect')).toBe(80);
    expect(datasheetDoriDistance(d, 'identify')).toBe(8);
    expect(datasheetDoriDistance(d, 'till')).toBe(8);
    expect(datasheetDoriDistance(d, 'monitor')).toBeNull();
    expect(datasheetDoriDistance(d, 'lpr')).toBeNull();
  });

  it('rejects an unknown purpose at the boundary', () => {
    // @ts-expect-error deliberately violating the type to test the runtime guard
    expect(() => purposeSpec('telepathy')).toThrow(/Unknown surveillance purpose/);
  });
});

// ---------------------------------------------------------------------------
// sensors
// ---------------------------------------------------------------------------

describe('sensor formats', () => {
  it('reproduces the Sony IMX327 published active area for 1/2.8"', () => {
    const s = sensorFormat('1/2.8"');
    expect(s).not.toBeNull();
    // Sony publishes 5.57 x 3.13 mm. Our 16:9 split of the 6.4 mm diagonal must
    // land within 1% or the whole focal-length calculation is suspect.
    expect(s!.widthMm).toBeCloseTo(5.58, 2);
    expect(s!.heightMm).toBeCloseTo(3.14, 2);
    expect(Math.abs(s!.widthMm - 5.57) / 5.57).toBeLessThan(0.01);
  });

  it('uses the published IMX585 figures for 1/1.2" rather than a fitted curve', () => {
    const s = sensorFormat('1/1.2"');
    expect(s!.widthMm).toBeCloseTo(11.14, 2);
    expect(s!.heightMm).toBeCloseTo(6.26, 2);
    expect(s!.isEstimate).toBe(false);
  });

  it('is not one constant: a 1/1.2" sensor is more than twice as wide as a 1/3"', () => {
    const small = sensorFormat('1/3"')!;
    const large = sensorFormat('1/1.2"')!;
    expect(large.widthMm / small.widthMm).toBeGreaterThan(2);
  });

  it('tolerates the ways datasheets write the inch mark', () => {
    const canonical = sensorFormat('1/1.8"');
    expect(sensorFormat('1/1.8”')).toEqual(canonical);
    expect(sensorFormat('1/1.8 inch')).toEqual(canonical);
    expect(sensorFormat(' 1/1.8" ')).toEqual(canonical);
  });

  it('returns null for an unknown format instead of guessing', () => {
    expect(sensorFormat('1/9.7"')).toBeNull();
    expect(sensorFormat(null)).toBeNull();
    expect(sensorFormat('')).toBeNull();
  });

  it('keeps every row close to 16:9 and labelled with a source', () => {
    for (const s of SENSOR_FORMATS) {
      // Curve-fitted rows are split exactly 16:9; the 1/1.2" row uses Sony's
      // published active area, which is 1.7796:1 rather than 1.7778:1.
      expect(s.widthMm / s.heightMm).toBeCloseTo(16 / 9, 2);
      expect(s.sourceUrl).toMatch(/^https:\/\//);
    }
  });
});

// ---------------------------------------------------------------------------
// optics — worked examples
// ---------------------------------------------------------------------------

describe('optics', () => {
  it('worked example: 6 m of scene at 12 m needs a 28.1 degree horizontal FOV', () => {
    // 2 * atan(6 / 24) = 2 * atan(0.25) = 2 * 14.0362 deg = 28.07 deg
    expect(requiredHorizontalFovDeg(6, 12)).toBeCloseTo(28.072, 3);
  });

  it('worked example: a 90 degree FOV at 10 m covers exactly 20 m', () => {
    // 2 * 10 * tan(45 deg) = 20
    expect(sceneWidthFromFovDeg(90, 10)).toBeCloseTo(20, 9);
  });

  it('worked example: 1/1.8" sensor, 12 m away, 6 m of scene needs a 15.5 mm lens', () => {
    const s = sensorFormat('1/1.8"')!;
    // f = (7.7570 mm * 12 m) / 6 m = 15.514 mm
    expect(s.widthMm).toBeCloseTo(7.757, 3);
    expect(requiredFocalLengthMm(s.widthMm, 12, 6)).toBeCloseTo(15.514, 3);
  });

  it('focal length and scene width are exact inverses', () => {
    const s = sensorFormat('1/2.8"')!;
    const f = requiredFocalLengthMm(s.widthMm, 15, 8);
    expect(sceneWidthMetres(s.widthMm, 15, f)).toBeCloseTo(8, 9);
  });

  it('worked example: a 2.8 mm lens on a 1/2.8" sensor gives about 90 degrees', () => {
    const s = sensorFormat('1/2.8"')!;
    // 2 * atan(5.578 / 5.6) = 2 * 44.886 = 89.77 deg
    expect(angleOfViewDeg(s.widthMm, 2.8)).toBeCloseTo(89.77, 1);
  });

  it('longer focal length means a narrower angle', () => {
    const s = sensorFormat('1/1.8"')!;
    expect(angleOfViewDeg(s.widthMm, 12)).toBeLessThan(angleOfViewDeg(s.widthMm, 2.8));
  });

  it('rejects non-positive and non-finite geometry rather than returning NaN', () => {
    expect(() => requiredHorizontalFovDeg(0, 10)).toThrow(RangeError);
    expect(() => requiredHorizontalFovDeg(6, -1)).toThrow(RangeError);
    expect(() => requiredFocalLengthMm(Number.NaN, 10, 6)).toThrow(RangeError);
    expect(() => sceneWidthFromFovDeg(180, 10)).toThrow(RangeError);
  });

  describe('lens fit', () => {
    it('reports where in a varifocal range the requirement sits', () => {
      const fit = assessLensFit(7.4, 2.8, 12);
      expect(fit.fit).toBe('fits');
      expect(fit.positionInRange).toBeCloseTo(0.5, 2);
      expect(fit.explanation).toMatch(/50% through/);
    });

    it('says when the lens cannot go wide enough', () => {
      const fit = assessLensFit(1.5, 2.8, 12);
      expect(fit.fit).toBe('too-wide-needed');
      expect(fit.positionInRange).toBeNull();
      expect(fit.explanation).toMatch(/widest this model goes is 2.8 mm/);
    });

    it('says when the lens cannot go long enough', () => {
      const fit = assessLensFit(30, 2.8, 12);
      expect(fit.fit).toBe('too-long-needed');
      expect(fit.explanation).toMatch(/longest this model goes is 12 mm/);
    });

    it('treats a fixed lens as a zero-width range', () => {
      const fit = assessLensFit(4, 4, 4);
      expect(fit.fit).toBe('fits');
      expect(fit.positionInRange).toBe(0.5);
      expect(fit.explanation).toMatch(/Fixed 4 mm lens/);
    });

    it('rejects an inverted range', () => {
      expect(() => assessLensFit(5, 12, 2.8)).toThrow(RangeError);
    });
  });
});

// ---------------------------------------------------------------------------
// geometry — worked examples
// ---------------------------------------------------------------------------

describe('geometry', () => {
  it('worked example: 4 m mount, 1.6 m face height, 12 m out is 11.3 degrees of tilt', () => {
    // atan((4 - 1.6) / 12) = atan(0.2) = 11.31 deg
    const t = tilt(4, 12, 1.6);
    expect(t.tiltDeg).toBeCloseTo(11.31, 2);
    // slant = sqrt(2.4^2 + 12^2) = 12.237
    expect(t.slantRangeMetres).toBeCloseTo(12.2376, 3);
    expect(t.verdict).toBe('ok');
    expect(t.warnings).toHaveLength(0);
  });

  it('warns when the camera is looking at the tops of heads', () => {
    // 6 m mount, 2 m away -> atan(4.4/2) = 65.6 deg
    const t = tilt(6, 2, 1.6);
    expect(t.tiltDeg).toBeGreaterThan(45);
    expect(t.verdict).toBe('steep');
    expect(t.warnings[0]).toMatch(/tops of heads/);
  });

  it('warns when the camera is looking at the horizon', () => {
    const t = tilt(3, 60, 1.6);
    expect(t.verdict).toBe('shallow');
    // The wording must cover both indoor and outdoor glare — an indoor scenario
    // used to be told to expect sun glare.
    expect(t.warnings[0]).toMatch(/looking almost level/);
    expect(t.warnings[0]).toMatch(/indoors/);
  });

  it('flags the identification limit between 30 and 45 degrees without failing', () => {
    // 4 m mount, 3 m out, 1.6 m target -> atan(2.4/3) = 38.7 deg
    const t = tilt(4, 3, 1.6);
    expect(t.verdict).toBe('ok');
    expect(t.warnings[0]).toMatch(/foreshortened/);
  });

  it('worked example: blind spot for a 3 m mount at 11.3 deg tilt with a 55 deg vertical FOV', () => {
    // bottom ray = 11.31 + 27.5 = 38.81 deg; 3 / tan(38.81) = 3.731 m
    const b = blindSpot(3, 11.31, 55);
    expect(b.blindSpotMetres).toBeCloseTo(3.731, 2);
    expect(b.explanation).toMatch(/Bottom of frame points 39/);
  });

  it('has no blind spot when the bottom of the frame points straight down', () => {
    const b = blindSpot(3, 60, 70);
    expect(b.blindSpotMetres).toBe(0);
    expect(b.explanation).toMatch(/no blind spot/);
  });

  it('rejects an impossible tilt', () => {
    expect(() => blindSpot(3, 90, 55)).toThrow(RangeError);
    expect(() => blindSpot(3, -1, 55)).toThrow(RangeError);
  });

  it('worked example: trapezium footprint between 3 m and 12 m', () => {
    // 8 m wide at 12 m -> 2 m wide at 3 m. ((2 + 8) / 2) * 9 = 45 m^2
    const f = groundFootprint(3, 12, 8);
    expect(f.depthMetres).toBe(9);
    expect(f.areaSquareMetres).toBeCloseTo(45, 6);
  });

  it('collapses to zero depth when the blind spot swallows the target', () => {
    const f = groundFootprint(20, 12, 8);
    expect(f.depthMetres).toBe(0);
    expect(f.areaSquareMetres).toBe(0);
  });

  it('worked example: 500 m2 at 45 m2 per camera with 15% overlap needs 14 cameras', () => {
    // 45 * 0.85 = 38.25; ceil(500 / 38.25) = ceil(13.07) = 14
    const c = camerasForArea(500, 45, 0.15);
    expect(c.effectiveAreaPerCameraSquareMetres).toBeCloseTo(38.25, 6);
    expect(c.camerasNeeded).toBe(14);
  });

  it('never returns a fractional camera', () => {
    expect(camerasForArea(100, 45, 0).camerasNeeded).toBe(3);
  });

  it('rejects an overlap allowance of 100% or more', () => {
    expect(() => camerasForArea(100, 45, 1)).toThrow(RangeError);
  });

  it('takes the short axis as the width and the long axis as the distance', () => {
    expect(sceneWidthFromRoom(20, 8)).toBe(8);
    expect(targetDistanceFromRoom(20, 8)).toBe(20);
    expect(sceneWidthFromRoom(8, 20)).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// pixel density
// ---------------------------------------------------------------------------

describe('pixel density', () => {
  it('worked example: 2688 px across 6 m is 448 px/m, which passes identify', () => {
    expect(achievedPxPerMetre(2688, 6)).toBeCloseTo(448, 6);
    const r = assessPixelDensity(2688, 6, 250);
    expect(r.verdict).toBe('pass');
    expect(r.ratio).toBeCloseTo(1.792, 3);
  });

  it('worked example: 1920 px across 12 m is 160 px/m, which fails identify but passes recognise', () => {
    expect(achievedPxPerMetre(1920, 12)).toBe(160);
    expect(assessPixelDensity(1920, 12, 250).verdict).toBe('fail');
    expect(assessPixelDensity(1920, 12, 125).verdict).toBe('pass');
  });

  it('calls exactly-on-threshold marginal, not pass', () => {
    // 250 px/m required, so 250 px across 1 m.
    const r = assessPixelDensity(250, 1, 250);
    expect(r.ratio).toBe(1);
    expect(r.verdict).toBe('marginal');
  });

  it('only passes once the margin allowance is cleared', () => {
    const justUnder = assessPixelDensity(287, 1, 250); // 1.148x
    const justOver = assessPixelDensity(288, 1, 250); // 1.152x
    expect(justUnder.ratio).toBeLessThan(1 + MARGIN_ALLOWANCE);
    expect(justUnder.verdict).toBe('marginal');
    expect(justOver.verdict).toBe('pass');
  });

  it('reports the shortfall as a percentage in the explanation', () => {
    expect(assessPixelDensity(1920, 12, 250).explanation).toMatch(/-36%/);
  });

  it('worked example: a 4 MP camera on a 90 deg lens holds 125 px/m out to 6.7 m', () => {
    // 20 m of scene at 10 m -> 2 m of width per metre of distance.
    // d = 2688 / (125 * 2) = 10.752 m
    expect(maxDistanceForDensity(2688, 20, 10, 125)).toBeCloseTo(10.752, 3);
    // And only 5.376 m for identify.
    expect(maxDistanceForDensity(2688, 20, 10, 250)).toBeCloseTo(5.376, 3);
  });

  it('rejects a non-integer resolution', () => {
    expect(() => achievedPxPerMetre(1920.5, 6)).toThrow(RangeError);
    expect(() => achievedPxPerMetre(1920, 0)).toThrow(RangeError);
    expect(() => assessPixelDensity(1920, 6, 0)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// illumination
// ---------------------------------------------------------------------------

describe('illumination', () => {
  it('passes when the target is inside the 20%-reduced working range', () => {
    // 60 m published -> 48 m working.
    const r = assessIllumination(60, 40, null, false);
    expect(r.verdict).toBe('pass');
    expect(r.warnings).toHaveLength(0);
  });

  it('calls it marginal between the working range and the published range', () => {
    const r = assessIllumination(60, 55, null, false);
    expect(r.verdict).toBe('marginal');
    expect(r.warnings[0]).toMatch(/dim, noisy image/);
  });

  it('fails beyond the published range and says the far end will be black', () => {
    const r = assessIllumination(30, 45, null, false);
    expect(r.verdict).toBe('fail');
    expect(r.warnings[0]).toMatch(/far end of the scene will be black/);
  });

  it('does not bind when the scene is lit 24/7', () => {
    const r = assessIllumination(30, 100, null, true);
    expect(r.verdict).toBe('not-applicable');
  });

  it('cannot check an unpublished range, and says so rather than passing silently', () => {
    const r = assessIllumination(null, 40, null, false);
    expect(r.verdict).toBe('not-applicable');
    expect(r.explanation).toMatch(/Treat as unverified/);
  });

  it('warns about IR hotspot when a strong illuminator has a subject right in front of it', () => {
    const r = assessIllumination(60, 40, 1.5, false);
    expect(r.warnings.some((w) => /overexposed/.test(w))).toBe(true);
  });

  it('does not warn about hotspot for a weak illuminator', () => {
    const r = assessIllumination(20, 15, 1.5, false);
    expect(r.warnings.some((w) => /overexposed/.test(w))).toBe(false);
  });

  it('rejects a non-positive target distance', () => {
    expect(() => assessIllumination(60, 0, null, false)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// bitrate and storage
// ---------------------------------------------------------------------------

describe('bitrate (Hikvision published recommendations)', () => {
  it('reproduces the published H.265 figure for 4 MP wide at 25 fps', () => {
    // Table: 2688 x 1520, H.265, 25 fps = 4096 Kbps. Low motion = x1.
    const r = bitrateFor(2688, 1520, 'h265', 25, 'low');
    expect(r.targetKbps).toBe(4096);
    expect(r.isEstimate).toBe(false);
    expect(r.resolutionKeyUsed).toBe('2688x1520');
  });

  it('reproduces the published H.265+ target figure, which is lower than H.265', () => {
    // Table: 2688 x 1520, H.265+, 25 fps target = 2048 Kbps, max = 4096 Kbps.
    const r = bitrateFor(2688, 1520, 'h265plus', 25, 'low');
    expect(r.targetKbps).toBe(2048);
    expect(r.peakKbps).toBe(4096);
  });

  it('reproduces the published 4K H.264 figure', () => {
    expect(bitrateFor(3840, 2160, 'h264', 25, 'low').targetKbps).toBe(16384);
  });

  it('H.265 is about half of H.264 at the same resolution and frame rate', () => {
    const h264 = bitrateFor(1920, 1080, 'h264', 25, 'low').targetKbps;
    const h265 = bitrateFor(1920, 1080, 'h265', 25, 'low').targetKbps;
    expect(h265 / h264).toBeCloseTo(0.5, 6);
  });

  it('applies the published +30% allowance for a complex scene, flagged as sourced', () => {
    const r = bitrateFor(2688, 1520, 'h265', 25, 'high');
    expect(r.targetKbps).toBe(Math.round(4096 * 1.3));
    expect(r.isEstimate).toBe(false);
    expect(r.explanation).toMatch(/\+20%~30% allowance/);
  });

  it('flags the interpolated middle motion step as an estimate', () => {
    const r = bitrateFor(2688, 1520, 'h265', 25, 'moderate');
    expect(r.isEstimate).toBe(true);
    expect(r.explanation).toMatch(/Estimate/);
  });

  it('worked example: 2048 Kbps is 22.1 GB a day and 664 GB over 30 days', () => {
    // 2048 Kbps * 1000 / 8 * 86400 = 22.1184e9 bytes = 22.1184 GB
    const r = bitrateFor(2688, 1520, 'h265plus', 25, 'low');
    expect(r.storageGbPerDay).toBeCloseTo(22.1184, 4);
    expect(storageGbForRetention(r.storageGbPerDay, 30)).toBeCloseTo(663.552, 3);
  });

  it('substitutes the next LARGER published resolution and flags it, never under-estimating', () => {
    // 3040 x 1368 (the panoramic bullet) is not a published row.
    const r = bitrateFor(3040, 1368, 'h265', 25, 'low');
    expect(r.isEstimate).toBe(true);
    expect(r.explanation).toMatch(/no row for 3040x1368/);
    expect(r.targetKbps).toBeGreaterThanOrEqual(bitrateFor(2688, 1520, 'h265', 25, 'low').targetKbps);
  });

  it('refuses a frame rate Hikvision does not publish a column for', () => {
    // @ts-expect-error 18 fps is not one of the published columns
    expect(() => bitrateFor(2688, 1520, 'h265', 18, 'low')).toThrow(/columns Hikvision publishes/);
    expect(SUPPORTED_FPS).toContain(25);
  });

  it('rejects nonsense retention', () => {
    expect(() => storageGbForRetention(22, 0)).toThrow(RangeError);
    expect(() => storageGbForRetention(22, 1.5)).toThrow(RangeError);
    expect(() => storageGbForRetention(0, 30)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// PoE
// ---------------------------------------------------------------------------

describe('PoE', () => {
  it('knows the IEEE port and powered-device maxima', () => {
    expect(poeStandard('802.3af').maxPseWatts).toBe(15.4);
    expect(poeStandard('802.3af').maxPdWatts).toBe(12.95);
    expect(poeStandard('802.3at').maxPseWatts).toBe(30);
    expect(poeStandard('802.3at').maxPdWatts).toBe(25.5);
    expect(poeStandard('802.3bt-type4').maxPseWatts).toBe(100);
  });

  it('accepts a draw inside the powered-device guarantee', () => {
    const c = checkPoeDraw('802.3af', 8.5);
    expect(c.ok).toBe(true);
    expect(c.explanation).toMatch(/Budget 15.4 W at the switch port/);
  });

  it('catches a data-entry error where the draw exceeds the standard', () => {
    const c = checkPoeDraw('802.3af', 20);
    expect(c.ok).toBe(false);
    expect(c.explanation).toMatch(/EXCEEDS/);
  });

  it('falls back to the port maximum when no draw is published', () => {
    const c = checkPoeDraw('802.3at', null);
    expect(c.ok).toBe(true);
    expect(c.explanation).toMatch(/budget on the 30 W port maximum/);
  });

  it('sizes the switch on the port maxima, not the camera figures', () => {
    const totals = poeTotals([
      { standard: '802.3af', drawWatts: 7.5, quantity: 4 },
      { standard: '802.3at', drawWatts: 18, quantity: 2 },
      { standard: 'none', drawWatts: null, quantity: 3 },
    ]);
    expect(totals.portCount).toBe(6);
    expect(totals.totalCameraWatts).toBeCloseTo(4 * 7.5 + 2 * 18, 6);
    expect(totals.totalPseBudgetWatts).toBeCloseTo(4 * 15.4 + 2 * 30, 6);
    expect(totals.byStandard['PoE (802.3af)']).toBe(4);
  });

  it('uses the PD guarantee for cameras with no published draw', () => {
    const totals = poeTotals([{ standard: '802.3af', drawWatts: null, quantity: 2 }]);
    expect(totals.totalCameraWatts).toBeCloseTo(2 * 12.95, 6);
  });

  it('handles an empty project without dividing by zero', () => {
    const totals = poeTotals([]);
    expect(totals.portCount).toBe(0);
    expect(totals.explanation).toMatch(/No PoE-powered cameras/);
  });

  it('rejects a negative quantity', () => {
    expect(() => poeTotals([{ standard: '802.3af', drawWatts: 7, quantity: -1 }])).toThrow(RangeError);
  });
});
