/**
 * The recommendation engine. A pure function: typed scenario in, ranked results
 * out. No React, no fetch, no clock. Phase 2's NVR and switch selectors will have
 * the same shape and consume this output.
 *
 * Order of operations, as the brief requires:
 *   1. Hard constraints — environment, ingress protection, form factor,
 *      must-have features. Each rejection carries the reason, in the engineer's
 *      words, so "why isn't X in the list" is always answerable.
 *   2. Score and rank the survivors on the weights in `weights.ts`.
 *   3. Label the top result and up to three alternatives by their trade-off.
 *   4. If nothing survives, name the binding constraint and show the nearest
 *      misses rather than returning an empty list.
 */

import { cameras } from '../data/cameras.ts';
import type { Camera, LensOption, Capability } from '../data/schema.ts';
import {
  calculateScenario,
  calculateForCamera,
  ScenarioError,
  type CameraCalculation,
  type ScenarioResult,
} from '../domain/calculate.ts';
import type { Location } from '../domain/types.ts';
import { WEIGHTS, pixelDensityScore, USEFUL_DENSITY_RATIO_CEILING } from './weights.ts';

export interface Rejection {
  readonly cameraId: string;
  readonly model: string;
  /** Machine-readable so the no-result path can count which constraint bites most. */
  readonly constraint:
    | 'ingress-protection'
    | 'vandal-resistance'
    | 'indoor-outdoor'
    | 'form-factor-ptz'
    | 'lens-preference'
    | 'colour-at-night'
    | 'wdr'
    | 'audio'
    | 'two-way-audio'
    | 'capability'
    | 'budget'
    | 'optics-unavailable';
  readonly reason: string;
}

export interface ScoreBreakdown {
  readonly pixelDensity: number;
  readonly lensFit: number;
  readonly lowLight: number;
  readonly featureMatch: number;
  readonly budget: number;
  readonly total: number;
}

export type TradeOffLabel =
  | 'primary recommendation'
  | 'budget option'
  | 'better in low light'
  | 'more flexible lens'
  | 'higher resolution headroom'
  | 'stronger deterrent'
  | 'closest alternative';

export interface Recommendation {
  readonly calculation: CameraCalculation;
  readonly score: ScoreBreakdown;
  readonly label: TradeOffLabel;
  /** Plain-language case for this model. */
  readonly why: string;
  /** The honest downside. Never empty. */
  readonly weakPoint: string;
}

export interface NearMiss {
  readonly calculation: CameraCalculation;
  readonly score: ScoreBreakdown;
  readonly shortfall: string;
}

export interface RecommendationResult {
  readonly scenario: ScenarioResult;
  readonly primary: Recommendation | null;
  readonly alternatives: readonly Recommendation[];
  readonly rejections: readonly Rejection[];
  /** Populated only when `primary` is null. */
  readonly nearMisses: readonly NearMiss[];
  /** Populated only when `primary` is null: what to change, in plain language. */
  readonly suggestedFixes: readonly string[];
  /** Set when the scenario itself is invalid. */
  readonly error: string | null;
}

// ---------------------------------------------------------------------------
// Hard constraints
// ---------------------------------------------------------------------------

/** Minimum IP second digit (water) required by the site type. */
function requiredWaterDigit(site: Location['environment']['site']): number {
  switch (site) {
    case 'outdoor':
      return 6; // IPx6 — protected against powerful water jets
    case 'semi-covered':
      return 4; // IPx4 — splashing water
    case 'indoor':
      return 0;
  }
}

function ipDigits(ipRating: string | null): { dust: number; water: number } | null {
  if (!ipRating) return null;
  const match = /^IP(\d)(\d)/.exec(ipRating);
  if (!match) return null;
  return { dust: Number(match[1]), water: Number(match[2]) };
}

function ikValue(ikRating: string | null): number | null {
  if (!ikRating) return null;
  const match = /^IK(\d{2})$/.exec(ikRating);
  return match ? Number(match[1]) : null;
}

