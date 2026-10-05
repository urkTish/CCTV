/**
 * The orchestrator: scenario in, one fully traceable result out.
 *
 * Two layers:
 *
 *   `calculateScenario`   — everything that depends only on the client's
 *                           geometry and purpose. No camera involved. This is the
 *                           "what the job needs" column.
 *   `calculateForCamera`  — what a specific model and lens actually delivers
 *                           against that requirement.
 *
 * Keeping them apart is what lets the UI show an honest "required" figure even
 * when no camera fits, and lets the no-result path name the binding constraint.
 *
 * Every number this module returns is a `TracedValue` carrying the formula that
 * produced it and the source of its constants, because the brief forbids magic
 * numbers on screen.
 */

import {
  purposeSpec,
  datasheetDoriDistance,
  type Purpose,
  LPR_PLATE,
  LPR_SOURCE_URL,
} from './dori.ts';
import { sensorFormat, type SensorFormat } from './sensors.ts';
import {
  requiredHorizontalFovDeg,
  requiredFocalLengthMm,
  sceneWidthMetres as sceneWidthFromFocal,
  sceneWidthFromFovDeg,
  angleOfViewDeg,
  assessLensFit,
  FOCAL_LENGTH_SOURCE_URL,
  FOV_SOURCE_URL,
  type LensFitResult,
} from './optics.ts';
import {
  tilt,
  blindSpot,
  groundFootprint,
  camerasForArea,
  sceneWidthFromRoom,
} from './geometry.ts';
import { assessPixelDensity, MARGIN_ALLOWANCE, type PixelDensityResult } from './pixelDensity.ts';
import { assessIllumination, IR_HEADROOM, type IlluminationResult } from './illumination.ts';
import { bitrateFor, storageGbForRetention, BITRATE_SOURCE_URL, type BitrateResult } from './bitrate.ts';
import { checkPoeDraw, POE_SOURCE_URL, type PoeCheck } from './power.ts';
import type { Camera, LensOption } from '../data/schema.ts';
import type { Location, TracedValue } from './types.ts';

export class ScenarioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScenarioError';
  }
}

export interface ScenarioResult {
  readonly purpose: Purpose;
  readonly requiredPxPerMetre: number;
  readonly requiredPxPerMetreIsEstimate: boolean;
  readonly sceneWidthMetres: number;
  readonly targetDistanceMetres: number;
  readonly requiredHorizontalFovDeg: number;
  /** Total horizontal pixels the scene needs, independent of any camera. */
  readonly requiredHorizontalPixels: number;
  readonly rows: readonly TracedValue[];
}

/** Validate a location's geometry at the boundary and normalise derived fields. */
function resolvedGeometry(location: Location): {
  sceneWidthMetres: number;
  targetDistanceMetres: number;
  mountHeightMetres: number;
} {
  const g = location.geometry;
  const bad = (name: string, v: number) =>
    new ScenarioError(`${name} must be a finite positive number, got ${String(v)}`);

  if (!Number.isFinite(g.mountHeightMetres) || g.mountHeightMetres <= 0) {
    throw bad('Mounting height', g.mountHeightMetres);
  }

  let sceneWidthMetres: number;
  let targetDistanceMetres: number;
  if (g.widthSource === 'room') {
    if (!Number.isFinite(g.roomLengthMetres) || g.roomLengthMetres <= 0) {
      throw bad('Room length', g.roomLengthMetres);
    }
    if (!Number.isFinite(g.roomWidthMetres) || g.roomWidthMetres <= 0) {
      throw bad('Room width', g.roomWidthMetres);
    }
    sceneWidthMetres = sceneWidthFromRoom(g.roomLengthMetres, g.roomWidthMetres);
    // Looking down the long axis from one end is the worst case, so the distance
    // the camera must hold its pixel density over is the room's long axis.
    targetDistanceMetres = Math.max(g.roomLengthMetres, g.roomWidthMetres);
  } else {
    if (!Number.isFinite(g.sceneWidthMetres) || g.sceneWidthMetres <= 0) {
      throw bad('Scene width', g.sceneWidthMetres);
    }
    if (!Number.isFinite(g.targetDistanceMetres) || g.targetDistanceMetres <= 0) {
      throw bad('Target distance', g.targetDistanceMetres);
    }
    sceneWidthMetres = g.sceneWidthMetres;
    targetDistanceMetres = g.targetDistanceMetres;
  }

  return { sceneWidthMetres, targetDistanceMetres, mountHeightMetres: g.mountHeightMetres };
}

