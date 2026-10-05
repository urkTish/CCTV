/**
 * Achieved pixel density and the pass/fail verdict.
 *
 *   achieved px/m = horizontal resolution (px) / scene width at target (m)
 *
 * This is the definition the DORI figures are stated against: pixels spread
 * across one metre of the scene, measured at the distance of interest (Axis,
 * *Pixel density based on IEC 62676-4:2014*).
 *
 * The margin band ("marginal") exists because a camera sitting exactly on the
 * threshold will not hold it in practice — motion blur, compression, rain, a
 * dirty dome and off-axis targets all eat into effective resolution. 15% is an
 * engineering allowance chosen here, not a standard figure, and the UI says so.
 */

export const MARGIN_ALLOWANCE = 0.15;

export type DensityVerdict = 'pass' | 'marginal' | 'fail';

export interface PixelDensityResult {
  readonly achievedPxPerMetre: number;
  readonly requiredPxPerMetre: number;
  /** achieved / required. 1.0 is exactly on the threshold. */
  readonly ratio: number;
  readonly verdict: DensityVerdict;
  readonly explanation: string;
}

export function achievedPxPerMetre(
  horizontalResolutionPx: number,
  sceneWidthMetres: number,
): number {
  if (!Number.isInteger(horizontalResolutionPx) || horizontalResolutionPx <= 0) {
    throw new RangeError(
      `horizontalResolutionPx must be a positive integer, got ${String(horizontalResolutionPx)}`,
    );
  }
  if (!Number.isFinite(sceneWidthMetres) || sceneWidthMetres <= 0) {
    throw new RangeError(`sceneWidthMetres must be positive, got ${String(sceneWidthMetres)}`);
  }
  return horizontalResolutionPx / sceneWidthMetres;
}

export function assessPixelDensity(
  horizontalResolutionPx: number,
  sceneWidthMetres: number,
  requiredPxPerMetreValue: number,
): PixelDensityResult {
  if (!Number.isFinite(requiredPxPerMetreValue) || requiredPxPerMetreValue <= 0) {
    throw new RangeError(
      `requiredPxPerMetre must be positive, got ${String(requiredPxPerMetreValue)}`,
    );
  }
  const achieved = achievedPxPerMetre(horizontalResolutionPx, sceneWidthMetres);
  const ratio = achieved / requiredPxPerMetreValue;

  let verdict: DensityVerdict;
  if (ratio >= 1 + MARGIN_ALLOWANCE) verdict = 'pass';
  else if (ratio >= 1) verdict = 'marginal';
  else verdict = 'fail';

  const pct = Math.round((ratio - 1) * 100);
  const explanation =
    `${horizontalResolutionPx} px across ${sceneWidthMetres.toFixed(2)} m of scene = ` +
    `${achieved.toFixed(0)} px/m against ${requiredPxPerMetreValue.toFixed(0)} px/m required ` +
    `(${pct >= 0 ? '+' : ''}${pct}%).`;

  return {
    achievedPxPerMetre: achieved,
    requiredPxPerMetre: requiredPxPerMetreValue,
    ratio,
    verdict,
    explanation,
  };
}

/**
 * The furthest distance at which a camera still holds a required density.
 *
 * Scene width grows linearly with distance, so density falls off as 1/distance:
 * density(d) = resolution / (sceneWidthAtRef x d / refDistance). Solving for the
 * distance where density equals the requirement gives the usable range.
 */
export function maxDistanceForDensity(
  horizontalResolutionPx: number,
  sceneWidthAtRefMetres: number,
  refDistanceMetres: number,
  requiredPxPerMetreValue: number,
): number {
  if (sceneWidthAtRefMetres <= 0 || refDistanceMetres <= 0 || requiredPxPerMetreValue <= 0) {
    throw new RangeError('maxDistanceForDensity needs positive scene width, distance and density');
  }
  const widthPerMetreOfDistance = sceneWidthAtRefMetres / refDistanceMetres;
  // required = resolution / (widthPerMetreOfDistance * d)  =>  d = resolution / (required * wpm)
  return horizontalResolutionPx / (requiredPxPerMetreValue * widthPerMetreOfDistance);
}