const CAPABILITY_LABELS: Readonly<Record<Capability, string>> = {
  acusense: 'AcuSense',
  colorvu: 'ColorVu',
  darkfighter: 'DarkFighter',
  'smart-hybrid-light': 'Smart Hybrid Light',
  'line-crossing': 'line crossing detection',
  'intrusion-detection': 'intrusion detection',
  'region-entrance-exit': 'region entrance/exit detection',
  'people-counting': 'people counting',
  anpr: 'ANPR / licence-plate recognition',
  'face-capture': 'face capture',
  'strobe-light': 'strobe light',
  'audible-warning': 'audible warning / siren',
  'two-way-audio': 'two-way audio',
  'built-in-mic': 'built-in microphone',
  'built-in-speaker': 'built-in speaker',
  'smart-supplement-light': 'Smart Supplement Light',
  'true-wdr': 'true WDR',
  'alarm-io': 'alarm input/output',
  'audio-io': 'line-level audio input/output',
  microsd: 'microSD on-board storage',
  'motorised-zoom': 'motorised zoom',
  'ptz-control': 'PTZ control',
  heater: 'built-in heater',
  'deep-learning-vca': 'deep-learning video analytics',
};

export function capabilityLabel(c: Capability): string {
  return CAPABILITY_LABELS[c];
}

/**
 * Apply every hard constraint. Returns null when the camera passes, or the first
 * rejection when it does not — first, because an engineer wants the headline
 * reason, not a list of six.
 */
