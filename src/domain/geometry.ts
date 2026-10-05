/**
 * Mounting geometry: tilt, blind spot, ground footprint, camera count.
 *
 * Everything here is plane trigonometry on a side elevation. The camera sits at
 * `mountHeight` above a flat floor; the target is at `targetDistance` measured
 * along the ground (the brief's "distance to the furthest point of interest" is
 * the ground run, which is how an installer measures it with a tape).
 *
 *   slant range   = sqrt(h^2 + d^2)                       (Pythagoras)
 *   tilt below     = atan(h / d)                           (depression angle)
 *   blind spot     = h / tan(verticalFov/2 + tilt)         (see note below)
 *
 * The blind-spot relation: the bottom edge of the frame points downwards at
 * (tilt + verticalFov/2) from horizontal. Where that ray meets the floor is the
 * nearest visible ground point; closer than that is under the camera and unseen.
 * If that angle reaches or exceeds 90 degrees the camera sees its own mounting
 * surface and there is no blind spot.
 *
 * The thresholds for "too steep" / "too shallow" are practitioner rules of thumb,
 * not standards, and are labelled as such in the UI:
 *   - above 45 degrees of depression you are increasingly looking at the tops of
 *     heads, which is useless for facial identification;
 *   - below about 10 degrees the camera is looking at the horizon, which invites
 *     sun glare and wastes the top of the sensor on sky.
 */

import { degToRad, radToDeg } from './units.ts';

