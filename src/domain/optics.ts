/**
 * Lens optics: field of view, focal length, scene width.
 *
 * ## Formulas and sources
 *
 * All four relations below are the standard thin-lens / rectilinear-lens
 * approximations used throughout machine vision. They hold when the working
 * distance is much larger than the focal length, which is always true in CCTV.
 *
 * 1. Required focal length from a wanted field of view:
 *
 *      f = (sensorWidth x workingDistance) / sceneWidth
 *
 *    "The basic formula to calculate lens focal length is FL = (Sensor size x WD)
 *    / FOV" — 1stVision, *Imaging Basics – Calculating Lens Focal Length*:
 *    https://1stvision.com/machine-vision-solutions/2015/09/imaging-basics-calculating-lens-focal.html
 *
 * 2. Scene width covered by a given focal length (the same relation rearranged):
 *
 *      sceneWidth = (sensorWidth x workingDistance) / f
 *
 *    "FOV_H = (SW / f) x WD" — Commonlands, *Machine Vision Optics Guide*:
 *    https://commonlands.com/blogs/technical/field-of-view-machine-vision
 *
 * 3. Angle of view from focal length and sensor dimension:
 *
 *      theta = 2 x atan(sensorDimension / (2 x f))
 *
 * 4. Angle needed to cover a width at a distance (independent of the camera):
 *
 *      theta = 2 x atan(sceneWidth / (2 x workingDistance))
 *
 * Verified 2026-10-04.
 *
 * ## Why (3) and (4) are both here
 *
 * (4) is what the *job* requires and uses only the client's geometry. (3) is what
 * a *candidate camera* delivers. Comparing them is the lens-fit check, and keeping
 * them separate keeps the "required" column honest when no camera fits.
 */

import { radToDeg } from './units.ts';

export const FOCAL_LENGTH_SOURCE_URL =
  'https://1stvision.com/machine-vision-solutions/2015/09/imaging-basics-calculating-lens-focal.html';
export const FOV_SOURCE_URL =
  'https://commonlands.com/blogs/technical/field-of-view-machine-vision';

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number, got ${String(value)}`);
  }
}

/**
 * Angle subtended by a width at a distance. This is the FOV the job demands.
 * `theta = 2 * atan(width / (2 * distance))`, in degrees.
 */
export function requiredHorizontalFovDeg(sceneWidthMetres: number, distanceMetres: number): number {
  assertPositive('sceneWidthMetres', sceneWidthMetres);
  assertPositive('distanceMetres', distanceMetres);
  return radToDeg(2 * Math.atan(sceneWidthMetres / (2 * distanceMetres)));
}

/**
 * Focal length in mm needed to fit `sceneWidthMetres` at `distanceMetres` on a
 * sensor `sensorWidthMm` wide. Distance and scene width are both in metres so the
 * ratio is dimensionless and the result comes out in the sensor's units (mm).
 */
export function requiredFocalLengthMm(
  sensorWidthMm: number,
  distanceMetres: number,
  sceneWidthMetres: number,
): number {
  assertPositive('sensorWidthMm', sensorWidthMm);
  assertPositive('distanceMetres', distanceMetres);
  assertPositive('sceneWidthMetres', sceneWidthMetres);
  return (sensorWidthMm * distanceMetres) / sceneWidthMetres;
}

/** Scene width in metres a given focal length covers at a given distance. */
export function sceneWidthMetres(
  sensorWidthMm: number,
  distanceMetres: number,
  focalLengthMm: number,
): number {
  assertPositive('sensorWidthMm', sensorWidthMm);
  assertPositive('distanceMetres', distanceMetres);
  assertPositive('focalLengthMm', focalLengthMm);
  return (sensorWidthMm * distanceMetres) / focalLengthMm;
}

/** Angle of view in degrees for a sensor dimension and focal length. */
export function angleOfViewDeg(sensorDimensionMm: number, focalLengthMm: number): number {
  assertPositive('sensorDimensionMm', sensorDimensionMm);
  assertPositive('focalLengthMm', focalLengthMm);
  return radToDeg(2 * Math.atan(sensorDimensionMm / (2 * focalLengthMm)));
}

/** Scene width in metres from a published horizontal FOV angle. Used when a */
/** datasheet gives the angle but we would rather not trust our sensor table. */
export function sceneWidthFromFovDeg(horizontalFovDeg: number, distanceMetres: number): number {
  assertPositive('horizontalFovDeg', horizontalFovDeg);
  assertPositive('distanceMetres', distanceMetres);
  if (horizontalFovDeg >= 180) {
    throw new RangeError(`horizontalFovDeg must be below 180, got ${String(horizontalFovDeg)}`);
  }
  return 2 * distanceMetres * Math.tan((horizontalFovDeg * Math.PI) / 360);
}

export type LensFit = 'fits' | 'too-wide-needed' | 'too-long-needed';

export interface LensFitResult {
  readonly fit: LensFit;
  /** Where in the lens's range the required focal length sits: 0 = widest, 1 = longest. */
  readonly positionInRange: number | null;
  readonly requiredFocalLengthMm: number;
  readonly lensMinMm: number;
  readonly lensMaxMm: number;
  readonly explanation: string;
}

/**
 * Does the required focal length fall inside a lens's range, and where?
 *
 * Position matters for commissioning: a varifocal sitting at the very end of its
 * travel leaves the installer no adjustment, so the scorer prefers the middle.
 */
export function assessLensFit(
  requiredMm: number,
  lensMinMm: number,
  lensMaxMm: number,
): LensFitResult {
  assertPositive('requiredMm', requiredMm);
  assertPositive('lensMinMm', lensMinMm);
  assertPositive('lensMaxMm', lensMaxMm);
  if (lensMaxMm < lensMinMm) {
    throw new RangeError(`lensMaxMm (${lensMaxMm}) must be >= lensMinMm (${lensMinMm})`);
  }

  if (requiredMm < lensMinMm) {
    return {
      fit: 'too-wide-needed',
      positionInRange: null,
      requiredFocalLengthMm: requiredMm,
      lensMinMm,
      lensMaxMm,
      explanation: `Needs a ${requiredMm.toFixed(1)} mm lens but the widest this model goes is ${lensMinMm} mm — it will not fit the scene width in.`,
    };
  }
  if (requiredMm > lensMaxMm) {
    return {
      fit: 'too-long-needed',
      positionInRange: null,
      requiredFocalLengthMm: requiredMm,
      lensMinMm,
      lensMaxMm,
      explanation: `Framing the stated scene width exactly would need a ${requiredMm.toFixed(1)} mm lens; the longest this model goes is ${lensMaxMm} mm, so it will show a wider view than asked for. Whether that still works depends on the achieved pixel density, which is checked separately.`,
    };
  }

  const span = lensMaxMm - lensMinMm;
  const positionInRange = span === 0 ? 0.5 : (requiredMm - lensMinMm) / span;
  return {
    fit: 'fits',
    positionInRange,
    requiredFocalLengthMm: requiredMm,
    lensMinMm,
    lensMaxMm,
    explanation:
      span === 0
        ? `Fixed ${lensMinMm} mm lens, and ${requiredMm.toFixed(1)} mm is what the scene needs.`
        : `${requiredMm.toFixed(1)} mm sits ${Math.round(positionInRange * 100)}% through the ${lensMinMm}–${lensMaxMm} mm range.`,
  };
}