function rejectForConstraints(camera: Camera, location: Location): Rejection | null {
  const env = location.environment;
  const req = location.requirements;
  const reject = (constraint: Rejection['constraint'], reason: string): Rejection => ({
    cameraId: camera.id,
    model: camera.model,
    constraint,
    reason,
  });

  if (env.site !== 'indoor') {
    if (camera.indoorOutdoor === 'indoor') {
      return reject(
        'indoor-outdoor',
        `${env.site} location, and this model is rated indoor only.`,
      );
    }
    const digits = ipDigits(camera.ipRating);
    const needed = requiredWaterDigit(env.site);
    if (!digits) {
      return reject(
        'ingress-protection',
        `${env.site} location needs at least IPx${needed}, and no IP rating is published for this model.`,
      );
    }
    if (digits.water < needed) {
      return reject(
        'ingress-protection',
        `${env.site} location needs at least IPx${needed}; this model is ${camera.ipRating}.`,
      );
    }
  }

  if (env.vandalExposure) {
    const ik = ikValue(camera.ikRating);
    if (ik === null || ik < 10) {
      return reject(
        'vandal-resistance',
        `Vandal exposure was flagged, which calls for IK10. This model is ${camera.ikRating ?? 'not IK rated'}.`,
      );
    }
  }

  if (env.specialConditions.includes('washdown') || env.specialConditions.includes('dust')) {
    const digits = ipDigits(camera.ipRating);
    if (!digits || digits.dust < 6) {
      return reject(
        'ingress-protection',
        `Dust or washdown conditions need IP6x; this model is ${camera.ipRating ?? 'not IP rated'}.`,
      );
    }
  }

  if (!req.ptzAcceptable && camera.formFactor === 'ptz') {
    return reject('form-factor-ptz', 'PTZ was ruled out for this location; this is a PTZ.');
  }

  if (req.lensPreference === 'fixed' && camera.lensType !== 'fixed') {
    return reject(
      'lens-preference',
      `A fixed lens was specified; this model is ${camera.lensType.replace('-', ' ')}.`,
    );
  }
  if (req.lensPreference === 'varifocal' && camera.lensType === 'fixed') {
    return reject('lens-preference', 'A varifocal or motorised lens was specified; this is fixed focal.');
  }

  if (env.colourAtNight && env.ambientLight !== 'well-lit-24-7') {
    const canDoColourAtNight =
      camera.capabilities.includes('colorvu') ||
      camera.capabilities.includes('smart-hybrid-light') ||
      camera.whiteLightRangeMetres !== null;
    if (!canDoColourAtNight) {
      return reject(
        'colour-at-night',
        'The client wants colour at night; this model has IR only, so it goes monochrome after dark.',
      );
    }
  }

  if (env.strongBacklight && (camera.wdrDb === null || camera.wdrDb < 120)) {
    return reject(
      'wdr',
      `Strong backlight was flagged, which needs at least 120 dB true WDR. This model publishes ${camera.wdrDb === null ? 'no WDR figure (digital WDR only)' : `${camera.wdrDb} dB`}.`,
    );
  }

  if (req.audioRequired && !camera.capabilities.includes('built-in-mic')) {
    return reject('audio', 'Audio was required; this model has no built-in microphone.');
  }
  if (req.twoWayAudioRequired && !camera.capabilities.includes('two-way-audio')) {
    return reject('two-way-audio', 'Two-way audio was required; this model does not support it.');
  }

  for (const capability of req.requiredCapabilities) {
    if (!camera.capabilities.includes(capability)) {
      return reject('capability', `${capabilityLabel(capability)} was required; this model does not have it.`);
    }
  }

  if (req.budgetTier !== 'any' && camera.priceTier !== req.budgetTier) {
    const order = { economy: 0, standard: 1, premium: 2 } as const;
    if (order[camera.priceTier] > order[req.budgetTier]) {
      return reject(
        'budget',
        `Budget tier is ${req.budgetTier}; this model sits in the ${camera.priceTier} band.`,
      );
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function lensFitScore(calc: CameraCalculation): number {
  if (!calc.lensFit) return 0.3; // unknown optics: usable but not preferred
  if (calc.lensFit.fit !== 'fits') return 0;
  const pos = calc.lensFit.positionInRange ?? 0.5;
  // A fixed lens that fits scores 0.8 — correct, but no commissioning headroom.
  if (calc.lens.focalLengthMinMm === calc.lens.focalLengthMaxMm) return 0.8;
  // A varifocal scores best in the middle of its travel, falling to 0.6 at an end.
  return 1 - 0.4 * Math.abs(pos - 0.5) * 2;
}

function lowLightScore(calc: CameraCalculation): number {
  const cam = calc.camera;
  let score = 0;

  // Aperture: F1.0 is four times the light of F2.0. Scored on the f-number
  // directly because that is what the datasheets publish.
  const f = calc.lens.apertureFNumber;
  if (f !== null) score += f <= 1.0 ? 0.35 : f <= 1.2 ? 0.3 : f <= 1.4 ? 0.22 : f <= 1.6 ? 0.15 : 0.05;
  else score += 0.1;

  // Published minimum illumination in colour, on a log scale: each decade of
  // sensitivity is worth the same step.
  const lux = cam.minIlluminationColourLux;
  if (lux !== null && lux > 0) {
    const decades = -Math.log10(lux); // 0.005 lux -> 2.3, 0.0001 lux -> 4
    score += Math.max(0, Math.min(0.3, (decades - 1.5) / 2.5 * 0.3));
  } else if (lux === 0) {
    score += 0.3;
  }

  // Does the camera's own light actually reach the target.
  switch (calc.illumination.verdict) {
    case 'pass':
      score += 0.2;
      break;
    case 'marginal':
      score += 0.1;
      break;
    case 'not-applicable':
      score += 0.15;
      break;
    case 'fail':
      break;
  }

  // Dedicated low-light technologies.
  if (cam.capabilities.includes('colorvu')) score += 0.1;
  if (cam.capabilities.includes('darkfighter')) score += 0.05;

  return Math.max(0, Math.min(1, score));
}

function featureMatchScore(camera: Camera, location: Location): number {
  const req = location.requirements;
  const env = location.environment;
  let wanted = 0;
  let got = 0;

  const want = (condition: boolean, has: boolean) => {
    if (!condition) return;
    wanted += 1;
    if (has) got += 1;
  };

  // Things the client asked for are already hard constraints, so what is scored
  // here is the discretionary value an engineer would weigh up.
  want(true, camera.capabilities.includes('deep-learning-vca'));
  want(true, camera.capabilities.includes('microsd'));
  want(env.site !== 'indoor', camera.capabilities.includes('smart-supplement-light'));
  want(env.strongBacklight, camera.capabilities.includes('true-wdr'));
  want(env.colourAtNight, camera.capabilities.includes('colorvu'));
  want(req.lensPreference !== 'fixed', camera.capabilities.includes('motorised-zoom'));
  want(location.purpose === 'lpr', camera.capabilities.includes('anpr'));
  want(
    location.purpose === 'till' || location.purpose === 'identify',
    camera.capabilities.includes('face-capture'),
  );
  want(
    env.ambientLight === 'zero-lux',
    camera.capabilities.includes('colorvu') || camera.capabilities.includes('smart-hybrid-light'),
  );

  return wanted === 0 ? 1 : got / wanted;
}

function budgetScore(camera: Camera, location: Location): number {
  const tier = location.requirements.budgetTier;
  if (tier === 'any') {
    // With no stated budget, prefer the cheaper band at equal capability.
    return camera.priceTier === 'economy' ? 1 : camera.priceTier === 'standard' ? 0.8 : 0.6;
  }
  if (camera.priceTier === tier) return 1;
  // Cheaper than asked for is a bonus, not a penalty.
  return 0.9;
}

function scoreCamera(calc: CameraCalculation, location: Location): ScoreBreakdown {
  const pixelDensity = pixelDensityScore(calc.pixelDensity.ratio);
  const lensFit = lensFitScore(calc);
  const lowLight = lowLightScore(calc);
  const featureMatch = featureMatchScore(calc.camera, location);
  const budget = budgetScore(calc.camera, location);
  const total =
    pixelDensity * WEIGHTS.pixelDensity +
    lensFit * WEIGHTS.lensFit +
    lowLight * WEIGHTS.lowLight +
    featureMatch * WEIGHTS.featureMatch +
    budget * WEIGHTS.budget;
  return { pixelDensity, lensFit, lowLight, featureMatch, budget, total };
}

// ---------------------------------------------------------------------------
// Explanations
// ---------------------------------------------------------------------------

function explain(calc: CameraCalculation, location: Location, score: ScoreBreakdown): string {
  const cam = calc.camera;
  const parts: string[] = [];

  parts.push(
    `At ${calc.appliedFocalLengthMm.toFixed(1)} mm this covers ${calc.deliveredSceneWidthMetres.toFixed(1)} m of scene at ${location.geometry.targetDistanceMetres.toFixed(1)} m, giving ${calc.pixelDensity.achievedPxPerMetre.toFixed(0)} px/m against the ${calc.pixelDensity.requiredPxPerMetre.toFixed(0)} px/m this purpose needs`,
  );
  if (calc.pixelDensity.ratio >= USEFUL_DENSITY_RATIO_CEILING) {
    parts.push(
      `that is more than double the requirement, so there is room to pull the lens back or move the camera further out`,
    );
  }
  if (cam.capabilities.includes('colorvu')) {
    parts.push(
      `ColorVu keeps the image in colour after dark, which is what the client asked for and what makes a description usable`,
    );
  } else if (cam.capabilities.includes('smart-hybrid-light')) {
    parts.push(
      `Smart Hybrid Light gives the choice of covert IR or colour-on-event, rather than committing to one`,
    );
  }
  if (calc.illumination.verdict === 'pass' && calc.illumination.publishedRangeMetres !== null) {
    parts.push(
      `the ${calc.illumination.publishedRangeMetres} m supplement light comfortably covers the ${location.geometry.targetDistanceMetres.toFixed(1)} m target`,
    );
  }
  if (cam.lensType !== 'fixed') {
    parts.push(
      `the motorised lens means the field of view can be set from the browser at commissioning instead of being fixed by the order`,
    );
  }
  if (score.featureMatch >= 0.8) {
    parts.push(`and it carries the analytics this location calls for`);
  }

  return `${parts.join('; ')}.`;
}

function weakPoint(calc: CameraCalculation, location: Location): string {
  const cam = calc.camera;

  if (calc.pixelDensity.verdict === 'marginal') {
    return `Pixel density is only ${Math.round((calc.pixelDensity.ratio - 1) * 100)}% above the requirement. Rain, motion blur or a dirty lens will push it under — do not promise this one at the edge of the scene.`;
  }
  if (calc.illumination.verdict === 'fail') {
    return `The supplement light does not reach the target, so the far end of this scene will be dark at night.`;
  }
  if (calc.illumination.verdict === 'marginal') {
    return `The target sits at the edge of the published light range: expect a dim, noisy image at the far end after dark.`;
  }
  if (cam.supplementLight === 'white' && location.environment.ambientLight !== 'well-lit-24-7') {
    return `White light only, no IR. If the client turns the light off at night — or a neighbour complains about it — the camera is blind.`;
  }
  if (cam.ikRating === null && location.environment.site !== 'indoor') {
    return `No IK rating is published, so this is not the model for a reachable, exposed position.`;
  }
  if (cam.poeStandard === '802.3at') {
    return `Needs an 802.3at (PoE+) port. It will not run on a plain 802.3af switch, so check the switch before quoting.`;
  }
  if (cam.wdrDb === null) {
    return `Digital WDR only — no dB figure is published. Avoid it facing a doorway or a window.`;
  }
  if (calc.pixelDensity.ratio > 3) {
    return `Considerably more resolution than this scene needs, which the client pays for twice: once in the camera and again in storage (${calc.storageGbForRetention.toFixed(0)} GB per camera over ${location.requirements.retentionDays} days).`;
  }
  if (cam.lensType === 'fixed') {
    return `Fixed lens: if the measured distance on site differs from the survey, the only fix is a different camera.`;
  }
  return `Nothing disqualifying, but the model carries no deterrent features — no strobe, no siren — if that matters to the client.`;
}

function labelAlternative(
  alt: CameraCalculation,
  altScore: ScoreBreakdown,
  primary: CameraCalculation,
  primaryScore: ScoreBreakdown,
  used: Set<TradeOffLabel>,
): TradeOffLabel {
  const order = { economy: 0, standard: 1, premium: 2 } as const;
  const candidates: TradeOffLabel[] = [];

  if (order[alt.camera.priceTier] < order[primary.camera.priceTier]) candidates.push('budget option');
  if (altScore.lowLight > primaryScore.lowLight + 0.05) candidates.push('better in low light');
  if (alt.camera.lensType !== 'fixed' && primary.camera.lensType === 'fixed') {
    candidates.push('more flexible lens');
  }
  if (alt.pixelDensity.ratio > primary.pixelDensity.ratio * 1.2) {
    candidates.push('higher resolution headroom');
  }
  if (
    alt.camera.capabilities.includes('strobe-light') &&
    !primary.camera.capabilities.includes('strobe-light')
  ) {
    candidates.push('stronger deterrent');
  }

  for (const c of candidates) {
    if (!used.has(c)) {
      used.add(c);
      return c;
    }
  }
  return 'closest alternative';
}

// ---------------------------------------------------------------------------
// No-result path
// ---------------------------------------------------------------------------

function bindingConstraint(rejections: readonly Rejection[]): string | null {
  if (rejections.length === 0) return null;
  const counts = new Map<Rejection['constraint'], number>();
  for (const r of rejections) counts.set(r.constraint, (counts.get(r.constraint) ?? 0) + 1);
  const worst = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!worst) return null;
  const example = rejections.find((r) => r.constraint === worst[0]);
  return `${worst[1]} of ${rejections.length} models were ruled out on the same constraint: ${example?.reason ?? worst[0]}`;
}

function suggestFixes(location: Location, nearMisses: readonly NearMiss[]): string[] {
  const fixes: string[] = [];
  const g = location.geometry;
  const scenario = calculateScenario(location);

  const best = nearMisses[0];
  if (best && best.calculation.pixelDensity.verdict === 'fail') {
    const ratio = best.calculation.pixelDensity.ratio;
    const closerDistance = g.targetDistanceMetres * ratio;
    const narrowerWidth = scenario.sceneWidthMetres * ratio;
    fixes.push(
      `Move the camera closer: the best candidate holds the required density out to about ${closerDistance.toFixed(1)} m, not ${g.targetDistanceMetres.toFixed(1)} m.`,
    );
    fixes.push(
      `Or narrow the scene to about ${narrowerWidth.toFixed(1)} m and use a second camera for the rest of the width.`,
    );
    if (location.purpose === 'identify') {
      fixes.push(
        'Or accept "recognise" instead of "identify" here (125 px/m rather than 250), and put one identify-grade camera on the choke point where everyone has to pass.',
      );
    }
    if (location.purpose === 'lpr') {
      fixes.push(
        'For ANPR, the usual fix is a dedicated plate camera on a tight lens at a low angle, separate from the overview camera.',
      );
    }
  }

  if (location.requirements.lensPreference === 'fixed') {
    fixes.push('Allowing a varifocal or motorised lens would open up the models that can be dialled in on site.');
  }
  if (location.requirements.budgetTier !== 'any') {
    fixes.push(`Relaxing the ${location.requirements.budgetTier} budget tier would bring in higher-specification models.`);
  }
  if (location.environment.vandalExposure) {
    fixes.push('Dropping the IK10 requirement — or mounting out of reach instead — would widen the choice considerably.');
  }
  if (location.environment.colourAtNight) {
    fixes.push('If monochrome at night is acceptable, the IR-only models become available and are cheaper.');
  }
  if (fixes.length === 0) {
    fixes.push('Loosen one of the hard constraints above, or split the coverage across two cameras.');
  }
  return fixes;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** Every (camera, lens) pair, since a lens choice is a real procurement decision. */
function candidatePairs(pool: readonly Camera[]): { camera: Camera; lens: LensOption }[] {
  const pairs: { camera: Camera; lens: LensOption }[] = [];
  for (const camera of pool) {
    for (const lens of camera.lensOptions) pairs.push({ camera, lens });
  }
  return pairs;
}

export function recommend(
  location: Location,
  pool: readonly Camera[] = cameras,
): RecommendationResult {
  let scenario: ScenarioResult;
  try {
    scenario = calculateScenario(location);
  } catch (err) {
    if (err instanceof ScenarioError) {
      return {
        scenario: {
          purpose: location.purpose,
          requiredPxPerMetre: 0,
          requiredPxPerMetreIsEstimate: false,
          sceneWidthMetres: 0,
          targetDistanceMetres: 0,
          requiredHorizontalFovDeg: 0,
          requiredHorizontalPixels: 0,
          rows: [],
        },
        primary: null,
        alternatives: [],
        rejections: [],
        nearMisses: [],
        suggestedFixes: [],
        error: err.message,
      };
    }
    throw err;
  }

  const rejections: Rejection[] = [];
  const survivors: Camera[] = [];
  for (const camera of pool) {
    const rejection = rejectForConstraints(camera, location);
    if (rejection) rejections.push(rejection);
    else survivors.push(camera);
  }

  const scored: { calc: CameraCalculation; score: ScoreBreakdown }[] = [];
  for (const { camera, lens } of candidatePairs(survivors)) {
    let calc: CameraCalculation;
    try {
      calc = calculateForCamera(location, scenario, camera, lens);
    } catch (err) {
      if (err instanceof ScenarioError) {
        rejections.push({
          cameraId: camera.id,
          model: `${camera.model} (${lens.label})`,
          constraint: 'optics-unavailable',
          reason: err.message,
        });
        continue;
      }
      throw err;
    }
    scored.push({ calc, score: scoreCamera(calc, location) });
  }

  // Only one lens per model in the results — the best-scoring one. Showing the
  // same camera three times with different lenses is noise, not choice.
  const bestPerModel = new Map<string, { calc: CameraCalculation; score: ScoreBreakdown }>();
  for (const entry of scored) {
    const existing = bestPerModel.get(entry.calc.camera.id);
    if (!existing || entry.score.total > existing.score.total) {
      bestPerModel.set(entry.calc.camera.id, entry);
    }
  }

  const ranked = [...bestPerModel.values()].sort((a, b) => {
    // A passing model always outranks a failing one, whatever else it scores.
    const aPass = a.calc.pixelDensity.verdict !== 'fail';
    const bPass = b.calc.pixelDensity.verdict !== 'fail';
    if (aPass !== bPass) return aPass ? -1 : 1;
    if (Math.abs(b.score.total - a.score.total) > 1e-9) return b.score.total - a.score.total;
    // Deterministic tie-break so the same inputs always give the same order.
    return a.calc.camera.id.localeCompare(b.calc.camera.id);
  });

  // Pixel density is the gate, and it is the only gate. A lens that is "too wide"
  // for the stated scene still sees the target — it just shows more of the
  // surroundings — and that cost is already priced into the achieved px/m. Lens
  // fit stays in the score, where it belongs, rather than vetoing a model that
  // meets the operational requirement.
  const viable = ranked.filter((r) => r.calc.pixelDensity.verdict !== 'fail');

  if (viable.length === 0) {
    const nearMisses: NearMiss[] = ranked.slice(0, 4).map(({ calc, score }) => ({
      calculation: calc,
      score,
      shortfall:
        calc.pixelDensity.verdict === 'fail'
          ? `${calc.pixelDensity.achievedPxPerMetre.toFixed(0)} px/m against ${calc.pixelDensity.requiredPxPerMetre.toFixed(0)} px/m required — short by ${Math.round((1 - calc.pixelDensity.ratio) * 100)}%.`
          : (calc.lensFit?.explanation ?? 'Optics could not be evaluated for this model.'),
    }));

    const fixes = suggestFixes(location, nearMisses);
    const binding = bindingConstraint(rejections);

    return {
      scenario,
      primary: null,
      alternatives: [],
      rejections,
      nearMisses,
      suggestedFixes: binding ? [binding, ...fixes] : fixes,
      error: null,
    };
  }

  const [top, ...rest] = viable;
  if (!top) throw new Error('unreachable: viable list is non-empty');

  const primary: Recommendation = {
    calculation: top.calc,
    score: top.score,
    label: 'primary recommendation',
    why: explain(top.calc, location, top.score),
    weakPoint: weakPoint(top.calc, location),
  };

  const usedLabels = new Set<TradeOffLabel>();
  const alternatives: Recommendation[] = rest.slice(0, 3).map(({ calc, score }) => ({
    calculation: calc,
    score,
    label: labelAlternative(calc, score, top.calc, top.score, usedLabels),
    why: explain(calc, location, score),
    weakPoint: weakPoint(calc, location),
  }));

  return { scenario, primary, alternatives, rejections, nearMisses: [], suggestedFixes: [], error: null };
}
