/**
 * Scoring weights — the one place they live.
 *
 * Each component scores 0..1 and the weights sum to exactly 1, so a total score
 * is directly readable as a percentage. Tuning the engine means editing this file
 * and nothing else.
 *
 * Why these proportions:
 *
 *   pixelDensity (0.35)  The brief's core question is "can the client see what
 *                        they need to see". Nothing else matters if this fails,
 *                        and it is the only component with a hard floor.
 *   lensFit      (0.20)  A model that cannot frame the scene is unusable even at
 *                        high resolution, and commissioning headroom is real
 *                        value on site.
 *   lowLight     (0.20)  Most of these sites are dark for half the day; this is
 *                        where the expensive models earn their money.
 *   featureMatch (0.15)  What the client actually asked for, weighted below the
 *                        physics because features can often be added elsewhere
 *                        in the system.
 *   budget       (0.10)  A tie-breaker, not a driver. The engineer owns the
 *                        commercial call.
 */

export interface ScoreWeights {
  readonly pixelDensity: number;
  readonly lensFit: number;
  readonly lowLight: number;
  readonly featureMatch: number;
  readonly budget: number;
}

export const WEIGHTS: ScoreWeights = {
  pixelDensity: 0.35,
  lensFit: 0.2,
  lowLight: 0.2,
  featureMatch: 0.15,
  budget: 0.1,
};

export const WEIGHT_RATIONALE: Readonly<Record<keyof ScoreWeights, string>> = {
  pixelDensity:
    'Can the client see what they need to see at the stated distance. The only component with a hard pass/fail floor.',
  lensFit:
    'Does the required focal length fall inside the lens range, and is there commissioning headroom either side of it.',
  lowLight:
    'Aperture, sensor size, published minimum illumination and whether the supplement light reaches the target.',
  featureMatch: 'Analytics, audio and deterrent features the client actually asked for.',
  budget: 'Indicative price band against the stated budget tier. A tie-breaker, not a driver.',
};

/**
 * How much a pixel-density ratio above the requirement is still worth.
 *
 * Diminishing returns: 1.0x the requirement scores 0.5, 2.0x scores 1.0, and
 * beyond that the extra pixels buy nothing for this purpose (they cost bandwidth
 * instead). Below 1.0x the score falls away fast so a failing model never wins on
 * other components.
 */
export function pixelDensityScore(ratio: number): number {
  if (ratio <= 0) return 0;
  if (ratio < 1) return 0.5 * ratio * ratio; // quadratic penalty below the threshold
  return Math.min(1, 0.5 + 0.5 * Math.min(ratio - 1, 1));
}

/** Resolution headroom past about 2x the requirement is wasted bandwidth. */
export const USEFUL_DENSITY_RATIO_CEILING = 2;

export function assertWeightsSumToOne(weights: ScoreWeights = WEIGHTS): void {
  const total =
    weights.pixelDensity + weights.lensFit + weights.lowLight + weights.featureMatch + weights.budget;
  if (Math.abs(total - 1) > 1e-9) {
    throw new Error(`Scoring weights must sum to 1, got ${total}`);
  }
}

// ---------------------------------------------------------------------------
// Recorder (NVR) scoring — phase 2
// ---------------------------------------------------------------------------

/**
 * Applied only to recorders that already pass every hard check, so these are
 * preferences, not safety margins. Editorial, like the camera weights.
 *
 *   channelFit        (0.35)  Do not sell a 64-channel box for 9 cameras.
 *   budget            (0.30)  Recorders vary in price far more than they vary
 *                             in usefulness once the checks pass.
 *   bandwidthHeadroom (0.20)  Full marks at 30 % spare ingest; cameras get
 *                             re-configured to higher bitrates after handover.
 *   storageExpansion  (0.15)  Free bays let retention grow without a forklift.
 */
export interface NvrScoreWeights {
  readonly channelFit: number;
  readonly budget: number;
  readonly bandwidthHeadroom: number;
  readonly storageExpansion: number;
}

export const NVR_WEIGHTS: NvrScoreWeights = {
  channelFit: 0.35,
  budget: 0.3,
  bandwidthHeadroom: 0.2,
  storageExpansion: 0.15,
};

export function assertNvrWeightsSumToOne(weights: NvrScoreWeights = NVR_WEIGHTS): void {
  const total = weights.channelFit + weights.budget + weights.bandwidthHeadroom + weights.storageExpansion;
  if (Math.abs(total - 1) > 1e-9) throw new Error(`NVR scoring weights must sum to 1, got ${total}`);
}
