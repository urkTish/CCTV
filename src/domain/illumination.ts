/**
 * Illumination adequacy: does the camera's own light reach the target?
 *
 * Two independent checks:
 *
 * 1. **Reach.** The supplement light (IR, white light, or both in a Smart Hybrid
 *    unit) has a published range. That range is a manufacturer figure measured on
 *    a high-reflectance target in clear air; real scenes are darker and dirtier,
 *    so this check requires headroom rather than treating the published number as
 *    a hard edge. The 20% headroom below is an engineering allowance, not a
 *    standard, and the UI says so.
 *
 * 2. **Hotspot.** IR LEDs close to the lens overexpose anything within a couple
 *    of metres: a face at 1 m under a 60 m illuminator washes out to white. Where
 *    the nearest point of interest is very close AND the illuminator is powerful,
 *    that is worth flagging — usually the fix is Smart IR (which Hikvision calls
 *    "Smart Supplement Light") or moving the camera.
 *
 * Night colour is a separate question from reach. ColorVu models hold colour at
 * 0 lux because they pair an F1.0 lens with a white-light supplement; IR-only
 * models go monochrome. That is a capability match, handled by the recommendation
 * engine, not an illumination calculation.
 */

/** Fraction of the published range held back as margin. Engineering allowance. */
export const IR_HEADROOM = 0.2;
/** Below this distance a powerful illuminator risks washing the subject out. */
export const IR_HOTSPOT_DISTANCE_METRES = 2;
/** An illuminator at least this long is powerful enough to matter up close. */
export const IR_HOTSPOT_RANGE_THRESHOLD_METRES = 30;

export type IlluminationVerdict = 'pass' | 'marginal' | 'fail' | 'not-applicable';

export interface IlluminationResult {
  readonly verdict: IlluminationVerdict;
  readonly publishedRangeMetres: number | null;
  readonly requiredRangeMetres: number;
  readonly explanation: string;
  readonly warnings: readonly string[];
}

export function assessIllumination(
  publishedRangeMetres: number | null,
  targetDistanceMetres: number,
  nearestDistanceMetres: number | null,
  /** True when the scene has usable ambient light 24/7, so reach does not bind. */
  ambientLightAlwaysAvailable: boolean,
): IlluminationResult {
  if (!Number.isFinite(targetDistanceMetres) || targetDistanceMetres <= 0) {
    throw new RangeError(`targetDistanceMetres must be positive, got ${String(targetDistanceMetres)}`);
  }

  const warnings: string[] = [];

  if (
    nearestDistanceMetres !== null &&
    nearestDistanceMetres > 0 &&
    nearestDistanceMetres < IR_HOTSPOT_DISTANCE_METRES &&
    publishedRangeMetres !== null &&
    publishedRangeMetres >= IR_HOTSPOT_RANGE_THRESHOLD_METRES
  ) {
    warnings.push(
      `Nearest point of interest is ${nearestDistanceMetres.toFixed(1)} m from a ${publishedRangeMetres} m illuminator — close subjects will be overexposed at night. Enable Smart Supplement Light, or move the camera back.`,
    );
  }

  if (ambientLightAlwaysAvailable) {
    return {
      verdict: 'not-applicable',
      publishedRangeMetres,
      requiredRangeMetres: targetDistanceMetres,
      explanation:
        'Scene is lit 24/7, so the camera’s own illuminator does not have to reach the target.',
      warnings,
    };
  }

  if (publishedRangeMetres === null) {
    return {
      verdict: 'not-applicable',
      publishedRangeMetres: null,
      requiredRangeMetres: targetDistanceMetres,
      explanation:
        'No supplement-light range published for this model, so reach cannot be checked. Treat as unverified.',
      warnings,
    };
  }

  const usableRange = publishedRangeMetres * (1 - IR_HEADROOM);
  let verdict: IlluminationVerdict;
  if (targetDistanceMetres <= usableRange) verdict = 'pass';
  else if (targetDistanceMetres <= publishedRangeMetres) verdict = 'marginal';
  else verdict = 'fail';

  const explanation =
    `Published supplement-light range ${publishedRangeMetres} m; with ${Math.round(IR_HEADROOM * 100)}% held back that is ${usableRange.toFixed(0)} m usable, against a ${targetDistanceMetres.toFixed(1)} m target.`;

  if (verdict === 'marginal') {
    warnings.push(
      `Target at ${targetDistanceMetres.toFixed(1)} m is inside the published ${publishedRangeMetres} m range but outside the ${usableRange.toFixed(0)} m working figure. Expect a dim, noisy image at the far edge.`,
    );
  }
  if (verdict === 'fail') {
    warnings.push(
      `Illuminator reaches ${publishedRangeMetres} m; the target is at ${targetDistanceMetres.toFixed(1)} m. At night the far end of the scene will be black.`,
    );
  }

  return {
    verdict,
    publishedRangeMetres,
    requiredRangeMetres: targetDistanceMetres,
    explanation,
    warnings,
  };
}