/** Rule-of-thumb limits. Not from a standard — surfaced as guidance, not verdicts. */
export const TILT_TOO_STEEP_DEG = 45;
export const TILT_TOO_SHALLOW_DEG = 10;
/** Depression beyond which facial identification is generally considered lost. */
export const TILT_FACE_ID_LIMIT_DEG = 30;

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number, got ${String(value)}`);
  }
}

export interface TiltResult {
  /** Depression angle below horizontal, degrees. */
  readonly tiltDeg: number;
  /** Straight-line distance from lens to target, metres. */
  readonly slantRangeMetres: number;
  readonly verdict: 'ok' | 'steep' | 'shallow';
  readonly warnings: readonly string[];
}

export function tilt(
  mountHeightMetres: number,
  targetDistanceMetres: number,
  /** Eye/plate height of the thing being looked at; the camera aims at it, not the floor. */
  targetHeightMetres = 0,
): TiltResult {
  assertPositive('mountHeightMetres', mountHeightMetres);
  assertPositive('targetDistanceMetres', targetDistanceMetres);
  if (targetHeightMetres < 0 || !Number.isFinite(targetHeightMetres)) {
    throw new RangeError(`targetHeightMetres must be >= 0, got ${String(targetHeightMetres)}`);
  }

  const drop = mountHeightMetres - targetHeightMetres;
  const tiltDeg = radToDeg(Math.atan(Math.max(drop, 0) / targetDistanceMetres));
  const slantRangeMetres = Math.hypot(drop, targetDistanceMetres);

  const warnings: string[] = [];
  let verdict: TiltResult['verdict'] = 'ok';
  if (tiltDeg > TILT_TOO_STEEP_DEG) {
    verdict = 'steep';
    warnings.push(
      `Camera is tilted ${tiltDeg.toFixed(0)}° down. Above ${TILT_TOO_STEEP_DEG}° you mostly see the tops of heads — lower the mount or move it back.`,
    );
  } else if (tiltDeg > TILT_FACE_ID_LIMIT_DEG) {
    warnings.push(
      `${tiltDeg.toFixed(0)}° of downward tilt is past the ${TILT_FACE_ID_LIMIT_DEG}° point where faces start to be foreshortened. Fine for detection, marginal for identification.`,
    );
  } else if (tiltDeg < TILT_TOO_SHALLOW_DEG) {
    verdict = 'shallow';
    warnings.push(
      `Only ${tiltDeg.toFixed(0)}° of downward tilt. The camera is looking almost level, so the top of the frame is filled with whatever is behind the target — sky and sun outdoors, ceiling and lights indoors. Expect glare and wasted pixels.`,
    );
  }

  return { tiltDeg, slantRangeMetres, verdict, warnings };
}

export interface BlindSpotResult {
  /** Ground distance from directly below the camera to the nearest visible point. */
  readonly blindSpotMetres: number;
  readonly explanation: string;
}

export function blindSpot(
  mountHeightMetres: number,
  tiltDeg: number,
  verticalFovDeg: number,
): BlindSpotResult {
  assertPositive('mountHeightMetres', mountHeightMetres);
  assertPositive('verticalFovDeg', verticalFovDeg);
  if (tiltDeg < 0 || tiltDeg >= 90) {
    throw new RangeError(`tiltDeg must be in [0, 90), got ${String(tiltDeg)}`);
  }

  const bottomRayDeg = tiltDeg + verticalFovDeg / 2;
  if (bottomRayDeg >= 90) {
    return {
      blindSpotMetres: 0,
      explanation:
        'The bottom of the frame points straight down or behind the camera: no blind spot at the wall.',
    };
  }
  const blindSpotMetres = mountHeightMetres / Math.tan(degToRad(bottomRayDeg));
  return {
    blindSpotMetres,
    explanation: `Bottom of frame points ${bottomRayDeg.toFixed(0)}° below horizontal (${tiltDeg.toFixed(0)}° tilt + half of ${verticalFovDeg.toFixed(0)}° vertical FOV), so the floor is first visible ${blindSpotMetres.toFixed(1)} m out from the wall.`,
  };
}

export interface FootprintResult {
  /** Scene width at the target distance, metres. */
  readonly widthAtTargetMetres: number;
  /** Ground depth between the blind spot and the target distance, metres. */
  readonly depthMetres: number;
  /**
   * Ground area actually covered, metres squared. Approximated as a trapezium
   * between the near edge (at the blind spot) and the far edge (at the target),
   * which is what the FOV cone cuts out of a flat floor.
   */
  readonly areaSquareMetres: number;
  readonly explanation: string;
}

export function groundFootprint(
  blindSpotMetres: number,
  targetDistanceMetres: number,
  widthAtTargetMetres: number,
): FootprintResult {
  assertPositive('targetDistanceMetres', targetDistanceMetres);
  assertPositive('widthAtTargetMetres', widthAtTargetMetres);
  if (blindSpotMetres < 0 || !Number.isFinite(blindSpotMetres)) {
    throw new RangeError(`blindSpotMetres must be >= 0, got ${String(blindSpotMetres)}`);
  }

  const near = Math.min(blindSpotMetres, targetDistanceMetres);
  const depthMetres = targetDistanceMetres - near;
  // Width scales linearly with distance for a rectilinear lens.
  const widthAtNearMetres = (widthAtTargetMetres * near) / targetDistanceMetres;
  const areaSquareMetres = ((widthAtNearMetres + widthAtTargetMetres) / 2) * depthMetres;

  return {
    widthAtTargetMetres,
    depthMetres,
    areaSquareMetres,
    explanation: `Trapezium between ${widthAtNearMetres.toFixed(1)} m wide at ${near.toFixed(1)} m and ${widthAtTargetMetres.toFixed(1)} m wide at ${targetDistanceMetres.toFixed(1)} m: ((${widthAtNearMetres.toFixed(1)} + ${widthAtTargetMetres.toFixed(1)}) / 2) × ${depthMetres.toFixed(1)} m = ${areaSquareMetres.toFixed(1)} m².`,
  };
}

export interface CameraCountResult {
  readonly camerasNeeded: number;
  readonly effectiveAreaPerCameraSquareMetres: number;
  readonly explanation: string;
}

/**
 * How many cameras of this coverage it takes to blanket an area.
 *
 * Overlap allowance is the fraction of each camera's footprint given up to the
 * neighbouring camera so there is no seam. 0.15 (15%) is a common installation
 * default; it is an allowance, not a standard.
 */
export function camerasForArea(
  areaToCoverSquareMetres: number,
  areaPerCameraSquareMetres: number,
  overlapAllowance = 0.15,
): CameraCountResult {
  assertPositive('areaToCoverSquareMetres', areaToCoverSquareMetres);
  assertPositive('areaPerCameraSquareMetres', areaPerCameraSquareMetres);
  if (overlapAllowance < 0 || overlapAllowance >= 1) {
    throw new RangeError(`overlapAllowance must be in [0, 1), got ${String(overlapAllowance)}`);
  }

  const effectiveAreaPerCameraSquareMetres = areaPerCameraSquareMetres * (1 - overlapAllowance);
  const camerasNeeded = Math.ceil(areaToCoverSquareMetres / effectiveAreaPerCameraSquareMetres);
  return {
    camerasNeeded,
    effectiveAreaPerCameraSquareMetres,
    explanation: `${areaToCoverSquareMetres.toFixed(1)} m² to cover ÷ ${effectiveAreaPerCameraSquareMetres.toFixed(1)} m² per camera (${areaPerCameraSquareMetres.toFixed(1)} m² less ${Math.round(overlapAllowance * 100)}% overlap) = ${camerasNeeded} camera(s).`,
  };
}

/**
 * Derive a scene width from room dimensions when the user gives an area instead.
 * The camera is assumed to look down the long axis from one end, so the width it
 * must cover is the short axis.
 */
export function sceneWidthFromRoom(lengthMetres: number, widthMetres: number): number {
  assertPositive('lengthMetres', lengthMetres);
  assertPositive('widthMetres', widthMetres);
  return Math.min(lengthMetres, widthMetres);
}

/** The distance the camera must see when looking down the long axis of a room. */
export function targetDistanceFromRoom(lengthMetres: number, widthMetres: number): number {
  assertPositive('lengthMetres', lengthMetres);
  assertPositive('widthMetres', widthMetres);
  return Math.max(lengthMetres, widthMetres);
}