export function calculateScenario(location: Location): ScenarioResult {
  const { sceneWidthMetres, targetDistanceMetres } = resolvedGeometry(location);
  const spec = purposeSpec(location.purpose);

  const fovDeg = requiredHorizontalFovDeg(sceneWidthMetres, targetDistanceMetres);
  const requiredHorizontalPixels = Math.ceil(spec.requiredPxPerMetre * sceneWidthMetres);

  const rows: TracedValue[] = [
    {
      label: 'Required pixel density',
      display: `${spec.requiredPxPerMetre.toFixed(0)} px/m`,
      value: spec.requiredPxPerMetre,
      formula: `${spec.label}: ${spec.sourceNote}`,
      sourceUrl: spec.sourceUrl,
      isEstimate: spec.isEstimate,
      verdict: 'info',
    },
    {
      label: 'Required horizontal resolution',
      display: `${requiredHorizontalPixels} px across the scene`,
      value: requiredHorizontalPixels,
      formula: `${spec.requiredPxPerMetre.toFixed(0)} px/m x ${sceneWidthMetres.toFixed(2)} m of scene width = ${requiredHorizontalPixels} px.`,
      sourceUrl: spec.sourceUrl,
      isEstimate: spec.isEstimate,
      verdict: 'info',
    },
    {
      label: 'Required horizontal field of view',
      display: `${fovDeg.toFixed(1)}°`,
      value: fovDeg,
      formula: `2 x atan(width / (2 x distance)) = 2 x atan(${sceneWidthMetres.toFixed(2)} / (2 x ${targetDistanceMetres.toFixed(2)})) = ${fovDeg.toFixed(1)}°.`,
      sourceUrl: FOV_SOURCE_URL,
      isEstimate: false,
      verdict: 'info',
    },
  ];

  if (location.purpose === 'lpr') {
    const platePixels = spec.requiredPxPerMetre * LPR_PLATE.plateWidthMetres;
    rows.push({
      label: 'Pixels across the plate',
      display: `${platePixels.toFixed(0)} px`,
      value: platePixels,
      formula: `${spec.requiredPxPerMetre.toFixed(0)} px/m x ${LPR_PLATE.plateWidthMetres} m plate width = ${platePixels.toFixed(0)} px. A stopped vehicle on a progressive-scan camera needs ${LPR_PLATE.designPixelsAcrossPlate} px; a moving vehicle on an interlaced camera needs ${LPR_PLATE.minPixelsAcrossPlateMoving} px.`,
      sourceUrl: LPR_SOURCE_URL,
      isEstimate: false,
      verdict: 'info',
    });
  }

  return {
    purpose: location.purpose,
    requiredPxPerMetre: spec.requiredPxPerMetre,
    requiredPxPerMetreIsEstimate: spec.isEstimate,
    sceneWidthMetres,
    targetDistanceMetres,
    requiredHorizontalFovDeg: fovDeg,
    requiredHorizontalPixels,
    rows,
  };
}

export interface CameraCalculation {
  readonly camera: Camera;
  readonly lens: LensOption;
  readonly sensor: SensorFormat | null;
  /** Focal length the scene needs, mm. Null when the sensor format is unknown. */
  readonly requiredFocalLengthMm: number | null;
  readonly lensFit: LensFitResult | null;
  /** Focal length actually used for the delivered figures, mm. */
  readonly appliedFocalLengthMm: number;
  readonly deliveredSceneWidthMetres: number;
  readonly deliveredHorizontalFovDeg: number;
  readonly deliveredVerticalFovDeg: number;
  readonly pixelDensity: PixelDensityResult;
  readonly tiltDeg: number;
  readonly slantRangeMetres: number;
  readonly blindSpotMetres: number;
  readonly coverageAreaSquareMetres: number;
  readonly camerasForStatedArea: number | null;
  readonly illumination: IlluminationResult;
  readonly bitrate: BitrateResult;
  readonly storageGbForRetention: number;
  readonly poe: PoeCheck;
  readonly datasheetDoriMetres: number | null;
  readonly warnings: readonly string[];
  readonly rows: readonly TracedValue[];
}

