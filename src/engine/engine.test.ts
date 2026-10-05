import { describe, it, expect } from 'vitest';

import { cameras, cameraDataset, parseCameraDataset, CameraDataError } from '../data/cameras.ts';
import { cameraSchema, type Camera } from '../data/schema.ts';
import { recommend, capabilityLabel } from './recommend.ts';
import { WEIGHTS, assertWeightsSumToOne, pixelDensityScore } from './weights.ts';
import { buildOutputCard, CARD_FIELD_ORDER, NOT_SPECIFIED } from './outputCard.ts';
import { calculateScenario, calculateForCamera } from '../domain/calculate.ts';
import {
  defaultLocation,
  DEFAULT_GEOMETRY,
  DEFAULT_ENVIRONMENT,
  DEFAULT_REQUIREMENTS,
  type Location,
} from '../domain/types.ts';

// ---------------------------------------------------------------------------
// Dataset integrity — the thing an engineer will quote a client from
// ---------------------------------------------------------------------------

describe('camera dataset', () => {
  it('loads and validates', () => {
    expect(cameraDataset.schemaVersion).toBe(1);
    expect(cameras.length).toBeGreaterThanOrEqual(25);
  });

  it('gives every model a datasheet URL on an official Hikvision host', () => {
    for (const c of cameras) {
      expect(c.datasheetUrl, c.model).toMatch(/^https:\/\/(assets\.)?(www\.)?hikvision\.com\//);
    }
  });

  it('gives every model a verified-on date that is a real date, not in the future', () => {
    const today = new Date('2026-10-04T00:00:00Z').getTime();
    for (const c of cameras) {
      const t = Date.parse(`${c.verifiedOn}T00:00:00Z`);
      expect(Number.isNaN(t), c.model).toBe(false);
      expect(t, c.model).toBeLessThanOrEqual(today);
    }
  });

  it('has unique ids', () => {
    expect(new Set(cameras.map((c) => c.id)).size).toBe(cameras.length);
  });

  it('never has a camera whose PoE draw exceeds its own stated standard', () => {
    const limits = { '802.3af': 12.95, '802.3at': 25.5, '802.3bt-type3': 51, '802.3bt-type4': 71 };
    for (const c of cameras) {
      if (c.poeStandard === 'none' || c.poeMaxWatts === null) continue;
      expect(c.poeMaxWatts, c.model).toBeLessThanOrEqual(limits[c.poeStandard]);
    }
  });

  it('never has a lens whose wide-end FOV is narrower than its tele-end FOV', () => {
    for (const c of cameras) {
      for (const l of c.lensOptions) {
        if (l.horizontalFovWideDeg === null || l.horizontalFovTeleDeg === null) continue;
        expect(l.horizontalFovWideDeg, `${c.model} ${l.label}`).toBeGreaterThanOrEqual(
          l.horizontalFovTeleDeg,
        );
      }
    }
  });

  it('keeps every published horizontal FOV under 180 degrees so the optics stay valid', () => {
    for (const c of cameras) {
      for (const l of c.lensOptions) {
        if (l.horizontalFovWideDeg === null) continue;
        expect(l.horizontalFovWideDeg, `${c.model} ${l.label}`).toBeLessThan(180);
      }
    }
  });

  it('spans the resolutions, form factors and tiers the brief asks for', () => {
    const megapixels = new Set(cameras.map((c) => c.sensorMegapixels));
    expect(megapixels).toContain(2);
    expect(megapixels).toContain(4);
    expect(megapixels).toContain(8);

    const forms = new Set(cameras.map((c) => c.formFactor));
    for (const f of ['bullet', 'mini-bullet', 'dome', 'turret', 'ptz', 'panoramic'] as const) {
      expect(forms, f).toContain(f);
    }

    const tiers = new Set(cameras.map((c) => c.priceTier));
    expect(tiers).toEqual(new Set(['economy', 'standard', 'premium']));

    const lensTypes = new Set(cameras.map((c) => c.lensType));
    expect(lensTypes).toContain('fixed');
    expect(lensTypes).toContain('motorised-varifocal');

    const lights = new Set(cameras.map((c) => c.supplementLight));
    expect(lights).toContain('ir');
    expect(lights).toContain('white');
    expect(lights).toContain('smart-hybrid');

    expect(cameras.some((c) => c.capabilities.includes('colorvu'))).toBe(true);
    expect(cameras.some((c) => c.capabilities.includes('darkfighter'))).toBe(true);
    expect(cameras.some((c) => c.capabilities.includes('anpr'))).toBe(true);
    expect(cameras.some((c) => c.capabilities.includes('acusense'))).toBe(true);
  });

  it('rejects a corrupt dataset loudly, naming the offending path', () => {
    const broken = structuredClone(cameraDataset) as { cameras: { datasheetUrl: string }[] };
    broken.cameras[0]!.datasheetUrl = 'not-a-url';
    expect(() => parseCameraDataset(broken)).toThrow(CameraDataError);
    expect(() => parseCameraDataset(broken)).toThrow(/cameras\.0\.datasheetUrl/);
  });

  it('rejects an outdoor model with no IP rating', () => {
    const bad = { ...cameras[0]!, id: 'bad', indoorOutdoor: 'outdoor' as const, ipRating: null };
    expect(cameraSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a model with a supplement light but no published range', () => {
    const bad = {
      ...cameras[0]!,
      id: 'bad',
      supplementLight: 'ir' as const,
      irRangeMetres: null,
      whiteLightRangeMetres: null,
    };
    expect(cameraSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an unknown extra field rather than silently dropping it', () => {
    const bad = { ...cameras[0]!, somethingNew: true };
    expect(cameraSchema.safeParse(bad).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The 15-field card
// ---------------------------------------------------------------------------

describe('output card', () => {
  it('has exactly the fifteen fields the client sheet specifies, in order', () => {
    expect(CARD_FIELD_ORDER).toHaveLength(15);
    expect([...CARD_FIELD_ORDER]).toEqual([
      'Other Special Features of the Product',
      'Indoor Outdoor Usage',
      'Compatible Devices',
      'Controller Type',
      'Mount Type',
      'Color',
      'Form Factor',
      'Enclosure Material',
      'Shape',
      'Alert Type',
      'Room Type',
      'Light Source',
      'Effective Still Resolution',
      'Waterproof Rating',
      'Photo Sensor Resolution',
    ]);
  });

  it('renders every field for every camera, in order, never blank', () => {
    for (const camera of cameras) {
      const card = buildOutputCard(camera);
      expect(card.map((f) => f.name), camera.model).toEqual([...CARD_FIELD_ORDER]);
      for (const field of card) {
        expect(field.value.trim(), `${camera.model} / ${field.name}`).not.toBe('');
      }
    }
  });

  it('renders "Not specified" rather than a guess where the datasheet is silent', () => {
    const noColour = cameras.find((c) => c.colour === null);
    expect(noColour).toBeDefined();
    const colourField = buildOutputCard(noColour!).find((f) => f.name === 'Color');
    expect(colourField!.value).toBe(NOT_SPECIFIED);
  });

  it('marks the three inferred fields as derived and the rest as datasheet facts', () => {
    const card = buildOutputCard(cameras[0]!);
    const derived = card.filter((f) => f.derived).map((f) => f.name);
    expect(derived.sort()).toEqual(['Alert Type', 'Controller Type', 'Room Type']);
  });

  it('agrees with the IP rating on indoor/outdoor usage', () => {
    for (const camera of cameras) {
      const usage = buildOutputCard(camera).find((f) => f.name === 'Indoor Outdoor Usage')!.value;
      if (camera.indoorOutdoor !== 'indoor') {
        expect(usage, camera.model).toMatch(/IP\d\d|not specified/i);
      }
    }
  });

  it('puts the published light range in the Light Source field', () => {
    const colorVu = cameras.find((c) => c.supplementLight === 'white' && c.whiteLightRangeMetres)!;
    const light = buildOutputCard(colorVu).find((f) => f.name === 'Light Source')!.value;
    expect(light).toMatch(/White light \(ColorVu\), up to \d+ m/);
  });

  it('reports a Smart Hybrid model with both ranges', () => {
    const hybrid = cameras.find((c) => c.supplementLight === 'smart-hybrid')!;
    const light = buildOutputCard(hybrid).find((f) => f.name === 'Light Source')!.value;
    expect(light).toMatch(/Smart Hybrid Light/);
    expect(light).toMatch(/IR up to/);
    expect(light).toMatch(/white light up to/);
  });
});

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

describe('scoring weights', () => {
  it('sum to exactly 1 so a total score reads as a percentage', () => {
    expect(() => assertWeightsSumToOne()).not.toThrow();
    const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 12);
  });

  it('throws when someone edits one weight and forgets the others', () => {
    expect(() => assertWeightsSumToOne({ ...WEIGHTS, budget: 0.5 })).toThrow(/must sum to 1/);
  });

  it('scores pixel density with diminishing returns above the threshold', () => {
    expect(pixelDensityScore(0)).toBe(0);
    expect(pixelDensityScore(0.5)).toBeCloseTo(0.125, 6);
    expect(pixelDensityScore(1)).toBeCloseTo(0.5, 6);
    expect(pixelDensityScore(2)).toBeCloseTo(1, 6);
    expect(pixelDensityScore(10)).toBeCloseTo(1, 6);
    expect(pixelDensityScore(1.5)).toBeGreaterThan(pixelDensityScore(1.2));
  });
});

// ---------------------------------------------------------------------------
// Scenario calculation
// ---------------------------------------------------------------------------

function loc(overrides: Partial<Location> = {}): Location {
  return { ...defaultLocation('t', 'Test'), ...overrides };
}

describe('calculateScenario', () => {
  it('derives the requirement from geometry alone, with no camera involved', () => {
    const s = calculateScenario(
      loc({
        purpose: 'identify',
        geometry: { ...DEFAULT_GEOMETRY, targetDistanceMetres: 12, sceneWidthMetres: 6 },
      }),
    );
    expect(s.requiredPxPerMetre).toBe(250);
    expect(s.requiredHorizontalPixels).toBe(1500); // 250 x 6
    expect(s.requiredHorizontalFovDeg).toBeCloseTo(28.072, 3);
  });

  it('derives scene width and distance from room dimensions when asked', () => {
    const s = calculateScenario(
      loc({
        geometry: {
          ...DEFAULT_GEOMETRY,
          widthSource: 'room',
          roomLengthMetres: 20,
          roomWidthMetres: 8,
        },
      }),
    );
    expect(s.sceneWidthMetres).toBe(8);
    expect(s.targetDistanceMetres).toBe(20);
  });

  it('gives every row a formula and a label', () => {
    const s = calculateScenario(loc());
    expect(s.rows.length).toBeGreaterThan(0);
    for (const row of s.rows) {
      expect(row.label.length).toBeGreaterThan(0);
      expect(row.formula.length).toBeGreaterThan(10);
      expect(row.display.length).toBeGreaterThan(0);
    }
  });

  it('adds the plate-width row for ANPR', () => {
    const s = calculateScenario(loc({ purpose: 'lpr' }));
    const plate = s.rows.find((r) => r.label === 'Pixels across the plate');
    expect(plate).toBeDefined();
    expect(plate!.display).toBe('170 px');
  });

  it('rejects an invalid scenario at the boundary rather than producing NaN', () => {
    expect(() =>
      calculateScenario(loc({ geometry: { ...DEFAULT_GEOMETRY, mountHeightMetres: 0 } })),
    ).toThrow(/Mounting height/);
    expect(() =>
      calculateScenario(loc({ geometry: { ...DEFAULT_GEOMETRY, sceneWidthMetres: Number.NaN } })),
    ).toThrow(/Scene width/);
  });
});

describe('calculateForCamera', () => {
  const camera = cameras.find((c) => c.id === 'ds-2cd2347g2h-liu')!;

  it('gives every number a traceable formula', () => {
    const location = loc();
    const scenario = calculateScenario(location);
    const calc = calculateForCamera(location, scenario, camera, camera.lensOptions[0]!);
    expect(calc.rows.length).toBeGreaterThan(8);
    for (const row of calc.rows) {
      expect(row.formula.length, row.label).toBeGreaterThan(10);
      expect(row.display.length, row.label).toBeGreaterThan(0);
    }
  });

  it('prefers the datasheet FOV over our own sensor arithmetic at the wide end', () => {
    const location = loc({
      geometry: { ...DEFAULT_GEOMETRY, targetDistanceMetres: 10, sceneWidthMetres: 30 },
    });
    const scenario = calculateScenario(location);
    const lens = camera.lensOptions[0]!; // 2.8 mm, published 111.1 deg
    const calc = calculateForCamera(location, scenario, camera, lens);
    // Required focal length is well under 2.8 mm here, so the lens clamps to its
    // widest setting and the published angle should be used verbatim.
    expect(calc.appliedFocalLengthMm).toBe(2.8);
    expect(calc.deliveredHorizontalFovDeg).toBe(lens.horizontalFovWideDeg);
    const widthRow = calc.rows.find((r) => r.label === 'Coverage width at target')!;
    expect(widthRow.formula).toMatch(/published 111.1° horizontal FOV/);
  });

  // Regression: the bitrate warning used to fire for every default scenario,
  // because the interpolated "moderate" motion step also set `isEstimate`. The
  // warning must only appear when the RESOLUTION had to be substituted.
  it('does not warn about bitrate when the resolution is published', () => {
    const location = loc(); // 2688 x 1520, which Hikvision publishes
    const scenario = calculateScenario(location);
    const calc = calculateForCamera(location, scenario, camera, camera.lensOptions[0]!);
    expect(calc.warnings.some((w) => /publishes no bitrate figure/.test(w))).toBe(false);
    // The estimate is still surfaced on the row itself.
    const row = calc.rows.find((r) => r.label === 'Bitrate per camera')!;
    expect(row.isEstimate).toBe(true);
  });

  it('does warn when the resolution is not published', () => {
    const panoramic = cameras.find((c) => c.id === 'ds-2cd2t47g2p-lsu-sl')!; // 3040 x 1368
    const location = loc();
    const scenario = calculateScenario(location);
    const calc = calculateForCamera(location, scenario, panoramic, panoramic.lensOptions[0]!);
    expect(calc.warnings.some((w) => /publishes no bitrate figure/.test(w))).toBe(true);
  });

  // Regression: a narrow lens on a high mount can pass every pixel check while
  // seeing none of the ground on the approach. That used to render as a silent
  // "0 m2 covered".
  it('warns when the blind spot swallows the approach to the target', () => {
    const varifocal = cameras.find((c) => c.id === 'ds-2cd2646g2h-izs')!;
    const location = loc({
      geometry: {
        ...DEFAULT_GEOMETRY,
        mountHeightMetres: 3,
        targetDistanceMetres: 8,
        sceneWidthMetres: 5,
      },
    });
    const scenario = calculateScenario(location);
    const calc = calculateForCamera(location, scenario, varifocal, varifocal.lensOptions[0]!);
    expect(calc.blindSpotMetres).toBeGreaterThan(location.geometry.targetDistanceMetres * 0.6);
    expect(calc.warnings.some((w) => /ground (coverage|depth)/.test(w))).toBe(true);
  });

  it('emits the phase-2 figures (bitrate, storage, PoE) even though phase 2 is not built', () => {
    const location = loc();
    const scenario = calculateScenario(location);
    const calc = calculateForCamera(location, scenario, camera, camera.lensOptions[0]!);
    expect(calc.bitrate.targetKbps).toBeGreaterThan(0);
    expect(calc.storageGbForRetention).toBeGreaterThan(0);
    expect(calc.poe.standard.id).toBe(camera.poeStandard);
  });

  it('cross-checks against the datasheet DORI distance when one is published', () => {
    const location = loc({ purpose: 'recognise' });
    const scenario = calculateScenario(location);
    const calc = calculateForCamera(location, scenario, camera, camera.lensOptions[0]!);
    expect(calc.datasheetDoriMetres).toBe(camera.doriAtWidestLens!.recogniseMetres);
    expect(calc.rows.some((r) => r.label === 'Datasheet DORI cross-check')).toBe(true);
  });

  it('clamps a varifocal to the focal length the scene needs', () => {
    const varifocal = cameras.find((c) => c.id === 'ds-2cd2646g2h-izs')!;
    const location = loc({
      geometry: { ...DEFAULT_GEOMETRY, targetDistanceMetres: 25, sceneWidthMetres: 5 },
    });
    const scenario = calculateScenario(location);
    const calc = calculateForCamera(location, scenario, varifocal, varifocal.lensOptions[0]!);
    // f = (5.23 mm * 25) / 5 = 26 mm, beyond the 12 mm top of the lens.
    expect(calc.requiredFocalLengthMm!).toBeGreaterThan(12);
    expect(calc.appliedFocalLengthMm).toBe(12);
    expect(calc.lensFit!.fit).toBe('too-long-needed');
  });
});

// ---------------------------------------------------------------------------
// The recommendation engine
// ---------------------------------------------------------------------------

describe('recommend', () => {
  /** The brief's definition-of-done scenario. */
  const gateAtNight: Location = loc({
    name: 'Main gate',
    purpose: 'identify',
    geometry: {
      ...DEFAULT_GEOMETRY,
      mountHeightMetres: 4,
      targetDistanceMetres: 12,
      sceneWidthMetres: 4,
      targetHeightMetres: 1.6,
    },
    environment: {
      ...DEFAULT_ENVIRONMENT,
      site: 'outdoor',
      ambientLight: 'zero-lux',
      colourAtNight: true,
    },
    requirements: { ...DEFAULT_REQUIREMENTS, cameraCount: 1 },
  });

  it('answers the brief’s worked scenario with a real model and alternatives', () => {
    const result = recommend(gateAtNight);
    expect(result.error).toBeNull();
    expect(result.primary).not.toBeNull();
    expect(result.primary!.calculation.pixelDensity.verdict).not.toBe('fail');
    // Identify-grade in colour at 12 m is demanding: only the two colour-capable
    // models that can reach 250 px/m at that distance survive, so one alternative
    // is the honest answer here rather than a padded three.
    expect(result.alternatives.length).toBeGreaterThanOrEqual(1);
    expect(result.alternatives.length).toBeLessThanOrEqual(3);
  });

  it('offers a full set of three alternatives when the scenario is less demanding', () => {
    const result = recommend(
      loc({
        purpose: 'recognise',
        geometry: {
          ...DEFAULT_GEOMETRY,
          mountHeightMetres: 4,
          targetDistanceMetres: 12,
          sceneWidthMetres: 4,
        },
      }),
    );
    expect(result.primary).not.toBeNull();
    expect(result.alternatives).toHaveLength(3);
  });

  it('only recommends models that can actually do colour at night for that scenario', () => {
    const result = recommend(gateAtNight);
    for (const rec of [result.primary!, ...result.alternatives]) {
      const cam = rec.calculation.camera;
      const canColour =
        cam.capabilities.includes('colorvu') ||
        cam.capabilities.includes('smart-hybrid-light') ||
        cam.whiteLightRangeMetres !== null;
      expect(canColour, cam.model).toBe(true);
    }
  });

  it('explains every result and names a weak point for each', () => {
    const result = recommend(gateAtNight);
    for (const rec of [result.primary!, ...result.alternatives]) {
      expect(rec.why.length, rec.calculation.camera.model).toBeGreaterThan(40);
      expect(rec.weakPoint.length, rec.calculation.camera.model).toBeGreaterThan(20);
    }
  });

  it('labels the primary and gives each alternative a distinct trade-off', () => {
    const result = recommend(gateAtNight);
    expect(result.primary!.label).toBe('primary recommendation');
    const labels = result.alternatives.map((a) => a.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('reports what was rejected and why, in words an engineer can repeat', () => {
    const result = recommend(gateAtNight);
    expect(result.rejections.length).toBeGreaterThan(0);
    const irOnly = result.rejections.find((r) => r.constraint === 'colour-at-night');
    expect(irOnly).toBeDefined();
    expect(irOnly!.reason).toMatch(/monochrome after dark/);
    for (const r of result.rejections) {
      expect(r.reason.length, r.model).toBeGreaterThan(15);
    }
  });

  it('never shows the same model twice', () => {
    const result = recommend(gateAtNight);
    const ids = [result.primary!, ...result.alternatives].map((r) => r.calculation.camera.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is deterministic', () => {
    const a = recommend(gateAtNight);
    const b = recommend(gateAtNight);
    expect(a.primary!.calculation.camera.id).toBe(b.primary!.calculation.camera.id);
    expect(a.alternatives.map((x) => x.calculation.camera.id)).toEqual(
      b.alternatives.map((x) => x.calculation.camera.id),
    );
  });

  it('rules out indoor-only and low-IP models outdoors', () => {
    const indoorOnly: Camera = {
      ...cameras[0]!,
      id: 'fake-indoor',
      model: 'FAKE-INDOOR',
      indoorOutdoor: 'indoor',
      ipRating: null,
    };
    const result = recommend(gateAtNight, [indoorOnly]);
    expect(result.primary).toBeNull();
    expect(result.rejections[0]!.constraint).toBe('indoor-outdoor');
    expect(result.rejections[0]!.reason).toMatch(/rated indoor only/);
  });

  it('rules out models without IK10 when vandal exposure is flagged', () => {
    const result = recommend(
      loc({
        ...gateAtNight,
        environment: { ...gateAtNight.environment, vandalExposure: true },
      }),
    );
    expect(result.rejections.some((r) => r.constraint === 'vandal-resistance')).toBe(true);
    for (const rec of [result.primary, ...result.alternatives].filter((r) => r !== null)) {
      expect(rec!.calculation.camera.ikRating).toBe('IK10');
    }
  });

  it('rules out PTZ when PTZ is not acceptable, and allows it when it is', () => {
    const withoutPtz = recommend(gateAtNight);
    expect(withoutPtz.rejections.some((r) => r.constraint === 'form-factor-ptz')).toBe(true);

    const ptzOk = recommend(
      loc({ ...gateAtNight, requirements: { ...gateAtNight.requirements, ptzAcceptable: true } }),
    );
    expect(ptzOk.rejections.some((r) => r.constraint === 'form-factor-ptz')).toBe(false);
  });

  it('honours a required capability as a hard constraint', () => {
    const result = recommend(
      loc({
        purpose: 'lpr',
        geometry: { ...DEFAULT_GEOMETRY, targetDistanceMetres: 8, sceneWidthMetres: 3 },
        requirements: { ...DEFAULT_REQUIREMENTS, requiredCapabilities: ['anpr'] },
      }),
    );
    for (const rec of [result.primary, ...result.alternatives].filter((r) => r !== null)) {
      expect(rec!.calculation.camera.capabilities, rec!.calculation.camera.model).toContain('anpr');
    }
    const rejected = result.rejections.find((r) => r.constraint === 'capability');
    expect(rejected!.reason).toMatch(/ANPR \/ licence-plate recognition was required/);
  });

  it('honours a required capability as a hard constraint even when nothing has it', () => {
    const result = recommend(
      loc({ requirements: { ...DEFAULT_REQUIREMENTS, requiredCapabilities: ['people-counting'] } }),
    );
    expect(result.primary).toBeNull();
    expect(result.rejections).toHaveLength(cameras.length);
    expect(result.suggestedFixes[0]).toMatch(/ruled out on the same constraint/);
  });

  it('never returns nothing silently: names the constraint, the near misses and the fix', () => {
    // Identify a face across 40 m of scene at 60 m. Nothing in the catalogue can.
    const impossible = loc({
      purpose: 'identify',
      geometry: {
        ...DEFAULT_GEOMETRY,
        mountHeightMetres: 6,
        targetDistanceMetres: 60,
        sceneWidthMetres: 40,
      },
    });
    const result = recommend(impossible);
    expect(result.primary).toBeNull();
    expect(result.nearMisses.length).toBeGreaterThan(0);
    expect(result.suggestedFixes.length).toBeGreaterThan(0);
    expect(result.nearMisses[0]!.shortfall).toMatch(/short by \d+%/);
    expect(result.suggestedFixes.join(' ')).toMatch(/Move the camera closer|narrow the scene/);
    expect(result.suggestedFixes.join(' ')).toMatch(/recognise/);
  });

  it('returns the scenario error rather than throwing when the geometry is invalid', () => {
    const result = recommend(loc({ geometry: { ...DEFAULT_GEOMETRY, targetDistanceMetres: -5 } }));
    expect(result.error).toMatch(/Target distance/);
    expect(result.primary).toBeNull();
  });

  it('picks a lower-resolution model for an undemanding purpose than for identify', () => {
    const base = {
      ...DEFAULT_GEOMETRY,
      mountHeightMetres: 4,
      targetDistanceMetres: 12,
      sceneWidthMetres: 8,
    };
    const detect = recommend(loc({ purpose: 'detect', geometry: base }));
    const identify = recommend(loc({ purpose: 'identify', geometry: base }));
    expect(detect.primary).not.toBeNull();
    // Identify over 8 m of scene needs 2000 px, so if anything is recommended it
    // must be a higher-resolution model than the detect answer.
    if (identify.primary) {
      expect(identify.primary.calculation.camera.maxResolutionWidthPx).toBeGreaterThanOrEqual(
        detect.primary!.calculation.camera.maxResolutionWidthPx,
      );
    }
  });

  it('labels every capability it can reject on', () => {
    for (const c of cameras.flatMap((x) => x.capabilities)) {
      expect(capabilityLabel(c).length).toBeGreaterThan(2);
    }
  });
});
