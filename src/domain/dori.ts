/**
 * Required pixel density by operational purpose.
 *
 * ## Sources
 *
 * The four DORI levels are defined by IEC 62676-4:2014 *Video surveillance systems
 * for use in security applications — Part 4: Application guidelines*. The standard
 * itself is paywalled; the figures below are taken from Axis Communications'
 * white paper "Pixel density based on IEC 62676-4:2014", which reproduces the
 * standard's table:
 *
 *   https://whitepapers.axis.com/en/pixel-density-based-on-iec-62676-4-2014
 *
 *   | Operational requirement | px/face | px/m | px/ft |
 *   |-------------------------|---------|------|-------|
 *   | Detection               |       4 |   25 |     8 |
 *   | Observation             |      10 |   63 |    20 |
 *   | Recognition             |      20 |  125 |    40 |
 *   | Identification          |      40 |  250 |    80 |
 *
 * Verified 2026-10-04.
 *
 * ## What is NOT in the standard
 *
 * "Monitor / crowd overview" at 12.5 px/m is a widely-repeated industry
 * convention (half of Detect) but it is **not** one of the IEC 62676-4 levels —
 * the standard defines four, not five. It is therefore flagged `isEstimate: true`
 * and surfaced with a visible "unverified" badge in the UI.
 *
 * "Cash/till overwatch" is likewise not a standard level. It is treated here as
 * identification-grade (250 px/m) because the operational need is the same
 * (court-admissible identification of a person handling money) — also flagged as
 * an estimate rather than a sourced figure.
 *
 * ## Licence-plate capture
 *
 * ANPR/LPR is specified as pixels across the *plate width*, not px/m of scene.
 * Milestone Systems' LPR plate-width recommendations (which mirror the figures
 * used across the ANPR industry) give:
 *
 *   https://doc.milestonesys.com/2025r2/en-US/add-ons/add-on_lpr/lpr_platewidthrecommendat.htm
 *
 *   | Plate            | Plate width | Stopped, progressive | Moving, interlaced |
 *   |------------------|-------------|----------------------|--------------------|
 *   | Single-line US   | 12 in       | 130 px               | 215 px             |
 *   | Single-line EU   | 52 cm       | 170 px               | 280 px             |
 *
 *   "The resolution for best LPR performance should be at least 2.7 pixels/stroke."
 *
 * Verified 2026-10-04. Converting to px/m of scene: a 0.52 m EU plate needing
 * 170 px across it requires 170 / 0.52 ≈ 327 px/m. That is the figure the engine
 * compares against, so LPR lands on the same scale as the DORI levels.
 */

import { pxPerMetreToPxPerFoot } from './units.ts';

export const DORI_SOURCE_URL =
  'https://whitepapers.axis.com/en/pixel-density-based-on-iec-62676-4-2014';

export const LPR_SOURCE_URL =
  'https://doc.milestonesys.com/2025r2/en-US/add-ons/add-on_lpr/lpr_platewidthrecommendat.htm';

export const SOURCES_VERIFIED_ON = '2026-10-04';

export type Purpose =
  | 'monitor'
  | 'detect'
  | 'observe'
  | 'recognise'
  | 'identify'
  | 'lpr'
  | 'till';

export interface PurposeSpec {
  readonly id: Purpose;
  readonly label: string;
  /** What the engineer should tell the client this level actually delivers. */
  readonly helper: string;
  /** Required horizontal pixel density across the scene, px per metre. */
  readonly requiredPxPerMetre: number;
  /** Pixels across a human face at that density, where the standard gives one. */
  readonly pxPerFace: number | null;
  /** True when the figure is NOT traceable to IEC 62676-4 and must be shown as unverified. */
  readonly isEstimate: boolean;
  readonly sourceUrl: string;
  readonly sourceNote: string;
}

/** Plate-width geometry used to derive the LPR px/m figure. */
export const LPR_PLATE = {
  /** Single-line European plate width, metres (52 cm). */
  plateWidthMetres: 0.52,
  /** Minimum pixels across the plate, stopped vehicle, progressive scan. */
  minPixelsAcrossPlateStopped: 130,
  /** Minimum pixels across the plate for a moving vehicle (interlaced worst case). */
  minPixelsAcrossPlateMoving: 280,
  /** The figure the engine uses: EU plate, stopped, progressive scan. */
  designPixelsAcrossPlate: 170,
} as const;

/** 170 px across a 0.52 m plate = 326.9 px/m. */
export const LPR_REQUIRED_PX_PER_METRE =
  LPR_PLATE.designPixelsAcrossPlate / LPR_PLATE.plateWidthMetres;