/**
 * Pick the focal length to evaluate a model at.
 *
 * For a fixed lens there is no choice. For a varifocal we evaluate at the focal
 * length the scene actually needs, clamped into the lens's range — that is what
 * the installer will set at commissioning.
 */
function chooseFocalLength(lens: LensOption, requiredMm: number | null): number {
  if (requiredMm === null) return lens.focalLengthMinMm;
  return Math.min(Math.max(requiredMm, lens.focalLengthMinMm), lens.focalLengthMaxMm);
}

/**
 * Scene width a lens delivers at a distance.
 *
 * Preference order matters. A published horizontal FOV angle is a measured
 * manufacturer figure, so it beats our own sensor-table arithmetic whenever the
 * lens is at the focal length that angle was quoted at. Otherwise we fall back to
 * the sensor width, and say so.
 */
function deliveredWidth(
  lens: LensOption,
  sensor: SensorFormat | null,
  focalLengthMm: number,
  distanceMetres: number,
): { widthMetres: number; horizontalFovDeg: number; basis: 'published-fov' | 'sensor-width'; isEstimate: boolean } {
  const atWideEnd = Math.abs(focalLengthMm - lens.focalLengthMinMm) < 1e-9;
  if (atWideEnd && lens.horizontalFovWideDeg !== null && lens.horizontalFovWideDeg < 180) {
    return {
      widthMetres: sceneWidthFromFovDeg(lens.horizontalFovWideDeg, distanceMetres),
      horizontalFovDeg: lens.horizontalFovWideDeg,
      basis: 'published-fov',
      isEstimate: false,
    };
  }
  if (!sensor) {
    throw new ScenarioError(
      `Cannot compute coverage for ${lens.label}: no published FOV at this focal length and the sensor format is unknown.`,
    );
  }
  const widthMetres = sceneWidthFromFocal(sensor.widthMm, distanceMetres, focalLengthMm);
  return {
    widthMetres,
    horizontalFovDeg: angleOfViewDeg(sensor.widthMm, focalLengthMm),
    basis: 'sensor-width',
    isEstimate: sensor.isEstimate,
  };
}