export const PURPOSES: readonly PurposeSpec[] = [
  {
    id: 'monitor',
    label: 'Monitor / crowd overview',
    helper: 'See that an area is busy or empty. No useful detail on individuals.',
    requiredPxPerMetre: 12.5,
    pxPerFace: null,
    isEstimate: true,
    sourceUrl: DORI_SOURCE_URL,
    sourceNote:
      'Industry convention (half of Detect). NOT one of the four IEC 62676-4 levels — treat as an estimate.',
  },
  {
    id: 'detect',
    label: 'Detect',
    helper: 'Tell with a high degree of certainty that a person or vehicle is present.',
    requiredPxPerMetre: 25,
    pxPerFace: 4,
    isEstimate: false,
    sourceUrl: DORI_SOURCE_URL,
    sourceNote: 'IEC 62676-4:2014 — Detection, 25 px/m (4 px across a face).',
  },
  {
    id: 'observe',
    label: 'Observe',
    helper: 'See characteristic details — clothing, what someone is carrying, behaviour.',
    requiredPxPerMetre: 63,
    pxPerFace: 10,
    isEstimate: false,
    sourceUrl: DORI_SOURCE_URL,
    sourceNote: 'IEC 62676-4:2014 — Observation, 63 px/m (10 px across a face).',
  },
  {
    id: 'recognise',
    label: 'Recognise',
    helper: 'Recognise someone you already know, with a high degree of certainty.',
    requiredPxPerMetre: 125,
    pxPerFace: 20,
    isEstimate: false,
    sourceUrl: DORI_SOURCE_URL,
    sourceNote: 'IEC 62676-4:2014 — Recognition, 125 px/m (20 px across a face).',
  },
  {
    id: 'identify',
    label: 'Identify',
    helper: 'Identify a stranger to a standard a court will accept.',
    requiredPxPerMetre: 250,
    pxPerFace: 40,
    isEstimate: false,
    sourceUrl: DORI_SOURCE_URL,
    sourceNote: 'IEC 62676-4:2014 — Identification, 250 px/m (40 px across a face).',
  },
  {
    id: 'lpr',
    label: 'Licence-plate capture (ANPR)',
    helper:
      'Read a number plate reliably. Needs far more pixels than face identification and a tight, low-angle shot.',
    requiredPxPerMetre: LPR_REQUIRED_PX_PER_METRE,
    pxPerFace: null,
    isEstimate: false,
    sourceUrl: LPR_SOURCE_URL,
    sourceNote:
      '170 px across a 0.52 m single-line EU plate (stopped vehicle, progressive scan) = 327 px/m.',
  },
  {
    id: 'till',
    label: 'Cash / till overwatch',
    helper:
      'Identify the person at the till and see the denomination of notes. Identification-grade or better.',
    requiredPxPerMetre: 250,
    pxPerFace: 40,
    isEstimate: true,
    sourceUrl: DORI_SOURCE_URL,
    sourceNote:
      'Not a standard level. Mapped to identification-grade 250 px/m because the operational need is the same — treat as an estimate.',
  },
];

const BY_ID = new Map<Purpose, PurposeSpec>(PURPOSES.map((p) => [p.id, p]));

export function purposeSpec(id: Purpose): PurposeSpec {
  const spec = BY_ID.get(id);
  if (!spec) {
    // Unreachable while `Purpose` and `PURPOSES` stay in step; guard the boundary anyway.
    throw new Error(`Unknown surveillance purpose: ${String(id)}`);
  }
  return spec;
}

export function requiredPxPerMetre(id: Purpose): number {
  return purposeSpec(id).requiredPxPerMetre;
}

export function requiredPxPerFoot(id: Purpose): number {
  return pxPerMetreToPxPerFoot(requiredPxPerMetre(id));
}

/**
 * The distance at which a given camera still meets a purpose, from the DORI
 * distances a Hikvision datasheet quotes. Datasheets publish D/O/R/I distances
 * directly, so where we have them we can cross-check our own geometry.
 */
export interface DatasheetDoriDistances {
  readonly detectMetres: number | null;
  readonly observeMetres: number | null;
  readonly recogniseMetres: number | null;
  readonly identifyMetres: number | null;
}

export function datasheetDoriDistance(
  distances: DatasheetDoriDistances,
  purpose: Purpose,
): number | null {
  switch (purpose) {
    case 'detect':
      return distances.detectMetres;
    case 'observe':
      return distances.observeMetres;
    case 'recognise':
      return distances.recogniseMetres;
    case 'identify':
    case 'till':
      return distances.identifyMetres;
    case 'monitor':
    case 'lpr':
      // No datasheet equivalent — monitor is below the published range and LPR is
      // a different measurement entirely.
      return null;
  }
}