export function calculateForCamera(
  location: Location,
  scenario: ScenarioResult,
  camera: Camera,
  lens: LensOption,
): CameraCalculation {
  const { mountHeightMetres } = resolvedGeometry(location);
  const g = location.geometry;
  const req = location.requirements;
  const sensor = sensorFormat(camera.sensorFormat);

  const requiredFocal =
    sensor === null
      ? null
      : requiredFocalLengthMm(sensor.widthMm, scenario.targetDistanceMetres, scenario.sceneWidthMetres);
  const lensFit =
    requiredFocal === null
      ? null
      : assessLensFit(requiredFocal, lens.focalLengthMinMm, lens.focalLengthMaxMm);

  const appliedFocalLengthMm = chooseFocalLength(lens, requiredFocal);
  const delivered = deliveredWidth(lens, sensor, appliedFocalLengthMm, scenario.targetDistanceMetres);

  const pixelDensity = assessPixelDensity(
    camera.maxResolutionWidthPx,
    delivered.widthMetres,
    scenario.requiredPxPerMetre,
  );

  const tiltResult = tilt(mountHeightMetres, scenario.targetDistanceMetres, g.targetHeightMetres);

  // Vertical FOV: use the published figure where the lens is at the end it was
  // quoted at, otherwise derive it from the sensor height.
  const atWideEnd = Math.abs(appliedFocalLengthMm - lens.focalLengthMinMm) < 1e-9;
  const deliveredVerticalFovDeg =
    atWideEnd && lens.verticalFovWideDeg !== null && lens.verticalFovWideDeg < 180
      ? lens.verticalFovWideDeg
      : sensor
        ? angleOfViewDeg(sensor.heightMm, appliedFocalLengthMm)
        : // 16:9 frame, so vertical angle is always smaller than horizontal. Without
          // a sensor we cannot compute it; fall back to 9/16 of the horizontal angle
          // and flag the whole calculation as an estimate via `sensor === null`.
          (delivered.horizontalFovDeg * 9) / 16;

  const blind = blindSpot(mountHeightMetres, tiltResult.tiltDeg, deliveredVerticalFovDeg);
  const footprint = groundFootprint(
    blind.blindSpotMetres,
    scenario.targetDistanceMetres,
    delivered.widthMetres,
  );

  let camerasForStatedArea: number | null = null;
  if (g.widthSource === 'room' && footprint.areaSquareMetres > 0) {
    const roomArea = g.roomLengthMetres * g.roomWidthMetres;
    camerasForStatedArea = camerasForArea(
      roomArea,
      footprint.areaSquareMetres,
      g.overlapAllowance,
    ).camerasNeeded;
  }

  const lightRange =
    camera.supplementLight === 'none'
      ? null
      : Math.max(camera.irRangeMetres ?? 0, camera.whiteLightRangeMetres ?? 0) || null;
  const illumination = assessIllumination(
    lightRange,
    scenario.targetDistanceMetres,
    g.nearestDistanceMetres,
    location.environment.ambientLight === 'well-lit-24-7',
  );

  const bitrate = bitrateFor(
    camera.maxResolutionWidthPx,
    camera.maxResolutionHeightPx,
    req.codec,
    req.fps,
    req.motionLevel,
  );
  const storage = storageGbForRetention(bitrate.storageGbPerDay, req.retentionDays);
  const poe = checkPoeDraw(camera.poeStandard, camera.poeMaxWatts);

  const datasheetDoriMetres = camera.doriAtWidestLens
    ? datasheetDoriDistance(camera.doriAtWidestLens, location.purpose)
    : null;

  const warnings = [...tiltResult.warnings, ...illumination.warnings];
  if (lensFit && lensFit.fit !== 'fits') warnings.push(lensFit.explanation);

  // The camera is aimed at the target, so the target itself is always in frame.
  // What a large blind spot costs is the ground on the approach — and a narrow
  // lens on a high mount loses nearly all of it while still passing every pixel
  // check. That is worth saying out loud.
  if (blind.blindSpotMetres >= scenario.targetDistanceMetres) {
    warnings.push(
      `No ground coverage on the approach: the floor only comes into view ${blind.blindSpotMetres.toFixed(1)} m out, beyond the ${scenario.targetDistanceMetres.toFixed(1)} m target. The target is still framed, but you will not see anyone walking up to it. Widen the lens, lower the mount, or add a second camera for the approach.`,
    );
  } else if (blind.blindSpotMetres > scenario.targetDistanceMetres * 0.6) {
    warnings.push(
      `Only ${footprint.depthMetres.toFixed(1)} m of usable ground depth: the floor is first visible ${blind.blindSpotMetres.toFixed(1)} m out and the target is at ${scenario.targetDistanceMetres.toFixed(1)} m. Good for the target, poor for the approach to it.`,
    );
  }

  if (sensor?.isEstimate) {
    warnings.push(
      `Sensor active area for ${camera.sensorFormat} is interpolated, not published. Focal-length and coverage figures for this model are approximate.`,
    );
  }
  if (sensor === null) {
    warnings.push(
      `No sensor active area on file for "${String(camera.sensorFormat)}", so the optics here rest on the published FOV angle alone.`,
    );
  }
  // Only warn when the RESOLUTION had to be substituted. An interpolated motion
  // multiplier is already marked with an Unverified badge on the bitrate row, and
  // raising it to a warning here made every default scenario look broken.
  if (bitrate.resolutionKeyUsed !== `${camera.maxResolutionWidthPx}x${camera.maxResolutionHeightPx}`) {
    warnings.push(
      `Hikvision publishes no bitrate figure for ${camera.maxResolutionWidthPx}x${camera.maxResolutionHeightPx}; the bandwidth and storage shown use the next larger published resolution (${bitrate.resolutionKeyUsed}), so they are an over-estimate.`,
    );
  }
  if (!poe.ok) warnings.push(poe.explanation);

  const rows: TracedValue[] = [
    {
      label: 'Achieved pixel density',
      display: `${pixelDensity.achievedPxPerMetre.toFixed(0)} px/m`,
      value: pixelDensity.achievedPxPerMetre,
      formula: `${pixelDensity.explanation} Verdict band: pass at or above +${Math.round(MARGIN_ALLOWANCE * 100)}%, marginal between 0 and +${Math.round(MARGIN_ALLOWANCE * 100)}%, fail below.`,
      sourceUrl: null,
      isEstimate: delivered.isEstimate || sensor === null,
      verdict: pixelDensity.verdict,
    },
    {
      label: 'Required focal length',
      display: requiredFocal === null ? 'Not calculable' : `${requiredFocal.toFixed(1)} mm`,
      value: requiredFocal,
      formula:
        requiredFocal === null
          ? `No sensor active area on file for "${String(camera.sensorFormat)}", so the required focal length cannot be derived.`
          : `f = (sensor width x distance) / scene width = (${sensor?.widthMm.toFixed(2)} mm x ${scenario.targetDistanceMetres.toFixed(2)} m) / ${scenario.sceneWidthMetres.toFixed(2)} m = ${requiredFocal.toFixed(1)} mm. ${sensor?.note ?? ''}`,
      sourceUrl: FOCAL_LENGTH_SOURCE_URL,
      isEstimate: sensor?.isEstimate ?? true,
      verdict: lensFit ? (lensFit.fit === 'fits' ? 'pass' : 'fail') : 'info',
    },
    {
      label: 'Lens applied',
      display: `${appliedFocalLengthMm.toFixed(1)} mm (${lens.label})`,
      value: appliedFocalLengthMm,
      formula:
        lensFit?.explanation ??
        `Evaluated at ${appliedFocalLengthMm.toFixed(1)} mm, the widest setting of this lens.`,
      sourceUrl: camera.datasheetUrl,
      isEstimate: false,
      verdict: lensFit ? (lensFit.fit === 'fits' ? 'pass' : 'fail') : 'info',
    },
    {
      label: 'Coverage width at target',
      display: `${delivered.widthMetres.toFixed(2)} m`,
      value: delivered.widthMetres,
      formula:
        delivered.basis === 'published-fov'
          ? `From the datasheet's published ${delivered.horizontalFovDeg.toFixed(1)}° horizontal FOV: 2 x ${scenario.targetDistanceMetres.toFixed(2)} m x tan(${delivered.horizontalFovDeg.toFixed(1)}° / 2) = ${delivered.widthMetres.toFixed(2)} m.`
          : `scene width = (sensor width x distance) / f = (${sensor?.widthMm.toFixed(2)} mm x ${scenario.targetDistanceMetres.toFixed(2)} m) / ${appliedFocalLengthMm.toFixed(1)} mm = ${delivered.widthMetres.toFixed(2)} m.`,
      sourceUrl: delivered.basis === 'published-fov' ? camera.datasheetUrl : FOV_SOURCE_URL,
      isEstimate: delivered.isEstimate,
      verdict: 'info',
    },
    {
      label: 'Horizontal field of view',
      display: `${delivered.horizontalFovDeg.toFixed(1)}°`,
      value: delivered.horizontalFovDeg,
      formula:
        delivered.basis === 'published-fov'
          ? 'Published on the datasheet for this lens at its widest setting.'
          : `2 x atan(sensor width / (2 x f)) = 2 x atan(${sensor?.widthMm.toFixed(2)} / (2 x ${appliedFocalLengthMm.toFixed(1)})) = ${delivered.horizontalFovDeg.toFixed(1)}°.`,
      sourceUrl: delivered.basis === 'published-fov' ? camera.datasheetUrl : FOV_SOURCE_URL,
      isEstimate: delivered.isEstimate,
      verdict: 'info',
    },
    {
      label: 'Downward tilt',
      display: `${tiltResult.tiltDeg.toFixed(1)}°`,
      value: tiltResult.tiltDeg,
      formula: `atan((mount height - target height) / distance) = atan((${mountHeightMetres.toFixed(2)} - ${g.targetHeightMetres.toFixed(2)}) / ${scenario.targetDistanceMetres.toFixed(2)}) = ${tiltResult.tiltDeg.toFixed(1)}°. Slant range sqrt(drop² + distance²) = ${tiltResult.slantRangeMetres.toFixed(2)} m.`,
      sourceUrl: null,
      isEstimate: false,
      verdict: tiltResult.verdict === 'ok' ? 'pass' : 'marginal',
    },
    {
      label: 'Blind spot at the wall',
      display: `${blind.blindSpotMetres.toFixed(2)} m`,
      value: blind.blindSpotMetres,
      formula: blind.explanation,
      sourceUrl: null,
      isEstimate: delivered.isEstimate || sensor === null,
      verdict: 'info',
    },
    {
      label: 'Ground area covered',
      display: `${footprint.areaSquareMetres.toFixed(1)} m²`,
      value: footprint.areaSquareMetres,
      formula: footprint.explanation,
      sourceUrl: null,
      isEstimate: delivered.isEstimate || sensor === null,
      verdict: 'info',
    },
    {
      label: 'Supplement light reach',
      display: illumination.publishedRangeMetres === null ? 'Not specified' : `${illumination.publishedRangeMetres} m`,
      value: illumination.publishedRangeMetres,
      formula: `${illumination.explanation} The ${Math.round(IR_HEADROOM * 100)}% held back is an engineering allowance, not a published figure.`,
      sourceUrl: camera.datasheetUrl,
      isEstimate: true,
      verdict: illumination.verdict === 'not-applicable' ? 'info' : illumination.verdict,
    },
    {
      label: 'Bitrate per camera',
      display: `${(bitrate.targetKbps / 1000).toFixed(2)} Mbps (peak ${(bitrate.peakKbps / 1000).toFixed(2)} Mbps)`,
      value: bitrate.targetKbps,
      formula: bitrate.explanation,
      sourceUrl: BITRATE_SOURCE_URL,
      isEstimate: bitrate.isEstimate,
      verdict: 'info',
    },
    {
      label: `Storage per camera, ${req.retentionDays} days`,
      display: `${storage.toFixed(0)} GB`,
      value: storage,
      formula: `${bitrate.storageGbPerDay.toFixed(1)} GB/day x ${req.retentionDays} days = ${storage.toFixed(0)} GB (decimal GB, as drives are sold). Continuous recording; motion-only recording will be lower.`,
      sourceUrl: BITRATE_SOURCE_URL,
      isEstimate: bitrate.isEstimate,
      verdict: 'info',
    },
    {
      label: 'PoE draw',
      display:
        camera.poeMaxWatts === null
          ? `${poe.standard.label}, draw not specified`
          : `${camera.poeMaxWatts} W (${poe.standard.label})`,
      value: camera.poeMaxWatts,
      formula: poe.explanation,
      sourceUrl: POE_SOURCE_URL,
      isEstimate: camera.poeMaxWatts === null,
      verdict: poe.ok ? 'pass' : 'fail',
    },
  ];

  if (camerasForStatedArea !== null) {
    rows.push({
      label: 'Cameras to cover the stated area',
      display: `${camerasForStatedArea}`,
      value: camerasForStatedArea,
      formula: camerasForArea(
        g.roomLengthMetres * g.roomWidthMetres,
        footprint.areaSquareMetres,
        g.overlapAllowance,
      ).explanation,
      sourceUrl: null,
      isEstimate: true,
      verdict: 'info',
    });
  }

  if (datasheetDoriMetres !== null) {
    const ok = datasheetDoriMetres >= scenario.targetDistanceMetres;
    rows.push({
      label: 'Datasheet DORI cross-check',
      display: `${datasheetDoriMetres} m published for this purpose`,
      value: datasheetDoriMetres,
      formula: `Hikvision publishes ${datasheetDoriMetres} m for this model's widest lens at the "${purposeSpec(location.purpose).label}" level, against a ${scenario.targetDistanceMetres.toFixed(1)} m target. Their figure assumes the widest lens and a scene filling the frame, so it will not always agree with the geometry above — treat a disagreement as a prompt to check the lens choice.`,
      sourceUrl: camera.datasheetUrl,
      isEstimate: false,
      verdict: ok ? 'pass' : 'fail',
    });
  }

  return {
    camera,
    lens,
    sensor,
    requiredFocalLengthMm: requiredFocal,
    lensFit,
    appliedFocalLengthMm,
    deliveredSceneWidthMetres: delivered.widthMetres,
    deliveredHorizontalFovDeg: delivered.horizontalFovDeg,
    deliveredVerticalFovDeg,
    pixelDensity,
    tiltDeg: tiltResult.tiltDeg,
    slantRangeMetres: tiltResult.slantRangeMetres,
    blindSpotMetres: blind.blindSpotMetres,
    coverageAreaSquareMetres: footprint.areaSquareMetres,
    camerasForStatedArea,
    illumination,
    bitrate,
    storageGbForRetention: storage,
    poe,
    datasheetDoriMetres,
    warnings,
    rows,
  };
}
